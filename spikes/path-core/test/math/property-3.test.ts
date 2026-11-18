import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { normalize } from '../../src/math';
import { arbVec3 } from '../helpers/basic-generators';

// Feature: path-core, Property 3: Normalize yields unit or zero
// **Validates: Requirements 1.4**

const EPS = 1e-12;
const tiny = (m: number) => fc.double({ min: -m, max: m, noNaN: true, noDefaultInfinity: true });

// Mix of ordinary vectors, vectors around the 1e-12 threshold, and exact zero.
const arbInput = fc.oneof(
  arbVec3,
  fc.record({ x: tiny(1e-11), y: tiny(1e-11), z: tiny(1e-11) }),
  fc.record({ x: tiny(1e-9), y: tiny(1e-9), z: tiny(1e-9) }),
  fc.constant({ x: 0, y: 0, z: 0 }),
);

describe('Property 3: Normalize yields unit or zero', () => {
  it('result is a unit vector for length >= 1e-12 and the zero vector below it', () => {
    fc.assert(
      fc.property(arbInput, (v) => {
        const len = Math.hypot(v.x, v.y, v.z);
        const r = normalize(v);
        const rLen = Math.hypot(r.x, r.y, r.z);
        const isZero = r.x === 0 && r.y === 0 && r.z === 0;
        // Either exactly zero or unit length.
        expect(isZero || Math.abs(rLen - 1) <= 1e-9).toBe(true);
        // Clear of the threshold, the branch is determined (margin absorbs rounding in the length).
        if (len >= EPS * 1.0001) {
          expect(Math.abs(rLen - 1)).toBeLessThanOrEqual(1e-9);
        } else if (len <= EPS * 0.9999) {
          expect(isZero).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('zero vector normalizes to zero', () => {
    expect(normalize({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('a vector just below 1e-12 normalizes to zero', () => {
    expect(normalize({ x: 5e-13, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 });
  });
});
