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
  sub3,
} from '../helpers/orbit-generators.js';
import type { OrbitCase } from '../helpers/orbit-generators.js';

// Feature: orbit-around, Property O4: The sign of speed gives the turning direction
// Validates: Requirements 2.4, 2.7, 2.17, 8.7
//
// Right-hand rule: for positive speed, dot(cross(offset at f, offset at f + 1), axis) is positive.
// For negative speed it is negative. The same case with the sign of speed reversed gives the reversed sign.
// Source lines this should catch: swapping side1 and side2 in the negative-axis branch (a mirror),
// or flipping the sign of `sin`.

/** Counts the pairs checked. Throws when a pair has the wrong turning direction. */
function checkDirection(c: OrbitCase, label: string): number {
  const baked = bake(buildOrbitScene(c));
  const axis = AXIS_UNIT[c.axis];
  const wanted = c.speed > 0 ? 1 : -1;
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
    const turn = dot3(crossed, axis);
    if (!(turn * wanted > 0)) {
      throw new Error(
        `Property O4 (${label}): frames ${frame} to ${frame + 1}: dot(cross, axis ${c.axis}) = ${turn}, expected sign ${wanted} for speed ${c.speed}; case ${JSON.stringify(c)}`,
      );
    }
    pairsChecked++;
  }
  return pairsChecked;
}

function checkBothDirections(c: OrbitCase): void {
  const forward = checkDirection(c, 'as generated');
  const reversed = checkDirection({ ...c, speed: -c.speed }, 'speed reversed');
  expect(forward).toBe(c.frameCount - 1);
  expect(reversed).toBe(c.frameCount - 1);
}

// A non-zero speed: a zero speed becomes one degree per frame.
const arbTurningCase = arbOrbitCase({ minRadius: 0.1, maxDegreesPerFrame: 179 }).map(
  (c): OrbitCase => (c.speed === 0 ? { ...c, speed: c.fps } : c),
);

const AXES = FORCED_ORBIT_CASES.slice(5); // one case per axis token
const FORCED: OrbitCase[] = [
  ...AXES.map((c): OrbitCase => ({ ...c, speed: 90 * c.fps, frameCount: 5 })),
  ...AXES.map((c): OrbitCase => ({ ...c, speed: -90 * c.fps, frameCount: 5 })),
];

describe('Feature: orbit-around, Property O4: The sign of speed gives the turning direction', () => {
  it('positive speed turns one way and negative speed the other, for every consecutive pair', () => {
    fc.assert(
      fc.property(arbTurningCase, (c) => {
        checkBothDirections(c);
      }),
      { numRuns: 100, examples: FORCED.map((c) => [c] as [OrbitCase]) },
    );
  });

  it('forced: one case per axis with a 90-degree turn per frame, in both directions', () => {
    expect(new Set(FORCED.map((c) => c.axis)).size).toBe(6);
    expect(FORCED.every((c) => Math.abs(c.speed) === 90 * c.fps)).toBe(true);
    for (const c of FORCED) checkBothDirections(c);
  });
});
