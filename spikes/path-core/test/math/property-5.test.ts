import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { slerp, quatAngle } from '../../src/math.js';
import type { Quat } from '../../src/math.js';
import { arbUnitQuat } from '../helpers/basic-generators.js';

// Feature: path-core, Property 5: Slerp follows the shorter arc
// **Validates: Requirements 1.3, 1.5**

const ANGLE_TOL = 1e-6;
const UNIT_TOL = 1e-9;

const neg = (q: Quat): Quat => ({ x: -q.x, y: -q.y, z: -q.z, w: -q.w });
const norm = (q: Quat): number => Math.hypot(q.x, q.y, q.z, q.w);
const arbT = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

function checkShorterArc(a: Quat, b: Quat, t: number) {
  const r = slerp(a, b, t);
  const rNeg = slerp(a, neg(b), t);

  // slerp(a, b, t) and slerp(a, -b, t) are the same rotation (q and -q are equal rotations).
  expect(quatAngle(r, rNeg)).toBeLessThanOrEqual(ANGLE_TOL);

  // Result is a unit quaternion.
  expect(Math.abs(norm(r) - 1)).toBeLessThanOrEqual(UNIT_TOL);

  // quatAngle is within [0, pi] and the swept angle is t times the shorter-arc angle.
  const total = quatAngle(a, b);
  expect(total).toBeGreaterThanOrEqual(0);
  expect(total).toBeLessThanOrEqual(Math.PI);
  expect(Math.abs(quatAngle(a, r) - t * total)).toBeLessThanOrEqual(ANGLE_TOL);
}

describe('Property 5: Slerp follows the shorter arc', () => {
  it('slerp(a, b, t) equals slerp(a, -b, t), is unit length, and sweeps t * quatAngle(a, b)', () => {
    fc.assert(
      fc.property(arbUnitQuat, arbUnitQuat, arbT, (a, b, t) => {
        checkShorterArc(a, b, t);
      }),
      { numRuns: 200 },
    );
  });

  it('holds when b is chosen on the far hemisphere (negative dot)', () => {
    fc.assert(
      fc.property(arbUnitQuat, arbUnitQuat, arbT, (a, b0, t) => {
        const d = a.x * b0.x + a.y * b0.y + a.z * b0.z + a.w * b0.w;
        const b = d > 0 ? neg(b0) : b0;
        checkShorterArc(a, b, t);
      }),
      { numRuns: 200 },
    );
  });

  it('endpoints: t = 0 gives a and t = 1 gives b (as rotations)', () => {
    fc.assert(
      fc.property(arbUnitQuat, arbUnitQuat, (a, b) => {
        expect(quatAngle(slerp(a, b, 0), a)).toBeLessThanOrEqual(ANGLE_TOL);
        expect(quatAngle(slerp(a, b, 1), b)).toBeLessThanOrEqual(ANGLE_TOL);
      }),
      { numRuns: 200 },
    );
  });

  it('example: 270 degrees about Y takes the 90 degree arc the other way', () => {
    const id: Quat = { x: 0, y: 0, z: 0, w: 1 };
    const h = (3 * Math.PI) / 4; // half of 270 degrees
    const b: Quat = { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) }; // dot with id is negative
    const mid = slerp(id, b, 0.5);
    expect(quatAngle(id, b)).toBeCloseTo(Math.PI / 2, 9);
    expect(quatAngle(id, mid)).toBeCloseTo(Math.PI / 4, 9);
  });
});
