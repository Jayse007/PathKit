import { describe, it } from 'vitest';
import fc from 'fast-check';
import { SceneError, validateScene } from '../../src/scene.js';
import { FORCED_ORBIT_CASES, arbOrbitCase, buildOrbitScene } from '../helpers/orbit-generators.js';
import type { OrbitCase } from '../helpers/orbit-generators.js';

// Feature: orbit-around, Property O11: The first defect wins
// Validates: Requirements 4.1, 4.2, 4.8
//
// The five defects, in the order the validator must test them. Bit k of the mask turns defect k on.
// Influence and order stay valid, so only the type-specific order is tested.
// Source line this should catch: moving the radius check above the axis check in checkOrbitAround.

const AXIS_HINT = '(use +X, -X, +Y, -Y, +Z or -Z)';
const RADIUS_VALUES = [NaN, Infinity, -Infinity, -1];
const SPEED_VALUES = [NaN, Infinity, -Infinity, NaN];
const START_VALUES = [Infinity, NaN, -Infinity, Infinity];

const FIELD_NAMES = ['target', 'axis', 'radius', 'speed', 'startAngle'] as const;

function bitCount(n: number): number {
  let count = 0;
  for (let m = n; m > 0; m >>= 1) count += m & 1;
  return count;
}

/** The message of defect `k` (0 target, 1 axis, 2 radius, 3 speed, 4 startAngle). */
function messageOf(k: number, variant: number): string {
  switch (k) {
    case 0:
      return 'Entity "orbiter": unknown target "nowhere"';
    case 1:
      return `Entity "orbiter": orbitAround axis "+W" is not an axis token ${AXIS_HINT}`;
    case 2:
      return `Entity "orbiter": orbitAround radius must be a finite number of 0 or more, got ${String(RADIUS_VALUES[variant])}`;
    case 3:
      return `Entity "orbiter": orbitAround speed must be a finite number, got ${String(SPEED_VALUES[variant])}`;
    default:
      return `Entity "orbiter": orbitAround startAngle must be a finite number, got ${String(START_VALUES[variant])}`;
  }
}

function checkFirstDefectWins(c: OrbitCase, mask: number, variant: number): void {
  const scene = buildOrbitScene(c);
  const orbit = scene.entities[0].constraints[0] as unknown as Record<string, unknown>;
  let first = -1;
  for (let k = 0; k < 5; k++) {
    if ((mask & (1 << k)) === 0) continue;
    if (first < 0) first = k;
    if (k === 0) orbit.target = 'nowhere';
    else if (k === 1) orbit.axis = '+W';
    else if (k === 2) orbit.radius = RADIUS_VALUES[variant];
    else if (k === 3) orbit.speed = SPEED_VALUES[variant];
    else orbit.startAngle = START_VALUES[variant];
  }
  const expected = messageOf(first, variant);
  let thrown: unknown;
  try {
    validateScene(scene);
  } catch (e) {
    thrown = e;
  }
  const label = `mask ${mask} (defects ${FIELD_NAMES.filter((_, k) => (mask & (1 << k)) !== 0).join(', ')}), variant ${variant}`;
  if (thrown === undefined) {
    throw new Error(`Property O11: validateScene did not throw for ${label}`);
  }
  if (!(thrown instanceof SceneError)) {
    throw new Error(`Property O11: expected a SceneError for ${label}, got ${String(thrown)}`);
  }
  if (thrown.message !== expected) {
    throw new Error(
      `Property O11: ${label} expected the message of "${FIELD_NAMES[first]}": ${expected} but got: ${thrown.message}`,
    );
  }
}

const arbMask = fc.integer({ min: 3, max: 31 }).filter((m) => bitCount(m) >= 2);
const arbVariant = fc.integer({ min: 0, max: 3 });

// Forced: all five defects together, and each adjacent pair (target+axis, axis+radius, radius+speed, speed+startAngle).
const FORCED_MASKS = [0b11111, 0b00011, 0b00110, 0b01100, 0b11000];

describe('Feature: orbit-around, Property O11: The first defect wins', () => {
  it('reports only the message of the first defect in the order target, axis, radius, speed, startAngle', () => {
    const examples: [OrbitCase, number, number][] = [];
    for (const mask of FORCED_MASKS) {
      for (let variant = 0; variant < 4; variant++) {
        examples.push([FORCED_ORBIT_CASES[0], mask, variant]);
      }
    }
    fc.assert(
      fc.property(arbOrbitCase(), arbMask, arbVariant, (c, mask, variant) => {
        checkFirstDefectWins(c, mask, variant);
      }),
      { numRuns: 200, examples },
    );
  });

  it('forced: every mask with two or more defects, on a case with radius 0 and startAngle 0', () => {
    for (let mask = 3; mask <= 31; mask++) {
      if (bitCount(mask) < 2) continue;
      for (let variant = 0; variant < 4; variant++) {
        checkFirstDefectWins(FORCED_ORBIT_CASES[0], mask, variant);
      }
    }
  });
});
