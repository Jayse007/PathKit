import { describe, expect, it } from 'vitest';
import { bake } from '../../src/bake.js';
import { SceneError, validateScene } from '../../src/scene.js';
import type { Constraint, Scene } from '../../src/scene.js';
import { FORCED_ORBIT_CASES, buildOrbitScene } from '../helpers/orbit-generators.js';

// Validation of the orbitAround constraint and of unknown constraint types.
// Messages are the exact strings of requirements 4.3 to 4.7 and 5.5.

const AXIS_HINT = '(use +X, -X, +Y, -Y, +Z or -Z)';

/** A valid scene with one orbiter whose orbit constraint has `patch` applied on top. */
function sceneWith(patch: Record<string, unknown>): Scene {
  const scene = buildOrbitScene(FORCED_ORBIT_CASES[0]);
  Object.assign(scene.entities[0].constraints[0], patch);
  return scene;
}

/** A valid scene whose only constraint is `constraint` (built with a cast by the caller). */
function sceneWithConstraint(constraint: unknown): Scene {
  const scene = buildOrbitScene(FORCED_ORBIT_CASES[0]);
  scene.entities[0].constraints = [constraint as Constraint];
  return scene;
}

/** Runs validateScene and returns the thrown value. Fails if nothing was thrown. */
function thrownBy(scene: Scene): unknown {
  try {
    validateScene(scene);
  } catch (e) {
    return e;
  }
  throw new Error('validateScene did not throw');
}

describe('orbitAround validation messages', () => {
  it('rejects an unknown target', () => {
    expect(() => validateScene(sceneWith({ target: 'nowhere' }))).toThrow(
      new SceneError('Entity "orbiter": unknown target "nowhere"'),
    );
  });

  it('rejects the inherited name "toString" as an unknown target', () => {
    expect(() => validateScene(sceneWith({ target: 'toString' }))).toThrow(
      new SceneError('Entity "orbiter": unknown target "toString"'),
    );
  });

  it('rejects an axis that is not a token', () => {
    expect(() => validateScene(sceneWith({ axis: '+W' }))).toThrow(
      new SceneError(`Entity "orbiter": orbitAround axis "+W" is not an axis token ${AXIS_HINT}`),
    );
  });

  it('rejects radius NaN', () => {
    expect(() => validateScene(sceneWith({ radius: NaN }))).toThrow(
      new SceneError('Entity "orbiter": orbitAround radius must be a finite number of 0 or more, got NaN'),
    );
  });

  it('rejects radius Infinity', () => {
    expect(() => validateScene(sceneWith({ radius: Infinity }))).toThrow(
      new SceneError('Entity "orbiter": orbitAround radius must be a finite number of 0 or more, got Infinity'),
    );
  });

  it('rejects radius -Infinity', () => {
    expect(() => validateScene(sceneWith({ radius: -Infinity }))).toThrow(
      new SceneError('Entity "orbiter": orbitAround radius must be a finite number of 0 or more, got -Infinity'),
    );
  });

  it('rejects a negative radius', () => {
    expect(() => validateScene(sceneWith({ radius: -1 }))).toThrow(
      new SceneError('Entity "orbiter": orbitAround radius must be a finite number of 0 or more, got -1'),
    );
  });

  it('rejects the string "5" as a radius, with a message ending "got 5"', () => {
    expect(() => validateScene(sceneWith({ radius: '5' as unknown as number }))).toThrow(
      new SceneError('Entity "orbiter": orbitAround radius must be a finite number of 0 or more, got 5'),
    );
  });

  it('rejects speed NaN', () => {
    expect(() => validateScene(sceneWith({ speed: NaN }))).toThrow(
      new SceneError('Entity "orbiter": orbitAround speed must be a finite number, got NaN'),
    );
  });

  it('rejects speed Infinity', () => {
    expect(() => validateScene(sceneWith({ speed: Infinity }))).toThrow(
      new SceneError('Entity "orbiter": orbitAround speed must be a finite number, got Infinity'),
    );
  });

  it('rejects startAngle NaN', () => {
    expect(() => validateScene(sceneWith({ startAngle: NaN }))).toThrow(
      new SceneError('Entity "orbiter": orbitAround startAngle must be a finite number, got NaN'),
    );
  });

  it('rejects startAngle Infinity', () => {
    expect(() => validateScene(sceneWith({ startAngle: Infinity }))).toThrow(
      new SceneError('Entity "orbiter": orbitAround startAngle must be a finite number, got Infinity'),
    );
  });
});

describe('orbitAround: the first defect wins', () => {
  const targetMsg = 'Entity "orbiter": unknown target "nowhere"';
  const axisMsg = `Entity "orbiter": orbitAround axis "+W" is not an axis token ${AXIS_HINT}`;
  const radiusMsg = 'Entity "orbiter": orbitAround radius must be a finite number of 0 or more, got -1';
  const speedMsg = 'Entity "orbiter": orbitAround speed must be a finite number, got NaN';
  const startMsg = 'Entity "orbiter": orbitAround startAngle must be a finite number, got Infinity';

  it('reports the target before the axis', () => {
    const e = thrownBy(sceneWith({ target: 'nowhere', axis: '+W' }));
    expect(e).toEqual(new SceneError(targetMsg));
  });

  it('reports the axis before the radius', () => {
    const e = thrownBy(sceneWith({ axis: '+W', radius: -1 }));
    expect(e).toEqual(new SceneError(axisMsg));
  });

  it('reports the radius before the speed', () => {
    const e = thrownBy(sceneWith({ radius: -1, speed: NaN }));
    expect(e).toEqual(new SceneError(radiusMsg));
  });

  it('reports the speed before the startAngle', () => {
    const e = thrownBy(sceneWith({ speed: NaN, startAngle: Infinity }));
    expect(e).toEqual(new SceneError(speedMsg));
  });

  it('reports only the target error when all five fields are bad', () => {
    const e = thrownBy(
      sceneWith({ target: 'nowhere', axis: '+W', radius: -1, speed: NaN, startAngle: Infinity }),
    );
    expect(e).toEqual(new SceneError(targetMsg));
  });

  it('reports only the radius error when radius, speed and startAngle are bad', () => {
    const e = thrownBy(sceneWith({ radius: -1, speed: NaN, startAngle: Infinity }));
    expect(e).toEqual(new SceneError(radiusMsg));
  });

  it('reports only the startAngle error when it is the only defect', () => {
    const e = thrownBy(sceneWith({ startAngle: Infinity }));
    expect(e).toEqual(new SceneError(startMsg));
  });
});

describe('unknown constraint types', () => {
  it('rejects the type "mystery"', () => {
    const scene = sceneWithConstraint({ type: 'mystery', order: 0, influence: 1 });
    expect(() => validateScene(scene)).toThrow(
      new SceneError('Entity "orbiter": unknown constraint type "mystery" (use followPath, aimAt or orbitAround)'),
    );
  });

  it('rejects a constraint with no type and reports "undefined"', () => {
    const scene = sceneWithConstraint({ order: 0, influence: 1 });
    expect(() => validateScene(scene)).toThrow(
      new SceneError('Entity "orbiter": unknown constraint type "undefined" (use followPath, aimAt or orbitAround)'),
    );
  });
});

describe('check order between influence, order and the type checks', () => {
  it('a bad influence plus an unknown type reports the influence error', () => {
    const scene = sceneWithConstraint({ type: 'mystery', order: 0, influence: 2 });
    expect(thrownBy(scene)).toEqual(new SceneError('Entity "orbiter": influence 2 is outside [0,1]'));
  });

  it('a bad order plus an unknown type reports the order error', () => {
    const scene = sceneWithConstraint({ type: 'mystery', order: NaN, influence: 1 });
    expect(thrownBy(scene)).toEqual(new SceneError('Entity "orbiter": order must be a finite number, got NaN'));
  });

  it('a bad influence plus a bad orbit axis reports the influence error', () => {
    const e = thrownBy(sceneWith({ influence: 2, axis: '+W' }));
    expect(e).toEqual(new SceneError('Entity "orbiter": influence 2 is outside [0,1]'));
  });

  it('a bad order plus a bad orbit radius reports the order error', () => {
    const e = thrownBy(sceneWith({ order: NaN, radius: -1 }));
    expect(e).toEqual(new SceneError('Entity "orbiter": order must be a finite number, got NaN'));
  });

  it('an unknown type with valid influence and order reports the type error', () => {
    const scene = sceneWithConstraint({ type: 'mystery', order: 0, influence: 0.5 });
    const e = thrownBy(scene);
    expect(e).toBeInstanceOf(SceneError);
    expect((e as SceneError).message).toBe(
      'Entity "orbiter": unknown constraint type "mystery" (use followPath, aimAt or orbitAround)',
    );
  });
});

describe('bake rejects invalid scenes', () => {
  it('rejects an invalid orbit scene with the validateScene SceneError and returns no Baked_Data', () => {
    const scene = sceneWith({ radius: -1 });
    let result: unknown = 'not assigned';
    expect(() => {
      result = bake(scene);
    }).toThrow(
      new SceneError('Entity "orbiter": orbitAround radius must be a finite number of 0 or more, got -1'),
    );
    expect(result).toBe('not assigned');
  });

  it('rejects an unknown-type scene with the validateScene SceneError and returns no Baked_Data', () => {
    const scene = sceneWithConstraint({ type: 'mystery', order: 0, influence: 1 });
    let result: unknown = 'not assigned';
    expect(() => {
      result = bake(scene);
    }).toThrow(
      new SceneError('Entity "orbiter": unknown constraint type "mystery" (use followPath, aimAt or orbitAround)'),
    );
    expect(result).toBe('not assigned');
  });
});

describe('accepted scenes', () => {
  it('accepts radius 0', () => {
    expect(() => validateScene(sceneWith({ radius: 0 }))).not.toThrow();
  });

  it('accepts a scene with a valid path and no entity that follows it', () => {
    const scene = buildOrbitScene(FORCED_ORBIT_CASES[0]);
    expect(scene.path.points.length).toBeGreaterThan(1);
    expect(scene.entities[0].constraints.every((c) => c.type !== 'followPath')).toBe(true);
    expect(() => validateScene(scene)).not.toThrow();
  });
});

describe('validateScene does not modify the scene', () => {
  it('leaves a valid scene deeply equal to a copy taken before', () => {
    const scene = buildOrbitScene(FORCED_ORBIT_CASES[0]);
    const before = structuredClone(scene);
    validateScene(scene);
    expect(scene).toEqual(before);
  });

  it('leaves an invalid scene deeply equal to a copy taken before', () => {
    const scene = sceneWith({ radius: NaN, speed: Infinity });
    const before = structuredClone(scene);
    expect(() => validateScene(scene)).toThrow(SceneError);
    expect(scene).toEqual(before);
  });
});
