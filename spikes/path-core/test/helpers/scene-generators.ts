import fc from 'fast-check';
import type { Vec3 } from '../../src/math.js';
import type {
  AimAtConstraint,
  AxisToken,
  Constraint,
  Entity,
  FollowPathConstraint,
  Keyframe,
  Scene,
  Target,
} from '../../src/scene.js';
import {
  INVALID_AXIS_PAIRS,
  arbClosed,
  arbPointList,
  arbValidAxisPair,
  arbVec3,
  coord,
} from './basic-generators.js';

// ---------------------------------------------------------------------------
// Valid scenes
// ---------------------------------------------------------------------------

const arbFps = fc.constantFrom(24, 30, 60);
const arbFrameCount = fc.integer({ min: 1, max: 120 });
const arbInfluence = fc.oneof(fc.constant(0), fc.constant(1), coord(0, 1));
const arbOrder = fc.integer({ min: -20, max: 20 });

/** Array with a length drawn uniformly from [min, max] (plain fc.array favours short lengths). */
function arrayOfLength<T>(item: fc.Arbitrary<T>, min: number, max: number): fc.Arbitrary<T[]> {
  return fc
    .integer({ min, max })
    .chain((n) => fc.array(item, { minLength: n, maxLength: n }));
}

interface FollowBody {
  influence: number;
  speed: number;
  startOffset: number;
  align: boolean | undefined; // undefined means the property is omitted
}

const arbFollowBody: fc.Arbitrary<FollowBody> = fc.record({
  influence: arbInfluence,
  speed: coord(-10, 10),
  startOffset: coord(-50, 50),
  align: fc.constantFrom<boolean | undefined>(undefined, true, false),
});

function buildFollow(order: number, b: FollowBody): FollowPathConstraint {
  const c: FollowPathConstraint = {
    type: 'followPath',
    order,
    influence: b.influence,
    speed: b.speed,
    startOffset: b.startOffset,
  };
  if (b.align !== undefined) c.alignToPath = b.align;
  return c;
}

const arbAimBody = (names: string[]) =>
  fc.record({ influence: arbInfluence, target: fc.constantFrom(...names) });

function buildAim(order: number, b: { influence: number; target: string }): AimAtConstraint {
  return { type: 'aimAt', order, influence: b.influence, target: b.target };
}

/** 0..3 constraints with distinct integer orders in random list order. aimAt only if names is non-empty. */
function arbConstraints(names: string[], min: number, max: number): fc.Arbitrary<Constraint[]> {
  const follow: fc.Arbitrary<(order: number) => Constraint> = arbFollowBody.map(
    (b) => (order: number) => buildFollow(order, b),
  );
  const arbOne: fc.Arbitrary<(order: number) => Constraint> =
    names.length === 0
      ? follow
      : fc.oneof(
          follow,
          arbAimBody(names).map((b) => (order: number) => buildAim(order, b)),
        );
  return fc.integer({ min, max }).chain((n) =>
    fc
      .tuple(
        fc.uniqueArray(arbOrder, { minLength: n, maxLength: n }),
        fc.array(arbOne, { minLength: n, maxLength: n }),
      )
      .map(([orders, makers]) => makers.map((make, i) => make(orders[i]))),
  );
}

interface EntityBody {
  axes: readonly [AxisToken, AxisToken];
  constraints: Constraint[];
}

const arbEntityBody = (names: string[]): fc.Arbitrary<EntityBody> =>
  fc.record({ axes: arbValidAxisPair, constraints: arbConstraints(names, 0, 3) });

function arbEntityBodies(names: string[], min: number, max: number): fc.Arbitrary<EntityBody[]> {
  return arrayOfLength(arbEntityBody(names), min, max);
}

function toEntities(bodies: EntityBody[]): Entity[] {
  return bodies.map((b, i) => ({
    id: `entity-${i}`,
    forwardAxis: b.axes[0],
    upAxis: b.axes[1],
    constraints: b.constraints,
  }));
}

/** Non-empty keyframes with strictly increasing integer frames in [0, frameCount + 20]. */
function arbKeyframes(frameCount: number, min: number, max: number): fc.Arbitrary<Keyframe[]> {
  return fc.integer({ min, max }).chain((n) =>
    fc
      .tuple(
        fc.uniqueArray(fc.integer({ min: 0, max: frameCount + 20 }), { minLength: n, maxLength: n }),
        fc.array(arbVec3, { minLength: n, maxLength: n }),
      )
      .map(([frames, positions]) =>
        [...frames].sort((a, b) => a - b).map((frame, i) => ({ frame, position: positions[i] })),
      ),
  );
}

function arbTargets(frameCount: number): fc.Arbitrary<Record<string, Target>> {
  const arbTarget: fc.Arbitrary<Target> = fc.oneof(
    arbVec3,
    arbKeyframes(frameCount, 1, 5).map((keyframes) => ({ keyframes })),
  );
  return arrayOfLength(arbTarget, 0, 4).map((list) => {
    const targets: Record<string, Target> = {};
    list.forEach((t, i) => {
      targets[`t${i}`] = t;
    });
    return targets;
  });
}

const arbHeader = fc.record({ fps: arbFps, frameCount: arbFrameCount, closed: arbClosed });

/** Valid scenes: 0..4 entities, mixed constraints, open or closed path, static and keyframed targets. */
export const arbValidScene: fc.Arbitrary<Scene> = arbHeader.chain((h) =>
  fc.tuple(arbPointList(h.closed), arbTargets(h.frameCount)).chain(([points, targets]) =>
    arbEntityBodies(Object.keys(targets), 0, 4).map(
      (bodies): Scene => ({
        fps: h.fps,
        frameCount: h.frameCount,
        path: { points, closed: h.closed },
        targets,
        entities: toEntities(bodies),
      }),
    ),
  ),
);

// ---------------------------------------------------------------------------
// Invalid scenes
// ---------------------------------------------------------------------------

/**
 * Valid scene that always has: >= 2 entities, a followPath and an aimAt constraint (entity 0),
 * a static target "s0", a keyframed target "k0" with 2..5 keyframes, and >= 3 path points.
 */
const arbRichBase: fc.Arbitrary<Scene> = arbHeader.chain((h) => {
  const names = ['s0', 'k0'];
  const arbRichEntity: fc.Arbitrary<EntityBody> = fc
    .record({
      axes: arbValidAxisPair,
      orders: fc.uniqueArray(arbOrder, { minLength: 2, maxLength: 2 }),
      follow: arbFollowBody,
      aim: arbAimBody(names),
    })
    .map((r) => ({
      axes: r.axes,
      constraints: [buildFollow(r.orders[0], r.follow), buildAim(r.orders[1], r.aim)],
    }));
  return fc
    .tuple(
      arbPointList(h.closed, 3),
      arbVec3,
      arbKeyframes(h.frameCount, 2, 5),
      arbRichEntity,
      arbEntityBodies(names, 1, 3),
    )
    .map(
      ([points, staticPos, keyframes, rich, others]): Scene => ({
        fps: h.fps,
        frameCount: h.frameCount,
        path: { points, closed: h.closed },
        targets: { s0: staticPos, k0: { keyframes } },
        entities: toEntities([rich, ...others]),
      }),
    );
});

export const INVALID_KINDS = [
  'fpsInvalid',
  'frameCountInvalid',
  'duplicateEntityId',
  'forwardAxisNotToken',
  'upAxisNotToken',
  'sameAxisPair',
  'influenceOutOfRange',
  'orderNotFinite',
  'unknownAimTarget',
  'keyframeFrameNotInteger',
  'keyframesEmpty',
  'keyframeFramesEqual',
  'keyframeFramesDecreasing',
  'speedNotFinite',
  'startOffsetNotFinite',
  'pathPointNotFinite',
  'staticTargetNotFinite',
  'keyframePositionNotFinite',
] as const;

export type InvalidKind = (typeof INVALID_KINDS)[number];

export interface InvalidSceneCase {
  kind: InvalidKind;
  scene: Scene;
  /** Exact message validateScene is expected to throw. */
  message: string;
}

const arbPick = fc.integer({ min: 0, max: 1_000_000 });
const at = <T>(arr: readonly T[], pick: number): T => arr[pick % arr.length];

const arbNonFinite = fc.constantFrom(NaN, Infinity, -Infinity);

/** Not a positive integer: NaN, +-Infinity, 0, negatives, fractions. */
const arbBadCount = fc.oneof(
  fc.constantFrom(NaN, Infinity, -Infinity, 0, -1, 2.5),
  fc.integer({ min: -1000, max: -1 }),
  fc.integer({ min: 0, max: 1000 }).map((i) => i + 0.5),
  fc.integer({ min: 0, max: 1000 }).map((i) => -(i + 0.5)),
);

const NON_TOKENS = ['', 'X', 'Z+', '+W', '+x', '-y', 'forward', '++X', '+X ', ' -Z', '0', 'up', '+XY'];
const arbNonToken = fc.constantFrom(...NON_TOKENS);

const arbBadInfluence = fc.oneof(
  arbNonFinite,
  fc.integer({ min: 1, max: 100000 }).map((i) => 1 + i / 1000),
  fc.integer({ min: 1, max: 100000 }).map((i) => -i / 1000),
);

const arbBadTargetName = fc.oneof(
  fc.constantFrom('toString', 'constructor', '', '__proto__', 'hasOwnProperty'),
  fc.integer({ min: 0, max: 999 }).map((i) => `missing-${i}`),
);

const arbBadFrame = fc.oneof(
  arbNonFinite,
  fc.integer({ min: -100, max: 200 }).map((i) => i + 0.5),
  fc.integer({ min: -100, max: 100 }).map((i) => i + 0.25),
);

const arbBadCoord = fc.record({
  axis: fc.constantFrom<'x' | 'y' | 'z'>('x', 'y', 'z'),
  value: arbNonFinite,
});

const TOKEN_HINT = '(use +X, -X, +Y, -Y, +Z or -Z)';

function allConstraints(scene: Scene): { entity: Entity; constraint: Constraint }[] {
  const out: { entity: Entity; constraint: Constraint }[] = [];
  for (const entity of scene.entities) {
    for (const constraint of entity.constraints) out.push({ entity, constraint });
  }
  return out;
}

function constraintsOfType<T extends Constraint['type']>(
  scene: Scene,
  type: T,
): { entity: Entity; constraint: Extract<Constraint, { type: T }> }[] {
  return allConstraints(scene).filter((x) => x.constraint.type === type) as {
    entity: Entity;
    constraint: Extract<Constraint, { type: T }>;
  }[];
}

const keyframesOf = (scene: Scene): Keyframe[] => (scene.targets['k0'] as { keyframes: Keyframe[] }).keyframes;

/** Deep-copies a rich base, applies exactly one mutation and returns the expected message. */
function mutation<X>(
  kind: InvalidKind,
  arbX: fc.Arbitrary<X>,
  apply: (scene: Scene, pick1: number, pick2: number, x: X) => string,
): fc.Arbitrary<InvalidSceneCase> {
  return fc.tuple(arbRichBase, arbPick, arbPick, arbX).map(([base, p1, p2, x]) => {
    const scene = structuredClone(base);
    const message = apply(scene, p1, p2, x);
    return { kind, scene, message };
  });
}

const none = fc.constant(null);

export const invalidSceneByKind: Record<InvalidKind, fc.Arbitrary<InvalidSceneCase>> = {
  fpsInvalid: mutation('fpsInvalid', arbBadCount, (s, _p1, _p2, x) => {
    s.fps = x;
    return `fps must be a positive integer, got ${x}`;
  }),

  frameCountInvalid: mutation('frameCountInvalid', arbBadCount, (s, _p1, _p2, x) => {
    s.frameCount = x;
    return `frameCount must be a positive integer, got ${x}`;
  }),

  duplicateEntityId: mutation('duplicateEntityId', none, (s, p1, p2) => {
    const j = 1 + (p1 % (s.entities.length - 1));
    const i = p2 % j;
    s.entities[j].id = s.entities[i].id;
    return `Duplicate entity id "${s.entities[j].id}"`;
  }),

  forwardAxisNotToken: mutation('forwardAxisNotToken', arbNonToken, (s, p1, _p2, x) => {
    const e = at(s.entities, p1);
    e.forwardAxis = x as AxisToken;
    return `Entity "${e.id}": forwardAxis "${x}" is not an axis token ${TOKEN_HINT}`;
  }),

  upAxisNotToken: mutation('upAxisNotToken', arbNonToken, (s, p1, _p2, x) => {
    const e = at(s.entities, p1);
    e.upAxis = x as AxisToken;
    return `Entity "${e.id}": upAxis "${x}" is not an axis token ${TOKEN_HINT}`;
  }),

  sameAxisPair: mutation('sameAxisPair', fc.constantFrom(...INVALID_AXIS_PAIRS), (s, p1, _p2, pair) => {
    const e = at(s.entities, p1);
    e.forwardAxis = pair[0];
    e.upAxis = pair[1];
    return `Entity "${e.id}": forwardAxis ${pair[0]} and upAxis ${pair[1]} must lie on different axes`;
  }),

  influenceOutOfRange: mutation('influenceOutOfRange', arbBadInfluence, (s, p1, _p2, x) => {
    const { entity, constraint } = at(allConstraints(s), p1);
    constraint.influence = x;
    return `Entity "${entity.id}": influence ${x} is outside [0,1]`;
  }),

  orderNotFinite: mutation('orderNotFinite', arbNonFinite, (s, p1, _p2, x) => {
    const { entity, constraint } = at(allConstraints(s), p1);
    constraint.order = x;
    return `Entity "${entity.id}": order must be a finite number, got ${x}`;
  }),

  unknownAimTarget: mutation('unknownAimTarget', arbBadTargetName, (s, p1, _p2, x) => {
    const { entity, constraint } = at(constraintsOfType(s, 'aimAt'), p1);
    constraint.target = x;
    return `Entity "${entity.id}": unknown target "${x}"`;
  }),

  keyframeFrameNotInteger: mutation('keyframeFrameNotInteger', arbBadFrame, (s, p1, _p2, x) => {
    const ks = keyframesOf(s);
    at(ks, p1).frame = x;
    return `Target "k0": keyframe frame must be an integer, got ${x}`;
  }),

  keyframesEmpty: mutation('keyframesEmpty', none, (s) => {
    (s.targets['k0'] as { keyframes: Keyframe[] }).keyframes = [];
    return 'Target "k0": keyframes must not be empty';
  }),

  keyframeFramesEqual: mutation('keyframeFramesEqual', none, (s, p1) => {
    const ks = keyframesOf(s);
    const i = 1 + (p1 % (ks.length - 1));
    const a = ks[i - 1].frame;
    ks[i].frame = a;
    return `Target "k0": keyframe frames must be strictly increasing, got ${a} then ${a}`;
  }),

  keyframeFramesDecreasing: mutation(
    'keyframeFramesDecreasing',
    fc.integer({ min: 1, max: 30 }),
    (s, p1, _p2, d) => {
      const ks = keyframesOf(s);
      const i = 1 + (p1 % (ks.length - 1));
      const a = ks[i - 1].frame;
      ks[i].frame = a - d;
      return `Target "k0": keyframe frames must be strictly increasing, got ${a} then ${a - d}`;
    },
  ),

  speedNotFinite: mutation('speedNotFinite', arbNonFinite, (s, p1, _p2, x) => {
    const { entity, constraint } = at(constraintsOfType(s, 'followPath'), p1);
    constraint.speed = x;
    return `Entity "${entity.id}": speed must be a finite number, got ${x}`;
  }),

  startOffsetNotFinite: mutation('startOffsetNotFinite', arbNonFinite, (s, p1, _p2, x) => {
    const { entity, constraint } = at(constraintsOfType(s, 'followPath'), p1);
    constraint.startOffset = x;
    return `Entity "${entity.id}": startOffset must be a finite number, got ${x}`;
  }),

  pathPointNotFinite: mutation('pathPointNotFinite', arbBadCoord, (s, p1, _p2, c) => {
    const i = p1 % s.path.points.length;
    s.path.points[i][c.axis] = c.value;
    return `Path point ${i} must have finite coordinates`;
  }),

  staticTargetNotFinite: mutation('staticTargetNotFinite', arbBadCoord, (s, _p1, _p2, c) => {
    (s.targets['s0'] as Vec3)[c.axis] = c.value;
    return 'Target "s0": position must have finite coordinates';
  }),

  keyframePositionNotFinite: mutation('keyframePositionNotFinite', arbBadCoord, (s, p1, _p2, c) => {
    const ks = keyframesOf(s);
    const i = p1 % ks.length;
    ks[i].position[c.axis] = c.value;
    return `Target "k0": keyframe ${i} position must have finite coordinates`;
  }),
};

/** One invalid scene of any kind, each kind equally likely. */
export const arbInvalidScene: fc.Arbitrary<InvalidSceneCase> = fc.oneof(
  ...INVALID_KINDS.map((k) => invalidSceneByKind[k]),
);

// ---------------------------------------------------------------------------
// Property 24 variant: followPath positions
// ---------------------------------------------------------------------------

export interface FollowPathSceneOptions {
  /** When false, no followPath in the scene has alignToPath true (no per-bake RMF table). */
  allowAlign: boolean;
  /** Forces an open (false) or closed (true) path. Omit for either. */
  closed?: boolean;
}

/**
 * One entity named "subject", one path, a static target "s0" and a keyframed target "k0".
 * The entity holds a followPath under test with influence 1. It is the LAST followPath in
 * constraint order, and every constraint after it is an aimAt (aimAt never drives position),
 * so no later constraint drives the position channel. Up to 2 earlier constraints (followPath
 * or aimAt, any influence) may exist. Orders are distinct and the list is in ascending order.
 * The test finds the constraint under test as the followPath with the highest order.
 * Its speed and startOffset are ordinary random values; a test that needs values scaled to
 * the path length overwrites them.
 */
export function arbFollowPathScene(options: FollowPathSceneOptions): fc.Arbitrary<Scene> {
  const maskAlign = (b: FollowBody): FollowBody =>
    options.allowAlign || b.align !== true ? b : { ...b, align: false };
  const arbHeader24 = fc.record({
    fps: arbFps,
    frameCount: fc.integer({ min: 1, max: 60 }),
    closed: options.closed === undefined ? arbClosed : fc.constant(options.closed),
  });
  const arbEarlier = fc.oneof(
    arbFollowBody.map((b) => ({ follow: maskAlign(b) as FollowBody | null, aim: null as { influence: number; target: string } | null })),
    arbAimBody(['s0', 'k0']).map((b) => ({ follow: null as FollowBody | null, aim: b as { influence: number; target: string } | null })),
  );
  return arbHeader24.chain((h) =>
    fc
      .record({
        points: arbPointList(h.closed),
        staticPos: arbVec3,
        keyA: arbVec3,
        keyB: arbVec3,
        axes: arbValidAxisPair,
        earlier: arrayOfLength(arbEarlier, 0, 2),
        later: arrayOfLength(arbAimBody(['s0', 'k0']), 0, 2),
        under: arbFollowBody,
        orders: fc.uniqueArray(arbOrder, { minLength: 5, maxLength: 5 }),
      })
      .map((r): Scene => {
        const sorted = [...r.orders].slice(0, r.earlier.length + 1 + r.later.length).sort((a, b) => a - b);
        const constraints: Constraint[] = [];
        let next = 0;
        for (const e of r.earlier) {
          const order = sorted[next++];
          constraints.push(e.follow !== null ? buildFollow(order, e.follow) : buildAim(order, e.aim as { influence: number; target: string }));
        }
        constraints.push(buildFollow(sorted[next++], { ...maskAlign(r.under), influence: 1 }));
        for (const a of r.later) constraints.push(buildAim(sorted[next++], a));
        return {
          fps: h.fps,
          frameCount: h.frameCount,
          path: { points: r.points, closed: h.closed },
          targets: {
            s0: r.staticPos,
            k0: {
              keyframes: [
                { frame: 0, position: r.keyA },
                { frame: h.frameCount, position: r.keyB },
              ],
            },
          },
          entities: [{ id: 'subject', forwardAxis: r.axes[0], upAxis: r.axes[1], constraints }],
        };
      }),
  );
}
