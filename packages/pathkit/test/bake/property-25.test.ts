import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import { createArcLengthTable } from '../../src/arclength.js';
import type { ArcLengthTable } from '../../src/arclength.js';
import { createCurve } from '../../src/curve.js';
import type { Vec3 } from '../../src/math.js';
import type { Constraint, FollowPathConstraint, Scene } from '../../src/scene.js';
import { coord } from '../helpers/basic-generators.js';
import { arbFollowPathScene } from '../helpers/scene-generators.js';

// Feature: path-core, Property 25: Open-path hold
// **Validates: Requirements 8.1, 8.7**

const TOLERANCE = 1e-6;

function tableOf(scene: Scene): ArcLengthTable {
  return createArcLengthTable(createCurve(scene.path.points, scene.path.closed));
}

/** The followPath under test: the followPath with the highest order. */
function underTest(scene: Scene): FollowPathConstraint {
  let best: FollowPathConstraint | null = null;
  for (const c of scene.entities[0].constraints) {
    if (c.type === 'followPath' && (best === null || c.order > best.order)) best = c;
  }
  if (best === null) throw new Error('scene has no followPath');
  return best;
}

/**
 * Copy of the scene where the followPath under test is the only followPath (so it is also the
 * first one in constraint order) and has the given speed and startOffset. aimAt constraints stay.
 */
function withMotion(scene: Scene, speed: number, startOffset: number): Scene {
  const target = underTest(scene);
  const constraints: Constraint[] = [];
  for (const c of scene.entities[0].constraints) {
    if (c === target) constraints.push({ ...target, speed, startOffset });
    else if (c.type !== 'followPath') constraints.push(c);
  }
  return { ...scene, entities: [{ ...scene.entities[0], constraints }] };
}

/** First frame whose unclamped distance is at or beyond the length, or -1. Written here, not taken from bake.ts. */
function expectedHeldFrame(scene: Scene, length: number): number {
  const c = underTest(scene);
  for (let f = 0; f < scene.frameCount; f++) {
    if (c.startOffset + (c.speed * f) / scene.fps >= length) return f;
  }
  return -1;
}

/** True when the rotation comes only from the followPath's alignToPath (no aimAt anywhere). */
function rotationIsPathOnly(scene: Scene): boolean {
  const cs = scene.entities[0].constraints;
  if (underTest(scene).alignToPath !== true) return false;
  for (const c of cs) if (c.type === 'aimAt') return false;
  return true;
}

/**
 * Bakes the scene and checks heldFromFrame, the held position and (path-only rotation) the held rotation.
 * Returns the expected held frame. Throws on the first miss.
 */
function checkHold(label: string, scene: Scene): number {
  const table = tableOf(scene);
  const length = table.length;
  const expectedHeld = expectedHeldFrame(scene, length);
  const baked = bake(scene);
  const held = baked.heldFromFrame[0];
  if (held !== expectedHeld) {
    throw new Error(`${label}: heldFromFrame ${held}, expected ${expectedHeld} (length=${length})`);
  }
  if (held < 0) return held;
  const last = scene.path.points[scene.path.points.length - 1];
  const t = baked.transforms[0];
  const checkRotation = rotationIsPathOnly(scene);
  const r0 = held * 7;
  for (let f = held; f < scene.frameCount; f++) {
    const i = f * 7;
    if (
      !(
        Math.abs(t[i] - last.x) <= TOLERANCE &&
        Math.abs(t[i + 1] - last.y) <= TOLERANCE &&
        Math.abs(t[i + 2] - last.z) <= TOLERANCE
      )
    ) {
      throw new Error(
        `${label}: held frame ${f} (heldFromFrame ${held}) position (${t[i]}, ${t[i + 1]}, ${t[i + 2]}), expected last point (${last.x}, ${last.y}, ${last.z})`,
      );
    }
    if (checkRotation && f > held) {
      for (let k = 3; k < 7; k++) {
        if (t[i + k] !== t[r0 + k]) {
          throw new Error(
            `${label}: held frame ${f} rotation component ${k - 3} is ${t[i + k]}, first held frame ${held} has ${t[r0 + k]}`,
          );
        }
      }
    }
  }
  return held;
}

// Motion drawn from the real path length. mode 0: the end is reached exactly on frame h.
// mode 1: reached from frame h by a small margin. mode 2: free motion (may never reach the end).
const arbMotion = fc.record({
  mode: fc.constantFrom(0, 1, 2),
  k: fc.integer({ min: 0, max: 1000 }),
  speedPos: coord(0.5, 10),
  speedFree: coord(-10, 10),
  factor: fc.integer({ min: -1000, max: 990 }).map((i) => i / 1000),
});

function motionFor(scene: Scene, m: { mode: number; k: number; speedPos: number; speedFree: number; factor: number }): [number, number] {
  const length = tableOf(scene).length;
  const h = Math.min(scene.frameCount - 1, Math.floor((m.k / 1001) * scene.frameCount));
  if (m.mode === 0) return [m.speedPos, length - (m.speedPos * h) / scene.fps];
  if (m.mode === 1) return [m.speedPos, length - (m.speedPos * (h - 0.5)) / scene.fps];
  return [m.speedFree, m.factor * length];
}

function holdProperty(allowAlign: boolean, numRuns: number): void {
  let runs = 0;
  let heldCount = 0;
  let neverHeld = 0;
  let heldLate = 0;
  let rotationChecked = 0;
  fc.assert(
    fc.property(arbFollowPathScene({ allowAlign, closed: false }), arbMotion, (base, m) => {
      const [speed, offset] = motionFor(base, m);
      runs++;
      const scene = withMotion(base, speed, offset);
      const held = checkHold(`run ${runs}`, scene);
      if (held >= 0) heldCount++;
      else neverHeld++;
      if (held > 0) heldLate++;
      if (held >= 0 && rotationIsPathOnly(scene)) rotationChecked++;
    }),
    { numRuns },
  );
  expect(runs).toBeGreaterThanOrEqual(numRuns);
  expect(heldCount).toBeGreaterThan(0);
  expect(neverHeld).toBeGreaterThan(0);
  expect(heldLate).toBeGreaterThan(0);
  if (allowAlign) expect(rotationChecked).toBeGreaterThan(0);
}

describe('Property 25: Open-path hold', () => {
  it('holds the last path point from the first frame at or beyond the length (no alignToPath)', () => {
    holdProperty(false, 200);
  });

  it('holds the last path point and the first held rotation (alignToPath allowed)', () => {
    holdProperty(true, 100);
  });

  it('closed paths are never held', () => {
    let runs = 0;
    fc.assert(
      fc.property(
        arbFollowPathScene({ allowAlign: false, closed: true }),
        fc.integer({ min: -5000, max: 5000 }).map((i) => i / 1000),
        coord(-50, 50),
        (base, factor, speed) => {
          runs++;
          const scene = withMotion(base, speed, factor * tableOf(base).length);
          const held = bake(scene).heldFromFrame[0];
          if (held !== -1) throw new Error(`run ${runs}: closed path heldFromFrame ${held}, expected -1`);
        },
      ),
      { numRuns: 200 },
    );
    expect(runs).toBeGreaterThanOrEqual(200);
  });

  describe('deterministic special cases', () => {
    const points: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 10, y: 5, z: 0 },
      { x: 4, y: 5, z: 3 },
    ];
    const sceneOf = (
      closed: boolean,
      speed: number,
      startOffset: number,
      frameCount = 40,
      fps = 30,
      alignToPath = true,
    ): Scene => ({
      fps,
      frameCount,
      path: { points, closed },
      targets: {},
      entities: [
        {
          id: 'subject',
          forwardAxis: '+Z',
          upAxis: '+Y',
          constraints: [{ type: 'followPath', order: 0, influence: 1, speed, startOffset, alignToPath }],
        },
      ],
    });
    const lengthOf = (closed: boolean): number => tableOf(sceneOf(closed, 0, 0)).length;

    it('speed 0 with startOffset exactly the path length is held from frame 0', () => {
      const length = lengthOf(false);
      const scene = sceneOf(false, 0, length);
      expect(checkHold('speed 0, offset = length', scene)).toBe(0);
      expect(bake(scene).heldFromFrame[0]).toBe(0);
    });

    it('a negative speed on an open path is never held and clamps at the first point', () => {
      const scene = sceneOf(false, -5, 0);
      expect(checkHold('speed -5', scene)).toBe(-1);
      const t = bake(scene).transforms[0];
      for (let f = 0; f < scene.frameCount; f++) {
        const i = f * 7;
        if (
          !(
            Math.abs(t[i] - points[0].x) <= TOLERANCE &&
            Math.abs(t[i + 1] - points[0].y) <= TOLERANCE &&
            Math.abs(t[i + 2] - points[0].z) <= TOLERANCE
          )
        ) {
          throw new Error(`speed -5: frame ${f} position (${t[i]}, ${t[i + 1]}, ${t[i + 2]}), expected first point`);
        }
      }
    });

    it('the end reached exactly on the last frame is held from the last frame only', () => {
      // fps 32 is a power of two, so (length * 32) / 32 equals length exactly on frame 32.
      const length = lengthOf(false);
      const scene = sceneOf(false, length, 0, 33, 32);
      expect(checkHold('exact last frame', scene)).toBe(32);
      expect(bake(scene).travelled[0][32]).toBe(length);
      // One frame fewer: never reached.
      expect(checkHold('one frame short', sceneOf(false, length, 0, 32, 32))).toBe(-1);
    });

    it('closed paths are not held with large offsets and speeds', () => {
      const length = lengthOf(true);
      const cases: [number, number][] = [
        [0, 5 * length],
        [1000, 0],
        [50, 10 * length],
        [-20, -3 * length],
      ];
      for (const [speed, offset] of cases) {
        const held = bake(sceneOf(true, speed, offset)).heldFromFrame[0];
        expect(held).toBe(-1);
      }
    });
  });
});
