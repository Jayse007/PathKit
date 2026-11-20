import fc from 'fast-check';
import { createArcLengthTable } from '../../src/arclength.js';
import { createCurve } from '../../src/curve.js';
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

// ---------------------------------------------------------------------------
// Property 27 variant: aimAt
// ---------------------------------------------------------------------------

/** How an aim target is placed relative to the entity position: angle from +Y, azimuth, distance. */
export interface AimSpec {
  /** Degrees between the aim direction and +Y, in [3.1, 176.9]. */
  theta: number;
  /** Degrees around the Y axis, an integer in [0, 359]. */
  azimuth: number;
  /** Metres from the entity position. */
  distance: number;
}

const AIM_DEG = Math.PI / 180;
/** Aims closer than this to vertical are rejected (3 degrees is the cone in the spec; 3.05 leaves rounding margin). */
const AIM_FILTER_COS = Math.cos(3.05 * AIM_DEG);
const AIM_MIN_DISTANCE = 0.5;

/**
 * Angle from +Y. Weighted towards the band just outside the vertical cone
 * (3.1 to 10 degrees from straight up or straight down), plus the generic
 * range and exactly 5 degrees (up or down). Tenths of a degree, evenly spread.
 */
const arbAimAngle: fc.Arbitrary<number> = fc.oneof(
  {
    weight: 3,
    arbitrary: fc
      .tuple(fc.integer({ min: 31, max: 100 }), fc.boolean())
      .map(([tenths, down]) => (down ? 180 - tenths / 10 : tenths / 10)),
  },
  { weight: 2, arbitrary: fc.integer({ min: 31, max: 1769 }).map((tenths) => tenths / 10) },
  { weight: 1, arbitrary: fc.boolean().map((down) => (down ? 175 : 5)) },
);

function arbAimSpec(distance: fc.Arbitrary<number>): fc.Arbitrary<AimSpec> {
  return fc.record({ theta: arbAimAngle, azimuth: fc.integer({ min: 0, max: 359 }), distance });
}

function aimDirectionOf(theta: number, azimuth: number): Vec3 {
  const t = theta * AIM_DEG;
  const a = azimuth * AIM_DEG;
  return { x: Math.sin(t) * Math.cos(a), y: Math.cos(t), z: Math.sin(t) * Math.sin(a) };
}

const arbAimFollowBody: fc.Arbitrary<FollowBody> = fc.record({
  influence: fc.oneof(fc.constant(1), coord(0, 1)),
  speed: fc.oneof(fc.constant(0), coord(-3, 3)),
  startOffset: coord(-20, 20),
  align: fc.constantFrom<boolean | undefined>(undefined, false, true),
});

/** Position after the followPath list, one Vec3 per frame (own clamp/wrap; origin when the list is empty). */
function followerPositions(
  points: Vec3[],
  closed: boolean,
  fps: number,
  frameCount: number,
  followers: readonly FollowBody[],
): Vec3[] {
  const table = createArcLengthTable(createCurve(points, closed));
  const len = table.length;
  const p: Vec3 = { x: 0, y: 0, z: 0 };
  const out: Vec3[] = [];
  for (let f = 0; f < frameCount; f++) {
    const pos: Vec3 = { x: 0, y: 0, z: 0 };
    for (const b of followers) {
      const d = b.startOffset + (b.speed * f) / fps;
      const dist = closed ? d - len * Math.floor(d / len) : Math.min(Math.max(d, 0), len);
      table.pointAtDistance(dist, p);
      pos.x += (p.x - pos.x) * b.influence;
      pos.y += (p.y - pos.y) * b.influence;
      pos.z += (p.z - pos.z) * b.influence;
    }
    out.push(pos);
  }
  return out;
}

/** Target position at a frame: hold before the first and after the last keyframe, lerp between. */
function aimTargetAt(target: Target, frame: number): Vec3 {
  if (!('keyframes' in target)) return target;
  const keys = target.keyframes;
  if (frame <= keys[0].frame) return keys[0].position;
  const last = keys[keys.length - 1];
  if (frame >= last.frame) return last.position;
  let i = 1;
  while (keys[i].frame < frame) i++;
  const k0 = keys[i - 1];
  const k1 = keys[i];
  const t = (frame - k0.frame) / (k1.frame - k0.frame);
  return {
    x: k0.position.x + (k1.position.x - k0.position.x) * t,
    y: k0.position.y + (k1.position.y - k0.position.y) * t,
    z: k0.position.z + (k1.position.z - k0.position.z) * t,
  };
}

/**
 * Scenes for Property 27. One entity "subject" with: 0..2 followPath constraints (any influence,
 * alignToPath true, false or omitted), then ONE aimAt with influence 1 as the LAST constraint
 * (orders ascending in list order), so no later constraint drives position or rotation.
 * The aimAt position comes from the followPaths, or is the origin when there are none.
 * The single target "goal" is static or keyframed (1..3 keyframes). Targets are built from an angle
 * from vertical (see AimSpec), and the scene is rejected unless at EVERY frame the target is at
 * least 0.5 m from the entity position and at least 3.05 degrees from vertical. With followPaths
 * the targets are 15..60 m away so the movement rarely rejects a scene. No fc.double.
 */
export const arbAimAtScene: fc.Arbitrary<Scene> = fc
  .record({ fps: arbFps, frameCount: fc.integer({ min: 3, max: 30 }), closed: arbClosed })
  .chain((h) =>
    fc
      .record({
        points: arbPointList(h.closed),
        axes: arbValidAxisPair,
        followers: arrayOfLength(arbAimFollowBody, 0, 2),
        orders: fc.uniqueArray(arbOrder, { minLength: 3, maxLength: 3 }),
        keyed: fc.boolean(),
        keyFrames: fc.uniqueArray(fc.integer({ min: 0, max: h.frameCount + 3 }), { minLength: 3, maxLength: 3 }),
      })
      .chain((r) =>
        arrayOfLength(arbAimSpec(r.followers.length > 0 ? coord(15, 60) : coord(0.5, 50)), 1, 3).map(
          (specs): { scene: Scene; ok: boolean } => {
            const positions = followerPositions(r.points, h.closed, h.fps, h.frameCount, r.followers);
            const worldFor = (frame: number, spec: AimSpec): Vec3 => {
              const p = positions[Math.min(frame, h.frameCount - 1)];
              const d = aimDirectionOf(spec.theta, spec.azimuth);
              return { x: p.x + d.x * spec.distance, y: p.y + d.y * spec.distance, z: p.z + d.z * spec.distance };
            };
            let target: Target;
            if (!r.keyed) {
              target = worldFor(0, specs[0]);
            } else {
              const frames = r.keyFrames.slice(0, specs.length).sort((a, b) => a - b);
              target = { keyframes: frames.map((frame, i) => ({ frame, position: worldFor(frame, specs[i]) })) };
            }
            let ok = true;
            for (let f = 0; f < h.frameCount && ok; f++) {
              const t = aimTargetAt(target, f);
              const p = positions[f];
              const vx = t.x - p.x;
              const vy = t.y - p.y;
              const vz = t.z - p.z;
              const len = Math.hypot(vx, vy, vz);
              ok = len >= AIM_MIN_DISTANCE - 1e-9 && Math.abs(vy) < len * AIM_FILTER_COS;
            }
            const sorted = [...r.orders].slice(0, r.followers.length + 1).sort((a, b) => a - b);
            const constraints: Constraint[] = r.followers.map((b, i) => buildFollow(sorted[i], b));
            constraints.push(buildAim(sorted[r.followers.length], { influence: 1, target: 'goal' }));
            return {
              ok,
              scene: {
                fps: h.fps,
                frameCount: h.frameCount,
                path: { points: r.points, closed: h.closed },
                targets: { goal: target },
                entities: [{ id: 'subject', forwardAxis: r.axes[0], upAxis: r.axes[1], constraints }],
              },
            };
          },
        ),
      ),
  )
  .filter((x) => x.ok)
  .map((x) => x.scene);

// ---------------------------------------------------------------------------
// Property 30 variant: coincident aim
// ---------------------------------------------------------------------------

/** How the entity position at the aimAt is produced. */
export type CoincidentAimMode = 'aimOnly' | 'afterFollow';

export interface CoincidentAimParams {
  /** aimOnly: no followPath, the position is the origin. afterFollow: a followPath (speed 0, startOffset 0, alignToPath false) comes first. */
  mode: CoincidentAimMode;
  /** One flag per frame. True: the target equals the entity position exactly on that frame. */
  coincident: readonly boolean[];
  points: Vec3[];
  closed: boolean;
  axes: readonly [AxisToken, AxisToken];
  fps: number;
  /** One spec per frame, used on the non-coincident frames (theta 10..170 degrees, distance >= 5 m). */
  far: readonly AimSpec[];
}

export interface CoincidentAimCase {
  scene: Scene;
  mode: CoincidentAimMode;
  coincident: readonly boolean[];
  /** The entity position at the aimAt, on every frame: the origin, or table.pointAtDistance(0) exactly as bake computes it. */
  position: Vec3;
}

/**
 * Builds a scene for Property 30. One entity "subject": optionally one followPath (order 0, influence 1,
 * speed 0, startOffset 0, alignToPath false), then ONE aimAt (influence 1) as the LAST constraint, so no
 * later constraint drives position or rotation. The target "goal" has one keyframe per frame (every frame
 * is exactly on a keyframe): the entity position (copied exactly) on coincident frames, a far point
 * elsewhere.
 */
export function buildCoincidentAimCase(p: CoincidentAimParams): CoincidentAimCase {
  const frameCount = p.coincident.length;
  const position: Vec3 = { x: 0, y: 0, z: 0 };
  const constraints: Constraint[] = [];
  if (p.mode === 'afterFollow') {
    const table = createArcLengthTable(createCurve(p.points, p.closed));
    table.pointAtDistance(0, position);
    constraints.push(buildFollow(0, { influence: 1, speed: 0, startOffset: 0, align: false }));
    constraints.push(buildAim(1, { influence: 1, target: 'goal' }));
  } else {
    constraints.push(buildAim(0, { influence: 1, target: 'goal' }));
  }
  const keyframes: Keyframe[] = [];
  for (let f = 0; f < frameCount; f++) {
    if (p.coincident[f]) {
      keyframes.push({ frame: f, position: { x: position.x, y: position.y, z: position.z } });
    } else {
      const d = aimDirectionOf(p.far[f].theta, p.far[f].azimuth);
      const r = p.far[f].distance;
      keyframes.push({
        frame: f,
        position: { x: position.x + d.x * r, y: position.y + d.y * r, z: position.z + d.z * r },
      });
    }
  }
  const scene: Scene = {
    fps: p.fps,
    frameCount,
    path: { points: p.points, closed: p.closed },
    targets: { goal: { keyframes } },
    entities: [{ id: 'subject', forwardAxis: p.axes[0], upAxis: p.axes[1], constraints }],
  };
  return { scene, mode: p.mode, coincident: p.coincident, position };
}

const arbFarSpec: fc.Arbitrary<AimSpec> = fc.record({
  theta: fc.integer({ min: 100, max: 1700 }).map((tenths) => tenths / 10),
  azimuth: fc.integer({ min: 0, max: 359 }),
  distance: fc.integer({ min: 50, max: 500 }).map((tenths) => tenths / 10),
});

/**
 * Property 30 cases. frameCount 4..30, either mode, either path kind. The coincident pattern is random
 * (about 40% of frames), then one structure is forced per run: kind 0 coincident on frame 0, kind 1 a
 * run of 3 coincident frames right after a non-coincident frame, kind 2 a coincident frame right after
 * a non-coincident frame.
 */
export const arbCoincidentAimCase: fc.Arbitrary<CoincidentAimCase> = arbClosed.chain((closed) =>
  fc
    .record({
      mode: fc.constantFrom<CoincidentAimMode>('aimOnly', 'afterFollow'),
      frameCount: fc.integer({ min: 4, max: 30 }),
      kind: fc.integer({ min: 0, max: 2 }),
      pick: fc.integer({ min: 0, max: 1_000_000 }),
      bits: fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 30, maxLength: 30 }),
      points: arbPointList(closed),
      axes: arbValidAxisPair,
      fps: arbFps,
      far: fc.array(arbFarSpec, { minLength: 30, maxLength: 30 }),
    })
    .map((r): CoincidentAimCase => {
      const n = r.frameCount;
      const pattern: boolean[] = [];
      for (let f = 0; f < n; f++) pattern.push(r.bits[f] < 40);
      if (r.kind === 0) {
        pattern[0] = true;
      } else if (r.kind === 1) {
        const s = 1 + (r.pick % (n - 3));
        pattern[s - 1] = false;
        pattern[s] = true;
        pattern[s + 1] = true;
        pattern[s + 2] = true;
      } else {
        const k = 1 + (r.pick % (n - 1));
        pattern[k - 1] = false;
        pattern[k] = true;
      }
      return buildCoincidentAimCase({
        mode: r.mode,
        coincident: pattern,
        points: r.points,
        closed,
        axes: r.axes,
        fps: r.fps,
        far: r.far.slice(0, n),
      });
    }),
);

// ---------------------------------------------------------------------------
// Property 38 variant: path end on open paths
// ---------------------------------------------------------------------------

interface PathEndFollowDesc {
  influence: number;
  align: boolean | undefined;
  mode: number;
  k: number;
  speedPos: number;
  speedFree: number;
  factor: number;
}

const arbPathEndFollow: fc.Arbitrary<PathEndFollowDesc> = fc.record({
  influence: arbInfluence,
  align: fc.constantFrom<boolean | undefined>(undefined, true, false),
  mode: fc.integer({ min: 0, max: 4 }),
  k: fc.integer({ min: 0, max: 1000 }),
  speedPos: coord(0.5, 10),
  speedFree: coord(-10, 10),
  factor: fc.integer({ min: -1000, max: 990 }).map((i) => i / 1000),
});

/**
 * Speed and startOffset drawn from the real path length. Mode 0: the end is reached at frame h.
 * Mode 1: speed 0 and startOffset exactly the length (equality on frame 0). Mode 2: startOffset
 * beyond the length, any speed (reached on frame 0 or never again below it). Mode 3: free motion.
 * Mode 4: negative speed from below the length (never reached).
 */
function pathEndMotion(d: PathEndFollowDesc, length: number, frameCount: number, fps: number): [number, number] {
  const h = Math.min(frameCount - 1, Math.floor((d.k / 1001) * frameCount));
  if (d.mode === 0) return [d.speedPos, length - (d.speedPos * h) / fps];
  if (d.mode === 1) return [0, length];
  if (d.mode === 2) return [d.speedFree, length * (1 + Math.abs(d.factor))];
  if (d.mode === 3) return [d.speedFree, d.factor * length];
  return [-d.speedPos, d.factor * length];
}

/**
 * Scenes for Property 38. Open path only. 1..3 entities named "entity-<i>", each with 0..3 followPath
 * constraints and 0..2 aimAt constraints (influence 0, 1 or in between), distinct orders and a shuffled
 * list order (so the first followPath in constraint ORDER is often not the first in the list).
 * Targets: static "s0", keyframed "k1" and "c0" at the origin (coincident with an entity that has no
 * followPath or whose followPaths all have influence 0). Speed and
 * startOffset of every followPath are drawn from the real path length (see pathEndMotion), so the
 * end is reached at a chosen frame, on frame 0, with exact equality, or never. alignToPath may be true.
 */
export const arbPathEndScene: fc.Arbitrary<Scene> = fc
  .record({ fps: arbFps, frameCount: fc.integer({ min: 2, max: 60 }) })
  .chain((h) =>
    fc
      .record({
        points: arbPointList(false),
        staticPos: arbVec3,
        keyA: arbVec3,
        keyB: arbVec3,
        entities: arrayOfLength(
          fc.record({
            axes: arbValidAxisPair,
            follows: arrayOfLength(arbPathEndFollow, 0, 3),
            aims: arrayOfLength(arbAimBody(['s0', 'k1', 'c0']), 0, 2),
            orders: fc.uniqueArray(arbOrder, { minLength: 5, maxLength: 5 }),
            keys: fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 5, maxLength: 5 }),
          }),
          1,
          3,
        ),
      })
      .map((r): Scene => {
        const length = createArcLengthTable(createCurve(r.points, false)).length;
        const entities: Entity[] = r.entities.map((body, i) => {
          const items: { key: number; constraint: Constraint }[] = [];
          let n = 0;
          for (const d of body.follows) {
            const [speed, startOffset] = pathEndMotion(d, length, h.frameCount, h.fps);
            items.push({
              key: body.keys[n],
              constraint: buildFollow(body.orders[n], { influence: d.influence, speed, startOffset, align: d.align }),
            });
            n++;
          }
          for (const a of body.aims) {
            items.push({ key: body.keys[n], constraint: buildAim(body.orders[n], a) });
            n++;
          }
          items.sort((p, q) => p.key - q.key);
          return {
            id: `entity-${i}`,
            forwardAxis: body.axes[0],
            upAxis: body.axes[1],
            constraints: items.map((x) => x.constraint),
          };
        });
        return {
          fps: h.fps,
          frameCount: h.frameCount,
          path: { points: r.points, closed: false },
          targets: {
            s0: r.staticPos,
            k1: {
              keyframes: [
                { frame: 0, position: r.keyA },
                { frame: h.frameCount, position: r.keyB },
              ],
            },
            c0: { x: 0, y: 0, z: 0 },
          },
          entities,
        };
      }),
  );
