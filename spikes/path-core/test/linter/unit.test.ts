import { describe, it, expect } from 'vitest';
import { createArcLengthTable } from '../../src/arclength.js';
import { bake } from '../../src/bake.js';
import type { BakedData } from '../../src/bake.js';
import { createCurve } from '../../src/curve.js';
import { motionLinter } from '../../src/linter.js';
import type { Finding } from '../../src/linter.js';
import type { Vec3 } from '../../src/math.js';
import type { Entity, Scene } from '../../src/scene.js';
import { buildFixture, quatAboutAxis } from '../helpers/baked-builder.js';

// Unit tests for linter edge cases: zero median speed, held frames left out of the speed list, equality of
// travelled distance and path length on the last frame, an entity that never reaches the end, a clean scene,
// an entity missing from baked.entityIndex, the roll threshold option and its default, a one-frame scene,
// and a scene with no entities. Each test comment says which kind of bug it would catch.
// Expected values are written by hand or computed in the test from the scene, never from the linter.

/** Only the fields the tests compare (the message text is not part of what these tests pin down). */
interface Brief {
  frame: number;
  entityId: string;
  severity: string;
  code: string;
}

function brief(findings: readonly Finding[]): Brief[] {
  return findings.map((f) => ({ frame: f.frame, entityId: f.entityId, severity: f.severity, code: f.code }));
}

function ofCode(findings: readonly Finding[], code: string): Finding[] {
  return findings.filter((f) => f.code === code);
}

/** Positions along the x axis, one per frame. */
function alongX(xs: number[]): [number, number, number][] {
  return xs.map((x) => [x, 0, 0]);
}

// ---------------------------------------------------------------------------
// Zero median speed and held frames in the speed list
// ---------------------------------------------------------------------------

describe('speed-spike: median speed', () => {
  // Catches: a median of 0 not being guarded (limit 3 * 0 = 0 would flag every moving frame),
  // or a division or comparison that crashes or produces NaN on a zero median.
  it('zero median speed gives no speed-spike and no crash', () => {
    // Frames 1..5 have speeds 0, 0, 0, 0, 9 at fps 1, so the median is 0 and the last speed is large.
    const { scene, baked } = buildFixture(6, 1, [{ id: 'a', positions: alongX([0, 0, 0, 0, 0, 9]) }]);
    expect(motionLinter(scene, baked)).toEqual([]);
  });

  // Catches: the same guard, with every position equal (every speed 0).
  it('all positions equal give no findings', () => {
    const { scene, baked } = buildFixture(5, 24, [{ id: 'a', positions: alongX([3, 3, 3, 3, 3]) }]);
    expect(motionLinter(scene, baked)).toEqual([]);
  });

  // Control for the two tests above: a positive median with the same large jump does give a spike.
  // Catches: a linter that never emits speed-spike, which would make the zero-median tests pass for the wrong reason.
  it('a positive median with one fast frame gives one speed-spike on that frame', () => {
    // Speeds 1, 1, 1, 1, 9 at fps 1: median 1, limit 3, so only frame 5 is above it.
    const { scene, baked } = buildFixture(6, 1, [{ id: 'a', positions: alongX([0, 1, 2, 3, 4, 13]) }]);
    expect(brief(motionLinter(scene, baked))).toEqual([
      { frame: 5, entityId: 'a', severity: 'warning', code: 'speed-spike' },
    ]);
  });

  // Catches: held frames being included in the speed list (the jump on the held frame would then be a spike).
  it('a jump on a held frame is not a speed-spike', () => {
    // Speeds 1, 1, 28 at fps 1. Held from frame 3, so the speed list is [1, 1] and has no spike.
    const { scene, baked } = buildFixture(4, 1, [
      { id: 'a', positions: alongX([0, 1, 2, 30]), heldFromFrame: 3 },
    ]);
    expect(brief(motionLinter(scene, baked))).toEqual([
      { frame: 3, entityId: 'a', severity: 'info', code: 'path-end-reached' },
    ]);
  });

  // Catches: an empty speed list (every frame held) crashing on the median, or the held frames still being counted.
  it('every frame after frame 0 held gives an empty speed list and no speed-spike', () => {
    const { scene, baked } = buildFixture(4, 1, [
      { id: 'a', positions: alongX([0, 1, 2, 30]), heldFromFrame: 0 },
    ]);
    expect(brief(motionLinter(scene, baked))).toEqual([
      { frame: 0, entityId: 'a', severity: 'info', code: 'path-end-reached' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// path-end-reached with a real bake
// ---------------------------------------------------------------------------

const PATH_POINTS: Vec3[] = [
  { x: 0, y: 0, z: 0 },
  { x: 10, y: 0, z: 0 },
  { x: 10, y: 5, z: 0 },
  { x: 4, y: 5, z: 3 },
];

/** Path length from the test's own curve and arc-length table, not from bake. */
function pathLength(points: Vec3[], closed: boolean): number {
  return createArcLengthTable(createCurve(points, closed)).length;
}

function followEntity(id: string, speed: number, startOffset = 0): Entity {
  return {
    id,
    forwardAxis: '+Z',
    upAxis: '+Y',
    constraints: [{ type: 'followPath', order: 0, influence: 1, speed, startOffset }],
  };
}

function sceneOf(entities: Entity[], frameCount: number, fps: number, points: Vec3[] = PATH_POINTS): Scene {
  return { fps, frameCount, path: { points, closed: false }, targets: {}, entities };
}

describe('path-end-reached: equality on the last frame', () => {
  const length = pathLength(PATH_POINTS, false);

  // Catches: the test's own arithmetic not matching what the task assumes (checked before the real tests below).
  it('with fps 32 the distance on frame 32 is exactly the length and on frame 31 is below it', () => {
    // fps 32 is a power of two, so (length * 32) / 32 is exactly length.
    expect(0 + (length * 32) / 32).toBe(length);
    expect(0 + (length * 31) / 32).toBeLessThan(length);
  });

  // Catches: `>` instead of `>=` when comparing travelled distance with the path length (bake) or a linter that
  // looks at the clamped distance (which equals the length only from the end on).
  it('reaching the length exactly on the last frame gives one info finding on that last frame', () => {
    const scene = sceneOf([followEntity('subject', length)], 33, 32);
    const findings = motionLinter(scene, bake(scene));
    expect(brief(ofCode(findings, 'path-end-reached'))).toEqual([
      { frame: 32, entityId: 'subject', severity: 'info', code: 'path-end-reached' },
    ]);
  });

  // Catches: a finding emitted for an entity that is still one frame short of the end.
  it('one frame fewer (last frame 31) gives no path-end-reached', () => {
    const scene = sceneOf([followEntity('subject', length)], 32, 32);
    const findings = motionLinter(scene, bake(scene));
    expect(ofCode(findings, 'path-end-reached')).toEqual([]);
  });
});

describe('path-end-reached: entity that never reaches the end', () => {
  const length = pathLength(PATH_POINTS, false);

  // Catches: path-end-reached emitted for every entity with a followPath, or the finding of one entity
  // being attributed to the other.
  it('only the entity that reaches the end gets a finding', () => {
    // 'slow' travels 1 metre in 32 frames (length is more than 10), 'fast' reaches the length on frame 32.
    const scene = sceneOf([followEntity('slow', 1), followEntity('fast', length)], 33, 32);
    const findings = motionLinter(scene, bake(scene));
    expect(ofCode(findings, 'path-end-reached').filter((f) => f.entityId === 'slow')).toEqual([]);
    expect(brief(ofCode(findings, 'path-end-reached'))).toEqual([
      { frame: 32, entityId: 'fast', severity: 'info', code: 'path-end-reached' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// A scene with nothing wrong
// ---------------------------------------------------------------------------

describe('clean scenes', () => {
  // Catches: any check emitting a finding on well-behaved data (a false positive in speed, roll, aim,
  // rotation-conflict or path-end), and the result not being a plain empty array.
  it('a real bake of a constant-speed entity that does not reach the end gives exactly []', () => {
    // Straight path of 20 m. 12 m/s at 24 fps is 0.5 m per frame, so 4.5 m after 9 frames.
    const straight: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 20, y: 0, z: 0 },
    ];
    const scene = sceneOf([followEntity('subject', 12)], 10, 24, straight);
    expect(motionLinter(scene, bake(scene))).toEqual([]);
  });

  // Catches: a crash or a finding when the scene has no entities.
  it('a scene with no entities gives []', () => {
    const { scene, baked } = buildFixture(5, 24, []);
    expect(motionLinter(scene, baked)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// An entity missing from baked.entityIndex
// ---------------------------------------------------------------------------

/** Shallow copy of baked with a new entityIndex that lacks `missingId`. The original is not changed. */
function withoutEntry(baked: BakedData, missingId: string): BakedData {
  const index = new Map<string, number>();
  baked.entityIndex.forEach((value, key) => {
    if (key !== missingId) index.set(key, value);
  });
  return { ...baked, entityIndex: index };
}

describe('entity missing from baked.entityIndex', () => {
  const entities = [
    { id: 'a', heldFromFrame: 0 },
    { id: 'b', heldFromFrame: 0 },
  ];

  // Catches: a missing id throwing, or giving a finding (for example from index undefined or from index 0).
  it('a missing second entity is skipped and the first still gives its finding', () => {
    const { scene, baked } = buildFixture(3, 24, entities);
    const reduced = withoutEntry(baked, 'b');
    let findings: Finding[] = [];
    expect(() => {
      findings = motionLinter(scene, reduced);
    }).not.toThrow();
    expect(brief(findings)).toEqual([{ frame: 0, entityId: 'a', severity: 'info', code: 'path-end-reached' }]);
    // The test's own copy did not change the original.
    expect(baked.entityIndex.has('b')).toBe(true);
    expect(baked.entityIndex.size).toBe(2);
  });

  // Catches: the same, when the missing entity is first in scene order (an early `return` instead of `continue`
  // would drop the entity that follows it).
  it('a missing first entity is skipped and the second still gives its finding', () => {
    const { scene, baked } = buildFixture(3, 24, entities);
    const reduced = withoutEntry(baked, 'a');
    let findings: Finding[] = [];
    expect(() => {
      findings = motionLinter(scene, reduced);
    }).not.toThrow();
    expect(brief(findings)).toEqual([{ frame: 0, entityId: 'b', severity: 'info', code: 'path-end-reached' }]);
    expect(baked.entityIndex.has('a')).toBe(true);
  });

  // Catches: findings ordered by the entity's position in the baked data instead of its position in the scene.
  it('findings on one frame follow the scene order, not the baked order', () => {
    const { scene, baked } = buildFixture(3, 24, entities);
    const swapped: Scene = { ...scene, entities: [scene.entities[1], scene.entities[0]] };
    expect(brief(motionLinter(swapped, baked))).toEqual([
      { frame: 0, entityId: 'b', severity: 'info', code: 'path-end-reached' },
      { frame: 0, entityId: 'a', severity: 'info', code: 'path-end-reached' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

describe('rollThresholdDegPerFrame', () => {
  /** Two frames; the entity rolls `degrees` about its forward axis (+Z) on frame 1. Nothing else moves. */
  function rollFixture(degrees: number) {
    return buildFixture(2, 24, [
      { id: 'a', rotations: [quatAboutAxis('z', 0), quatAboutAxis('z', degrees)] },
    ]);
  }
  const rollFinding: Brief = { frame: 1, entityId: 'a', severity: 'warning', code: 'roll-change' };

  // Catches: the explicit option being ignored, or read as radians instead of degrees
  // (19 radians would never be exceeded; 21 emitted means the default 15 was used).
  it('an explicit threshold is used: a 20 degree roll is emitted at 19 and not at 21', () => {
    const { scene, baked } = rollFixture(20);
    expect(brief(motionLinter(scene, baked, { rollThresholdDegPerFrame: 19 }))).toEqual([rollFinding]);
    expect(motionLinter(scene, baked, { rollThresholdDegPerFrame: 21 })).toEqual([]);
  });

  // Catches: the explicit option being ignored in favour of the default (a 10 degree roll is below the default 15).
  it('an explicit threshold of 5 emits a 10 degree roll', () => {
    const { scene, baked } = rollFixture(10);
    expect(brief(motionLinter(scene, baked, { rollThresholdDegPerFrame: 5 }))).toEqual([rollFinding]);
  });

  // Catches: a wrong default (for example 0, 10, 30 or a value in radians): 20 must be emitted and 10 must not.
  it('the default threshold is 15 when options are omitted, empty or undefined', () => {
    const big = rollFixture(20);
    const small = rollFixture(10);
    expect(brief(motionLinter(big.scene, big.baked))).toEqual([rollFinding]);
    expect(brief(motionLinter(big.scene, big.baked, {}))).toEqual([rollFinding]);
    expect(brief(motionLinter(big.scene, big.baked, { rollThresholdDegPerFrame: undefined }))).toEqual([rollFinding]);
    expect(motionLinter(small.scene, small.baked)).toEqual([]);
    expect(motionLinter(small.scene, small.baked, {})).toEqual([]);
    expect(motionLinter(small.scene, small.baked, { rollThresholdDegPerFrame: undefined })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// One-frame scene
// ---------------------------------------------------------------------------

describe('frameCount 1', () => {
  // Catches: a crash or a finding from speed or roll, which need two frames, and a missing frame-0 finding.
  it('only the frame-0 rotation-conflict is reported', () => {
    const { scene, baked } = buildFixture(1, 24, [{ id: 'a', rotationDrivers: 2 }]);
    expect(brief(motionLinter(scene, baked))).toEqual([
      { frame: 0, entityId: 'a', severity: 'warning', code: 'rotation-conflict' },
    ]);
  });

  // Catches: findings on the same frame and entity not sorted by code ('path-end-reached' before 'rotation-conflict').
  it('two frame-0 findings for one entity are sorted by code', () => {
    const { scene, baked } = buildFixture(1, 24, [{ id: 'a', rotationDrivers: 2, heldFromFrame: 0 }]);
    expect(brief(motionLinter(scene, baked))).toEqual([
      { frame: 0, entityId: 'a', severity: 'info', code: 'path-end-reached' },
      { frame: 0, entityId: 'a', severity: 'warning', code: 'rotation-conflict' },
    ]);
  });
});
