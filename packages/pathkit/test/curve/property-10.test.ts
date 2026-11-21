import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import type { Vec3 } from '../../src/math.js';
import { arbClosed, arbPointList, arbVec3 } from '../helpers/basic-generators.js';

// Feature: path-core, Property 10: Invalid curve inputs are rejected with informative errors
// **Validates: Requirements 2.6, 2.7**

const messageOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    return (e as Error).message;
  }
  return '';
};

const arbIndexSeed = fc.integer({ min: 0, max: 1000000 });

describe('Property 10: Invalid curve inputs are rejected with informative errors', () => {
  it('fewer than 2 points throws an error with the minimum 2 and the supplied count', () => {
    fc.assert(
      fc.property(fc.array(arbVec3, { minLength: 0, maxLength: 1 }), arbClosed, (points, closed) => {
        expect(messageOf(() => createCurve(points, closed))).toBe(
          `Curve needs at least 2 points, got ${points.length}`,
        );
      }),
      { numRuns: 200 },
    );
  });

  it('closed curves with exactly 2 points throw an error with the minimum 3 and the count 2', () => {
    fc.assert(
      fc.property(arbPointList(false, 2, 2), (points) => {
        expect(points.length).toBe(2);
        expect(messageOf(() => createCurve(points, true))).toBe(
          'Closed curve needs at least 3 points, got 2',
        );
      }),
      { numRuns: 200 },
    );
  });

  it('coincident consecutive points throw an error naming both indexes', () => {
    fc.assert(
      fc.property(
        arbClosed.chain((closed) => arbPointList(closed).map((points) => ({ points, closed }))),
        arbIndexSeed,
        ({ points, closed }, seed) => {
          const n = points.length;
          const i = seed % (n - 1);
          const bad: Vec3[] = points.map((p) => ({ x: p.x, y: p.y, z: p.z }));
          bad[i + 1] = { x: bad[i].x, y: bad[i].y, z: bad[i].z };
          expect(messageOf(() => createCurve(bad, closed))).toBe(
            `Coincident points at indexes ${i} and ${i + 1}`,
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('closed curves with coincident last and first points throw an error naming both indexes', () => {
    fc.assert(
      fc.property(arbPointList(true), (points) => {
        const n = points.length;
        const bad: Vec3[] = points.map((p) => ({ x: p.x, y: p.y, z: p.z }));
        bad[0] = { x: bad[n - 1].x, y: bad[n - 1].y, z: bad[n - 1].z };
        expect(messageOf(() => createCurve(bad, true))).toBe(
          `Coincident points at indexes ${n - 1} and 0`,
        );
      }),
      { numRuns: 200 },
    );
  });

  it('example: non-neighbouring coincident points are accepted', () => {
    // Only consecutive points (and, for closed curves, the last and first) may not coincide.
    const points: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 1, y: 0, z: 0 },
    ];
    expect(() => createCurve(points, true)).not.toThrow();
    expect(() => createCurve(points, false)).not.toThrow();
  });

  it('example: empty list, single point and closed pair', () => {
    expect(() => createCurve([], false)).toThrow('Curve needs at least 2 points, got 0');
    expect(() => createCurve([{ x: 0, y: 0, z: 0 }], true)).toThrow('Curve needs at least 2 points, got 1');
    expect(() => createCurve([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }], true)).toThrow(
      'Closed curve needs at least 3 points, got 2',
    );
  });
});
