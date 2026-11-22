import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import {
  FORCED_ORBIT_CASES,
  arbOrbitCase,
  bakedPosition,
  buildOrbitScene,
  centreAt,
  scaleOf,
  sub3,
} from '../helpers/orbit-generators.js';
import type { OrbitCase } from '../helpers/orbit-generators.js';

// Feature: orbit-around, Property O6: A moving centre carries the offset with it
// Validates: Requirements 2.5, 2.18, 8.10
//
// Note: this property compares two bakes of the same constraint, one with a linearly keyframed centre and one
// with a static centre at the origin. That is valid because Properties O1 to O4 and the hand-computed unit tests
// in test/bake/orbit-unit.test.ts pin the static case. The centre of the moving case comes from the Scene
// numbers: c0 + frame * step (keyframes at frame 0 and at frameCount).
// Source line this should catch: `targetPositionAt(target, frame, ...)` changed to `targetPositionAt(target, 0, ...)`.

/** The same case with a linear centre. A static case gets a step derived from its own coordinates. */
function withLinearCentre(c: OrbitCase): OrbitCase {
  if (c.centre.kind === 'linear') return c;
  const [x, y, z] = c.centre.c;
  return { ...c, centre: { kind: 'linear', c0: [x, y, z], step: [y / 50, z / 50, x / 50] } };
}

function checkCarriedOffset(c: OrbitCase): void {
  const moving = bake(buildOrbitScene(c));
  const atOrigin = bake(buildOrbitScene({ ...c, centre: { kind: 'static', c: [0, 0, 0] } }));
  const tol = 1e-9 * scaleOf(c);
  const positionMoving = [0, 0, 0];
  const positionOrigin = [0, 0, 0];
  const centre = [0, 0, 0];
  const offset = [0, 0, 0];
  let framesChecked = 0;
  for (let frame = 0; frame < c.frameCount; frame++) {
    bakedPosition(moving, 0, frame, positionMoving);
    centreAt(c, frame, centre);
    sub3(positionMoving, centre, offset);
    bakedPosition(atOrigin, 0, frame, positionOrigin);
    for (let k = 0; k < 3; k++) {
      if (!(Math.abs(offset[k] - positionOrigin[k]) <= tol)) {
        throw new Error(
          `Property O6: frame ${frame} component ${k}: offset from the moving centre is ${offset[k]}, offset from the origin centre is ${positionOrigin[k]} (more than ${tol} apart); case ${JSON.stringify(c)}`,
        );
      }
    }
    framesChecked++;
  }
  expect(framesChecked).toBe(c.frameCount);
}

const FORCED: OrbitCase[] = [
  ...FORCED_ORBIT_CASES.map(withLinearCentre),
  // radius 0 and startAngle 0 on a moving centre
  {
    ...FORCED_ORBIT_CASES[0],
    radius: 0,
    startAngle: 0,
    frameCount: 4,
    centre: { kind: 'linear', c0: [1, 2, 3], step: [1, -1, 2] },
  },
  // a long run, so the last frame is frame 119
  {
    fps: 60,
    frameCount: 120,
    axis: '+Z',
    radius: 30,
    speed: 360 * 60,
    startAngle: 90,
    centre: { kind: 'linear', c0: [-100, 100, -100], step: [2, -2, 2] },
  },
];

describe('Feature: orbit-around, Property O6: A moving centre carries the offset with it', () => {
  it('the offset from c0 + frame * step equals the offset from a static origin centre at every frame', () => {
    fc.assert(
      fc.property(arbOrbitCase().map(withLinearCentre), (c) => {
        checkCarriedOffset(c);
      }),
      { numRuns: 100, examples: FORCED.map((c) => [c] as [OrbitCase]) },
    );
  });

  it('forced: radius 0, startAngle 0, the first frame and the last frame', () => {
    expect(FORCED.some((c) => c.radius === 0)).toBe(true);
    expect(FORCED.some((c) => c.startAngle === 0)).toBe(true);
    expect(FORCED.some((c) => c.frameCount === 120)).toBe(true);
    expect(FORCED.every((c) => c.centre.kind === 'linear')).toBe(true);
    for (const c of FORCED) checkCarriedOffset(c);
  });
});
