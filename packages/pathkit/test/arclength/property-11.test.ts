import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import type { Curve } from '../../src/curve.js';
import { createArcLengthTable } from '../../src/arclength.js';
import { arbCurveInput } from '../helpers/basic-generators.js';

// Feature: path-core, Property 11: Arc-length table is bounded and consistent
// **Validates: Requirements 3.1, 3.2**

const DENSE_SEGMENTS = 4096; // 4097 sample points, t = i / 4096 from 0 to 1 inclusive
const TOLERANCE = 0.01; // 1 percent

/** Sum of chord lengths between pointAt at evenly spaced t in [0, 1]. */
const densePolylineLength = (curve: Curve): number => {
  const prev = { x: 0, y: 0, z: 0 };
  const cur = { x: 0, y: 0, z: 0 };
  curve.pointAt(0, prev);
  let total = 0;
  for (let i = 1; i <= DENSE_SEGMENTS; i++) {
    curve.pointAt(i / DENSE_SEGMENTS, cur);
    total += Math.hypot(cur.x - prev.x, cur.y - prev.y, cur.z - prev.z);
    prev.x = cur.x;
    prev.y = cur.y;
    prev.z = cur.z;
  }
  return total;
};

describe('Property 11: Arc-length table is bounded and consistent', () => {
  it('has exactly 1024 entries, a positive length, and a length within 1 percent of a dense polyline', () => {
    fc.assert(
      fc.property(arbCurveInput, ({ points, closed }) => {
        const curve = createCurve(points, closed);
        const table = createArcLengthTable(curve);
        expect(table.entryCount).toBe(1024);
        expect(table.length).toBeGreaterThan(0);
        const dense = densePolylineLength(curve);
        expect(Math.abs(table.length - dense)).toBeLessThanOrEqual(TOLERANCE * dense);
      }),
      { numRuns: 200 },
    );
  });

  it('example: a straight open line has length equal to its end-to-end distance', () => {
    const curve = createCurve(
      [
        { x: 0, y: 0, z: 0 },
        { x: 3, y: 0, z: 0 },
        { x: 6, y: 0, z: 0 },
      ],
      false,
    );
    const table = createArcLengthTable(curve);
    expect(table.entryCount).toBe(1024);
    expect(Math.abs(table.length - 6)).toBeLessThanOrEqual(0.06);
  });
});
