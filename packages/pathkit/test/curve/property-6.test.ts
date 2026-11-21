import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import type { Vec3 } from '../../src/math.js';
import { arbCurveInput } from '../helpers/basic-generators.js';

// Feature: path-core, Property 6: Curve interpolates its points and endpoints
// **Validates: Requirements 2.1, 2.3, 2.4**

const TOL = 1e-6;

const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('Property 6: Curve interpolates its points and endpoints', () => {
  it('pointAt at each knot parameter i / segmentCount equals point i within 1e-6', () => {
    fc.assert(
      fc.property(arbCurveInput, ({ points, closed }) => {
        const curve = createCurve(points, closed);
        const n = points.length;
        const segmentCount = closed ? n : n - 1;
        const out: Vec3 = { x: 0, y: 0, z: 0 };
        for (let i = 0; i < n; i++) {
          const p = curve.pointAt(i / segmentCount, out);
          expect(dist(p, points[i])).toBeLessThanOrEqual(TOL);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('open curves start at the first point and end at the last point', () => {
    fc.assert(
      fc.property(
        arbCurveInput.filter((c) => !c.closed),
        ({ points }) => {
          const curve = createCurve(points, false);
          const out: Vec3 = { x: 0, y: 0, z: 0 };
          expect(dist(curve.pointAt(0, out), points[0])).toBeLessThanOrEqual(TOL);
          expect(dist(curve.pointAt(1, out), points[points.length - 1])).toBeLessThanOrEqual(TOL);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('example: open curve through three points passes through each', () => {
    const pts: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 0 },
      { x: 3, y: 2, z: 1 },
    ];
    const curve = createCurve(pts, false);
    expect(dist(curve.pointAt(0), pts[0])).toBeLessThanOrEqual(TOL);
    expect(dist(curve.pointAt(0.5), pts[1])).toBeLessThanOrEqual(TOL);
    expect(dist(curve.pointAt(1), pts[2])).toBeLessThanOrEqual(TOL);
  });
});
