import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createArcLengthTable } from '../../src/arclength.js';
import { bake } from '../../src/bake.js';
import type { BakedData } from '../../src/bake.js';
import { createCurve } from '../../src/curve.js';
import { motionLinter } from '../../src/linter.js';
import type { Finding } from '../../src/linter.js';
import type { Vec3 } from '../../src/math.js';
import type { Constraint, Entity, Scene } from '../../src/scene.js';
import { arbPointList } from '../helpers/basic-generators.js';

// Feature: path-core, Property 39: path-end-reached is never emitted on closed paths
// **Validates: Requirements 8.5**

/** Path length built separately from bake: its own curve and arc-length table. */
function pathLength(points: Vec3[], closed: boolean): number {
  return createArcLengthTable(createCurve(points, closed)).length;
}

function endFindings(findings: readonly Finding[]): Finding[] {
  return findings.filter((x) => x.code === 'path-end-reached');
}

function describeFindings(list: readonly Finding[]): string {
  return JSON.stringify(list.map((x) => ({ frame: x.frame, severity: x.severity, entityId: x.entityId })));
}

/** Plain checks for one scene: no entity is held and the linter reports no path-end-reached. */
function checkClosedScene(label: string, scene: Scene): void {
  const baked: BakedData = bake(scene);
  for (const entity of scene.entities) {
    const e = baked.entityIndex.get(entity.id);
    if (e === undefined) throw new Error(`${label}: entity ${entity.id} missing from baked data`);
    if (baked.heldFromFrame[e] !== -1) {
      throw new Error(`${label}: entity ${entity.id} baked heldFromFrame ${baked.heldFromFrame[e]} on a closed path, expected -1`);
    }
  }
  const found = endFindings(motionLinter(scene, baked));
  if (found.length !== 0) {
    throw new Error(`${label}: closed path produced path-end-reached findings ${describeFindings(found)}`);
  }
}

interface FollowDraw {
  mode: number;
  a: number; // evenly spread in [0.001, 1]
  laps: number; // integer 1..10
  influence: number;
  align: boolean;
}

const arbUnit = fc.integer({ min: 1, max: 1000 }).map((i) => i / 1000);

const arbFollowDraw: fc.Arbitrary<FollowDraw> = fc.record({
  mode: fc.integer({ min: 0, max: 4 }),
  a: arbUnit,
  laps: fc.integer({ min: 1, max: 10 }),
  influence: fc.oneof(fc.constant(1), arbUnit),
  align: fc.boolean(),
});

/** [speed, startOffset] that would reach the end of an OPEN path of this length. */
function motionOf(d: FollowDraw, length: number, frameCount: number, fps: number): [number, number] {
  const perLap = (length * fps) / frameCount; // speed that covers one length in the whole clip
  if (d.mode === 0) return [d.laps * (1 + d.a) * perLap, 0]; // several laps
  if (d.mode === 1) return [d.a * 2 * perLap, d.laps * length]; // offset many lengths
  if (d.mode === 2) return [0, length]; // offset exactly the length
  if (d.mode === 3) return [-d.laps * (1 + d.a) * perLap, d.laps * length * (d.a - 0.5)]; // negative speed
  return [100 + 900 * d.a, d.a * 50]; // large absolute speed
}

const arbClosedEndScene: fc.Arbitrary<Scene> = fc
  .record({
    fps: fc.constantFrom(24, 30, 60),
    frameCount: fc.integer({ min: 1, max: 60 }),
    points: arbPointList(true),
    entities: fc.array(fc.array(arbFollowDraw, { minLength: 1, maxLength: 3 }), { minLength: 1, maxLength: 3 }),
  })
  .map((r): Scene => {
    const length = pathLength(r.points, true);
    const entities: Entity[] = r.entities.map((draws, i) => {
      const constraints: Constraint[] = draws.map((d, k) => {
        const [speed, startOffset] = motionOf(d, length, r.frameCount, r.fps);
        return {
          type: 'followPath',
          order: k,
          influence: d.influence,
          speed,
          startOffset,
          alignToPath: d.align,
        };
      });
      return { id: `entity-${i}`, forwardAxis: '+Z', upAxis: '+Y', constraints };
    });
    return {
      fps: r.fps,
      frameCount: r.frameCount,
      path: { points: r.points, closed: true },
      targets: {},
      entities,
    };
  });

describe('Property 39: path-end-reached is never emitted on closed paths', () => {
  it('no entity is held and no path-end-reached finding appears on any closed path', () => {
    let runs = 0;
    fc.assert(
      fc.property(arbClosedEndScene, (scene) => {
        runs++;
        if (!scene.path.closed) throw new Error(`run ${runs}: scene is not closed`);
        checkClosedScene(`run ${runs}`, scene);
      }),
      { numRuns: 100 },
    );
    expect(runs).toBeGreaterThanOrEqual(100);
  });

  describe('deterministic special cases', () => {
    const square: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 10, y: 0, z: 10 },
      { x: 0, y: 0, z: 10 },
    ];
    const fps = 30;
    const frameCount = 60;

    const sceneOf = (closed: boolean, speed: number, startOffset: number): Scene => ({
      fps,
      frameCount,
      path: { points: square, closed },
      targets: {},
      entities: [
        {
          id: 'mover',
          forwardAxis: '+Z',
          upAxis: '+Y',
          constraints: [{ type: 'followPath', order: 0, influence: 1, speed, startOffset }],
        },
        {
          id: 'still',
          forwardAxis: '+Z',
          upAxis: '+Y',
          constraints: [{ type: 'followPath', order: 0, influence: 1, speed: 0, startOffset: 0 }],
        },
      ],
    });
    const closedLength = pathLength(square, true);
    const threeLaps = (3 * closedLength * fps) / frameCount;

    it('three laps on a closed square give no path-end-reached', () => {
      const scene = sceneOf(true, threeLaps, 0);
      const baked = bake(scene);
      expect(baked.travelled[0][frameCount - 1]).toBeGreaterThan(2 * closedLength);
      expect(baked.heldFromFrame).toEqual([-1, -1]);
      expect(endFindings(motionLinter(scene, baked))).toHaveLength(0);
    });

    it('startOffset of five lengths on a closed square gives no path-end-reached', () => {
      const scene = sceneOf(true, 0, 5 * closedLength);
      const baked = bake(scene);
      expect(baked.travelled[0][0]).toBe(5 * closedLength);
      expect(baked.heldFromFrame).toEqual([-1, -1]);
      expect(endFindings(motionLinter(scene, baked))).toHaveLength(0);
    });

    it('contrast: the same three-lap scene with closed false gives exactly one finding for the mover', () => {
      const scene = sceneOf(false, threeLaps, 0);
      const found = endFindings(motionLinter(scene, bake(scene)));
      expect(found).toHaveLength(1);
      expect(found[0].entityId).toBe('mover');
      expect(found[0].severity).toBe('info');
    });

    it('contrast: the same five-lengths offset scene with closed false is found on frame 0', () => {
      const scene = sceneOf(false, 0, 5 * closedLength);
      const found = endFindings(motionLinter(scene, bake(scene)));
      expect(found).toHaveLength(1);
      expect(found[0].entityId).toBe('mover');
      expect(found[0].frame).toBe(0);
    });
  });
});
