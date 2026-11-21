import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SceneError, validateScene } from '../../src/scene.js';
import type { Scene } from '../../src/scene.js';
import { invalidSceneByKind } from '../helpers/scene-generators.js';
import type { InvalidKind } from '../helpers/scene-generators.js';

// Feature: path-core, Property 22: Scene validation rejects bad references and duplicates
// **Validates: Requirements 5.5, 5.12**

/** Runs validateScene and returns the thrown error, or undefined if it did not throw. */
function thrownBy(scene: Scene): unknown {
  try {
    validateScene(scene);
  } catch (e) {
    return e;
  }
  return undefined;
}

/** Throws a descriptive Error unless err is a SceneError with exactly the expected message. */
function checkExactMessage(kind: InvalidKind, run: number, expected: string, err: unknown): SceneErrorLike {
  if (err === undefined) {
    throw new Error(`kind ${kind}, run ${run}: expected SceneError "${expected}" but validateScene did not throw`);
  }
  if (!(err instanceof SceneError)) {
    throw new Error(`kind ${kind}, run ${run}: expected SceneError "${expected}" but got non-SceneError ${String(err)}`);
  }
  if (err.message !== expected) {
    throw new Error(`kind ${kind}, run ${run}: expected message "${expected}" but got "${err.message}"`);
  }
  return err;
}

type SceneErrorLike = SceneError;

describe('Property 22: Scene validation rejects bad references and duplicates', () => {
  it('rejects an aimAt target that is not an own key of targets, naming the entity and the target', () => {
    const kind: InvalidKind = 'unknownAimTarget';
    let index = 0;
    fc.assert(
      fc.property(invalidSceneByKind[kind], (c) => {
        const i = index++;

        // Recover the entity id and target name from the scene, independently of c.message.
        let ownerId: string | undefined;
        let targetName: string | undefined;
        for (const entity of c.scene.entities) {
          for (const constraint of entity.constraints) {
            if (
              ownerId === undefined &&
              constraint.type === 'aimAt' &&
              !Object.prototype.hasOwnProperty.call(c.scene.targets, constraint.target)
            ) {
              ownerId = entity.id;
              targetName = constraint.target;
            }
          }
        }
        if (ownerId === undefined || targetName === undefined) {
          throw new Error(`kind ${kind}, run ${i}: generated scene has no aimAt constraint with an unknown target`);
        }

        const err = checkExactMessage(kind, i, c.message, thrownBy(c.scene));

        const wantEntity = `Entity "${ownerId}"`;
        if (!err.message.includes(wantEntity)) {
          throw new Error(`kind ${kind}, run ${i}: expected message to contain ${wantEntity} but got "${err.message}"`);
        }
        const wantTarget = `"${targetName}"`;
        if (!err.message.includes(wantTarget)) {
          throw new Error(`kind ${kind}, run ${i}: expected message to contain ${wantTarget} but got "${err.message}"`);
        }
      }),
      { numRuns: 200 },
    );
    expect(index).toBeGreaterThanOrEqual(200);
  });

  it('rejects a repeated entity id, naming the duplicated id', () => {
    const kind: InvalidKind = 'duplicateEntityId';
    let index = 0;
    fc.assert(
      fc.property(invalidSceneByKind[kind], (c) => {
        const i = index++;

        // Recover the duplicated id: the first id that appears twice, in list order.
        let duplicated: string | undefined;
        const ids = c.scene.entities.map((e) => e.id);
        for (let k = 0; k < ids.length && duplicated === undefined; k++) {
          for (let m = 0; m < k; m++) {
            if (ids[m] === ids[k]) {
              duplicated = ids[k];
              break;
            }
          }
        }
        if (duplicated === undefined) {
          throw new Error(`kind ${kind}, run ${i}: generated scene has no repeated entity id`);
        }

        const err = checkExactMessage(kind, i, c.message, thrownBy(c.scene));

        const want = `"${duplicated}"`;
        if (!err.message.includes(want)) {
          throw new Error(`kind ${kind}, run ${i}: expected message to contain ${want} but got "${err.message}"`);
        }
      }),
      { numRuns: 200 },
    );
    expect(index).toBeGreaterThanOrEqual(200);
  });
});
