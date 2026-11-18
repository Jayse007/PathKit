import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve';
import type { Vec3 } from '../../src/math';
import { arbPointList } from '../helpers/basic-generators';

// Feature: path-core, Property 7: Closed curve joins continuously
// **Validates: Requirements 2.2**

const TOL = 1e-6;
const NEAR_END = 1 - 1e-9;

const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('Property 7: Closed curve joins continuously', () => {
  it('pointAt/tangentAt at t=1 equal those at t=0 within 1e-6', () => {
    fc.assert(
      fc.property(arbPointList(true), (points) => {
        const curve = createCurve(points, true);
        expect(dist(curve.pointAt(1), curve.pointAt(0))).toBeLessThanOrEqual(TOL);
        expect(dist(curve.tangentAt(1), curve.tangentAt(0))).toBeLessThanOrEqual(TOL);
      }),
      { numRuns: 200 },
    );
  });

  it('position at t=1-1e-9 is within 1e-6 of t=0, and the tangent is continuous at the join', () => {
    fc.assert(
      fc.property(arbPointList(true), (points) => {
        // Same coincidence test as createCurve (exact coordinate equality).
        // When both neighbours of the first point are the same spot, the join is a cusp.
        const a = points[points.length - 1];
        const b = points[1];
        fc.pre(!(a.x === b.x && a.y === b.y && a.z === b.z));
        const curve = createCurve(points, true);
        expect(dist(curve.pointAt(NEAR_END), curve.pointAt(0))).toBeLessThanOrEqual(TOL);
        const t0 = curve.tangentAt(0);
        const d9 = dist(curve.tangentAt(NEAR_END), t0);
        const d6 = dist(curve.tangentAt(1 - 1e-6), t0);
        expect(d9).toBeLessThanOrEqual(d6 / 100 + 1e-12);
      }),
      { numRuns: 200 },
    );
  });

  it('example: closed square joins at t=0 and t=1', () => {
    const pts: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 },
      { x: 4, y: 0, z: 4 },
      { x: 0, y: 0, z: 4 },
    ];
    const curve = createCurve(pts, true);
    expect(dist(curve.pointAt(1), curve.pointAt(0))).toBeLessThanOrEqual(TOL);
    expect(dist(curve.tangentAt(NEAR_END), curve.tangentAt(0))).toBeLessThanOrEqual(TOL);
  });
});
