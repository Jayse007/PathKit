import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import type { Vec3 } from '../../src/math.js';
import { arbCurveInput } from '../helpers/basic-generators.js';

// Feature: path-core, Property 8: Tangents are unit length
// **Validates: Requirements 2.5**

const TOL = 1e-6;

const norm = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);

describe('Property 8: Tangents are unit length', () => {
  it('tangentAt returns a finite vector of length 1 within 1e-6 for any t in [0, 1]', () => {
    fc.assert(
      fc.property(
        arbCurveInput,
        fc.integer({ min: 0, max: 1000000 }).map(i => i / 1000000),
        ({ points, closed }, t) => {
          const curve = createCurve(points, closed);
          const out: Vec3 = { x: 0, y: 0, z: 0 };
          const tan = curve.tangentAt(t, out);
          expect(Number.isFinite(tan.x) && Number.isFinite(tan.y) && Number.isFinite(tan.z)).toBe(true);
          expect(Math.abs(norm(tan) - 1)).toBeLessThanOrEqual(TOL);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('tangentAt is unit length at every knot parameter i / segmentCount', () => {
    fc.assert(
      fc.property(arbCurveInput, ({ points, closed }) => {
        const curve = createCurve(points, closed);
        const n = points.length;
        const segmentCount = closed ? n : n - 1;
        for (let i = 0; i <= segmentCount; i++) {
          const tan = curve.tangentAt(i / segmentCount);
          expect(Math.abs(norm(tan) - 1)).toBeLessThanOrEqual(TOL);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('example: straight open curve has tangent (1, 0, 0)', () => {
    const curve = createCurve(
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
      ],
      false,
    );
    const tan = curve.tangentAt(0.25);
    expect(tan.x).toBeCloseTo(1, 6);
    expect(tan.y).toBeCloseTo(0, 6);
    expect(tan.z).toBeCloseTo(0, 6);
  });
});
