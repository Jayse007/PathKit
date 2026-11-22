import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import type { BakedData } from '../../src/bake.js';
import type { Constraint, Scene } from '../../src/scene.js';
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

// Feature: orbit-around, Property O13: Equal orders run in list order, and list order is irrelevant otherwise
// Validates: Requirements 3.6, 3.13, 8.22
//
// A is a radius-0 orbit at the static target T (influence 1). B is the orbit under test, radius r above 0 at centre C,
// influence 0.5. Hand derivation, with offset o of B at a frame (|o| = r, perpendicular to the axis):
//   list [A, B] with equal order: A puts the position on T, then B moves it half way to C + o,
//     so R = (T + C) / 2 + o / 2, which is r / 2 from (T + C) / 2.
//   list [B, A] with equal order: B puts the position at (C + o) / 2, then A (influence 1) moves it all the way to T,
//     so R = T.
//   distinct orders with A lower: A runs first in either list order, so both lists give the [A, B] result.
// Source line this should catch: the comparator in sortedCopy changed so equal orders reverse, or the sort made unstable.

type Triple = [number, number, number];

interface Pair {
  c: OrbitCase;
  anchor: Triple;
}

function build(k: Pair, orderA: number, orderB: number, listAFirst: boolean): Scene {
  const a: Constraint = {
    type: 'orbitAround', order: orderA, influence: 1, target: 'anchor', radius: 0, axis: '+Y', speed: 0, startAngle: 0,
  };
  const scene = buildOrbitScene(k.c, {
    orbitOrder: orderB,
    orbitInfluence: 0.5,
    targets: { anchor: { x: k.anchor[0], y: k.anchor[1], z: k.anchor[2] } },
    constraints: [a],
  });
  // buildOrbitScene lists [B, A]. Swap to [A, B] when asked.
  if (listAFirst) scene.entities[0].constraints.reverse();
  return scene;
}

function tolOf(k: Pair): number {
  return 1e-9 * (scaleOf(k.c) + Math.max(Math.abs(k.anchor[0]), Math.abs(k.anchor[1]), Math.abs(k.anchor[2])));
}

function identityRotation(baked: BakedData, frameCount: number, label: string): void {
  const t = baked.transforms[0];
  for (let frame = 0; frame < frameCount; frame++) {
    const i = frame * 7;
    if (t[i + 3] !== 0 || t[i + 4] !== 0 || t[i + 5] !== 0 || t[i + 6] !== 1) {
      throw new Error(`Property O13 (${label}): frame ${frame} rotation is not the identity`);
    }
  }
}

/** Checks R is r / 2 from (T + C) / 2 and perpendicular to the axis. */
function checkHalfway(k: Pair, baked: BakedData, label: string): void {
  const { c, anchor } = k;
  const tol = tolOf(k);
  const axis = AXIS_UNIT[c.axis];
  const position = [0, 0, 0];
  const centre = [0, 0, 0];
  const mid = [0, 0, 0];
  const diff = [0, 0, 0];
  for (let frame = 0; frame < c.frameCount; frame++) {
    bakedPosition(baked, 0, frame, position);
    centreAt(c, frame, centre);
    for (let j = 0; j < 3; j++) mid[j] = (anchor[j] + centre[j]) / 2;
    sub3(position, mid, diff);
    if (!(Math.abs(len3(diff) - c.radius / 2) <= tol)) {
      throw new Error(`Property O13 (${label}): frame ${frame}: |R - (T + C) / 2| = ${len3(diff)}, expected ${c.radius / 2}; case ${JSON.stringify(k)}`);
    }
    if (!(Math.abs(dot3(diff, axis)) <= tol)) {
      throw new Error(`Property O13 (${label}): frame ${frame}: R - (T + C) / 2 is not perpendicular to axis ${c.axis}; case ${JSON.stringify(k)}`);
    }
  }
}

function checkPair(k: Pair): void {
  const tol = tolOf(k);
  const { c, anchor } = k;

  // Equal order: list order decides.
  const aThenB = bake(build(k, 0, 0, true));
  const bThenA = bake(build(k, 0, 0, false));
  checkHalfway(k, aThenB, 'equal order, [A, B]');
  const position = [0, 0, 0];
  for (let frame = 0; frame < c.frameCount; frame++) {
    bakedPosition(bThenA, 0, frame, position);
    for (let j = 0; j < 3; j++) {
      if (!(Math.abs(position[j] - anchor[j]) <= tol)) {
        throw new Error(`Property O13 (equal order, [B, A]): frame ${frame} component ${j} is ${position[j]}, expected the anchor ${anchor[j]}; case ${JSON.stringify(k)}`);
      }
    }
  }
  identityRotation(aThenB, c.frameCount, 'equal order, [A, B]');
  identityRotation(bThenA, c.frameCount, 'equal order, [B, A]');

  // Distinct orders, A lower: both list orders give the same positions, equal to the [A, B] result.
  const distinctAFirst = bake(build(k, 0, 1, true));
  const distinctBFirst = bake(build(k, 0, 1, false));
  checkHalfway(k, distinctAFirst, 'distinct order, [A, B]');
  checkHalfway(k, distinctBFirst, 'distinct order, [B, A]');
  const p = [0, 0, 0];
  const q = [0, 0, 0];
  for (let frame = 0; frame < c.frameCount; frame++) {
    bakedPosition(distinctAFirst, 0, frame, p);
    bakedPosition(distinctBFirst, 0, frame, q);
    for (let j = 0; j < 3; j++) {
      if (!(Math.abs(p[j] - q[j]) <= tol)) {
        throw new Error(`Property O13 (distinct order): frame ${frame} component ${j} differs between list orders: ${p[j]} and ${q[j]}`);
      }
    }
  }
  identityRotation(distinctAFirst, c.frameCount, 'distinct order, [A, B]');
  identityRotation(distinctBFirst, c.frameCount, 'distinct order, [B, A]');
  expect(c.frameCount).toBeGreaterThan(0);
}

const arbPair = fc.record({
  c: arbOrbitCase({ minRadius: 0.1 }),
  anchor: fc
    .tuple(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }))
    .map(([x, y, z]): Triple => [x / 10, y / 10, z / 10]),
});

const FORCED: Pair[] = [
  { c: FORCED_ORBIT_CASES[1], anchor: [-4, 7, 9] },
  { c: { ...FORCED_ORBIT_CASES[1], frameCount: 1 }, anchor: [0, 0, 0] },
  { c: { ...FORCED_ORBIT_CASES[1], axis: '-X', frameCount: 120, centre: { kind: 'linear', c0: [1, 2, 3], step: [1, -1, 1] } }, anchor: [50, -50, 50] },
];

describe('Feature: orbit-around, Property O13: Equal orders run in list order, and list order is irrelevant otherwise', () => {
  it('equal order follows the list order, and distinct orders ignore it', () => {
    fc.assert(
      fc.property(arbPair, (k) => {
        checkPair(k);
      }),
      { numRuns: 100, examples: FORCED.map((k) => [k] as [Pair]) },
    );
  });

  it('forced: the first and the last frame', () => {
    expect(FORCED.some((k) => k.c.frameCount === 1)).toBe(true);
    expect(FORCED.some((k) => k.c.frameCount === 120)).toBe(true);
    for (const k of FORCED) checkPair(k);
  });
});
