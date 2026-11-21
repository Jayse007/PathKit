import { describe, it, expect } from 'vitest';
import { bake } from '../../src/bake.js';
import type { BakedData } from '../../src/bake.js';
import { createCurve } from '../../src/curve.js';
import { createArcLengthTable } from '../../src/arclength.js';
import type { ArcLengthTable } from '../../src/arclength.js';
import { cross, dot, length, normalize, quatAngle, rotateVec, slerp } from '../../src/math.js';
import type { Quat, Vec3 } from '../../src/math.js';
import { axisVector, SceneError } from '../../src/scene.js';
import type { AimAtConstraint, AxisToken, Entity, FollowPathConstraint, Scene, Target } from '../../src/scene.js';
import { VALID_AXIS_PAIRS } from '../helpers/basic-generators.js';

// Unit tests for bake edge cases: alignToPath default, coincident aim on frame 0, near-vertical aim and its
// fallback, influence 0, zero speed, constraint order, rotationDrivers, overflow errors, createCurve errors.
// Each test comment says which kind of bug it would catch. Loops over frames or axis pairs use plain checks.

const FPS = 24;
const WORLD_UP: Vec3 = { x: 0, y: 1, z: 0 };
const IDENTITY: Quat = { x: 0, y: 0, z: 0, w: 1 };

const BASE: Scene = {
  fps: FPS,
  frameCount: 6,
  path: {
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 2, z: 4 },
      { x: 20, y: 0, z: 8 },
      { x: 30, y: -2, z: 4 },
    ],
    closed: false,
  },
  targets: {},
  entities: [],
};

function fresh(): Scene {
  return structuredClone(BASE);
}

function follow(order: number, speed: number, startOffset: number, influence = 1, alignToPath?: boolean): FollowPathConstraint {
  const c: FollowPathConstraint = { type: 'followPath', order, influence, speed, startOffset };
  if (alignToPath !== undefined) c.alignToPath = alignToPath;
  return c;
}

function aimAtC(order: number, target: string, influence = 1): AimAtConstraint {
  return { type: 'aimAt', order, influence, target };
}

function ent(id: string, constraints: Entity['constraints'], forwardAxis: AxisToken = '+Z', upAxis: AxisToken = '+Y'): Entity {
  return { id, forwardAxis, upAxis, constraints };
}

function sceneOf(entities: Entity[], targets: Record<string, Target> = {}, frameCount = 6): Scene {
  const s = fresh();
  s.entities = entities;
  s.targets = targets;
  s.frameCount = frameCount;
  return s;
}

/** Table built straight from the scene path, independent of bake. */
function tableOf(scene: Scene): ArcLengthTable {
  return createArcLengthTable(createCurve(scene.path.points, scene.path.closed));
}

function tangentAtDistance(scene: Scene, d: number): Vec3 {
  const curve = createCurve(scene.path.points, scene.path.closed);
  const table = createArcLengthTable(curve);
  return curve.tangentAt(table.parameterAtDistance(d));
}

function pointAt(table: ArcLengthTable, d: number): Vec3 {
  return table.pointAtDistance(d, { x: 0, y: 0, z: 0 });
}

function fail(message: string): never {
  throw new Error(message);
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function quatAt(baked: BakedData, e: number, f: number): Quat {
  const t = baked.transforms[e];
  const i = f * 7;
  return { x: t[i + 3], y: t[i + 4], z: t[i + 5], w: t[i + 6] };
}

function posAt(baked: BakedData, e: number, f: number): Vec3 {
  const t = baked.transforms[e];
  const i = f * 7;
  return { x: t[i], y: t[i + 1], z: t[i + 2] };
}

function aimDirAt(baked: BakedData, e: number, f: number): Vec3 {
  const a = baked.aimDirections[e];
  return { x: a[f * 3], y: a[f * 3 + 1], z: a[f * 3 + 2] };
}

function rotated(q: Quat, token: AxisToken): Vec3 {
  return rotateVec(q, axisVector(token, { x: 0, y: 0, z: 0 }));
}

function perpendicularPart(v: Vec3, dir: Vec3): Vec3 {
  const along = dot(v, dir);
  return { x: v.x - along * dir.x, y: v.y - along * dir.y, z: v.z - along * dir.z };
}

/** Unit vector at `degrees` from straight up on a given azimuth (degrees), scaled by `distance`. */
function aimTarget(degrees: number, azimuth: number, distance: number): Vec3 {
  const t = (degrees * Math.PI) / 180;
  const z = (azimuth * Math.PI) / 180;
  return {
    x: distance * Math.sin(t) * Math.cos(z),
    y: distance * Math.cos(t),
    z: distance * Math.sin(t) * Math.sin(z),
  };
}

function checkNear(label: string, actual: Vec3, expected: Vec3, tol: number): void {
  const d = dist(actual, expected);
  if (!(d <= tol)) {
    fail(`${label}: (${actual.x}, ${actual.y}, ${actual.z}) is ${d} from (${expected.x}, ${expected.y}, ${expected.z}), tolerance ${tol}`);
  }
}

function checkIdentity(label: string, q: Quat, tol: number): void {
  if (!(Math.abs(q.x) <= tol && Math.abs(q.y) <= tol && Math.abs(q.z) <= tol && Math.abs(q.w - 1) <= tol)) {
    fail(`${label}: rotation (${q.x}, ${q.y}, ${q.z}, ${q.w}) is not the identity`);
  }
}

/** Forward along `aim`, up unit and perpendicular to forward, and a proper (non-mirrored) basis. */
function checkBasis(label: string, q: Quat, forwardAxis: AxisToken, upAxis: AxisToken, aim: Vec3): void {
  const f = axisVector(forwardAxis, { x: 0, y: 0, z: 0 });
  const u = axisVector(upAxis, { x: 0, y: 0, z: 0 });
  const rf = rotateVec(q, f);
  const ru = rotateVec(q, u);
  const rr = rotateVec(q, cross(f, u));
  const forwardError = dist(rf, aim);
  if (!(forwardError <= 1e-4)) fail(`${label}: rotated forward is ${forwardError} from the aim`);
  if (!(Math.abs(length(ru) - 1) <= 1e-6)) fail(`${label}: rotated up has length ${length(ru)}`);
  if (!(Math.abs(dot(ru, rf)) <= 1e-6)) fail(`${label}: rotated up . rotated forward = ${dot(ru, rf)}`);
  const properError = dist(cross(rf, ru), rr);
  if (!(properError <= 1e-6)) fail(`${label}: basis is mirrored or skewed, error ${properError}`);
}

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

/** Asserts a SceneError with the exact message (rule 6: SceneError instance, plus instanceof). */
function expectSceneError(scene: Scene, message: string): void {
  expect(() => bake(scene)).toThrow(new SceneError(message));
  const error = thrown(() => bake(scene));
  expect(error instanceof SceneError).toBe(true);
  expect((error as Error).message).toBe(message);
}

/** Asserts a plain Error (not a SceneError) with the exact message. */
function expectPlainError(scene: Scene, message: string): void {
  const error = thrown(() => bake(scene));
  expect(error instanceof Error).toBe(true);
  expect(error instanceof SceneError).toBe(false);
  expect((error as Error).message).toBe(message);
}

// ---------------------------------------------------------------------------

describe('alignToPath default (Requirement 5.8, 6.3)', () => {
  // Catches: a default of true, or a missing property treated differently from false.
  it('omitted and false leave the rotation at the identity, true rotates the entity along the path', () => {
    const omitted = bake(sceneOf([ent('e', [follow(0, 3, 0)])]));
    const explicitFalse = bake(sceneOf([ent('e', [follow(0, 3, 0, 1, false)])]));
    const aligned = bake(sceneOf([ent('e', [follow(0, 3, 0, 1, true)])]));
    const scene = sceneOf([]);
    for (let f = 0; f < 6; f++) {
      const qa = quatAt(omitted, 0, f);
      const qb = quatAt(explicitFalse, 0, f);
      if (qa.x !== 0 || qa.y !== 0 || qa.z !== 0 || qa.w !== 1) fail(`omitted: frame ${f} rotation is not the exact identity`);
      if (qb.x !== 0 || qb.y !== 0 || qb.z !== 0 || qb.w !== 1) fail(`false: frame ${f} rotation is not the exact identity`);
      // true: forward follows the independently computed tangent, and position is unchanged by alignment.
      const qt = quatAt(aligned, 0, f);
      checkBasis(`true: frame ${f}`, qt, '+Z', '+Y', tangentAtDistance(scene, (3 * f) / FPS));
      checkNear(`true: frame ${f} position`, posAt(aligned, 0, f), posAt(omitted, 0, f), 1e-12);
    }
    expect(quatAngle(quatAt(aligned, 0, 0), IDENTITY)).toBeGreaterThan(0.1);
  });
});

describe('coincident aim on frame 0 (Requirement 6.9)', () => {
  // Catches: frame 0 using something other than the identity when the aim is coincident, and a non-zero aim direction.
  it('a target at the entity position gives the identity rotation and a zero aim direction on every frame', () => {
    const baked = bake(sceneOf([ent('e', [aimAtC(0, 'T')])], { T: { x: 0, y: 0, z: 0 } }));
    for (let f = 0; f < 6; f++) {
      const q = quatAt(baked, 0, f);
      if (q.x !== 0 || q.y !== 0 || q.z !== 0 || q.w !== 1) fail(`frame ${f}: rotation (${q.x}, ${q.y}, ${q.z}, ${q.w}) is not the exact identity`);
      const a = aimDirAt(baked, 0, f);
      if (a.x !== 0 || a.y !== 0 || a.z !== 0) fail(`frame ${f}: aim direction (${a.x}, ${a.y}, ${a.z}) is not zero`);
    }
  });

  // Catches: the position used for the coincidence test being the origin instead of the position from earlier constraints,
  // and frame 0 not resetting to the identity.
  it('a target at the followPath position on frame 0 is coincident there, and aims normally on frame 1', () => {
    const scene = sceneOf([ent('e', [follow(0, 5, 2), aimAtC(1, 'T')])]);
    const start = pointAt(tableOf(scene), 2);
    scene.targets = { T: start };
    const baked = bake(scene);
    const a0 = aimDirAt(baked, 0, 0);
    if (a0.x !== 0 || a0.y !== 0 || a0.z !== 0) fail(`frame 0: aim direction (${a0.x}, ${a0.y}, ${a0.z}) is not zero`);
    checkIdentity('frame 0', quatAt(baked, 0, 0), 0);
    const next = pointAt(tableOf(scene), 2 + 5 / FPS);
    const expected = normalize({ x: start.x - next.x, y: start.y - next.y, z: start.z - next.z });
    checkNear('frame 1 aim direction', aimDirAt(baked, 0, 1), expected, 1e-9);
    expect(quatAngle(quatAt(baked, 0, 1), IDENTITY)).toBeGreaterThan(0.01);
  });
});

describe('near-vertical aim (Requirement 7.4, 7.5)', () => {
  // Catches: using world up instead of the previous baked up on frame > 0, a wrong projection, or a mirrored basis.
  it('frame 1 within 3 degrees of vertical uses the previous baked up projected perpendicular to the aim (24 axis pairs, up and down)', () => {
    for (const [forwardAxis, upAxis] of VALID_AXIS_PAIRS) {
      for (const sign of [1, -1]) {
        const label = `${forwardAxis}/${upAxis} ${sign > 0 ? 'up' : 'down'}`;
        const t0: Vec3 = { x: 0, y: 0.3, z: 10 };
        const t1: Vec3 = { x: 5, y: 200 * sign, z: 0 };
        const scene = sceneOf(
          [ent('e', [aimAtC(0, 'G')], forwardAxis, upAxis)],
          { G: { keyframes: [{ frame: 0, position: t0 }, { frame: 1, position: t1 }] } },
          2,
        );
        const baked = bake(scene);
        const aim1 = normalize(t1);
        const prevUp = rotated(quatAt(baked, 0, 0), upAxis);
        const expected = normalize(perpendicularPart(prevUp, aim1));
        const worldChoice = normalize(perpendicularPart(WORLD_UP, aim1));
        if (!(dist(expected, worldChoice) > 0.3)) fail(`${label}: test bug, previous up and world up give nearly the same reference`);
        const up1 = rotated(quatAt(baked, 0, 1), upAxis);
        checkNear(`${label}: frame 1 up`, up1, expected, 1e-4);
        checkBasis(`${label}: frame 1`, quatAt(baked, 0, 1), forwardAxis, upAxis, aim1);
      }
    }
  });

  // Catches: a missing fallback when the projected previous up is shorter than 1e-9 (a zero or NaN up gives a bad basis).
  // The choice of perpendicular is not asserted.
  it('previous up parallel to the new aim: forward equals the aim and the basis is orthonormal and proper (24 axis pairs, up and down)', () => {
    for (const [forwardAxis, upAxis] of VALID_AXIS_PAIRS) {
      for (const sign of [1, -1]) {
        const label = `${forwardAxis}/${upAxis} ${sign > 0 ? 'up' : 'down'}`;
        const t0: Vec3 = { x: 10, y: 0, z: 0 }; // exactly horizontal: baked up of frame 0 is world up
        const t1: Vec3 = { x: 0, y: 10 * sign, z: 0 }; // exactly vertical: parallel to that up
        const scene = sceneOf(
          [ent('e', [aimAtC(0, 'G')], forwardAxis, upAxis)],
          { G: { keyframes: [{ frame: 0, position: t0 }, { frame: 1, position: t1 }] } },
          2,
        );
        const baked = bake(scene);
        checkBasis(`${label}: frame 0`, quatAt(baked, 0, 0), forwardAxis, upAxis, { x: 1, y: 0, z: 0 });
        checkBasis(`${label}: frame 1`, quatAt(baked, 0, 1), forwardAxis, upAxis, { x: 0, y: sign, z: 0 });
      }
    }
  });

  // Catches: applying the previous-up rule on frame 0 (where there is no previous up), or a threshold off by a frame.
  it('frame 0 near vertical (0.5, 2, 2.9 degrees, up and down) uses world up projected perpendicular to the aim (24 axis pairs)', () => {
    for (const [forwardAxis, upAxis] of VALID_AXIS_PAIRS) {
      for (const azimuth of [0, 137]) {
        for (const degrees of [0.5, 2, 2.9]) {
          for (const sign of [1, -1]) {
            const label = `${forwardAxis}/${upAxis} az ${azimuth} ${sign > 0 ? 'up' : 'down'} ${degrees}`;
            const target = aimTarget(sign > 0 ? degrees : 180 - degrees, azimuth, 20);
            const baked = bake(sceneOf([ent('e', [aimAtC(0, 'G')], forwardAxis, upAxis)], { G: target }, 1));
            const aim = normalize(target);
            const q = quatAt(baked, 0, 0);
            checkNear(`${label}: up`, rotated(q, upAxis), normalize(perpendicularPart(WORLD_UP, aim)), 1e-4);
            checkBasis(label, q, forwardAxis, upAxis, aim);
          }
        }
      }
    }
  });

  // Catches: treating a very short but non-zero vector as coincident (threshold far above 1e-12).
  it('a target 1e-6 away is not coincident: unit aim direction and forward axis point at it (24 axis pairs)', () => {
    const target: Vec3 = { x: 1e-6, y: 0, z: 0 };
    for (const [forwardAxis, upAxis] of VALID_AXIS_PAIRS) {
      const label = `${forwardAxis}/${upAxis}`;
      const baked = bake(sceneOf([ent('e', [aimAtC(0, 'G')], forwardAxis, upAxis)], { G: target }, 2));
      for (let f = 0; f < 2; f++) {
        checkNear(`${label}: frame ${f} aim direction`, aimDirAt(baked, 0, f), { x: 1, y: 0, z: 0 }, 1e-9);
        checkNear(`${label}: frame ${f} forward`, rotated(quatAt(baked, 0, f), forwardAxis), { x: 1, y: 0, z: 0 }, 1e-4);
      }
    }
  });
});

describe('influence 0 and the Rest_Pose (Requirement 6.7, 7.7)', () => {
  // Catches: influence 0 still moving or rotating the entity, with and without alignToPath.
  it('followPath with influence 0 (alignToPath true and false) keeps the origin and identity rotation', () => {
    for (const align of [true, false]) {
      const baked = bake(sceneOf([ent('e', [follow(0, 3, 1, 0, align)])]));
      for (let f = 0; f < 6; f++) {
        checkNear(`align ${align}: frame ${f} position`, posAt(baked, 0, f), { x: 0, y: 0, z: 0 }, 1e-12);
        checkIdentity(`align ${align}: frame ${f}`, quatAt(baked, 0, f), 1e-12);
      }
      // The constraint still ran: travelled is recorded.
      expect(baked.travelled[0][1]).toBeCloseTo(1 + 3 / FPS, 12);
    }
  });

  // Catches: aimAt with influence 0 rotating the entity, or skipping the aim direction record.
  it('aimAt with influence 0 keeps the identity rotation but still records the aim direction', () => {
    const baked = bake(sceneOf([ent('e', [aimAtC(0, 'G', 0)])], { G: { x: 10, y: 0, z: 0 } }));
    for (let f = 0; f < 6; f++) {
      checkIdentity(`frame ${f}`, quatAt(baked, 0, f), 1e-12);
      checkNear(`frame ${f} aim direction`, aimDirAt(baked, 0, f), { x: 1, y: 0, z: 0 }, 1e-9);
    }
  });

  // Catches: an influence-0 constraint overwriting the stack result of earlier constraints (position or rotation).
  it('an influence-0 followPath after an aimAt, and an influence-0 aimAt after a followPath, leave the earlier result unchanged', () => {
    const target: Vec3 = { x: 10, y: 0, z: 0 };
    const aimOnly = bake(sceneOf([ent('e', [aimAtC(0, 'G')])], { G: target }));
    const aimThenFollow = bake(sceneOf([ent('e', [aimAtC(0, 'G'), follow(1, 3, 1, 0, true)])], { G: target }));
    const scene = sceneOf([ent('e', [follow(0, 3, 1), aimAtC(1, 'G', 0)])], { G: target });
    const followThenAim = bake(scene);
    const table = tableOf(scene);
    for (let f = 0; f < 6; f++) {
      checkNear(`aim then follow: frame ${f} position`, posAt(aimThenFollow, 0, f), { x: 0, y: 0, z: 0 }, 1e-12);
      const a = quatAt(aimOnly, 0, f);
      const b = quatAt(aimThenFollow, 0, f);
      if (!(quatAngle(a, b) <= 1e-9)) fail(`aim then follow: frame ${f} rotation changed by an influence-0 followPath`);
      checkNear(`follow then aim: frame ${f} position`, posAt(followThenAim, 0, f), pointAt(table, 1 + (3 * f) / FPS), 1e-9);
      checkIdentity(`follow then aim: frame ${f}`, quatAt(followThenAim, 0, f), 1e-12);
    }
  });

  // Catches: the stack starting from the previous frame's result (values would accumulate with influence below 1).
  it('influence 0.5 gives the same blend on every frame: nothing carries over from the previous frame', () => {
    const target: Vec3 = { x: 10, y: 0, z: 0 };
    const full = bake(sceneOf([ent('e', [aimAtC(0, 'G')])], { G: target }));
    const half = bake(sceneOf([ent('e', [aimAtC(0, 'G', 0.5)])], { G: target }));
    const expectedQ = slerp(IDENTITY, quatAt(full, 0, 0), 0.5);
    const scene = sceneOf([ent('p', [follow(0, 3, 1, 0.5)])]);
    const halfFollow = bake(scene);
    const table = tableOf(scene);
    for (let f = 0; f < 6; f++) {
      const q = quatAt(half, 0, f);
      if (!(quatAngle(q, expectedQ) <= 1e-9)) fail(`frame ${f}: half-influence rotation is ${quatAngle(q, expectedQ)} rad from slerp(identity, full, 0.5)`);
      const p = pointAt(table, 1 + (3 * f) / FPS);
      checkNear(`frame ${f} position`, posAt(halfFollow, 0, f), { x: p.x * 0.5, y: p.y * 0.5, z: p.z * 0.5 }, 1e-9);
    }
    expect(quatAngle(expectedQ, IDENTITY)).toBeGreaterThan(0.5);
  });
});

describe('zero speed', () => {
  // Catches: speed 0 moving the entity, wrong travelled values, or a held flag on a path not yet reached.
  it('speed 0 keeps position, rotation and travelled constant, and is not held', () => {
    const scene = sceneOf([ent('e', [follow(0, 0, 3, 1, true)])]);
    const baked = bake(scene);
    const p = pointAt(tableOf(scene), 3);
    const q0 = quatAt(baked, 0, 0);
    expect(quatAngle(q0, IDENTITY)).toBeGreaterThan(0.1);
    for (let f = 0; f < 6; f++) {
      checkNear(`frame ${f} position`, posAt(baked, 0, f), p, 1e-12);
      const q = quatAt(baked, 0, f);
      if (q.x !== q0.x || q.y !== q0.y || q.z !== q0.z || q.w !== q0.w) fail(`frame ${f}: rotation differs from frame 0`);
      if (baked.travelled[0][f] !== 3) fail(`frame ${f}: travelled ${baked.travelled[0][f]}, expected 3`);
    }
    expect(baked.heldFromFrame[0]).toBe(-1);
  });

  // Catches: the held test using > instead of >= (reaching the end exactly counts as held).
  it('speed 0 with startOffset equal to the path length is held from frame 0', () => {
    const scene = sceneOf([ent('e', [follow(0, 0, 0)])]);
    const pathLength = tableOf(scene).length;
    scene.entities[0].constraints = [follow(0, 0, pathLength)];
    const baked = bake(scene);
    expect(baked.heldFromFrame[0]).toBe(0);
    for (let f = 0; f < 6; f++) {
      if (baked.travelled[0][f] !== pathLength) fail(`frame ${f}: travelled ${baked.travelled[0][f]}, expected ${pathLength}`);
    }
  });
});

describe('constraint order (Requirement 5.10)', () => {
  // Catches: using list order instead of the order value, or the first aimAt instead of the last in sorted order.
  it('two aimAt listed against their order values: aimDirections comes from the highest order value', () => {
    const targets: Record<string, Target> = { A: { x: 10, y: 0, z: 0 }, B: { x: 0, y: 0, z: 10 } };
    const reversed = bake(sceneOf([ent('e', [aimAtC(5, 'B'), aimAtC(1, 'A')])], targets));
    const inOrder = bake(sceneOf([ent('e', [aimAtC(1, 'A'), aimAtC(5, 'B')])], targets));
    for (let f = 0; f < 6; f++) {
      checkNear(`reversed list: frame ${f} aim direction`, aimDirAt(reversed, 0, f), { x: 0, y: 0, z: 1 }, 1e-9);
      checkNear(`sorted list: frame ${f} aim direction`, aimDirAt(inOrder, 0, f), { x: 0, y: 0, z: 1 }, 1e-9);
      checkNear(`reversed list: frame ${f} forward`, rotated(quatAt(reversed, 0, f), '+Z'), { x: 0, y: 0, z: 1 }, 1e-4);
    }
    expect(reversed.rotationDrivers[0]).toBe(2);
  });

  // Catches: travelled and heldFromFrame taken from the first followPath in list order instead of the lowest order value.
  it('two followPath listed against their order values: travelled and heldFromFrame come from the lowest order value', () => {
    const scene = sceneOf([ent('e', [follow(2, 0, 0), follow(1, 0, 0)])], {}, 30);
    const L = tableOf(scene).length;
    const slow = (L * FPS) / 20;
    const fast = (L * FPS) / 8;
    scene.entities[0].constraints = [follow(2, fast, 0), follow(1, slow, 0)];
    const heldFor = (speed: number): number => {
      for (let f = 0; f < 30; f++) {
        if ((speed * f) / FPS >= L) return f;
      }
      return -1;
    };
    const expectedHeld = heldFor(slow);
    if (!(expectedHeld > 0 && heldFor(fast) > 0 && expectedHeld !== heldFor(fast))) fail('test bug: the two speeds must be held at different frames');
    const baked = bake(scene);
    expect(baked.heldFromFrame[0]).toBe(expectedHeld);
    for (let f = 0; f < 30; f++) {
      const expected = (slow * f) / FPS;
      if (!(Math.abs(baked.travelled[0][f] - expected) <= 1e-9)) fail(`frame ${f}: travelled ${baked.travelled[0][f]}, expected ${expected}`);
    }
  });

  // Catches: an aimAt placed before a followPath using the path position, and one placed after it using the origin.
  it('aimAt before followPath aims from the origin while the position is on the path; after it, aims from the path point', () => {
    const T: Vec3 = { x: 3, y: 4, z: 12 };
    const before = sceneOf([ent('e', [aimAtC(0, 'G'), follow(1, 2, 1)])], { G: T }, 5);
    const after = sceneOf([ent('e', [follow(0, 2, 1), aimAtC(1, 'G')])], { G: T }, 5);
    const table = tableOf(before);
    const bakedBefore = bake(before);
    const bakedAfter = bake(after);
    const fromOrigin = normalize(T);
    for (let f = 0; f < 5; f++) {
      const p = pointAt(table, 1 + (2 * f) / FPS);
      checkNear(`before: frame ${f} position`, posAt(bakedBefore, 0, f), p, 1e-6);
      checkNear(`before: frame ${f} aim direction`, aimDirAt(bakedBefore, 0, f), fromOrigin, 1e-9);
      const fromPoint = normalize({ x: T.x - p.x, y: T.y - p.y, z: T.z - p.z });
      if (!(dist(fromPoint, fromOrigin) > 0.01)) fail(`frame ${f}: test bug, the two aim origins give nearly the same direction`);
      checkNear(`after: frame ${f} aim direction`, aimDirAt(bakedAfter, 0, f), fromPoint, 1e-9);
    }
  });
});

describe('rotationDrivers (Requirement 6.2, 6.4)', () => {
  // Catches: counting by influence, counting followPath without alignToPath, or missing aimAt / aligned followPath.
  it('counts aimAt and followPath with alignToPath true regardless of influence, not alignToPath false or omitted', () => {
    const entities = [
      ent('aim0', [aimAtC(0, 'G', 0)]),
      ent('align0', [follow(0, 1, 0, 0, true)]),
      ent('alignFalse', [follow(0, 1, 0, 1, false)]),
      ent('alignOmitted', [follow(0, 1, 0, 1)]),
      ent('mixed', [aimAtC(0, 'G', 0), follow(1, 1, 0, 0, true), follow(2, 1, 0, 1, false), follow(3, 1, 0, 1)]),
      ent('none', []),
    ];
    const baked = bake(sceneOf(entities, { G: { x: 1, y: 2, z: 3 } }));
    const count = (id: string): number => baked.rotationDrivers[baked.entityIndex.get(id) as number];
    expect(count('aim0')).toBe(1);
    expect(count('align0')).toBe(1);
    expect(count('alignFalse')).toBe(0);
    expect(count('alignOmitted')).toBe(0);
    expect(count('mixed')).toBe(2);
    expect(count('none')).toBe(0);
  });
});

describe('entities without the constraint (Requirement 7.1)', () => {
  // Catches: travelled, heldFromFrame or aimDirections being filled when the entity has no followPath or no aimAt.
  it('no followPath: travelled all zero and heldFromFrame -1; no aimAt: aimDirections all zero', () => {
    const baked = bake(sceneOf([
      ent('aimer', [aimAtC(0, 'G')]),
      ent('walker', [follow(0, 1000, 0)]),
      ent('idle', []),
    ], { G: { x: 4, y: 5, z: 6 } }));
    const aimer = baked.entityIndex.get('aimer') as number;
    const walker = baked.entityIndex.get('walker') as number;
    const idle = baked.entityIndex.get('idle') as number;
    for (const e of [aimer, idle]) {
      if (baked.travelled[e].length !== 6) fail(`entity ${e}: travelled length ${baked.travelled[e].length}`);
      for (let f = 0; f < 6; f++) {
        if (baked.travelled[e][f] !== 0) fail(`entity ${e}: travelled[${f}] = ${baked.travelled[e][f]}`);
      }
      expect(baked.heldFromFrame[e]).toBe(-1);
    }
    for (const e of [walker, idle]) {
      if (baked.aimDirections[e].length !== 18) fail(`entity ${e}: aimDirections length ${baked.aimDirections[e].length}`);
      for (let k = 0; k < 18; k++) {
        if (baked.aimDirections[e][k] !== 0) fail(`entity ${e}: aimDirections[${k}] = ${baked.aimDirections[e][k]}`);
      }
    }
    // Controls: the entities that do have the constraint show non-zero values.
    expect(baked.aimDirections[aimer][0] !== 0 || baked.aimDirections[aimer][1] !== 0).toBe(true);
    expect(baked.travelled[walker][1]).toBeGreaterThan(0);
    expect(baked.heldFromFrame[walker]).toBeGreaterThanOrEqual(0);
  });
});

describe('errors', () => {
  // Overflow: with fps 24 and speed 1e308, travelled = (1e308 * frame) / 24.
  // Frame 0: 0. Frame 1: 1e308 / 24, finite. Frame 2: 1e308 * 2 overflows to Infinity, so frame 2 is the first
  // non-finite frame in ascending order and the error names frame 2. Speed -1e308 gives -Infinity at frame 2.
  // Catches: a missing finite check (NaN or Infinity positions), a wrong frame number or value in the message.
  it('a speed that overflows throws a SceneError naming frame 2 and Infinity', () => {
    const scene = sceneOf([ent('rover', [follow(0, 1e308, 0)])], {}, 5);
    expectSceneError(scene, 'Entity "rover": travelled distance at frame 2 must be a finite number, got Infinity');
  });

  it('a speed of -1e308 throws a SceneError naming frame 2 and -Infinity', () => {
    const scene = sceneOf([ent('rover', [follow(0, -1e308, 0)])], {}, 5);
    expectSceneError(scene, 'Entity "rover": travelled distance at frame 2 must be a finite number, got -Infinity');
  });

  // Catches: wrapping or replacing createCurve errors with a SceneError, or changing their text.
  it('createCurve errors propagate unchanged and are not SceneErrors', () => {
    const one = sceneOf([]);
    one.path.points = [{ x: 0, y: 0, z: 0 }];
    expectPlainError(one, 'Curve needs at least 2 points, got 1');

    const coincident = sceneOf([ent('e', [follow(0, 1, 0)])]);
    coincident.path.points = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ];
    expectPlainError(coincident, 'Coincident points at indexes 1 and 2');

    const closedTwo = sceneOf([]);
    closedTwo.path = { points: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }], closed: true };
    expectPlainError(closedTwo, 'Closed curve needs at least 3 points, got 2');
  });

  // bake builds the curve even when no entity has a followPath: the first test above uses a scene with no entities
  // and a 1-point path, and it still throws the createCurve message.
  // Catches: validateScene running after createCurve (or not at all), so a path error hides a scene error.
  it('when the scene is invalid and the path is bad, the validateScene error wins', () => {
    const scene = sceneOf([]);
    scene.fps = 0;
    scene.path.points = [{ x: 0, y: 0, z: 0 }];
    expectSceneError(scene, 'fps must be a positive integer, got 0');
  });
});
