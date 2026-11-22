import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import type { BakedData } from '../../src/bake.js';
import { validateScene } from '../../src/scene.js';
import type { Constraint, Scene } from '../../src/scene.js';
import { FORCED_ORBIT_CASES, arbOrbitCase, buildOrbitScene } from '../helpers/orbit-generators.js';
import type { OrbitCase } from '../helpers/orbit-generators.js';

// Feature: orbit-around, Property O10: Baking and validating do not modify the scene, and baking is repeatable
// Validates: Requirements 4.10, 7.1, 7.2, 8.15
//
// A deep copy of the scene is taken first. The scene under test is then frozen (plain objects and arrays only,
// typed arrays are never frozen), so any write to it throws instead of passing unnoticed. After validateScene and
// two bake calls the scene equals the copy, and the two bakes agree element by element with exact equality.
// Source lines this should catch: `constraints.sort(...)` on `entity.constraints` instead of the copy, or any Math.random use.

interface Shape {
  c: OrbitCase;
  entityCount: number;
  withAim: boolean;
  withFollow: boolean;
  align: boolean;
}

function sceneOf(k: Shape): Scene {
  const extra: Constraint[] = [];
  if (k.withAim) extra.push({ type: 'aimAt', order: 1, influence: 1, target: 'centre' });
  if (k.withFollow) {
    extra.push({ type: 'followPath', order: 2, influence: 0.5, speed: 5, startOffset: 0, alignToPath: k.align });
  }
  const scene = buildOrbitScene(k.c, { constraints: extra });
  for (let e = 2; e <= k.entityCount; e++) {
    const clone = structuredClone(scene.entities[0]);
    clone.id = `orbiter${e}`;
    scene.entities.push(clone);
  }
  return scene;
}

/** Freezes plain objects and arrays. Typed arrays are left alone. */
function freezePlain(value: unknown): void {
  if (value === null || typeof value !== 'object' || ArrayBuffer.isView(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value)) freezePlain((value as Record<string, unknown>)[key]);
}

function sameNumbers(label: string, a: ArrayLike<number>, b: ArrayLike<number>): void {
  if (a.length !== b.length) throw new Error(`Property O10: ${label} lengths differ: ${a.length} and ${b.length}`);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) throw new Error(`Property O10: ${label}[${i}] differs between two bakes: ${a[i]} and ${b[i]}`);
  }
}

function sameBake(first: BakedData, second: BakedData): void {
  if (first.entityIds.length !== second.entityIds.length) throw new Error('Property O10: entity counts differ between two bakes');
  for (let e = 0; e < first.entityIds.length; e++) {
    sameNumbers(`transforms[${e}]`, first.transforms[e], second.transforms[e]);
    sameNumbers(`travelled[${e}]`, first.travelled[e], second.travelled[e]);
    sameNumbers(`aimDirections[${e}]`, first.aimDirections[e], second.aimDirections[e]);
  }
  sameNumbers('heldFromFrame', first.heldFromFrame, second.heldFromFrame);
  sameNumbers('rotationDrivers', first.rotationDrivers, second.rotationDrivers);
}

function checkPurity(k: Shape): void {
  const scene = sceneOf(k);
  const before = structuredClone(scene);
  freezePlain(scene);
  validateScene(scene);
  const first = bake(scene);
  const second = bake(scene);
  expect(scene).toEqual(before);
  sameBake(first, second);
  expect(first.entityIds.length).toBe(k.entityCount);
}

const arbShape = fc.record({
  c: arbOrbitCase(),
  entityCount: fc.integer({ min: 1, max: 3 }),
  withAim: fc.boolean(),
  withFollow: fc.boolean(),
  align: fc.boolean(),
});

const FORCED: Shape[] = [
  { c: FORCED_ORBIT_CASES[0], entityCount: 1, withAim: false, withFollow: false, align: false },
  { c: FORCED_ORBIT_CASES[2], entityCount: 3, withAim: true, withFollow: true, align: true },
  { c: FORCED_ORBIT_CASES[4], entityCount: 2, withAim: true, withFollow: true, align: false },
  { c: { ...FORCED_ORBIT_CASES[1], frameCount: 120 }, entityCount: 3, withAim: true, withFollow: false, align: false },
];

describe('Feature: orbit-around, Property O10: Baking and validating do not modify the scene, and baking is repeatable', () => {
  it('the scene equals its copy afterwards and two bakes are identical', () => {
    fc.assert(
      fc.property(arbShape, (k) => {
        checkPurity(k);
      }),
      { numRuns: 100, examples: FORCED.map((k) => [k] as [Shape]) },
    );
  });

  it('forced: one to three entities, with and without an aimAt and a followPath', () => {
    expect(new Set(FORCED.map((k) => k.entityCount))).toEqual(new Set([1, 2, 3]));
    expect(FORCED.some((k) => k.withAim && k.withFollow)).toBe(true);
    for (const k of FORCED) checkPurity(k);
  });
});
