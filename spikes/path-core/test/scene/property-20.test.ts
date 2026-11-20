import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SceneError, validateScene } from '../../src/scene.js';
import type { Entity, Scene } from '../../src/scene.js';
import { ALL_AXIS_PAIRS, INVALID_AXIS_PAIRS, VALID_AXIS_PAIRS } from '../helpers/basic-generators.js';
import { arbValidScene, invalidSceneByKind } from '../helpers/scene-generators.js';
import type { InvalidKind } from '../helpers/scene-generators.js';

// Feature: path-core, Property 20: Axis validation rejects same or opposite axes
// **Validates: Requirements 5.3, 5.4, 5.15, 10.5**

const BASE_SCENE_COUNT = 20;

/** Sampled valid scenes (fixed seed), each forced to have at least one entity. */
function sampleBases(): Scene[] {
  return fc.sample(arbValidScene, { numRuns: BASE_SCENE_COUNT, seed: 20 }).map((sampled) => {
    const scene = structuredClone(sampled);
    if (scene.entities.length === 0) {
      const entity: Entity = { id: 'entity-0', forwardAxis: '+X', upAxis: '+Y', constraints: [] };
      scene.entities.push(entity);
    }
    return scene;
  });
}

/** Runs validateScene and returns the thrown error, or undefined if it did not throw. */
function thrownBy(scene: Scene): unknown {
  try {
    validateScene(scene);
  } catch (e) {
    return e;
  }
  return undefined;
}

describe('Property 20: Axis validation rejects same or opposite axes', () => {
  it('rejects exactly the 12 same-axis pairs out of all 36 ordered pairs, for every base scene', () => {
    expect(ALL_AXIS_PAIRS.length).toBe(36);
    expect(INVALID_AXIS_PAIRS.length).toBe(12);
    expect(VALID_AXIS_PAIRS.length).toBe(24);

    const bases = sampleBases();
    expect(bases.length).toBe(BASE_SCENE_COUNT);

    let checks = 0;
    for (let b = 0; b < bases.length; b++) {
      for (const [f, u] of ALL_AXIS_PAIRS) {
        const scene = structuredClone(bases[b]);
        const entity = scene.entities[0];
        entity.forwardAxis = f;
        entity.upAxis = u;
        const shouldThrow = f.charAt(1) === u.charAt(1);
        const err = thrownBy(scene);
        checks++;

        if (shouldThrow) {
          const expected = `Entity "${entity.id}": forwardAxis ${f} and upAxis ${u} must lie on different axes`;
          if (err === undefined) {
            throw new Error(`base ${b}, pair (${f}, ${u}): expected SceneError "${expected}" but validateScene did not throw`);
          }
          if (!(err instanceof SceneError)) {
            throw new Error(`base ${b}, pair (${f}, ${u}): expected SceneError but got ${String(err)}`);
          }
          if (err.message !== expected) {
            throw new Error(`base ${b}, pair (${f}, ${u}): expected message "${expected}" but got "${err.message}"`);
          }
        } else if (err !== undefined) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`base ${b}, pair (${f}, ${u}): expected no throw but got "${msg}"`);
        }
      }
    }
    expect(checks).toBe(BASE_SCENE_COUNT * 36);
  });

  const kinds: InvalidKind[] = ['forwardAxisNotToken', 'upAxisNotToken'];
  for (const kind of kinds) {
    it(`rejects ${kind} with the exact message`, () => {
      let index = 0;
      fc.assert(
        fc.property(invalidSceneByKind[kind], (c) => {
          const i = index++;
          const err = thrownBy(c.scene);
          if (err === undefined) {
            throw new Error(`kind ${c.kind}, run ${i}: expected SceneError "${c.message}" but validateScene did not throw`);
          }
          if (!(err instanceof SceneError)) {
            throw new Error(`kind ${c.kind}, run ${i}: expected SceneError "${c.message}" but got ${String(err)}`);
          }
          if (err.message !== c.message) {
            throw new Error(`kind ${c.kind}, run ${i}: expected message "${c.message}" but got "${err.message}"`);
          }
        }),
        { numRuns: 200 },
      );
      expect(index).toBeGreaterThanOrEqual(200);
    });
  }
});
