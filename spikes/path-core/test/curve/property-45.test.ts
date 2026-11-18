import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import { arbPointList, arbT } from '../helpers/basic-generators.js';

// Feature: path-core, Property 45: Reversing an open curve reverses its parameter
// **Validates: Requirements 2.9**

const TOL = 1e-6;

describe('Property 45: Reversing an open curve reverses its parameter', () => {
  it('reversed.pointAt(1 - t) equals original.pointAt(t) within 1e-6', () => {
    fc.assert(
      fc.property(arbPointList(false), arbT, (points, t) => {
        const original = createCurve(points, false);
        const reversedPoints = points.slice().reverse();
        const reversed = createCurve(reversedPoints, false);
        const a = original.pointAt(t, { x: 0, y: 0, z: 0 });
        const b = reversed.pointAt(1 - t, { x: 0, y: 0, z: 0 });
        expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(TOL);
        expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(TOL);
        expect(Math.abs(a.z - b.z)).toBeLessThanOrEqual(TOL);
      }),
      { numRuns: 200 },
    );
  });

  it('does not mutate the input point list', () => {
    fc.assert(
      fc.property(arbPointList(false), (points) => {
        const snapshot = points.map((p) => ({ x: p.x, y: p.y, z: p.z }));
        createCurve(points.slice().reverse(), false);
        expect(points).toEqual(snapshot);
      }),
      { numRuns: 100 },
    );
  });

  it('example: a 3-point line reversed maps t to 1 - t', () => {
    const pts = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 },
    ];
    const original = createCurve(pts, false);
    const reversed = createCurve(pts.slice().reverse(), false);
    for (const t of [0, 0.25, 0.5, 1]) {
      const a = original.pointAt(t);
      const b = reversed.pointAt(1 - t);
      expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(TOL);
    }
  });
});
