import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import {
  AXIS_UNIT,
  FORCED_ORBIT_CASES,
  arbOrbitCase,
  bakedPosition,
  buildOrbitScene,
  centreAt,
  cross3,
  dot3,
  scaleOf,
  sub3,
} from '../helpers/orbit-generators.js';
import type { OrbitCase } from '../helpers/orbit-generators.js';

// Feature: orbit-around, Property O3: Consecutive frames differ by speed / fps degrees
// Validates: Requirements 2.1, 2.15, 8.8
//
// The signed angle about the axis from the offset at frame f to the offset at frame f + 1 is
// atan2(dot(cross(a, b), axis), dot(a, b)), written here with plain arithmetic.
// With |speed / fps| <= 179 degrees the angle is unique, so no wrap is needed.
// Source lines this should catch: `(c.speed * frame) / fps` changed to `c.speed * frame`, or the `/ 180` removed.

const ANGLE_TOL = 1e-9; // radians

function checkAngularStep(c: OrbitCase): void {
  const baked = bake(buildOrbitScene(c));
  const axis = AXIS_UNIT[c.axis];
  const expected = ((c.speed / c.fps) * Math.PI) / 180; // radians per frame
  const positionA = [0, 0, 0];
  const positionB = [0, 0, 0];
  const centre = [0, 0, 0];
  const a = [0, 0, 0];
  const b = [0, 0, 0];
  const crossed = [0, 0, 0];
  let pairsChecked = 0;
  for (let frame = 0; frame + 1 < c.frameCount; frame++) {
    bakedPosition(baked, 0, frame, positionA);
    centreAt(c, frame, centre);
    sub3(positionA, centre, a);
    bakedPosition(baked, 0, frame + 1, positionB);
    centreAt(c, frame + 1, centre);
    sub3(positionB, centre, b);
    cross3(a, b, crossed);
    const angle = Math.atan2(dot3(crossed, axis), dot3(a, b));
    if (!(Math.abs(angle - expected) <= ANGLE_TOL)) {
      throw new Error(
        `Property O3: frames ${frame} to ${frame + 1}: signed angle ${angle} rad, expected ${expected} rad (speed ${c.speed}, fps ${c.fps}); case ${JSON.stringify(c)}`,
      );
    }
    pairsChecked++;
  }
  expect(pairsChecked).toBe(c.frameCount - 1);
}

const FORCED: OrbitCase[] = [
  // a turn of exactly 90 degrees per frame, startAngle 0, two frames (first and last pair)
  ...[24, 30, 60].map((fps): OrbitCase => ({
    fps,
    frameCount: 2,
    axis: '+Y',
    radius: 5,
    speed: 90 * fps,
    startAngle: 0,
    centre: { kind: 'static', c: [0, 0, 0] },
  })),
  // 179 degrees per frame in both directions
  { ...FORCED_ORBIT_CASES[0], radius: 0.1, speed: 179 * 30, frameCount: 20 },
  { ...FORCED_ORBIT_CASES[0], radius: 0.1, speed: -179 * 30, frameCount: 20, axis: '-X' },
  // one case per axis
  ...FORCED_ORBIT_CASES.slice(5).map((c): OrbitCase => ({ ...c, speed: 90 * c.fps, frameCount: 5 })),
];

describe('Feature: orbit-around, Property O3: Consecutive frames differ by speed / fps degrees', () => {
  it('the signed angle between consecutive offsets is speed / fps degrees', () => {
    fc.assert(
      fc.property(arbOrbitCase({ minRadius: 0.1, maxDegreesPerFrame: 179 }), (c) => {
        checkAngularStep(c);
      }),
      { numRuns: 100, examples: FORCED.map((c) => [c] as [OrbitCase]) },
    );
  });

  it('forced: a turn of exactly 90 degrees per frame, and every axis', () => {
    expect(FORCED.some((c) => c.speed === 90 * c.fps && c.startAngle === 0)).toBe(true);
    expect(new Set(FORCED.map((c) => c.axis)).size).toBe(6);
    for (const c of FORCED) {
      expect(scaleOf(c)).toBeGreaterThan(0);
      checkAngularStep(c);
    }
  });
});
