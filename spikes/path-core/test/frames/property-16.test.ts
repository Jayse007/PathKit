import { describe, it } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import { rotationMinimizingFrames } from '../../src/frames.js';
import { dot, length, normalize, scale, sub } from '../../src/math.js';
import { arbCurveInput, arbVec3 } from '../helpers/basic-generators.js';
import type { Vec3 } from '../helpers/basic-generators.js';

// Feature: path-core, Property 16: RMF first normal follows the up vector
// **Validates: Requirements 4.3, 4.4**

const TOLERANCE = 1e-6;
// Property 16 covers only initialUp that is not parallel to the first tangent.
// Near-parallel inputs (perpendicular part shorter than this) belong to Property 15.
const MIN_PERP_LENGTH = 1e-3;

const arbCount = fc.integer({ min: 2, max: 50 });

// Magnitude 1..100 spread evenly (integers), sign drawn separately.
const arbFactor = fc
  .tuple(fc.integer({ min: 1, max: 100 }), fc.boolean())
  .map(([magnitude, negative]) => (negative ? -magnitude : magnitude));

/** Perpendicular part of `v` relative to the unit tangent `t0`, computed with plain helpers. */
const perpendicularPart = (v: Vec3, t0: Vec3): Vec3 => sub(v, scale(t0, dot(v, t0)));

// Once-per-run check, so expect would be fine, but a plain comparison gives a clearer message.
function requireClose(label: string, actual: Vec3, expected: Vec3): void {
  for (const axis of ['x', 'y', 'z'] as const) {
    const dev = Math.abs(actual[axis] - expected[axis]);
    if (!(dev <= TOLERANCE)) {
      throw new Error(
        `${label}: ${axis} = ${actual[axis]}, expected ${expected[axis]} (deviation ${dev} exceeds ${TOLERANCE})`,
      );
    }
  }
}

describe('Property 16: RMF first normal follows the up vector', () => {
  it('first normal equals normalize(initialUp - dot(initialUp, t0) * t0) for a given initialUp', () => {
    fc.assert(
      fc.property(arbCurveInput, arbVec3, arbCount, (input, initialUp, count) => {
        const curve = createCurve(input.points, input.closed);
        const t0 = curve.tangentAt(0);
        const perp = perpendicularPart(initialUp, t0);
        if (length(perp) < MIN_PERP_LENGTH) return true;
        const expected = normalize(perp);

        const frames = rotationMinimizingFrames(curve, count, initialUp);
        requireClose('first normal with initialUp', frames[0].normal, expected);
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it('first normal uses (0,1,0) when initialUp is omitted', () => {
    fc.assert(
      fc.property(arbCurveInput, arbCount, (input, count) => {
        const curve = createCurve(input.points, input.closed);
        const t0 = curve.tangentAt(0);
        const perp = perpendicularPart({ x: 0, y: 1, z: 0 }, t0);
        if (length(perp) < MIN_PERP_LENGTH) return true;
        const expected = normalize(perp);

        const frames = rotationMinimizingFrames(curve, count);
        requireClose('first normal with omitted initialUp', frames[0].normal, expected);
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it('a large component of initialUp along t0 (either sign) does not change the first normal', () => {
    fc.assert(
      fc.property(arbCurveInput, arbVec3, arbFactor, arbCount, (input, sample, k, count) => {
        const curve = createCurve(input.points, input.closed);
        const t0 = curve.tangentAt(0);
        const p = perpendicularPart(sample, t0);
        if (length(p) < MIN_PERP_LENGTH) return true;

        const kt0 = scale(t0, k);
        const initialUp: Vec3 = { x: p.x + kt0.x, y: p.y + kt0.y, z: p.z + kt0.z };
        const expected = normalize(p);

        const frames = rotationMinimizingFrames(curve, count, initialUp);
        requireClose('first normal with forced tangent component', frames[0].normal, expected);
        return true;
      }),
      { numRuns: 200 },
    );
  });
});
