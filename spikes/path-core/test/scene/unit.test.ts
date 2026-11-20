import { describe, it, expect } from 'vitest';
import { validateScene, axisVector, SceneError } from '../../src/scene.js';
import type { Scene, AxisToken, FollowPathConstraint, AimAtConstraint, Keyframe } from '../../src/scene.js';
import type { Vec3 } from '../../src/math.js';

// Unit tests for scene validation: exact messages, ordering, no mutation, axisVector, SceneError (steps 1 to 14 of validateScene)

const TOKEN_HINT = '(use +X, -X, +Y, -Y, +Z or -Z)';

const base: Scene = {
  fps: 30,
  frameCount: 10,
  path: {
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 1 },
      { x: 2, y: 0, z: 0 },
    ],
    closed: false,
  },
  targets: {
    fixed: { x: 1, y: 1, z: 1 },
    moving: {
      keyframes: [
        { frame: 0, position: { x: 0, y: 1, z: 0 } },
        { frame: 5, position: { x: 2, y: 1, z: 0 } },
      ],
    },
  },
  entities: [
    {
      id: 'e1',
      forwardAxis: '+Z',
      upAxis: '+Y',
      // no alignToPath property on purpose
      constraints: [{ type: 'followPath', order: 0, influence: 1, speed: 1, startOffset: 0 }],
    },
    {
      id: 'e2',
      forwardAxis: '-Z',
      upAxis: '+Y',
      constraints: [{ type: 'aimAt', order: 1, influence: 0.5, target: 'fixed' }],
    },
  ],
};

function fresh(): Scene {
  return structuredClone(base);
}

function follow(scene: Scene): FollowPathConstraint {
  return scene.entities[0].constraints[0] as FollowPathConstraint;
}

function aim(scene: Scene): AimAtConstraint {
  return scene.entities[1].constraints[0] as AimAtConstraint;
}

function movingKeys(scene: Scene): Keyframe[] {
  return (scene.targets['moving'] as { keyframes: Keyframe[] }).keyframes;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

function catchError(scene: Scene): unknown {
  try {
    validateScene(scene);
  } catch (e) {
    return e;
  }
  return undefined;
}

// Asserts the exact message with toThrow and that the error is a SceneError with that exact message.
function expectSceneError(scene: Scene, message: string): void {
  expect(() => validateScene(scene)).toThrow(new Error(message));
  const error = catchError(scene);
  expect(error instanceof SceneError).toBe(true);
  expect((error as Error).message).toBe(message);
}

describe('valid base scene', () => {
  it('does not throw', () => {
    expect(() => validateScene(fresh())).not.toThrow();
  });
});

describe('exact validation messages', () => {
  it('step 1: fps', () => {
    const s = fresh();
    s.fps = 0;
    expectSceneError(s, 'fps must be a positive integer, got 0');
  });

  it('step 1: frameCount', () => {
    const s = fresh();
    s.frameCount = 2.5;
    expectSceneError(s, 'frameCount must be a positive integer, got 2.5');
  });

  it('step 2: duplicate entity id', () => {
    const s = fresh();
    s.entities[1].id = 'e1';
    expectSceneError(s, 'Duplicate entity id "e1"');
  });

  it('step 3: forwardAxis is not a token', () => {
    const s = fresh();
    s.entities[1].forwardAxis = 'Q' as unknown as AxisToken;
    expectSceneError(s, `Entity "e2": forwardAxis "Q" is not an axis token ${TOKEN_HINT}`);
  });

  it('step 4: upAxis is not a token', () => {
    const s = fresh();
    s.entities[0].upAxis = 'up' as unknown as AxisToken;
    expectSceneError(s, `Entity "e1": upAxis "up" is not an axis token ${TOKEN_HINT}`);
  });

  it('step 5: forward and up on the same axis', () => {
    const s = fresh();
    s.entities[0].forwardAxis = '+Z';
    s.entities[0].upAxis = '-Z';
    expectSceneError(s, 'Entity "e1": forwardAxis +Z and upAxis -Z must lie on different axes');
  });

  it('step 6: influence outside [0,1]', () => {
    const s = fresh();
    follow(s).influence = 1.5;
    expectSceneError(s, 'Entity "e1": influence 1.5 is outside [0,1]');
  });

  it('step 6: order not finite', () => {
    const s = fresh();
    follow(s).order = NaN;
    expectSceneError(s, 'Entity "e1": order must be a finite number, got NaN');
  });

  it('step 6: unknown aimAt target', () => {
    const s = fresh();
    aim(s).target = 'nowhere';
    expectSceneError(s, 'Entity "e2": unknown target "nowhere"');
  });

  it('step 7: non-integer keyframe frame', () => {
    const s = fresh();
    movingKeys(s)[1].frame = 2.5;
    expectSceneError(s, 'Target "moving": keyframe frame must be an integer, got 2.5');
  });

  it('step 8: empty keyframes', () => {
    const s = fresh();
    movingKeys(s).length = 0;
    expectSceneError(s, 'Target "moving": keyframes must not be empty');
  });

  it('step 9: equal keyframe frames', () => {
    const s = fresh();
    movingKeys(s)[1].frame = 0;
    expectSceneError(s, 'Target "moving": keyframe frames must be strictly increasing, got 0 then 0');
  });

  it('step 9: decreasing keyframe frames', () => {
    const s = fresh();
    movingKeys(s)[0].frame = 8;
    expectSceneError(s, 'Target "moving": keyframe frames must be strictly increasing, got 8 then 5');
  });

  it('step 10: speed not finite', () => {
    const s = fresh();
    follow(s).speed = Infinity;
    expectSceneError(s, 'Entity "e1": speed must be a finite number, got Infinity');
  });

  it('step 11: startOffset not finite', () => {
    const s = fresh();
    follow(s).startOffset = NaN;
    expectSceneError(s, 'Entity "e1": startOffset must be a finite number, got NaN');
  });

  it('step 12: path point not finite', () => {
    const s = fresh();
    s.path.points[1].y = NaN;
    expectSceneError(s, 'Path point 1 must have finite coordinates');
  });

  it('step 13: static target not finite', () => {
    const s = fresh();
    (s.targets['fixed'] as Vec3).z = Infinity;
    expectSceneError(s, 'Target "fixed": position must have finite coordinates');
  });

  it('step 14: keyframe position not finite', () => {
    const s = fresh();
    movingKeys(s)[1].position.x = -Infinity;
    expectSceneError(s, 'Target "moving": keyframe 1 position must have finite coordinates');
  });
});

describe('omitted alignToPath', () => {
  it('is accepted and stays absent', () => {
    const s = fresh();
    const c = follow(s);
    expect('alignToPath' in c).toBe(false);
    expect(() => validateScene(s)).not.toThrow();
    expect('alignToPath' in c).toBe(false);
    expect(c.alignToPath).toBeUndefined();
  });
});

describe('validateScene does not mutate', () => {
  it('accepts a deep-frozen valid scene', () => {
    const s = deepFreeze(fresh());
    expect(() => validateScene(s)).not.toThrow();
  });

  it('throws SceneError, not TypeError, for a deep-frozen invalid scene', () => {
    const s = fresh();
    follow(s).influence = -1;
    deepFreeze(s);
    const error = catchError(s);
    expect(error instanceof SceneError).toBe(true);
    expect(error instanceof TypeError).toBe(false);
    expect((error as Error).message).toBe('Entity "e1": influence -1 is outside [0,1]');
  });
});

describe('check ordering', () => {
  it('fps is reported before frameCount', () => {
    const s = fresh();
    s.fps = 0;
    s.frameCount = 0;
    expectSceneError(s, 'fps must be a positive integer, got 0');
  });

  it('forwardAxis token is reported before upAxis token', () => {
    const s = fresh();
    s.entities[0].forwardAxis = 'F' as unknown as AxisToken;
    s.entities[0].upAxis = 'U' as unknown as AxisToken;
    expectSceneError(s, `Entity "e1": forwardAxis "F" is not an axis token ${TOKEN_HINT}`);
  });

  it('influence is reported before order in the same constraint', () => {
    const s = fresh();
    follow(s).influence = 2;
    follow(s).order = NaN;
    expectSceneError(s, 'Entity "e1": influence 2 is outside [0,1]');
  });

  it('a lower-numbered step on a later entity beats a higher-numbered step on an earlier entity', () => {
    const s = fresh();
    follow(s).influence = 2; // entity e1, step 6
    s.entities[1].forwardAxis = 'Q' as unknown as AxisToken; // entity e2, step 3
    expectSceneError(s, `Entity "e2": forwardAxis "Q" is not an axis token ${TOKEN_HINT}`);
  });
});

describe('axisVector', () => {
  const cases: Array<[AxisToken, number, number, number]> = [
    ['+X', 1, 0, 0],
    ['-X', -1, 0, 0],
    ['+Y', 0, 1, 0],
    ['-Y', 0, -1, 0],
    ['+Z', 0, 0, 1],
    ['-Z', 0, 0, -1],
  ];

  for (const [token, x, y, z] of cases) {
    it(`writes the exact vector for ${token} and returns out`, () => {
      const out: Vec3 = { x: 9, y: 9, z: 9 };
      const result = axisVector(token, out);
      expect(result).toBe(out);
      expect(out.x).toBe(x);
      expect(out.y).toBe(y);
      expect(out.z).toBe(z);
    });
  }

  it('throws SceneError for an unknown token', () => {
    const out: Vec3 = { x: 0, y: 0, z: 0 };
    const bad = '+W' as unknown as AxisToken;
    expect(() => axisVector(bad, out)).toThrow(SceneError);
    expect(() => axisVector(bad, out)).toThrow(new Error(`"+W" is not an axis token ${TOKEN_HINT}`));
  });
});

describe('SceneError', () => {
  it('has name SceneError and is an Error', () => {
    const e = new SceneError('boom');
    expect(e.name).toBe('SceneError');
    expect(e.message).toBe('boom');
    expect(e instanceof Error).toBe(true);
    expect(e instanceof SceneError).toBe(true);
  });
});
