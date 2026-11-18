import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { quatFromBasis, rotateVec } from '../../src/math';
import type { Vec3, Quat } from '../../src/math';
import { arbUnitQuat } from '../helpers/basic-generators';

// Feature: path-core, Property 4: Quaternion from orthonormal basis rotates the axes
// **Validates: Requirements 1.2**

const TOL = 1e-9;

/** Columns of the rotation matrix of a unit quaternion, from the standard formula (independent of src). */
function basisOf(q: Quat): [Vec3, Vec3, Vec3] {
  const { x, y, z, w } = q;
  return [
    { x: 1 - 2 * (y * y + z * z), y: 2 * (x * y + w * z), z: 2 * (x * z - w * y) },
    { x: 2 * (x * y - w * z), y: 1 - 2 * (x * x + z * z), z: 2 * (y * z + w * x) },
    { x: 2 * (x * z + w * y), y: 2 * (y * z - w * x), z: 1 - 2 * (x * x + y * y) },
  ];
}

function expectRotatesAxes(bx: Vec3, by: Vec3, bz: Vec3) {
  const q = quatFromBasis(bx, by, bz);
  expect(Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1)).toBeLessThanOrEqual(TOL);
  const pairs: [Vec3, Vec3][] = [
    [{ x: 1, y: 0, z: 0 }, bx],
    [{ x: 0, y: 1, z: 0 }, by],
    [{ x: 0, y: 0, z: 1 }, bz],
  ];
  for (const [axis, expected] of pairs) {
    const r = rotateVec(q, axis);
    expect(Math.abs(r.x - expected.x)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(r.y - expected.y)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(r.z - expected.z)).toBeLessThanOrEqual(TOL);
  }
}

describe('Property 4: Quaternion from orthonormal basis rotates the axes', () => {
  it('the resulting unit quaternion maps local x, y, z onto the basis vectors', () => {
    fc.assert(
      fc.property(arbUnitQuat, (q) => {
        const [bx, by, bz] = basisOf(q);
        expectRotatesAxes(bx, by, bz);
      }),
      { numRuns: 200 },
    );
  });

  it('identity basis gives the identity rotation', () => {
    expectRotatesAxes({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 });
  });

  it('180 degree rotations about each axis (non-positive trace branches)', () => {
    expectRotatesAxes({ x: 1, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: -1 });
    expectRotatesAxes({ x: -1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 });
    expectRotatesAxes({ x: -1, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 });
  });
});
