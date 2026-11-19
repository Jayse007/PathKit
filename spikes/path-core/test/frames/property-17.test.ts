import { describe, it } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import { frenetFrames, rotationMinimizingFrames } from '../../src/frames.js';
import { smoothCurvePoints } from '../helpers/smooth-curve-generator.js';
import { totalTwist } from '../helpers/twist.js';

// Feature: path-core, Property 17: RMF has less twist than Frenet frames
// **Validates: Requirements 4.2**

const SLACK = 1e-4;

describe('Property 17: RMF has less twist than Frenet frames', () => {
  it('RMF total twist is at most Frenet total twist plus 1e-4 on smooth open curves', () => {
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
      }),
      { numRuns: 200 },
    );
  });
});
