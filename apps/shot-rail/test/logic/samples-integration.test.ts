// Integration test: the three sample shots go through the whole pipeline.
// Subject bake -> buildKeyframedTarget -> buildSceneSet -> bake -> motionLinter, and validateScene on every scene.
// Expected positions are written by hand from the design's Samples table and the road's first point (22, 0.7, 0).
//
// Source line it should catch: set one sample's horizontalDistanceM to 0 in samples.ts (the orbit radius
// check and the range check fail), or set a shot length of 59 (the range check fails).

import { describe, expect, it } from 'vitest';
import {
  bake,
  createArcLengthTable,
  createCurve,
  evaluateEntity,
  motionLinter,
  validateScene,
} from '../../src/logic/pathkit.js';
import type { BakedData, Finding, OutBuffer, Scene, Target } from '../../src/logic/pathkit.js';
import {
  BAKE_FPS,
  BAKED_LAP_FRAMES,
  CAMERA_HEIGHT_MAX,
  CAMERA_HEIGHT_MIN,
  CAMERA_RADIUS_MAX,
  CAMERA_RADIUS_MIN,
  CAR_FORWARD_AXIS,
  CAR_UP_AXIS,
  EASE_AMPLITUDE,
  LAP_FRAMES,
  LAP_SECONDS,
  LENS_PRESETS_MM,
  SHOT_LENGTH_MAX,
  SHOT_LENGTH_MIN,
  SUBJECT_ENTITY_ID,
} from '../../src/logic/constants.js';
import { DEFAULT_ROAD_CLOSED, DEFAULT_ROAD_POINTS } from '../../src/logic/default-road.js';
import { remapDisplayedFrame } from '../../src/logic/frame-remap.js';
import { SAMPLE_SHOTS } from '../../src/logic/samples.js';
import type { SampleShot } from '../../src/logic/samples.js';
import { buildSceneSet } from '../../src/logic/scene-set.js';
import { buildKeyframedTarget } from '../../src/logic/target-converter.js';
import type { CameraPlacement, ShotType } from '../../src/logic/shot-builders.js';

const CAMERA_ID = 'cam-1';
const FRAMES_TO_EVALUATE = [0, 120, 239];
const TOLERANCE = 1e-6;
const ROAD_START = { x: 22, y: 0.7, z: 0 }; // first point of DEFAULT_ROAD_POINTS

function makeOut(): OutBuffer {
  return { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
}

function remap(displayedFrame: number): number {
  return remapDisplayedFrame(displayedFrame, LAP_FRAMES, BAKED_LAP_FRAMES, EASE_AMPLITUDE);
}

// The subject bake, as in the spikes: one lap at 240 fps along the default road.
const roadLength = createArcLengthTable(createCurve(DEFAULT_ROAD_POINTS, DEFAULT_ROAD_CLOSED)).length;
const subjectScene: Scene = {
  fps: BAKE_FPS,
  frameCount: BAKED_LAP_FRAMES,
  path: { points: DEFAULT_ROAD_POINTS.map((p) => ({ ...p })), closed: DEFAULT_ROAD_CLOSED },
  targets: {},
  entities: [
    {
      id: SUBJECT_ENTITY_ID,
      forwardAxis: CAR_FORWARD_AXIS,
      upAxis: CAR_UP_AXIS,
      constraints: [
        { type: 'followPath', order: 0, influence: 1, speed: roadLength / LAP_SECONDS, startOffset: 0, alignToPath: true },
      ],
    },
  ],
};
const subjectBaked: BakedData = bake(subjectScene);

interface Built {
  scenes: Scene[];
  bakedScenes: BakedData[];
  main: BakedData;
  findings: Finding[];
}

const builtCache = new Map<string, Built>();

function build(sample: SampleShot): Built {
  const cached = builtCache.get(sample.name);
  if (cached !== undefined) return cached;
  const n = sample.shotLengthFrames;
  const subjectTarget = buildKeyframedTarget(subjectBaked, SUBJECT_ENTITY_ID, n, remap, 0);
  const centreTarget = buildKeyframedTarget(subjectBaked, SUBJECT_ENTITY_ID, n, remap, sample.placement.heightM);
  const cameras = new Map<string, { shotType: ShotType; placement: CameraPlacement }>([
    [CAMERA_ID, { shotType: sample.shotType, placement: sample.placement }],
  ]);
  const centres = new Map<string, Target>([[CAMERA_ID, centreTarget]]);
  const set = buildSceneSet(CAMERA_ID, cameras, n, subjectTarget, centres, null);
  const scenes = set.scenes.map((s) => s.scene);
  const bakedScenes: BakedData[] = [];
  const findings: Finding[] = [];
  for (const scene of scenes) {
    validateScene(scene);
    const baked = bake(scene);
    bakedScenes.push(baked);
    findings.push(...motionLinter(scene, baked));
  }
  const result: Built = { scenes, bakedScenes, main: bakedScenes[0], findings };
  builtCache.set(sample.name, result);
  return result;
}

function cameraAt(sample: SampleShot, frame: number): { x: number; y: number; z: number } {
  const out = makeOut();
  evaluateEntity(build(sample).main, CAMERA_ID, frame, out);
  return { x: out.position.x, y: out.position.y, z: out.position.z };
}

function subjectAt(frame: number): { x: number; y: number; z: number } {
  const out = makeOut();
  evaluateEntity(subjectBaked, SUBJECT_ENTITY_ID, remap(frame), out);
  return { x: out.position.x, y: out.position.y, z: out.position.z };
}

function check(name: string, actual: number, expected: number): void {
  if (!(Math.abs(actual - expected) <= TOLERANCE)) {
    throw new Error(`${name}: got ${actual}, expected ${expected}`);
  }
}

// Plain comparisons that name the sample and the field.
function rangeProblems(s: SampleShot): string[] {
  const problems: string[] = [];
  const d = s.placement.horizontalDistanceM;
  const h = s.placement.heightM;
  if (!(d >= CAMERA_RADIUS_MIN && d <= CAMERA_RADIUS_MAX)) {
    problems.push(`${s.name}: horizontalDistanceM ${d} outside ${CAMERA_RADIUS_MIN} to ${CAMERA_RADIUS_MAX}`);
  }
  if (!(h >= CAMERA_HEIGHT_MIN && h <= CAMERA_HEIGHT_MAX)) {
    problems.push(`${s.name}: heightM ${h} outside ${CAMERA_HEIGHT_MIN} to ${CAMERA_HEIGHT_MAX}`);
  }
  if (!(LENS_PRESETS_MM as readonly number[]).includes(s.placement.lensMm)) {
    problems.push(`${s.name}: lensMm ${s.placement.lensMm} is not in LENS_PRESETS_MM`);
  }
  const n = s.shotLengthFrames;
  if (!(Number.isInteger(n) && n >= SHOT_LENGTH_MIN && n <= SHOT_LENGTH_MAX)) {
    problems.push(`${s.name}: shotLengthFrames ${n} outside ${SHOT_LENGTH_MIN} to ${SHOT_LENGTH_MAX}`);
  }
  return problems;
}

describe('sample shots: values', () => {
  it('match the design Samples table and have shot length 240', () => {
    expect(SAMPLE_SHOTS.length).toBe(3);
    const [orbit, push, crane] = SAMPLE_SHOTS;
    expect(orbit.shotType).toBe('orbit');
    expect(orbit.placement).toEqual({ bearingDeg: 0, heightM: 1.5, horizontalDistanceM: 8, lensMm: 35 });
    expect(push.shotType).toBe('push-in');
    expect(push.placement).toEqual({ bearingDeg: 30, heightM: -0.3, horizontalDistanceM: 12, lensMm: 50 });
    expect(crane.shotType).toBe('crane');
    expect(crane.placement).toEqual({ bearingDeg: 180, heightM: 0.5, horizontalDistanceM: 10, lensMm: 35 });
    for (const s of SAMPLE_SHOTS) {
      if (s.shotLengthFrames !== 240) throw new Error(`${s.name}: shotLengthFrames ${s.shotLengthFrames}, expected 240`);
    }
  });

  it.each(SAMPLE_SHOTS.map((s) => [s.name, s] as const))('%s: values lie inside the allowed ranges', (_name, sample) => {
    const problems = rangeProblems(sample);
    if (problems.length > 0) throw new Error(problems.join('; '));
  });

  it('the range check reports distance 0 and shot length 59', () => {
    const bad: SampleShot = {
      ...SAMPLE_SHOTS[0],
      placement: { ...SAMPLE_SHOTS[0].placement, horizontalDistanceM: 0 },
      shotLengthFrames: 59,
    };
    const problems = rangeProblems(bad);
    expect(problems.length).toBe(2);
    expect(problems[0]).toContain('horizontalDistanceM 0');
    expect(problems[1]).toContain('shotLengthFrames 59');
  });
});

describe('sample shots: pipeline', () => {
  it.each(SAMPLE_SHOTS.map((s) => [s.name, s] as const))('%s: every scene is valid and bakes, and the linter returns an array', (_name, sample) => {
    const built = build(sample);
    expect(built.scenes.length).toBe(1);
    for (let i = 0; i < built.scenes.length; i++) {
      expect(() => validateScene(built.scenes[i])).not.toThrow();
      if (built.bakedScenes[i].frameCount !== sample.shotLengthFrames) {
        throw new Error(`${sample.name}: baked frameCount ${built.bakedScenes[i].frameCount}, expected ${sample.shotLengthFrames}`);
      }
    }
    expect(Array.isArray(built.findings)).toBe(true);
    console.log(`${sample.name}: ${built.findings.length} findings`);
  });

  it.each(SAMPLE_SHOTS.map((s) => [s.name, s] as const))('%s: the main camera evaluates at frames 0, 120 and 239', (_name, sample) => {
    for (const f of FRAMES_TO_EVALUATE) {
      const p = cameraAt(sample, f);
      for (const [axis, v] of [['x', p.x], ['y', p.y], ['z', p.z]] as const) {
        if (!Number.isFinite(v)) throw new Error(`${sample.name}: frame ${f} position.${axis} is ${v}`);
      }
    }
  });
});

describe('sample shots: hand-computed camera positions', () => {
  it('orbit: height is subject y + 1.5, and the camera sits 8 m from the subject at 0.75 degrees per frame', () => {
    const sample = SAMPLE_SHOTS[0];
    // Frame 0, by hand: road start (22, 0.7, 0) + 8 m along +Z, 1.5 m up.
    const p0 = cameraAt(sample, 0);
    check('orbit frame 0 x', p0.x, ROAD_START.x);
    check('orbit frame 0 y', p0.y, ROAD_START.y + 1.5);
    check('orbit frame 0 z', p0.z, ROAD_START.z + 8);
    // Sweep 180 degrees over 240 frames = 0.75 degrees per frame. Offset from subject = 8 * (sin a, cos a) in (x, z).
    for (const f of FRAMES_TO_EVALUATE) {
      const a = (0.75 * f * Math.PI) / 180;
      const p = cameraAt(sample, f);
      const s = subjectAt(f);
      check(`orbit frame ${f} x offset`, p.x - s.x, 8 * Math.sin(a));
      check(`orbit frame ${f} y`, p.y, 0.7 + 1.5);
      check(`orbit frame ${f} z offset`, p.z - s.z, 8 * Math.cos(a));
    }
  });

  it('push-in: starts at (28, 0.4, 12 cos 30) and rises 0.18 m over the rail', () => {
    const sample = SAMPLE_SHOTS[1];
    const p0 = cameraAt(sample, 0);
    check('push-in frame 0 x', p0.x, 22 + 12 * 0.5);
    check('push-in frame 0 y', p0.y, 0.7 - 0.3);
    check('push-in frame 0 z', p0.z, 12 * 0.8660254037844386);
    // Rail end y = 0.7 + (-0.3 * 0.4) = 0.58. Travel at frame f is f / 240 of the rail, so y = 0.4 + 0.18 f / 240.
    check('push-in frame 120 y', cameraAt(sample, 120).y, 0.4 + (0.18 * 120) / 240);
    check('push-in frame 239 y', cameraAt(sample, 239).y, 0.4 + (0.18 * 239) / 240);
  });

  it('crane: starts at (22, 1.2, -10) and rises 6 m * f / 240 with x and z fixed', () => {
    const sample = SAMPLE_SHOTS[2];
    for (const f of FRAMES_TO_EVALUATE) {
      const p = cameraAt(sample, f);
      check(`crane frame ${f} x`, p.x, 22);
      check(`crane frame ${f} y`, p.y, 0.7 + 0.5 + (6 * f) / 240);
      check(`crane frame ${f} z`, p.z, -10);
    }
  });
});
