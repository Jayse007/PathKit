import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import type { Vec3 } from '../../src/math.js';
import { arbPointList } from '../helpers/basic-generators.js';

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
    let total = 0;
    let skipped = 0;
    fc.assert(
      fc.property(arbPointList(true), (points) => {
        // When the curve reverses direction at the first point (arriving and leaving
        // unit directions are opposite), the join is a cusp and the tangent flips.
        total++;
        const prev = points[points.length - 1];
        const p0 = points[0];
        const next = points[1];
        const inLen = dist(p0, prev);
        const outLen = dist(next, p0);
        if (inLen > 0 && outLen > 0) {
          const dot =
            ((p0.x - prev.x) * (next.x - p0.x) +
              (p0.y - prev.y) * (next.y - p0.y) +
              (p0.z - prev.z) * (next.z - p0.z)) /
            (inLen * outLen);
          if (dot <= -1 + 1e-9) {
            skipped++;
            fc.pre(false);
          }
        }
        const curve = createCurve(points, true);
        expect(dist(curve.pointAt(NEAR_END), curve.pointAt(0))).toBeLessThanOrEqual(TOL);
        const t0 = curve.tangentAt(0);
        const d9 = dist(curve.tangentAt(NEAR_END), t0);
        const d6 = dist(curve.tangentAt(1 - 1e-6), t0);
        expect(d9).toBeLessThanOrEqual(d6 / 100 + 1e-12);
      }),
      { numRuns: 200 },
    );
    console.log(`Property 7 reversal skip: ${skipped} of ${total} generated curves`);
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
