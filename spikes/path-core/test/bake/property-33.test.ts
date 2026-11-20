import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import { SceneError, validateScene } from '../../src/scene.js';
import type { Scene } from '../../src/scene.js';
import { INVALID_KINDS, invalidSceneByKind } from '../helpers/scene-generators.js';

// Feature: path-core, Property 33: Invalid scenes are rejected by bake
// **Validates: Requirements 7.15**

/** Runs fn and returns the thrown value, or undefined if it did not throw. */
function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

describe('Property 33: Invalid scenes are rejected by bake', () => {
  for (const kind of INVALID_KINDS) {
    it(`bake throws the validateScene SceneError for ${kind}`, () => {
      let index = 0;
      let lastCase: { before: Scene; after: Scene } | undefined;
      fc.assert(
        fc.property(invalidSceneByKind[kind], (c) => {
          const i = index++;
          const label = `kind ${kind}, run ${i}`;
          if (c.kind !== kind) {
            throw new Error(`${label}: generator produced kind ${c.kind}`);
          }

          // Expected error from validateScene on its own clone.
          const validationError = thrownBy(() => validateScene(structuredClone(c.scene)));
          if (validationError === undefined) {
            throw new Error(`${label}: validateScene did not throw, expected SceneError "${c.message}"`);
          }
          if (!(validationError instanceof SceneError)) {
            throw new Error(`${label}: validateScene threw a non-SceneError: ${String(validationError)}`);
          }
          if (validationError.message !== c.message) {
            throw new Error(
              `${label}: validateScene message differs from generator: expected "${c.message}", actual "${validationError.message}"`,
            );
          }

          // bake on a separate clone, so a mutation in one call cannot hide a problem in the other.
          const before = structuredClone(c.scene);
          const bakeScene = structuredClone(c.scene);
          const bakeError = thrownBy(() => bake(bakeScene));
          if (bakeError === undefined) {
            throw new Error(`${label}: bake did not throw, expected SceneError "${validationError.message}"`);
          }
          if (!(bakeError instanceof SceneError)) {
            throw new Error(
              `${label}: bake threw a non-SceneError: ${String(bakeError)}, expected SceneError "${validationError.message}"`,
            );
          }
          if (bakeError.message !== validationError.message) {
            throw new Error(
              `${label}: bake message differs from validateScene: expected "${validationError.message}", actual "${bakeError.message}"`,
            );
          }
          if (bakeError.message !== c.message) {
            throw new Error(
              `${label}: bake message differs from generator: expected "${c.message}", actual "${bakeError.message}"`,
            );
          }
          lastCase = { before, after: bakeScene };
        }),
        { numRuns: 100 },
      );
      expect(index).toBeGreaterThanOrEqual(100);
      // Once per run: the failed bake left its input unchanged (checked on the last case).
      expect(lastCase).toBeDefined();
      expect(lastCase!.after).toEqual(lastCase!.before);
    });
  }

  it('validation wins over createCurve: a bad scene with a 1-point path throws the validateScene error', () => {
    const makeScene = (): Scene => ({
      fps: 0, // scene-level defect
      frameCount: 10,
      path: { points: [{ x: 0, y: 0, z: 0 }], closed: false }, // path defect: only 1 point
      targets: {},
      entities: [],
    });

    const validationError = thrownBy(() => validateScene(makeScene()));
    expect(validationError).toBeInstanceOf(SceneError);
    const expectedMessage = (validationError as SceneError).message;
    expect(expectedMessage).toBe('fps must be a positive integer, got 0');

    const bakeError = thrownBy(() => bake(makeScene()));
    expect(bakeError).toBeInstanceOf(SceneError);
    expect((bakeError as SceneError).message).toBe(expectedMessage);
  });
});
