import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import type { Vec3 } from '../../src/math.js';
import { arbCurveInput, arbPointList } from '../helpers/basic-generators.js';

// Feature: path-core, Property 9: Out-of-range parameter clamps or wraps
// **Validates: Requirements 2.8**

const TOL = 1e-9;

const unit = fc.integer({ min: 0, max: 1000000 }).map(i => i / 1000000);
// Evenly spread t in [-5, 6]: covers below 0, inside [0, 1] and above 1.
const arbT = unit.map(u => -5 + u * 11);
// Evenly spread t in [-5, 0): strictly below 0.
const arbBelow = unit.map(u => -5 + u * 4.999999);
// Evenly spread t in (1, 6]: strictly above 1.
const arbAbove = unit.map(u => 1.000001 + u * 4.999999);

const expectClose = (a: Vec3, b: Vec3): void => {
  expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(TOL);
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(TOL);
  expect(Math.abs(a.z - b.z)).toBeLessThanOrEqual(TOL);
};

describe('Property 9: Out-of-range parameter clamps or wraps', () => {
  it('pointAt(t) equals pointAt(clamp(t, 0, 1)) for open curves and pointAt(t - floor(t)) for closed curves', () => {
    fc.assert(
      fc.property(arbCurveInput, arbT, ({ points, closed }, t) => {
        const curve = createCurve(points, closed);
        const expected = closed ? t - Math.floor(t) : Math.min(1, Math.max(0, t));
        const actual = curve.pointAt(t, { x: 0, y: 0, z: 0 });
        const reference = curve.pointAt(expected, { x: 0, y: 0, z: 0 });
        expectClose(actual, reference);
      }),
      { numRuns: 200 },
    );
  });

  it('tangentAt(t) equals tangentAt(clamp(t, 0, 1)) for open curves and tangentAt(t - floor(t)) for closed curves', () => {
    fc.assert(
      fc.property(arbCurveInput, arbT, ({ points, closed }, t) => {
        const curve = createCurve(points, closed);
        const expected = closed ? t - Math.floor(t) : Math.min(1, Math.max(0, t));
        const actual = curve.tangentAt(t, { x: 0, y: 0, z: 0 });
        const reference = curve.tangentAt(expected, { x: 0, y: 0, z: 0 });
        expectClose(actual, reference);
      }),
      { numRuns: 200 },
    );
  });

  it('closed curves are periodic: pointAt(t) equals pointAt(t + 1)', () => {
    const arbPeriodT = unit.map(u => -5 + u * 10);
    fc.assert(
      fc.property(arbPointList(true), arbPeriodT, (points, t) => {
        const curve = createCurve(points, true);
        const a = curve.pointAt(t, { x: 0, y: 0, z: 0 });
        const b = curve.pointAt(t + 1, { x: 0, y: 0, z: 0 });
        expectClose(a, b);
      }),
      { numRuns: 200 },
    );
  });

  it('open curves return the start point for t below 0 and the end point for t above 1', () => {
    fc.assert(
      fc.property(
        arbPointList(false),
        arbBelow,
        arbAbove,
        (points, below, above) => {
          const curve = createCurve(points, false);
          expectClose(curve.pointAt(below, { x: 0, y: 0, z: 0 }), curve.pointAt(0, { x: 0, y: 0, z: 0 }));
          expectClose(curve.pointAt(above, { x: 0, y: 0, z: 0 }), curve.pointAt(1, { x: 0, y: 0, z: 0 }));
        },
      ),
      { numRuns: 200 },
    );
  });

  it('example: closed square wraps t = 1.25 to t = 0.25 and open line clamps t = 2 to its end', () => {
    const square = createCurve(
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 0, z: 1 },
        { x: 0, y: 0, z: 1 },
      ],
      true,
    );
    expectClose(square.pointAt(1.25), square.pointAt(0.25));
    expectClose(square.pointAt(-0.75), square.pointAt(0.25));

    const line = createCurve(
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
      ],
      false,
    );
    expectClose(line.pointAt(2), { x: 2, y: 0, z: 0 });
    expectClose(line.pointAt(-3), { x: 0, y: 0, z: 0 });
  });
});
