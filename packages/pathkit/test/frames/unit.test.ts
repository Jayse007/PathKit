import { describe, it, expect } from 'vitest';
import { createCurve } from '../../src/curve.js';
import { frenetFrames, rotationMinimizingFrames } from '../../src/frames.js';
import type { Frame } from '../../src/frames.js';
import { stepTwists } from '../helpers/twist.js';

// Unit tests for frames: the Frenet flip at an inflection point (Requirements 4.2, 4.7)

const COUNT = 200;

// Planar S-shaped curve (z = 0). It bends one way, then the other,
// with an inflection point near (4, 0, 0).
const curve = createCurve(
  [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 2, y: 1.6, z: 0 },
    { x: 3, y: 1, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 5, y: -1, z: 0 },
    { x: 6, y: -1.6, z: 0 },
    { x: 7, y: -1, z: 0 },
    { x: 8, y: 0, z: 0 },
  ],
  false,
);

function largestStepTwist(frames: Frame[]): number {
  const twists = stepTwists(frames);
  let max = 0;
  for (let i = 0; i < twists.length; i++) {
    if (twists[i] > max) max = twists[i];
  }
  return max;
}

describe('Frenet flip at an inflection point', () => {
  // At the inflection point the curvature changes sign, so the Frenet normal flips to the opposite side within one step.
  it('frenetFrames has a single step with twist above 1 radian', () => {
    const maxTwist = largestStepTwist(frenetFrames(curve, COUNT));
    expect(maxTwist, `largest Frenet step twist was ${maxTwist}`).toBeGreaterThan(1);
  });

  // The RMF carries the normal along without the flip.
  it('rotationMinimizingFrames keeps every step twist below 0.001', () => {
    const maxTwist = largestStepTwist(rotationMinimizingFrames(curve, COUNT));
    expect(maxTwist, `largest RMF step twist was ${maxTwist}`).toBeLessThan(0.001);
  });
});
