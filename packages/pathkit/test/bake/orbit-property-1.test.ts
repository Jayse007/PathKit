import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import {
  FORCED_ORBIT_CASES,
  arbOrbitCase,
  bakedPosition,
  buildOrbitScene,
  centreAt,
  len3,
  scaleOf,
  sub3,
} from '../helpers/orbit-generators.js';
import type { OrbitCase } from '../helpers/orbit-generators.js';

// Feature: orbit-around, Property O1: Distance from the centre equals the radius
// Validates: Requirements 2.1, 2.3, 2.5, 2.6, 2.13, 8.4
//
// The expected distance is the radius taken from the Scene. The centre comes from the Scene numbers
// (static, or c0 + frame * step), never from the baker.
// Source lines this should catch: `cos * a.z + sin * a.y` changed to `cos * a.z + cos * a.y`, or `r *` removed.

/** Checks every frame of one case. The per-frame comparison is a plain check that throws. */
function checkDistances(c: OrbitCase): void {
  const baked = bake(buildOrbitScene(c));
  const tol = 1e-9 * scaleOf(c);
  const position = [0, 0, 0];
  const centre = [0, 0, 0];
  const offset = [0, 0, 0];
  let framesChecked = 0;
  for (let frame = 0; frame < c.frameCount; frame++) {
    bakedPosition(baked, 0, frame, position);
    centreAt(c, frame, centre);
    sub3(position, centre, offset);
    const distance = len3(offset);
    if (!(Math.abs(distance - c.radius) <= tol)) {
      throw new Error(
        `Property O1: frame ${frame}: distance ${distance} differs from radius ${c.radius} by more than ${tol}; case ${JSON.stringify(c)}`,
      );
    }
    framesChecked++;
  }
  expect(framesChecked).toBe(c.frameCount);
}

// Forced cases: the shared special cases plus a long run whose last frame is frame 119.
const LONG_CASE: OrbitCase = {
  fps: 60,
  frameCount: 120,
  axis: '-X',
  radius: 30,
  speed: 720 * 60,
  startAngle: -720,
  centre: { kind: 'linear', c0: [-100, 100, -100], step: [2, -2, 2] },
};
const FORCED: OrbitCase[] = [...FORCED_ORBIT_CASES, LONG_CASE];

describe('Feature: orbit-around, Property O1: Distance from the centre equals the radius', () => {
  it('every frame of every generated case is exactly radius away from the centre', () => {
    fc.assert(
      fc.property(arbOrbitCase(), (c) => {
        checkDistances(c);
      }),
      { numRuns: 100, examples: FORCED.map((c) => [c] as [OrbitCase]) },
    );
  });

  it('radius 0 places the entity on the centre at every frame', () => {
    fc.assert(
      fc.property(arbOrbitCase({ minRadius: 0 }).map((c): OrbitCase => ({ ...c, radius: 0 })), (c) => {
        checkDistances(c);
      }),
      { numRuns: 100, examples: [[{ ...FORCED_ORBIT_CASES[0], radius: 0 }]] },
    );
  });

  it('forced: one case per axis, startAngle 0, frameCount 1 and the last frame are all covered', () => {
    expect(FORCED.some((c) => c.startAngle === 0)).toBe(true);
    expect(FORCED.some((c) => c.frameCount === 1)).toBe(true);
    expect(FORCED.some((c) => c.frameCount === 120)).toBe(true);
    for (const c of FORCED) checkDistances(c);
  });
});
