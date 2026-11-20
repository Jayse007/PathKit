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

// Feature: path-core, Property 24: followPath positions on the path
// **Validates: Requirements 6.1, 8.2**

const TOLERANCE = 1e-6;

function tableOf(scene: Scene): ArcLengthTable {
  return createArcLengthTable(createCurve(scene.path.points, scene.path.closed));
}

/**
 * Expected position at distance d, written here and independent of bake.ts.
 * Open paths clamp to [0, length]; closed paths wrap into [0, length).
 */
function expectedPosition(table: ArcLengthTable, closed: boolean, d: number, out: Vec3): Vec3 {
  const length = table.length;
  const dist = closed ? d - length * Math.floor(d / length) : Math.min(Math.max(d, 0), length);
  return table.pointAtDistance(dist, out);
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

/** Copy of the scene with the followPath under test given a new speed and startOffset. */
function withMotion(scene: Scene, speed: number, startOffset: number): Scene {
  const target = underTest(scene);
  const constraints: Constraint[] = scene.entities[0].constraints.map((c) =>
    c === target ? { ...target, speed, startOffset } : c,
  );
  return { ...scene, entities: [{ ...scene.entities[0], constraints }] };
}

/** Checks the baked position at every frame against the independent expectation. Throws on the first miss. */
function checkEveryFrame(label: string, scene: Scene): void {
  const table = tableOf(scene);
  const c = underTest(scene);
  const closed = scene.path.closed;
  const transforms = bake(scene).transforms[0];
  const expected: Vec3 = { x: 0, y: 0, z: 0 };
  if (transforms.length !== scene.frameCount * 7) {
    throw new Error(`${label}: transforms length ${transforms.length}, expected ${scene.frameCount * 7}`);
  }
  for (let f = 0; f < scene.frameCount; f++) {
    const d = c.startOffset + (c.speed * f) / scene.fps;
    expectedPosition(table, closed, d, expected);
    const i = f * 7;
    const dx = Math.abs(transforms[i] - expected.x);
    const dy = Math.abs(transforms[i + 1] - expected.y);
    const dz = Math.abs(transforms[i + 2] - expected.z);
    if (!(dx <= TOLERANCE && dy <= TOLERANCE && dz <= TOLERANCE)) {
      throw new Error(
        `${label}: frame ${f}, d=${d}, length=${table.length}, closed=${closed}: baked (${transforms[i]}, ${transforms[i + 1]}, ${transforms[i + 2]}) expected (${expected.x}, ${expected.y}, ${expected.z})`,
      );
    }
  }
}

/** Throws unless every frame of the bake sits within tolerance of the given point. */
function checkAllFramesAt(label: string, scene: Scene, point: Vec3): void {
  const transforms = bake(scene).transforms[0];
  for (let f = 0; f < scene.frameCount; f++) {
    const i = f * 7;
    if (
      !(
        Math.abs(transforms[i] - point.x) <= TOLERANCE &&
        Math.abs(transforms[i + 1] - point.y) <= TOLERANCE &&
        Math.abs(transforms[i + 2] - point.z) <= TOLERANCE
      )
    ) {
      throw new Error(
        `${label}: frame ${f}: baked (${transforms[i]}, ${transforms[i + 1]}, ${transforms[i + 2]}) expected (${point.x}, ${point.y}, ${point.z})`,
      );
    }
  }
}

/** Throws unless the two scenes bake to the same positions at every frame. */
function checkSamePositions(label: string, a: Scene, b: Scene): void {
  const ta = bake(a).transforms[0];
  const tb = bake(b).transforms[0];
  for (let f = 0; f < a.frameCount; f++) {
    for (let k = 0; k < 3; k++) {
      const x = ta[f * 7 + k];
      const y = tb[f * 7 + k];
      if (!(Math.abs(x - y) <= TOLERANCE)) {
        throw new Error(`${label}: frame ${f}, component ${k}: ${x} vs ${y}`);
      }
    }
  }
}

// Motion drawn from the real path length. Offsets cover [-3, 3] times the length and include
// the forced values 0 and exactly 3 * length. Speeds include the forced value 0 and negatives.
const arbOffsetFactor = fc.oneof(
  fc.constant(0),
  fc.constant(3),
  fc.constant(-3),
  fc.integer({ min: -3000, max: 3000 }).map((i) => i / 1000),
);
const arbSpeed = fc.oneof(fc.constant(0), coord(-10, -0.5), coord(-10, 10));

describe('Property 24: followPath positions on the path', () => {
  it('bakes the position at every frame onto the path at the clamped or wrapped distance', () => {
    let runs = 0;
    let zeroSpeed = 0;
    let negativeSpeed = 0;
    let farOffset = 0;
    fc.assert(
      fc.property(
        arbFollowPathScene({ allowAlign: true }),
        arbOffsetFactor,
        arbSpeed,
        (base, factor, speed) => {
          const length = tableOf(base).length;
          const offset = factor * length;
          if (speed === 0) zeroSpeed++;
          if (speed < 0) negativeSpeed++;
          if (Math.abs(factor) === 3) farOffset++;
          runs++;
          checkEveryFrame(`run ${runs}`, withMotion(base, speed, offset));
        },
      ),
      { numRuns: 100 },
    );
    expect(runs).toBeGreaterThanOrEqual(100);
    expect(zeroSpeed).toBeGreaterThan(0);
    expect(negativeSpeed).toBeGreaterThan(0);
    expect(farOffset).toBeGreaterThan(0);
  });

  it('closed paths give the same positions for startOffsets that differ by one path length', () => {
    let runs = 0;
    fc.assert(
      fc.property(
        arbFollowPathScene({ allowAlign: false, closed: true }),
        fc.integer({ min: -2000, max: 2000 }).map((i) => i / 1000),
        arbSpeed,
        (base, factor, speed) => {
          const length = tableOf(base).length;
          const offset = factor * length;
          runs++;
          checkSamePositions(
            `run ${runs}`,
            withMotion(base, speed, offset),
            withMotion(base, speed, offset + length),
          );
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
    const sceneOf = (closed: boolean, speed: number, startOffset: number, frameCount = 40): Scene => ({
      fps: 30,
      frameCount,
      path: { points, closed },
      targets: {},
      entities: [
        {
          id: 'subject',
          forwardAxis: '+Z',
          upAxis: '+Y',
          constraints: [{ type: 'followPath', order: 0, influence: 1, speed, startOffset }],
        },
      ],
    });
    const lengthOf = (closed: boolean): number => tableOf(sceneOf(closed, 0, 0)).length;
    const pointAt = (closed: boolean, d: number): Vec3 =>
      expectedPosition(tableOf(sceneOf(closed, 0, 0)), closed, d, { x: 0, y: 0, z: 0 });

    it('speed 0 keeps the entity at the startOffset point (open and closed)', () => {
      for (const closed of [false, true]) {
        const length = lengthOf(closed);
        for (const offset of [0, 0.37 * length, 0.99 * length]) {
          checkAllFramesAt(`speed 0, closed=${closed}, offset=${offset}`, sceneOf(closed, 0, offset), pointAt(closed, offset));
        }
      }
      expect(lengthOf(false)).toBeGreaterThan(0);
    });

    it('negative speed on an open path clamps at the first path point', () => {
      const scene = sceneOf(false, -5, 0);
      checkAllFramesAt('open, speed -5, offset 0', scene, points[0]);
      // Also starting inside the path: reaches the start and stays.
      const inside = sceneOf(false, -5, 1, 60);
      checkEveryFrame('open, speed -5, offset 1', inside);
      const t = bake(inside).transforms[0];
      const last = (inside.frameCount - 1) * 7;
      expect(Math.abs(t[last] - points[0].x)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(t[last + 1] - points[0].y)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(t[last + 2] - points[0].z)).toBeLessThanOrEqual(TOLERANCE);
    });

    it('negative speed on a closed path wraps backwards instead of clamping', () => {
      const scene = sceneOf(true, -3, 0);
      checkEveryFrame('closed, speed -3, offset 0', scene);
      const t = bake(scene).transforms[0];
      // Frame 1 is 0.1 m behind the start, so it must be near the end of the loop, not at the first point.
      const moved = Math.hypot(t[7] - t[0], t[8] - t[1], t[9] - t[2]);
      expect(moved).toBeGreaterThan(1e-3);
      const wrapped = pointAt(true, lengthOf(true) - 0.1);
      expect(Math.abs(t[7] - wrapped.x)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(t[8] - wrapped.y)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(t[9] - wrapped.z)).toBeLessThanOrEqual(TOLERANCE);
    });

    it('startOffset of 3 * length clamps at the last point on an open path', () => {
      const length = lengthOf(false);
      checkAllFramesAt('open, speed 0, offset 3L', sceneOf(false, 0, 3 * length), points[points.length - 1]);
      checkAllFramesAt('open, speed 2, offset 3L', sceneOf(false, 2, 3 * length), points[points.length - 1]);
      checkEveryFrame('open, speed -4, offset 3L', sceneOf(false, -4, 3 * length, 200));
    });

    it('startOffset of 3 * length wraps to the same positions as startOffset 0 on a closed path', () => {
      const length = lengthOf(true);
      checkSamePositions('closed, speed 2', sceneOf(true, 2, 3 * length), sceneOf(true, 2, 0));
      checkSamePositions('closed, speed 0', sceneOf(true, 0, 3 * length), sceneOf(true, 0, 0));
      checkEveryFrame('closed, speed -2, offset 3L', sceneOf(true, -2, 3 * length));
    });
  });
});
