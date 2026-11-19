import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import { frenetFrames, rotationMinimizingFrames } from '../../src/frames.js';
import type { Vec3 } from '../helpers/basic-generators.js';

// Feature: path-core, Property 19: Invalid frame counts are rejected
// **Validates: Requirements 4.8**

const curve = createCurve(
  [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 1, z: 0 },
  ],
  false,
);

// toThrow(new Error(message)) compares the thrown error's message for equality
// (toThrow('text') would only check that the message contains the text).
const expectedMessage = (count: number): string =>
  `Frame count must be an integer >= 2, got ${count}`;

const arbInvalidCount: fc.Arbitrary<number> = fc.oneof(
  // (a) integers below 2
  fc.integer({ min: -1000, max: 1 }),
  // (b) non-integer fractions, both below and above 2
  fc
    .integer({ min: -100000, max: 1000000 })
    .map((i) => i / 7)
    .filter((x) => !Number.isInteger(x)),
  // (c) special values and values near the boundary
  fc.constantFrom(NaN, Infinity, -Infinity, 1.9999999, 2.0000001, 0.5, -0.5),
);

describe('Property 19: Invalid frame counts are rejected', () => {
  it('both frame builders throw the exact count message for any invalid count', () => {
    fc.assert(
      fc.property(arbInvalidCount, (count) => {
        const message = expectedMessage(count);
        expect(() => rotationMinimizingFrames(curve, count)).toThrow(new Error(message));
        expect(() => frenetFrames(curve, count)).toThrow(new Error(message));
      }),
      { numRuns: 200 },
    );
  });

  it('count 2 is accepted and returns exactly 2 frames; count 1 is rejected', () => {
    expect(rotationMinimizingFrames(curve, 2).length).toBe(2);
    expect(frenetFrames(curve, 2).length).toBe(2);

    const message = expectedMessage(1);
    expect(() => rotationMinimizingFrames(curve, 1)).toThrow(new Error(message));
    expect(() => frenetFrames(curve, 1)).toThrow(new Error(message));
  });

  it('count is validated before initialUp', () => {
    // The spec validates count first, so a NaN initialUp must not change the error.
    const badUp: Vec3 = { x: NaN, y: NaN, z: NaN };
    for (const count of [0, NaN]) {
      expect(() => rotationMinimizingFrames(curve, count, badUp)).toThrow(
        new Error(expectedMessage(count)),
      );
    }
  });
});
