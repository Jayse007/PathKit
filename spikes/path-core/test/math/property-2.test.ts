import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  add, sub, scale, cross, normalize, lerp,
  quatFromBasis, quatMul, quatInverse, rotateVec, slerp,
} from '../../src/math';
import { arbVec3, arbUnitQuat } from '../helpers/basic-generators';

// Feature: path-core, Property 2: Output arguments are written and returned
// **Validates: Requirements 1.7**

const arbScalar = fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true });
const arbT = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

// Pre-filled with values no result is expected to equal, so an unwritten field is detected.
const dirtyV = () => ({ x: 12345.5, y: -6789.25, z: 4242.75 });
const dirtyQ = () => ({ x: 12345.5, y: -6789.25, z: 4242.75, w: -999.125 });

/** With `out` given, the function returns that same object and writes the same values as the call without `out`. */
function checkOut<T extends object>(withoutOut: T, out: T, call: (o: T) => T): void {
  const returned = call(out);
  expect(returned).toBe(out);
  for (const key of Object.keys(withoutOut)) {
    expect(Object.is((out as Record<string, number>)[key], (withoutOut as Record<string, number>)[key])).toBe(true);
  }
}

describe('Property 2: Output arguments are written and returned', () => {
  it('vector functions', () => {
    fc.assert(
      fc.property(arbVec3, arbVec3, arbScalar, arbT, (a, b, s, t) => {
        checkOut(add(a, b), dirtyV(), (o) => add(a, b, o));
        checkOut(sub(a, b), dirtyV(), (o) => sub(a, b, o));
        checkOut(scale(a, s), dirtyV(), (o) => scale(a, s, o));
        checkOut(cross(a, b), dirtyV(), (o) => cross(a, b, o));
        checkOut(normalize(a), dirtyV(), (o) => normalize(a, o));
        checkOut(lerp(a, b, t), dirtyV(), (o) => lerp(a, b, t, o));
      }),
      { numRuns: 100 },
    );
  });

  it('normalize writes the zero vector into out for a zero input', () => {
    const out = dirtyV();
    expect(normalize({ x: 0, y: 0, z: 0 }, out)).toBe(out);
    expect(out).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('quaternion functions', () => {
    fc.assert(
      fc.property(arbUnitQuat, arbUnitQuat, arbVec3, arbT, (a, b, vec, t) => {
        checkOut(quatMul(a, b), dirtyQ(), (o) => quatMul(a, b, o));
        checkOut(quatInverse(a), dirtyQ(), (o) => quatInverse(a, o));
        checkOut(rotateVec(a, vec), dirtyV(), (o) => rotateVec(a, vec, o));
        checkOut(slerp(a, b, t), dirtyQ(), (o) => slerp(a, b, t, o));
      }),
      { numRuns: 100 },
    );
  });

  it('quatFromBasis', () => {
    fc.assert(
      fc.property(arbVec3, arbVec3, arbVec3, (x, y, z) => {
        checkOut(quatFromBasis(x, y, z), dirtyQ(), (o) => quatFromBasis(x, y, z, o));
      }),
      { numRuns: 100 },
    );
  });
});
