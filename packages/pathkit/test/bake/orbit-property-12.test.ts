import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import { SceneError, validateScene } from '../../src/scene.js';
import { FORCED_ORBIT_CASES, arbOrbitCase, buildOrbitScene } from '../helpers/orbit-generators.js';
import type { OrbitCase } from '../helpers/orbit-generators.js';

// Feature: orbit-around, Property O12: Every invalid value is rejected with its exact message
// Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7, 4.9, 4.11, 8.14, 8.25
//
// Source lines this should catch: removing `typeof c.radius !== 'number' ||` in checkOrbitAround,
// or replacing Number.isFinite with the global isFinite.

type Field = 'target' | 'axis' | 'radius' | 'speed' | 'startAngle';

const AXIS_HINT = '(use +X, -X, +Y, -Y, +Z or -Z)';

/** The exact message for one bad value in one field. Written here, not taken from src. */
function messageFor(field: Field, value: unknown): string {
  const v = String(value);
  switch (field) {
    case 'target':
      return `Entity "orbiter": unknown target "${v}"`;
    case 'axis':
      return `Entity "orbiter": orbitAround axis "${v}" is not an axis token ${AXIS_HINT}`;
    case 'radius':
      return `Entity "orbiter": orbitAround radius must be a finite number of 0 or more, got ${v}`;
    case 'speed':
      return `Entity "orbiter": orbitAround speed must be a finite number, got ${v}`;
    default:
      return `Entity "orbiter": orbitAround startAngle must be a finite number, got ${v}`;
  }
}

interface Defect {
  field: Field;
  value: unknown;
}

const NOT_A_NUMBER: unknown[] = ['fast', '30', null, undefined, true];

const DEFECTS: Defect[] = [
  ...['nowhere', 'toString', 'constructor', 'hasOwnProperty', ''].map((value): Defect => ({ field: 'target', value })),
  ...['+W', 'X', '', 'up', '+y', 5].map((value): Defect => ({ field: 'axis', value })),
  ...[NaN, Infinity, -Infinity, -1, -7, -1000, '5'].map((value): Defect => ({ field: 'radius', value })),
  ...[NaN, Infinity, -Infinity, ...NOT_A_NUMBER].map((value): Defect => ({ field: 'speed', value })),
  ...[NaN, Infinity, -Infinity, ...NOT_A_NUMBER].map((value): Defect => ({ field: 'startAngle', value })),
];

function sceneWithDefect(c: OrbitCase, defect: Defect) {
  const scene = buildOrbitScene(c);
  const orbit = scene.entities[0].constraints[0] as unknown as Record<string, unknown>;
  orbit[defect.field] = defect.value;
  return scene;
}

function checkRejected(c: OrbitCase, defect: Defect): void {
  const expected = messageFor(defect.field, defect.value);
  const label = `${defect.field} = ${typeof defect.value} ${String(defect.value)}`;
  const scene = sceneWithDefect(c, defect);

  for (const [name, run] of [
    ['validateScene', () => validateScene(scene)],
    ['bake', () => bake(scene)],
  ] as const) {
    let thrown: unknown;
    try {
      run();
    } catch (e) {
      thrown = e;
    }
    if (thrown === undefined) {
      throw new Error(`Property O12: ${name} did not throw for ${label}`);
    }
    if (!(thrown instanceof SceneError)) {
      throw new Error(`Property O12: ${name} threw a ${String(thrown)} instead of a SceneError for ${label}`);
    }
    if (thrown.message !== expected) {
      throw new Error(`Property O12: ${name} for ${label} expected "${expected}" but got "${thrown.message}"`);
    }
  }
}

describe('Feature: orbit-around, Property O12: Every invalid value is rejected with its exact message', () => {
  it('validateScene and bake reject each invalid value with the exact message of its field', () => {
    const examples: [OrbitCase, Defect][] = DEFECTS.map((d) => [FORCED_ORBIT_CASES[0], d]);
    fc.assert(
      fc.property(arbOrbitCase(), fc.constantFrom(...DEFECTS), (c, defect) => {
        checkRejected(c, defect);
      }),
      { numRuns: 200, examples },
    );
  });

  it('rejects any negative integer radius with its exact message', () => {
    fc.assert(
      fc.property(
        arbOrbitCase(),
        fc.integer({ min: 1, max: 100000 }).map((n) => -n),
        (c, radius) => {
          checkRejected(c, { field: 'radius', value: radius });
        },
      ),
      { numRuns: 100, examples: [[FORCED_ORBIT_CASES[0], -1]] },
    );
  });

  it('forced: the string "5" as a radius is rejected with a message ending "got 5"', () => {
    const scene = sceneWithDefect(FORCED_ORBIT_CASES[0], { field: 'radius', value: '5' });
    expect(() => validateScene(scene)).toThrow(
      new SceneError('Entity "orbiter": orbitAround radius must be a finite number of 0 or more, got 5'),
    );
    expect(() => bake(scene)).toThrow(
      new SceneError('Entity "orbiter": orbitAround radius must be a finite number of 0 or more, got 5'),
    );
  });

  it('forced: radius exactly 0 is accepted by validateScene', () => {
    const zero = FORCED_ORBIT_CASES.find((c) => c.radius === 0);
    if (zero === undefined) throw new Error('Property O12: no forced case with radius 0');
    expect(() => validateScene(buildOrbitScene(zero))).not.toThrow();
  });

  it('accepts every valid generated case with validateScene (radius 0 included)', () => {
    fc.assert(
      fc.property(arbOrbitCase(), (c) => {
        try {
          validateScene(buildOrbitScene(c));
        } catch (e) {
          throw new Error(`Property O12: a valid case was rejected: ${String(e)}`);
        }
      }),
      { numRuns: 100, examples: FORCED_ORBIT_CASES.map((c) => [c] as [OrbitCase]) },
    );
  });
});
