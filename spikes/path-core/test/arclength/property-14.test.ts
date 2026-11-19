import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import { createArcLengthTable } from '../../src/arclength.js';
import { arbCurveInput } from '../helpers/basic-generators.js';

// Feature: path-core, Property 14: Tangents at a distance are unit length and outputs are reused
// **Validates: Requirements 3.4, 3.8**

const TOLERANCE = 1e-9;
const RAW_MAX = 1000000;

const arbRaw = fc.integer({ min: 0, max: RAW_MAX });

/** Maps an integer in [0, RAW_MAX] onto [-3 * length, 4 * length]. */
const toDistance = (raw: number, length: number): number =>
  -3 * length + (raw / RAW_MAX) * 7 * length;

const norm = (v: { x: number; y: number; z: number }): number =>
  Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

describe('Property 14: Tangents at a distance are unit length and outputs are reused', () => {
  it('tangentAtDistance is unit length and both functions return the passed out object', () => {
    fc.assert(
      fc.property(arbCurveInput, arbRaw, (input, raw) => {
        const curve = createCurve(input.points, input.closed);
        const table = createArcLengthTable(curve);
        const d = toDistance(raw, table.length);

        const tangentOut = { x: 0, y: 0, z: 0 };
        const tangentResult = table.tangentAtDistance(d, tangentOut);
        expect(tangentResult).toBe(tangentOut);
        expect(Math.abs(norm(tangentResult) - 1)).toBeLessThanOrEqual(TOLERANCE);

        const pointOut = { x: 0, y: 0, z: 0 };
        const pointResult = table.pointAtDistance(d, pointOut);
        expect(pointResult).toBe(pointOut);
      }),
      { numRuns: 200 },
    );
  });
});

describe('Closed square example', () => {
  it('returns unit tangents and the passed out object at 0, a whole multiple of the length and a negative distance', () => {
    const curve = createCurve(
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      true,
    );
    const table = createArcLengthTable(curve);
    const distances = [0, table.length, 2 * table.length, -table.length, -0.3, 0.7, 2.5];
    for (const d of distances) {
      const tangentOut = { x: 0, y: 0, z: 0 };
      const tangentResult = table.tangentAtDistance(d, tangentOut);
      expect(tangentResult).toBe(tangentOut);
      expect(Math.abs(norm(tangentResult) - 1)).toBeLessThanOrEqual(TOLERANCE);

      const pointOut = { x: 0, y: 0, z: 0 };
      expect(table.pointAtDistance(d, pointOut)).toBe(pointOut);
    }
  });
});
