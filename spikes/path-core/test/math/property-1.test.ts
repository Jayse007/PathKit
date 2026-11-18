import { describe, it } from 'vitest';
import fc from 'fast-check';
import {
  add, sub, scale, dot, cross, length, normalize, lerp,
  quatFromBasis, quatMul, quatInverse, rotateVec, slerp, quatAngle,
} from '../../src/math';
import { arbVec3, arbUnitQuat } from '../helpers/basic-generators';

// Feature: path-core, Property 1: Math functions do not mutate inputs
// **Validates: Requirements 1.6, 10.10**

const arbScalar = fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true });
const arbT = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

const copy = <T extends object>(o: T): T => ({ ...o });

/**
 * Runs `call` on frozen inputs (plain objects, so freezing is safe) with and
 * without a separate `out` object, and checks that each input still equals a
 * copy taken beforehand. A write to a frozen object throws in strict mode.
 */
function inputsUnchanged(inputs: object[], call: (withOut: boolean) => void): boolean {
  const before = inputs.map(copy);
  inputs.forEach((i) => Object.freeze(i));
  call(false);
  call(true);
  return inputs.every((i, k) => JSON.stringify(i) === JSON.stringify(before[k]) &&
    Object.keys(i).every((key) => Object.is((i as Record<string, number>)[key], (before[k] as Record<string, number>)[key])));
}

const v = () => ({ x: 0, y: 0, z: 0 });
const q = () => ({ x: 0, y: 0, z: 0, w: 1 });

describe('Property 1: Math functions do not mutate inputs', () => {
  it('binary vector functions', () => {
    fc.assert(
      fc.property(arbVec3, arbVec3, arbScalar, arbT, (a, b, s, t) =>
        inputsUnchanged([a, b], (o) => {
          add(a, b, o ? v() : undefined);
          sub(a, b, o ? v() : undefined);
          scale(a, s, o ? v() : undefined);
          dot(a, b);
          cross(a, b, o ? v() : undefined);
          lerp(a, b, t, o ? v() : undefined);
        }),
      ),
      { numRuns: 100 },
    );
  });

  it('unary vector functions', () => {
    fc.assert(
      fc.property(arbVec3, (a) =>
        inputsUnchanged([a], (o) => {
          length(a);
          normalize(a, o ? v() : undefined);
        }),
      ),
      { numRuns: 100 },
    );
  });

  it('quaternion functions', () => {
    fc.assert(
      fc.property(arbUnitQuat, arbUnitQuat, arbVec3, arbT, (a, b, vec, t) =>
        inputsUnchanged([a, b, vec], (o) => {
          quatMul(a, b, o ? q() : undefined);
          quatInverse(a, o ? q() : undefined);
          rotateVec(a, vec, o ? v() : undefined);
          slerp(a, b, t, o ? q() : undefined);
          quatAngle(a, b);
        }),
      ),
      { numRuns: 100 },
    );
  });

  it('quatFromBasis', () => {
    fc.assert(
      fc.property(arbVec3, arbVec3, arbVec3, (x, y, z) =>
        inputsUnchanged([x, y, z], (o) => {
          quatFromBasis(x, y, z, o ? q() : undefined);
        }),
      ),
      { numRuns: 100 },
    );
  });
});
