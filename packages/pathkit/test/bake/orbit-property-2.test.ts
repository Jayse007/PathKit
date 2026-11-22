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
  dot3,
  scaleOf,
  sub3,
} from '../helpers/orbit-generators.js';
import type { OrbitCase } from '../helpers/orbit-generators.js';

// Feature: orbit-around, Property O2: The offset is perpendicular to the axis
// Validates: Requirements 2.3, 2.4, 2.14, 8.5
//
// The axis unit vector comes from the test's own AXIS_UNIT table, not from src.
// Source line this should catch: a wrong side vector, for example the `p.z` line using `a.z` instead of `a.y`,
// which adds a component along the axis.

function checkPerpendicular(c: OrbitCase): void {
  const baked = bake(buildOrbitScene(c));
  const tol = 1e-9 * scaleOf(c);
  const axis = AXIS_UNIT[c.axis];
  const position = [0, 0, 0];
  const centre = [0, 0, 0];
  const offset = [0, 0, 0];
  let framesChecked = 0;
  for (let frame = 0; frame < c.frameCount; frame++) {
    bakedPosition(baked, 0, frame, position);
    centreAt(c, frame, centre);
    sub3(position, centre, offset);
    const along = dot3(offset, axis);
    if (!(Math.abs(along) <= tol)) {
      throw new Error(
        `Property O2: frame ${frame}: offset [${offset.join(', ')}] has component ${along} along axis ${c.axis}, more than ${tol}; case ${JSON.stringify(c)}`,
      );
    }
    framesChecked++;
  }
  expect(framesChecked).toBe(c.frameCount);
}

const FORCED: OrbitCase[] = [
  ...FORCED_ORBIT_CASES,
  { ...FORCED_ORBIT_CASES[0], radius: 0, startAngle: 0, frameCount: 3 },
  {
    fps: 24,
    frameCount: 120,
    axis: '-Z',
    radius: 30,
    speed: -720 * 24,
    startAngle: 720,
    centre: { kind: 'linear', c0: [100, -100, 100], step: [-2, 2, -2] },
  },
];

describe('Feature: orbit-around, Property O2: The offset is perpendicular to the axis', () => {
  it('at every frame the offset from the centre has no component along the axis', () => {
    fc.assert(
      fc.property(arbOrbitCase(), (c) => {
        checkPerpendicular(c);
      }),
      { numRuns: 100, examples: FORCED.map((c) => [c] as [OrbitCase]) },
    );
  });

  it('forced: every axis token, radius 0 and startAngle 0', () => {
    const axes = new Set(FORCED.map((c) => c.axis));
    expect(axes.size).toBe(6);
    expect(FORCED.some((c) => c.radius === 0)).toBe(true);
    expect(FORCED.some((c) => c.startAngle === 0)).toBe(true);
    for (const c of FORCED) checkPerpendicular(c);
  });
});
