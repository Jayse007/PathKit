import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import type { Constraint } from '../../src/scene.js';
import {
  AXIS_UNIT,
  FORCED_ORBIT_CASES,
  arbOrbitCase,
  bakedPosition,
  buildOrbitScene,
  centreAt,
  dot3,
  len3,
  scaleOf,
  sub3,
} from '../helpers/orbit-generators.js';
import type { OrbitCase } from '../helpers/orbit-generators.js';

// Feature: orbit-around, Property O7: Influence blends the position
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 8.11
//
// The Entity has a radius-0 orbit at the static target `anchor` T (order 0, influence 1), then the orbit under test
// (order 1, influence lambda) at centre C. The first constraint puts the position exactly on T, so the blend of the
// second is (1 - lambda) T + lambda (C + offset). With E = (1 - lambda) T + lambda C the baked position R satisfies
// |R - E| = lambda * radius and dot(R - E, axis) = 0. No formula of the baker is used to produce an expected value.
// Source line this should catch: `blendCandidate(work, c.influence, false)` replaced by a direct write into `work.position`.

type Triple = [number, number, number];

interface Blend {
  c: OrbitCase;
  lambda: number;
  anchor: Triple;
}

const LAMBDAS = [0, 0.25, 0.5, 0.75, 1];

function anchorOrbit(): Constraint {
  return { type: 'orbitAround', order: 0, influence: 1, target: 'anchor', radius: 0, axis: '+Y', speed: 0, startAngle: 0 };
}

function sceneOf({ c, lambda, anchor }: Blend) {
  return buildOrbitScene(c, {
    orbitOrder: 1,
    orbitInfluence: lambda,
    targets: { anchor: { x: anchor[0], y: anchor[1], z: anchor[2] } },
    constraints: [anchorOrbit()],
  });
}

function checkBlend(k: Blend): void {
  const { c, lambda, anchor } = k;
  const baked = bake(sceneOf(k));
  const axis = AXIS_UNIT[c.axis];
  const tol = 1e-9 * (scaleOf(c) + Math.max(Math.abs(anchor[0]), Math.abs(anchor[1]), Math.abs(anchor[2])));
  const position = [0, 0, 0];
  const centre = [0, 0, 0];
  const expectedCentre = [0, 0, 0];
  const diff = [0, 0, 0];
  const fromCentre = [0, 0, 0];
  const fromAnchor = [0, 0, 0];
  const rotation = baked.transforms[0];
  let framesChecked = 0;
  for (let frame = 0; frame < c.frameCount; frame++) {
    bakedPosition(baked, 0, frame, position);
    centreAt(c, frame, centre);
    for (let j = 0; j < 3; j++) expectedCentre[j] = (1 - lambda) * anchor[j] + lambda * centre[j];
    sub3(position, expectedCentre, diff);
    const distance = len3(diff);
    if (!(Math.abs(distance - lambda * c.radius) <= tol)) {
      throw new Error(`Property O7: frame ${frame}: |R - E| = ${distance}, expected lambda * radius = ${lambda * c.radius}; case ${JSON.stringify(k)}`);
    }
    const along = dot3(diff, axis);
    if (!(Math.abs(along) <= tol)) {
      throw new Error(`Property O7: frame ${frame}: R - E has component ${along} along axis ${c.axis}; case ${JSON.stringify(k)}`);
    }
    if (lambda === 0) {
      sub3(position, anchor, fromAnchor);
      if (!(len3(fromAnchor) <= tol)) {
        throw new Error(`Property O7: frame ${frame}: lambda 0 but R is ${len3(fromAnchor)} from the anchor; case ${JSON.stringify(k)}`);
      }
    }
    if (lambda === 1) {
      sub3(position, centre, fromCentre);
      if (!(Math.abs(len3(fromCentre) - c.radius) <= tol)) {
        throw new Error(`Property O7: frame ${frame}: lambda 1 but R is ${len3(fromCentre)} from the centre, expected ${c.radius}; case ${JSON.stringify(k)}`);
      }
    }
    // The rotation is the identity, exactly.
    const i = frame * 7;
    if (rotation[i + 3] !== 0 || rotation[i + 4] !== 0 || rotation[i + 5] !== 0 || rotation[i + 6] !== 1) {
      throw new Error(`Property O7: frame ${frame}: rotation is [${rotation[i + 3]}, ${rotation[i + 4]}, ${rotation[i + 5]}, ${rotation[i + 6]}], expected the identity`);
    }
    framesChecked++;
  }
  expect(framesChecked).toBe(c.frameCount);
}

const arbAnchor = fc
  .tuple(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }))
  .map(([x, y, z]): Triple => [x / 10, y / 10, z / 10]);

const arbBlend = fc.record({
  c: arbOrbitCase({ minRadius: 1 }),
  lambda: fc.constantFrom(...LAMBDAS),
  anchor: arbAnchor,
});

// Forced: lambda 0, 0.5 and 1, on cases that include the first frame only (frameCount 1) and a 120 frame last frame.
const BASE = FORCED_ORBIT_CASES[1]; // radius 5, startAngle 0, static centre (1, 2, 3)
const LONG: OrbitCase = {
  fps: 60,
  frameCount: 120,
  axis: '-Y',
  radius: 30,
  speed: 540 * 60,
  startAngle: 0,
  centre: { kind: 'linear', c0: [-100, 100, -100], step: [2, -2, 2] },
};
const FORCED: Blend[] = [
  ...[0, 0.5, 1].map((lambda): Blend => ({ c: BASE, lambda, anchor: [-4, 7, 9] })),
  ...[0, 0.5, 1].map((lambda): Blend => ({ c: { ...BASE, frameCount: 1 }, lambda, anchor: [0, 0, 0] })),
  ...[0, 0.5, 1].map((lambda): Blend => ({ c: LONG, lambda, anchor: [100, -100, 100] })),
];

describe('Feature: orbit-around, Property O7: Influence blends the position', () => {
  it('R lies lambda * radius from (1 - lambda) T + lambda C, perpendicular to the axis, with identity rotation', () => {
    fc.assert(
      fc.property(arbBlend, (k) => {
        checkBlend(k);
      }),
      { numRuns: 100, examples: FORCED.map((k) => [k] as [Blend]) },
    );
  });

  it('forced: lambda 0, 0.5 and 1, first and last frame', () => {
    expect(new Set(FORCED.map((k) => k.lambda))).toEqual(new Set([0, 0.5, 1]));
    expect(FORCED.some((k) => k.c.frameCount === 1)).toBe(true);
    expect(FORCED.some((k) => k.c.frameCount === 120)).toBe(true);
    for (const k of FORCED) checkBlend(k);
  });

  it('unit: influence 0 with no earlier constraint leaves the Rest_Pose (0, 0, 0)', () => {
    const c: OrbitCase = { ...BASE, frameCount: 4 };
    const baked = bake(buildOrbitScene(c, { orbitInfluence: 0 }));
    for (let frame = 0; frame < c.frameCount; frame++) {
      const p = bakedPosition(baked, 0, frame, [0, 0, 0]);
      for (let k = 0; k < 3; k++) {
        if (!(Math.abs(p[k]) <= 1e-12)) throw new Error(`frame ${frame} component ${k} is ${p[k]}, expected 0`);
      }
    }
  });
});
