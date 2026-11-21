import { describe, it } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import { frenetFrames, rotationMinimizingFrames } from '../../src/frames.js';
import { smoothCurvePoints } from '../helpers/smooth-curve-generator.js';
import { totalTwist } from '../helpers/twist.js';

// Feature: path-core, Property 17: RMF has less twist than Frenet frames
// **Validates: Requirements 4.2**

const SLACK = 1e-4;
// Empirical bound: the largest RMF total twist seen over 10,000 generated curves was 0.0067. It makes the test fail for an RMF that merely stays below the Frenet total, such as one that follows a fixed up vector.
const ABSOLUTE_BOUND = 0.02;

describe('Property 17: RMF has less twist than Frenet frames', () => {
  it('RMF total twist is at most the Frenet total plus 1e-4, and at most 0.02, on smooth open curves', () => {
    fc.assert(
      fc.property(smoothCurvePoints, ({ points, N }) => {
        const curve = createCurve(points, false);
        const count = N;
        const rmf = totalTwist(rotationMinimizingFrames(curve, count));
        const frenet = totalTwist(frenetFrames(curve, count));
        // Plain comparison, written so NaN fails.
        if (!(rmf <= frenet + SLACK)) {
          throw new Error(
            `RMF total twist ${rmf} exceeds Frenet total ${frenet} + 1e-4 (count ${count})`,
          );
        }
        if (!(rmf <= ABSOLUTE_BOUND)) {
          throw new Error(
            `RMF total twist ${rmf} exceeds absolute bound ${ABSOLUTE_BOUND} (count ${count})`,
          );
        }
      }),
      { numRuns: 200 },
    );
  });
});
