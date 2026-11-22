import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import {
  FORCED_ORBIT_CASES,
  arbOrbitCase,
  bakedPosition,
  buildOrbitScene,
  centreAt,
  len3,
  sub3,
} from '../helpers/orbit-generators.js';
import type { OrbitCase } from '../helpers/orbit-generators.js';

// Feature: orbit-around, Property O8: An aimAt with a higher order faces the centre
// Validates: Requirements 3.7, 3.8, 8.12
//
// An orbit (order 0, influence 1) and an aimAt on the same target (order 1, influence 1). The aimAt runs after the
// orbit, so it sees the orbit position. The stored aim direction is the unit vector from the baked position to the
// centre, worked out here with plain arithmetic from the baked position and the centre taken from the Scene numbers.
// Source lines this should catch: running the orbitAround after the aimAt (order handling), or applyOrbitAround
// writing to a buffer that aimAt does not read.

const AIM_TOL = 1e-9;

function checkAimsAtCentre(c: OrbitCase): void {
  const scene = buildOrbitScene(c, {
    constraints: [{ type: 'aimAt', order: 1, influence: 1, target: 'centre' }],
  });
  const baked = bake(scene);
  const aim = baked.aimDirections[0];
  const position = [0, 0, 0];
  const centre = [0, 0, 0];
  const toCentre = [0, 0, 0];
  let framesChecked = 0;
  for (let frame = 0; frame < c.frameCount; frame++) {
    bakedPosition(baked, 0, frame, position);
    centreAt(c, frame, centre);
    sub3(centre, position, toCentre);
    const length = len3(toCentre);
    for (let k = 0; k < 3; k++) {
      const expected = toCentre[k] / length;
      const actual = aim[frame * 3 + k];
      if (!(Math.abs(actual - expected) <= AIM_TOL)) {
        throw new Error(
          `Property O8: frame ${frame} component ${k}: stored aim ${actual}, expected ${expected} (distance ${length}); case ${JSON.stringify(c)}`,
        );
      }
    }
    framesChecked++;
  }
  expect(framesChecked).toBe(c.frameCount);
}

const FORCED: OrbitCase[] = [
  { ...FORCED_ORBIT_CASES[1], frameCount: 1 }, // first frame is also the last
  FORCED_ORBIT_CASES[1],
  {
    // keyframed centre, 120 frames: the last frame is 119
    fps: 30,
    frameCount: 120,
    axis: '-Z',
    radius: 0.1,
    speed: 179 * 30,
    startAngle: 0,
    centre: { kind: 'linear', c0: [-100, 50, 100], step: [1.5, -1, 0.5] },
  },
  ...FORCED_ORBIT_CASES.slice(5), // one case per axis
];

describe('Feature: orbit-around, Property O8: An aimAt with a higher order faces the centre', () => {
  it('the stored aim direction is the unit vector from the baked position to the centre at every frame', () => {
    fc.assert(
      fc.property(arbOrbitCase({ minRadius: 0.1 }), (c) => {
        checkAimsAtCentre(c);
      }),
      { numRuns: 100, examples: FORCED.map((c) => [c] as [OrbitCase]) },
    );
  });

  it('forced: first frame, last frame, a keyframed centre and every axis', () => {
    expect(FORCED.some((c) => c.frameCount === 1)).toBe(true);
    expect(FORCED.some((c) => c.centre.kind === 'linear')).toBe(true);
    expect(new Set(FORCED.map((c) => c.axis)).size).toBe(6);
    for (const c of FORCED) checkAimsAtCentre(c);
  });
});
