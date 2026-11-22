import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import type { BakedData } from '../../src/bake.js';
import type { Constraint } from '../../src/scene.js';
import { FORCED_ORBIT_CASES, arbOrbitCase, buildOrbitScene } from '../helpers/orbit-generators.js';
import type { OrbitCase } from '../helpers/orbit-generators.js';

// Feature: orbit-around, Property O9: An orbit changes no rotation or bookkeeping
// Validates: Requirements 3.9, 3.10, 3.11, 5.3, 5.9, 8.13
//
// An orbit-only Entity has the identity rotation (exact) at every frame, travelled all 0, heldFromFrame -1,
// aimDirections all 0 and rotationDrivers 0. An orbit plus an aimAt has rotationDrivers 1, travelled all 0 and
// heldFromFrame -1. An orbit plus an aimAt plus an aligned followPath has rotationDrivers 2.
// Typed arrays are read directly and never frozen.
// Source lines this should catch: `blendCandidate(work, c.influence, true)` in applyOrbitAround, the orbitAround
// case writing output.travelled, or drivesRotation returning true for orbitAround.

const AIM: Constraint = { type: 'aimAt', order: 1, influence: 1, target: 'centre' };
const ALIGNED_FOLLOW: Constraint = {
  type: 'followPath',
  order: 2,
  influence: 1,
  speed: 5,
  startOffset: 0,
  alignToPath: true,
};

function allZero(label: string, values: Float64Array, c: OrbitCase): void {
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== 0) {
      throw new Error(`Property O9: ${label}[${i}] is ${values[i]}, expected 0; case ${JSON.stringify(c)}`);
    }
  }
}

function identityRotation(baked: BakedData, c: OrbitCase): void {
  const t = baked.transforms[0];
  for (let frame = 0; frame < c.frameCount; frame++) {
    const i = frame * 7;
    if (t[i + 3] !== 0 || t[i + 4] !== 0 || t[i + 5] !== 0 || t[i + 6] !== 1) {
      throw new Error(
        `Property O9: frame ${frame}: rotation [${t[i + 3]}, ${t[i + 4]}, ${t[i + 5]}, ${t[i + 6]}] is not the identity; case ${JSON.stringify(c)}`,
      );
    }
  }
}

function checkBookkeeping(c: OrbitCase): void {
  // Orbit only.
  const only = bake(buildOrbitScene(c));
  identityRotation(only, c);
  allZero('travelled (orbit only)', only.travelled[0], c);
  allZero('aimDirections (orbit only)', only.aimDirections[0], c);
  if (only.heldFromFrame[0] !== -1) throw new Error(`Property O9: heldFromFrame ${only.heldFromFrame[0]} for an orbit-only entity`);
  if (only.rotationDrivers[0] !== 0) throw new Error(`Property O9: rotationDrivers ${only.rotationDrivers[0]} for an orbit-only entity`);

  // Orbit plus aimAt.
  const withAim = bake(buildOrbitScene(c, { constraints: [AIM] }));
  allZero('travelled (orbit + aimAt)', withAim.travelled[0], c);
  if (withAim.heldFromFrame[0] !== -1) throw new Error(`Property O9: heldFromFrame ${withAim.heldFromFrame[0]} for orbit + aimAt`);
  if (withAim.rotationDrivers[0] !== 1) throw new Error(`Property O9: rotationDrivers ${withAim.rotationDrivers[0]} for orbit + aimAt, expected 1`);

  // Orbit plus aimAt plus an aligned followPath.
  const withBoth = bake(buildOrbitScene(c, { constraints: [AIM, ALIGNED_FOLLOW] }));
  if (withBoth.rotationDrivers[0] !== 2) throw new Error(`Property O9: rotationDrivers ${withBoth.rotationDrivers[0]} for orbit + aimAt + aligned followPath, expected 2`);

  expect(only.transforms[0].length).toBe(c.frameCount * 7);
}

const FORCED: OrbitCase[] = [
  ...FORCED_ORBIT_CASES,
  { ...FORCED_ORBIT_CASES[1], frameCount: 120, centre: { kind: 'linear', c0: [1, 2, 3], step: [1, 1, 1] } },
];

describe('Feature: orbit-around, Property O9: An orbit changes no rotation or bookkeeping', () => {
  it('orbit-only keeps the identity rotation and zero bookkeeping, and rotationDrivers counts only aimAt and aligned followPath', () => {
    fc.assert(
      fc.property(arbOrbitCase(), (c) => {
        checkBookkeeping(c);
      }),
      { numRuns: 100, examples: FORCED.map((c) => [c] as [OrbitCase]) },
    );
  });

  it('forced: radius 0, startAngle 0, one frame, and every axis', () => {
    expect(FORCED.some((c) => c.radius === 0)).toBe(true);
    expect(FORCED.some((c) => c.frameCount === 1)).toBe(true);
    expect(new Set(FORCED.map((c) => c.axis)).size).toBe(6);
    for (const c of FORCED) checkBookkeeping(c);
  });
});
