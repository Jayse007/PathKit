import { describe, expect, it, vi } from 'vitest';
import { bake } from '../../src/index.js';
import type { Constraint } from '../../src/scene.js';
import { FORCED_ORBIT_CASES, buildOrbitScene } from '../helpers/orbit-generators.js';

// validateScene is replaced by a no-op so a constraint of an unknown type reaches the baker.
// Everything else in scene.js is the real module.
vi.mock('../../src/scene.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/scene.js')>()),
  validateScene: () => {},
}));

// Defensive branch of bakeEntity (Requirements 5.2, 5.12): the validator rejects an unknown type first,
// so only a mocked validator lets one reach the baker. The error is a plain Error, not a SceneError.
//
// The matching branch in drivesRotation cannot be reached through bake(): bake() calls bakeEntity first,
// and bakeEntity throws for the unknown type on frame 0 before drivesRotation is ever called.
// That branch is covered by the source-text check in test/bake/orbit-unit.test.ts (task 3.3)
// and by the reviewer's type check (the never exhaustiveness of the default branch).

function sceneWithConstraint(constraint: unknown) {
  const scene = buildOrbitScene(FORCED_ORBIT_CASES[0]);
  scene.entities[0].constraints = [constraint as Constraint];
  return scene;
}

describe('bakeEntity defensive branch with validateScene mocked', () => {
  it('an unknown constraint type "mystery" throws Error "Unknown constraint type \\"mystery\\""', () => {
    const scene = sceneWithConstraint({ type: 'mystery', order: 0, influence: 1 });
    expect(() => bake(scene)).toThrow(new Error('Unknown constraint type "mystery"'));
    let thrown: unknown;
    try {
      bake(scene);
    } catch (e) {
      thrown = e;
    }
    expect((thrown as Error).name).toBe('Error');
  });

  it('a constraint with no type throws Error with the value "undefined"', () => {
    const scene = sceneWithConstraint({ order: 0, influence: 1 });
    expect(() => bake(scene)).toThrow(new Error('Unknown constraint type "undefined"'));
  });
});
