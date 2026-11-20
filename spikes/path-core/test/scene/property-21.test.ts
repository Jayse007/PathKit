import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SceneError, validateScene } from '../../src/scene.js';
import type { Constraint, Scene } from '../../src/scene.js';
import { arbValidScene, invalidSceneByKind } from '../helpers/scene-generators.js';
import type { InvalidKind } from '../helpers/scene-generators.js';

// Feature: path-core, Property 21: Scene validation rejects bad numeric fields
// **Validates: Requirements 5.2, 5.6, 5.7, 5.11, 5.13, 5.14, 5.16**

/** Runs validateScene and returns the thrown error, or undefined if it did not throw. */
function thrownBy(scene: Scene): unknown {
  try {
    validateScene(scene);
  } catch (e) {
    return e;
  }
  return undefined;
}

/** Plain, independent statement of the accepted influence range. NaN fails both comparisons. */
function influenceAccepted(value: number): boolean {
  return value >= 0 && value <= 1;
}

describe('Property 21: Scene validation rejects bad numeric fields', () => {
  const kinds: InvalidKind[] = [
    'fpsInvalid',
    'frameCountInvalid',
    'influenceOutOfRange',
    'orderNotFinite',
    'keyframeFrameNotInteger',
    'keyframesEmpty',
    'keyframeFramesEqual',
    'keyframeFramesDecreasing',
    'speedNotFinite',
    'startOffsetNotFinite',
    'pathPointNotFinite',
    'staticTargetNotFinite',
    'keyframePositionNotFinite',
  ];

  for (const kind of kinds) {
    it(`rejects ${kind} with the exact message`, () => {
      let index = 0;
      fc.assert(
        fc.property(invalidSceneByKind[kind], (c) => {
          const i = index++;
          const err = thrownBy(c.scene);
          if (err === undefined) {
            throw new Error(`kind ${kind}, run ${i}: expected SceneError "${c.message}" but validateScene did not throw`);
          }
          if (!(err instanceof SceneError)) {
            throw new Error(`kind ${kind}, run ${i}: expected SceneError "${c.message}" but got non-SceneError ${String(err)}`);
          }
          if (err.message !== c.message) {
            throw new Error(`kind ${kind}, run ${i}: expected message "${c.message}" but got "${err.message}"`);
          }
        }),
        { numRuns: 200 },
      );
      expect(index).toBeGreaterThanOrEqual(200);
    });
  }

  // Influence values: the boundaries, just outside them, non-finite values, and an even spread in [-2, 3].
  const arbInfluenceValue: fc.Arbitrary<number> = fc.oneof(
    fc.constant(0),
    fc.constant(1),
    fc.constant(-0.0000001),
    fc.constant(1.0000001),
    fc.constant(NaN),
    fc.constant(Infinity),
    fc.constant(-Infinity),
    fc.integer({ min: -2000, max: 3000 }).map((i) => i / 1000),
  );

  /** Checks one mutated scene: accepted exactly when 0 <= value <= 1, else exact message for the owner. */
  function checkInfluence(label: string, scene: Scene, ownerId: string, value: number): void {
    const err = thrownBy(scene);
    if (influenceAccepted(value)) {
      if (err !== undefined) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`${label}: influence ${value} should be accepted but validateScene threw "${msg}"`);
      }
      return;
    }
    const expected = `Entity "${ownerId}": influence ${value} is outside [0,1]`;
    if (err === undefined) {
      throw new Error(`${label}: expected SceneError "${expected}" but validateScene did not throw`);
    }
    if (!(err instanceof SceneError)) {
      throw new Error(`${label}: expected SceneError "${expected}" but got non-SceneError ${String(err)}`);
    }
    if (err.message !== expected) {
      throw new Error(`${label}: expected message "${expected}" but got "${err.message}"`);
    }
  }

  it('accepts an influence exactly when it lies in [0,1], and names the owning entity otherwise', () => {
    let index = 0;
    fc.assert(
      fc.property(
        arbValidScene,
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        arbInfluenceValue,
        (base, entityPick, constraintPick, value) => {
          const i = index++;
          // Work on a clone, never the shared scene.
          const scene = structuredClone(base);
          // No filtering: if the base has no entity or no constraint, add one so every run tests a constraint.
          if (scene.entities.length === 0) {
            scene.entities.push({ id: 'entity-0', forwardAxis: '+X', upAxis: '+Y', constraints: [] });
          }
          const entity = scene.entities[entityPick % scene.entities.length];
          if (entity.constraints.length === 0) {
            const added: Constraint = { type: 'followPath', order: 0, influence: 0.5, speed: 1, startOffset: 0 };
            entity.constraints.push(added);
          }
          const constraint = entity.constraints[constraintPick % entity.constraints.length];
          constraint.influence = value;
          // The base is valid, so this influence is the only possible defect and its owner is `entity`.
          checkInfluence(`run ${i}, entity "${entity.id}"`, scene, entity.id, value);
        },
      ),
      { numRuns: 200 },
    );
    expect(index).toBeGreaterThanOrEqual(200);
  });

  it('hits each exact influence boundary value on a fixed valid scene', () => {
    const makeScene = (): Scene => ({
      fps: 30,
      frameCount: 10,
      path: { points: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }], closed: false },
      targets: {},
      entities: [
        {
          id: 'mover',
          forwardAxis: '+Z',
          upAxis: '+Y',
          constraints: [{ type: 'followPath', order: 0, influence: 0.5, speed: 1, startOffset: 0 }],
        },
      ],
    });
    expect(thrownBy(makeScene())).toBeUndefined();

    const values: number[] = [0, 1, -0.0000001, 1.0000001, NaN, Infinity, -Infinity];
    const accepted: boolean[] = [true, true, false, false, false, false, false];
    for (let v = 0; v < values.length; v++) {
      const scene = makeScene();
      scene.entities[0].constraints[0].influence = values[v];
      if (influenceAccepted(values[v]) !== accepted[v]) {
        throw new Error(`boundary ${v} (${values[v]}): test expectation table disagrees with the range rule`);
      }
      checkInfluence(`boundary ${v} (${values[v]})`, scene, 'mover', values[v]);
    }
  });
});
