import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as api from '../../src/index.js';
import { bake, evaluateEntity, motionLinter, validateScene } from '../../src/index.js';
import type { BakedData, Finding, LinterOptions, OutBuffer, Scene } from '../../src/index.js';
import { buildFixture, quatAboutAxis } from '../helpers/baked-builder.js';
import type { FixtureEntity } from '../helpers/baked-builder.js';
import {
  arbAimAtScene,
  arbCoincidentAimCase,
  arbFollowPathScene,
  arbPathEndScene,
  arbValidScene,
} from '../helpers/scene-generators.js';

// Feature: path-core, Property 37: No NaN in any output
// **Validates: Requirements 7.14**

// Everything here goes through the public entry point src/index.ts only. Every number in the baked data, in every
// evaluateEntity output and in every linter Finding must be finite, for every roll threshold in the list below
// (including NaN and the infinities). Per-frame checks are plain comparisons that throw; expect is used once per run.

const EXPECTED_EXPORTS = [
  'add', 'sub', 'scale', 'dot', 'cross', 'length', 'normalize', 'lerp',
  'quatFromBasis', 'quatMul', 'quatInverse', 'rotateVec', 'slerp', 'quatAngle',
  'createCurve', 'createArcLengthTable', 'rotationMinimizingFrames', 'frenetFrames',
  'axisVector', 'validateScene', 'SceneError', 'bake', 'evaluateEntity', 'motionLinter',
];

/** Roll thresholds in degrees per frame. undefined means no options object at all. */
const ROLL_THRESHOLDS: readonly (number | undefined)[] = [
  undefined, 0, 1, 15, 179.9, 360, 1e6, Infinity, -Infinity, NaN,
];

const FINDING_CODES = ['path-end-reached', 'roll-change', 'speed-spike', 'aim-vertical', 'rotation-conflict'] as const;
const BAD_TEXT = ['NaN', 'Infinity', 'undefined'] as const;

/** Computed here, not imported: the vertical cone half-angle is 3 degrees. */
const VERTICAL_COS_TEST = Math.cos((3 * Math.PI) / 180);

interface Counters {
  scenes: number;
  coincidentAim: number;
  verticalAim: number;
  influenceZero: number;
  speedZero: number;
  held: number;
  closed: number;
  findings: Record<string, number>;
}

function newCounters(): Counters {
  const findings: Record<string, number> = {};
  for (const code of FINDING_CODES) findings[code] = 0;
  return { scenes: 0, coincidentAim: 0, verticalAim: 0, influenceZero: 0, speedZero: 0, held: 0, closed: 0, findings };
}

function newOut(): OutBuffer {
  return { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
}

function requireFinite(label: string, what: string, value: number): void {
  if (!Number.isFinite(value)) throw new Error(`${label}: ${what} is not finite, got ${value}`);
}

function checkArray(label: string, what: string, entityId: string, values: ArrayLike<number>): void {
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) {
      throw new Error(`${label}: entity ${entityId} ${what}[${i}] is not finite, got ${values[i]}`);
    }
  }
}

function checkBaked(label: string, baked: BakedData): void {
  requireFinite(label, 'baked.fps', baked.fps);
  requireFinite(label, 'baked.frameCount', baked.frameCount);
  for (let e = 0; e < baked.entityIds.length; e++) {
    const id = baked.entityIds[e];
    checkArray(label, 'transforms', id, baked.transforms[e]);
    checkArray(label, 'travelled', id, baked.travelled[e]);
    checkArray(label, 'aimDirections', id, baked.aimDirections[e]);
    requireFinite(label, `entity ${id} heldFromFrame`, baked.heldFromFrame[e]);
    requireFinite(label, `entity ${id} rotationDrivers`, baked.rotationDrivers[e]);
  }
}

function checkEvaluate(label: string, baked: BakedData, out: OutBuffer): void {
  for (const id of baked.entityIds) {
    for (let f = 0; f < baked.frameCount; f++) {
      evaluateEntity(baked, id, f, out);
      const where = `evaluateEntity(${id}, frame ${f})`;
      requireFinite(label, `${where} position.x`, out.position.x);
      requireFinite(label, `${where} position.y`, out.position.y);
      requireFinite(label, `${where} position.z`, out.position.z);
      requireFinite(label, `${where} rotation.x`, out.rotation.x);
      requireFinite(label, `${where} rotation.y`, out.rotation.y);
      requireFinite(label, `${where} rotation.z`, out.rotation.z);
      requireFinite(label, `${where} rotation.w`, out.rotation.w);
    }
  }
}

function checkFindings(label: string, threshold: number | undefined, baked: BakedData, findings: readonly Finding[], counters: Counters): void {
  const t = `threshold ${threshold === undefined ? 'omitted' : String(threshold)}`;
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    const where = `${label}: ${t} finding ${i} (${f.code}, entity ${f.entityId}, frame ${f.frame})`;
    if (!Number.isInteger(f.frame) || f.frame < 0 || f.frame > baked.frameCount - 1) {
      throw new Error(`${where}: frame is not an integer in [0, ${baked.frameCount - 1}], got ${f.frame}`);
    }
    if (typeof f.entityId !== 'string') throw new Error(`${where}: entityId is not a string, got ${String(f.entityId)}`);
    if (typeof f.code !== 'string') throw new Error(`${where}: code is not a string, got ${String(f.code)}`);
    if (typeof f.message !== 'string') throw new Error(`${where}: message is not a string, got ${String(f.message)}`);
    for (const bad of BAD_TEXT) {
      if (f.message.includes(bad)) throw new Error(`${where}: message contains "${bad}": ${f.message}`);
    }
    counters.findings[f.code] = (counters.findings[f.code] ?? 0) + 1;
  }
}

/** Counts the regimes a scene and its baked data actually contain. */
function countRegimes(scene: Scene, baked: BakedData, counters: Counters): void {
  counters.scenes++;
  if (scene.path.closed) counters.closed++;
  for (const entity of scene.entities) {
    const e = baked.entityIndex.get(entity.id);
    if (e === undefined) throw new Error(`entity ${entity.id} missing from baked data`);
    if (baked.heldFromFrame[e] >= 0) counters.held++;
    let hasAim = false;
    for (const c of entity.constraints) {
      if (c.influence === 0) counters.influenceZero++;
      if (c.type === 'followPath' && c.speed === 0) counters.speedZero++;
      if (c.type === 'aimAt') hasAim = true;
    }
    if (!hasAim) continue;
    const aims = baked.aimDirections[e];
    for (let f = 0; f < baked.frameCount; f++) {
      const x = aims[f * 3];
      const y = aims[f * 3 + 1];
      const z = aims[f * 3 + 2];
      if (x === 0 && y === 0 && z === 0) counters.coincidentAim++;
      else if (Math.abs(y) >= VERTICAL_COS_TEST) counters.verticalAim++;
    }
  }
}

/** Runs the lint step at every threshold and checks the findings. */
function lintAtEveryThreshold(label: string, scene: Scene, baked: BakedData, counters: Counters): void {
  for (const threshold of ROLL_THRESHOLDS) {
    const options: LinterOptions | undefined = threshold === undefined ? undefined : { rollThresholdDegPerFrame: threshold };
    const findings = motionLinter(scene, baked, options);
    checkFindings(label, threshold, baked, findings, counters);
  }
}

/** Real bake, then every check. */
function checkScene(label: string, scene: Scene, counters: Counters, out: OutBuffer): void {
  const baked = bake(scene);
  checkBaked(label, baked);
  checkEvaluate(label, baked, out);
  countRegimes(scene, baked, counters);
  lintAtEveryThreshold(label, scene, baked, counters);
}

/** Hand-built baked data: no bake step, same checks otherwise. */
function checkFixture(label: string, scene: Scene, baked: BakedData, counters: Counters, out: OutBuffer): void {
  checkBaked(label, baked);
  checkEvaluate(label, baked, out);
  countRegimes(scene, baked, counters);
  lintAtEveryThreshold(label, scene, baked, counters);
}

// ---------------------------------------------------------------------------
// Fixed scenes
// ---------------------------------------------------------------------------

const OPEN_POINTS = [
  { x: 0, y: 0, z: 0 },
  { x: 10, y: 0, z: 0 },
  { x: 10, y: 5, z: 0 },
  { x: 4, y: 5, z: 3 },
];
const CLOSED_POINTS = [
  { x: 0, y: 0, z: 0 },
  { x: 10, y: 0, z: 0 },
  { x: 10, y: 0, z: 10 },
  { x: 0, y: 2, z: 10 },
];
const DEG = Math.PI / 180;

function follow(order: number, influence: number, speed: number, startOffset: number, alignToPath: boolean): Scene['entities'][number]['constraints'][number] {
  return { type: 'followPath', order, influence, speed, startOffset, alignToPath };
}

function aim(order: number, influence: number, target: string): Scene['entities'][number]['constraints'][number] {
  return { type: 'aimAt', order, influence, target };
}

function sceneOf(
  frameCount: number,
  closed: boolean,
  targets: Scene['targets'],
  entities: Scene['entities'],
): Scene {
  return { fps: 30, frameCount, path: { points: closed ? CLOSED_POINTS : OPEN_POINTS, closed }, targets, entities };
}

function entityOf(id: string, constraints: Scene['entities'][number]['constraints']): Scene['entities'][number] {
  return { id, forwardAxis: '+Z', upAxis: '+Y', constraints };
}

const FIXED_SCENES: { label: string; scene: Scene }[] = [
  {
    // (1) coincident aim: the target equals the entity position (the origin) on frames 0 and 2
    label: 'coincident aim',
    scene: sceneOf(
      3,
      false,
      {
        goal: {
          keyframes: [
            { frame: 0, position: { x: 0, y: 0, z: 0 } },
            { frame: 1, position: { x: 0, y: 0, z: 5 } },
            { frame: 2, position: { x: 0, y: 0, z: 0 } },
          ],
        },
      },
      [entityOf('aimer', [aim(0, 1, 'goal')])],
    ),
  },
  {
    // (2) near-vertical aim: straight above, then 2 degrees from vertical, then straight above and below
    label: 'near-vertical aim',
    scene: sceneOf(
      5,
      false,
      {
        goal: {
          keyframes: [
            { frame: 0, position: { x: 0, y: 10, z: 0 } },
            { frame: 1, position: { x: 0, y: 10 * Math.cos(2 * DEG), z: 10 * Math.sin(2 * DEG) } },
            { frame: 2, position: { x: 0, y: 10, z: 0 } },
            { frame: 3, position: { x: 10 * Math.sin(2 * DEG), y: 10 * Math.cos(2 * DEG), z: 0 } },
            { frame: 4, position: { x: 0, y: -10, z: 0 } },
          ],
        },
      },
      [entityOf('aimer', [aim(0, 1, 'goal')])],
    ),
  },
  {
    // (3) influence 0 on a followPath and on an aimAt, with rotation drivers
    label: 'influence 0',
    scene: sceneOf(
      6,
      false,
      { up: { x: 0, y: 10, z: 0 } },
      [
        entityOf('zero-follow', [follow(0, 0, 3, 1, true)]),
        entityOf('zero-aim', [follow(0, 1, 2, 0, true), aim(1, 0, 'up')]),
      ],
    ),
  },
  {
    // (4) followPath with speed 0
    label: 'speed 0',
    scene: sceneOf(4, false, {}, [entityOf('still', [follow(0, 1, 0, 3, true)])]),
  },
  {
    // (5) open path end reached (heldFromFrame >= 0), start offset beyond the end on a second entity
    label: 'path end reached',
    scene: sceneOf(8, false, {}, [
      entityOf('runner', [follow(0, 1, 100, 0, true)]),
      entityOf('beyond', [follow(0, 1, 1, 1000, true)]),
    ]),
  },
  {
    // (6) closed path, several laps (about 40 m long, 60 frames at 50 m/s and 30 fps is 100 m)
    label: 'closed path laps',
    scene: sceneOf(60, true, { c: { x: 5, y: 1, z: 5 } }, [
      entityOf('lapper', [follow(0, 1, 50, 0, true)]),
      entityOf('backwards', [follow(0, 1, -50, 7, true), aim(1, 1, 'c')]),
    ]),
  },
  {
    // (8) frameCount 1
    label: 'frameCount 1',
    scene: sceneOf(1, false, { up: { x: 0, y: 10, z: 0 } }, [
      entityOf('single', [follow(0, 1, 5, 0, true), aim(1, 1, 'up')]),
    ]),
  },
];

/** (7) hand-built baked data: one entity per linter code. */
function buildLinterFixture(): { scene: Scene; baked: BakedData } {
  const frames = 10;
  const spikePositions: [number, number, number][] = [];
  for (let f = 0; f < frames; f++) spikePositions.push([f < 5 ? f : f + 95, 0, 0]);
  const aimDirections: [number, number, number][] = [
    [0, 0, 0],
    [0, 1, 0],
    [0, Math.cos(2 * DEG), Math.sin(2 * DEG)],
    [0, -1, 0],
    [1, 0, 0],
  ];
  const entities: FixtureEntity[] = [
    { id: 'spike', positions: spikePositions },
    { id: 'roll', rotations: [quatAboutAxis('z', 0), quatAboutAxis('z', 90), quatAboutAxis('z', 90), quatAboutAxis('z', -120)] },
    { id: 'vertical', aimDirections },
    { id: 'conflict', rotationDrivers: 3 },
    { id: 'held', heldFromFrame: 4, positions: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0], [4, 0, 0]] },
  ];
  return buildFixture(frames, 30, entities);
}

let fixedCache: Counters | undefined;

/** Runs all fixed scenes once and returns their counters. */
function fixedCounters(): Counters {
  if (fixedCache !== undefined) return fixedCache;
  const counters = newCounters();
  const out = newOut();
  for (const item of FIXED_SCENES) {
    validateScene(item.scene);
    checkScene(`fixed scene "${item.label}"`, item.scene, counters, out);
  }
  const fixture = buildLinterFixture();
  checkFixture('fixture (hand-built baked data)', fixture.scene, fixture.baked, counters, out);
  fixedCache = counters;
  return counters;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 37: No NaN in any output', () => {
  it('exports exactly the expected runtime names and not VERTICAL_COS', () => {
    const actual = Object.keys(api).sort();
    const expected = [...EXPECTED_EXPORTS].sort();
    for (const name of actual) {
      if (!expected.includes(name)) throw new Error(`src/index.ts exports an unexpected name "${name}"`);
    }
    for (const name of expected) {
      if (!actual.includes(name)) throw new Error(`src/index.ts is missing the export "${name}"`);
    }
    expect(actual.length).toBe(expected.length);
    expect('VERTICAL_COS' in api).toBe(false);
  });

  it('every number in baked data, evaluateEntity output and findings is finite, for every roll threshold', () => {
    const counters = newCounters();
    const out = newOut();
    let runs = 0;
    const arbScene: fc.Arbitrary<Scene> = fc.oneof(
      arbValidScene,
      arbAimAtScene,
      arbCoincidentAimCase.map((c) => c.scene),
      arbPathEndScene,
      arbFollowPathScene({ allowAlign: true }),
    );
    fc.assert(
      fc.property(arbScene, (scene) => {
        runs++;
        checkScene(`run ${runs}`, scene, counters, out);
      }),
      { numRuns: 100 },
    );
    const fixed = fixedCounters();

    expect(runs).toBeGreaterThanOrEqual(100);
    // Regimes the generators supply on their own.
    expect(counters.coincidentAim).toBeGreaterThan(0);
    expect(counters.influenceZero).toBeGreaterThan(0);
    expect(counters.speedZero).toBeGreaterThan(0);
    expect(counters.held).toBeGreaterThan(0);
    expect(counters.closed).toBeGreaterThan(0);
    expect(counters.findings['path-end-reached']).toBeGreaterThan(0);
    expect(counters.findings['rotation-conflict']).toBeGreaterThan(0);
    // Regimes random scenes rarely or never produce: random runs plus the fixed scenes.
    expect(counters.verticalAim + fixed.verticalAim).toBeGreaterThan(0);
    expect(counters.findings['aim-vertical'] + fixed.findings['aim-vertical']).toBeGreaterThan(0);
    expect(counters.findings['roll-change'] + fixed.findings['roll-change']).toBeGreaterThan(0);
    expect(counters.findings['speed-spike'] + fixed.findings['speed-spike']).toBeGreaterThan(0);
  });

  it('fixed scenes alone cover every regime and all five finding codes', () => {
    const fixed = fixedCounters();
    expect(fixed.scenes).toBe(FIXED_SCENES.length + 1);
    expect(fixed.coincidentAim).toBeGreaterThan(0);
    expect(fixed.verticalAim).toBeGreaterThan(0);
    expect(fixed.influenceZero).toBeGreaterThan(0);
    expect(fixed.speedZero).toBeGreaterThan(0);
    expect(fixed.held).toBeGreaterThan(0);
    expect(fixed.closed).toBeGreaterThan(0);
    for (const code of FINDING_CODES) expect(fixed.findings[code]).toBeGreaterThan(0);
  });
});
