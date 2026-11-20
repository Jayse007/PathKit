import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import { lerp, rotateVec, slerp } from '../../src/math.js';
import type { Quat, Vec3 } from '../../src/math.js';
import { axisVector } from '../../src/scene.js';
import type { AxisToken, Constraint, FollowPathConstraint, Scene, Target } from '../../src/scene.js';
import { VALID_AXIS_PAIRS, arbClosed, arbValidAxisPair, coord } from '../helpers/basic-generators.js';

// Feature: path-core, Property 28: Influence blends linearly
// **Validates: Requirements 6.6, 6.7**

const TOLERANCE = 1e-9;

// Bounds that keep every aim far from vertical, so the history rule for near-vertical aims never applies:
//  - Path points lie within about 20 m of the origin: start in [-2, 2]^3 (at most 3.5 m from the origin),
//    at most 6 steps of at most 2.5 m. Every entity position is a blend of the origin and path points.
//  - Targets are static at (R cos a, h, R sin a) with R in [60, 100] and |h| <= 20.
//  - So from any entity position the horizontal part of the aim is at least 40 m and |y| is at most 40 m:
//    the aim is at least 45 degrees from vertical (the 10 degree requirement) and at least 40 m long (> 0.5 m).

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const arbInfluence = fc.oneof(
  fc.constant(0),
  fc.constant(1),
  fc.integer({ min: 1, max: 999 }).map((i) => i / 1000),
);
const arbMidInfluence = fc.integer({ min: 50, max: 950 }).map((i) => i / 1000);

interface FollowBody {
  influence: number;
  speed: number;
  startOffset: number;
  align: boolean | undefined; // undefined means omitted
}

type EarlierSpec =
  | { kind: 'follow'; body: FollowBody }
  | { kind: 'aim'; target: 't0' | 't1'; influence: number };

const arbBody = (align: fc.Arbitrary<boolean | undefined>): fc.Arbitrary<FollowBody> =>
  fc.record({
    influence: arbInfluence,
    speed: coord(-5, 5),
    startOffset: coord(-5, 25),
    align,
  });

const arbAnyAlign = fc.constantFrom<boolean | undefined>(undefined, false, true);
const arbNoAlign = fc.constantFrom<boolean | undefined>(undefined, false);

const arbEarlier: fc.Arbitrary<EarlierSpec> = fc.oneof(
  arbBody(arbAnyAlign).map((body): EarlierSpec => ({ kind: 'follow', body })),
  fc
    .record({ target: fc.constantFrom<'t0' | 't1'>('t0', 't1'), influence: arbInfluence })
    .map((r): EarlierSpec => ({ kind: 'aim', target: r.target, influence: r.influence })),
);

/** 0, 1 or 2 earlier constraints, length uniform. */
const arbEarlierList: fc.Arbitrary<EarlierSpec[]> = fc
  .integer({ min: 0, max: 2 })
  .chain((n) => fc.array(arbEarlier, { minLength: n, maxLength: n }));

const arbUnitDirection: fc.Arbitrary<Vec3> = fc
  .record({ x: coord(-1, 1), y: coord(-1, 1), z: coord(-1, 1) })
  .filter((v) => Math.hypot(v.x, v.y, v.z) >= 0.1)
  .map((v) => {
    const n = Math.hypot(v.x, v.y, v.z);
    return { x: v.x / n, y: v.y / n, z: v.z / n };
  });

/** Path with 2..7 points (3..7 when closed), within about 20 m of the origin, consecutive points >= 0.5 m apart. */
function arbPath(closed: boolean): fc.Arbitrary<Vec3[]> {
  return fc
    .tuple(
      fc.record({ x: coord(-2, 2), y: coord(-2, 2), z: coord(-2, 2) }),
      fc.array(fc.record({ dir: arbUnitDirection, step: coord(0.5, 2.5) }), {
        minLength: closed ? 2 : 1,
        maxLength: 6,
      }),
    )
    .map(([start, steps]) => {
      const pts: Vec3[] = [start];
      for (const { dir, step } of steps) {
        const p = pts[pts.length - 1];
        pts.push({ x: p.x + dir.x * step, y: p.y + dir.y * step, z: p.z + dir.z * step });
      }
      return pts;
    })
    .filter((pts) => {
      if (!closed) return true;
      const a = pts[0];
      const b = pts[pts.length - 1];
      return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) >= 0.1;
    });
}

/** Static target far from the origin and mostly horizontal. */
const arbFarTarget: fc.Arbitrary<Vec3> = fc
  .record({ r: coord(60, 100), a: fc.integer({ min: 0, max: 359 }), h: coord(-20, 20) })
  .map(({ r, a, h }) => {
    const rad = (a * Math.PI) / 180;
    return { x: r * Math.cos(rad), y: h, z: r * Math.sin(rad) };
  });

interface Base {
  fps: number;
  frameCount: number;
  closed: boolean;
  points: Vec3[];
  targets: Record<string, Target>;
  axes: readonly [AxisToken, AxisToken];
}

const arbBase: fc.Arbitrary<Base> = fc
  .record({
    fps: fc.constantFrom(24, 30, 60),
    frameCount: fc.integer({ min: 2, max: 20 }),
    closed: arbClosed,
  })
  .chain((h) =>
    fc
      .record({ points: arbPath(h.closed), t0: arbFarTarget, t1: arbFarTarget, axes: arbValidAxisPair })
      .map((r): Base => ({
        fps: h.fps,
        frameCount: h.frameCount,
        closed: h.closed,
        points: r.points,
        targets: { t0: r.t0, t1: r.t1 },
        axes: r.axes,
      })),
  );

function followOf(order: number, b: FollowBody): FollowPathConstraint {
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

function earlierOf(order: number, e: EarlierSpec): Constraint {
  if (e.kind === 'follow') return followOf(order, e.body);
  return { type: 'aimAt', order, influence: e.influence, target: e.target };
}

function sceneOf(base: Base, constraints: Constraint[]): Scene {
  return {
    fps: base.fps,
    frameCount: base.frameCount,
    path: { points: base.points, closed: base.closed },
    targets: base.targets,
    entities: [{ id: 'subject', forwardAxis: base.axes[0], upAxis: base.axes[1], constraints }],
  };
}

/** Earlier constraints in orders 0..n-1, then the constraint under test with order n (last). */
function underTestScene(base: Base, earlier: EarlierSpec[], last: Constraint): Scene {
  const constraints: Constraint[] = earlier.map((e, i) => earlierOf(i, e));
  constraints.push({ ...last, order: earlier.length });
  return sceneOf(base, constraints);
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function near(label: string, frame: number, what: string, actual: number, expected: number): void {
  if (!(Math.abs(actual - expected) <= TOLERANCE)) {
    throw new Error(`${label}: frame ${frame}: ${what} is ${actual}, expected ${expected} (difference ${Math.abs(actual - expected)})`);
  }
}

/**
 * The scene's entity has the constraint under test as its last constraint. Compares the bake of the scene
 * with lerp/slerp from the bake without that constraint to the bake with it at influence 1, by its influence.
 * Throws on the first miss.
 */
function checkBlend(label: string, scene: Scene): void {
  const entity = scene.entities[0];
  const list = entity.constraints;
  const last = list[list.length - 1];
  const w = last.influence;
  const withEntity = (constraints: Constraint[]): Scene => ({ ...scene, entities: [{ ...entity, constraints }] });

  const before = bake(withEntity(list.slice(0, -1))).transforms[0];
  const candidate = bake(withEntity([...list.slice(0, -1), { ...last, influence: 1 }])).transforms[0];
  const actual = bake(scene).transforms[0];
  const expectedLength = scene.frameCount * 7;
  if (before.length !== expectedLength || candidate.length !== expectedLength || actual.length !== expectedLength) {
    throw new Error(`${label}: transforms lengths ${before.length}, ${candidate.length}, ${actual.length}, expected ${expectedLength}`);
  }

  const pa: Vec3 = { x: 0, y: 0, z: 0 };
  const pb: Vec3 = { x: 0, y: 0, z: 0 };
  const pe: Vec3 = { x: 0, y: 0, z: 0 };
  const qa: Quat = { x: 0, y: 0, z: 0, w: 1 };
  const qb: Quat = { x: 0, y: 0, z: 0, w: 1 };
  const qe: Quat = { x: 0, y: 0, z: 0, w: 1 };

  for (let f = 0; f < scene.frameCount; f++) {
    const i = f * 7;
    pa.x = before[i]; pa.y = before[i + 1]; pa.z = before[i + 2];
    pb.x = candidate[i]; pb.y = candidate[i + 1]; pb.z = candidate[i + 2];
    qa.x = before[i + 3]; qa.y = before[i + 4]; qa.z = before[i + 5]; qa.w = before[i + 6];
    qb.x = candidate[i + 3]; qb.y = candidate[i + 4]; qb.z = candidate[i + 5]; qb.w = candidate[i + 6];
    lerp(pa, pb, w, pe);
    slerp(qa, qb, w, qe);

    near(label, f, 'position x', actual[i], pe.x);
    near(label, f, 'position y', actual[i + 1], pe.y);
    near(label, f, 'position z', actual[i + 2], pe.z);
    near(label, f, 'rotation x', actual[i + 3], qe.x);
    near(label, f, 'rotation y', actual[i + 4], qe.y);
    near(label, f, 'rotation z', actual[i + 5], qe.z);
    near(label, f, 'rotation w', actual[i + 6], qe.w);

    if (last.type === 'aimAt') {
      // An aimAt never drives position.
      near(label, f, 'position x (aimAt leaves it)', actual[i], before[i]);
      near(label, f, 'position y (aimAt leaves it)', actual[i + 1], before[i + 1]);
      near(label, f, 'position z (aimAt leaves it)', actual[i + 2], before[i + 2]);
    }
    if (w === 0) {
      for (let k = 0; k < 7; k++) near(label, f, `component ${k} at influence 0 vs before`, actual[i + k], before[i + k]);
    }
  }
}

interface InfluenceCounts {
  zero: number;
  one: number;
  mid: number;
}

function count(counts: InfluenceCounts, w: number): void {
  if (w === 0) counts.zero++;
  else if (w === 1) counts.one++;
  else counts.mid++;
}

function expectAllInfluences(runs: number, counts: InfluenceCounts, minRuns: number): void {
  expect(runs).toBeGreaterThanOrEqual(minRuns);
  expect(counts.zero).toBeGreaterThan(0);
  expect(counts.one).toBeGreaterThan(0);
  expect(counts.mid).toBeGreaterThan(0);
}

describe('Property 28: Influence blends linearly', () => {
  it('followPath with alignToPath true blends position and rotation by its influence', () => {
    let runs = 0;
    const counts: InfluenceCounts = { zero: 0, one: 0, mid: 0 };
    fc.assert(
      fc.property(arbBase, arbEarlierList, arbBody(fc.constant(true)), (base, earlier, body) => {
        runs++;
        count(counts, body.influence);
        checkBlend(`run ${runs}`, underTestScene(base, earlier, followOf(0, body)));
      }),
      { numRuns: 100 },
    );
    expectAllInfluences(runs, counts, 100);
  });

  it('followPath with alignToPath false or omitted blends position and leaves rotation alone', () => {
    let runs = 0;
    const counts: InfluenceCounts = { zero: 0, one: 0, mid: 0 };
    fc.assert(
      fc.property(arbBase, arbEarlierList, arbBody(arbNoAlign), (base, earlier, body) => {
        runs++;
        count(counts, body.influence);
        checkBlend(`run ${runs}`, underTestScene(base, earlier, followOf(0, body)));
      }),
      { numRuns: 200 },
    );
    expectAllInfluences(runs, counts, 200);
  });

  it('aimAt blends rotation by its influence and leaves position unchanged', () => {
    let runs = 0;
    const counts: InfluenceCounts = { zero: 0, one: 0, mid: 0 };
    fc.assert(
      fc.property(
        arbBase,
        arbEarlierList,
        fc.constantFrom<'t0' | 't1'>('t0', 't1'),
        arbInfluence,
        (base, earlier, target, influence) => {
          runs++;
          count(counts, influence);
          checkBlend(`run ${runs}`, underTestScene(base, earlier, { type: 'aimAt', order: 0, influence, target }));
        },
      ),
      { numRuns: 200 },
    );
    expectAllInfluences(runs, counts, 200);
  });

  it('a followPath without alignToPath after a partly blended aimAt keeps the aimAt-only rotation exactly', () => {
    let runs = 0;
    let moved = 0;
    fc.assert(
      fc.property(
        arbBase,
        fc.constantFrom<'t0' | 't1'>('t0', 't1'),
        arbMidInfluence,
        arbBody(arbNoAlign),
        (base, target, aimInfluence, body) => {
          runs++;
          const aim: Constraint = { type: 'aimAt', order: 0, influence: aimInfluence, target };
          const aimOnly = bake(sceneOf(base, [aim])).transforms[0];
          const both = bake(sceneOf(base, [aim, followOf(1, body)])).transforms[0];
          for (let f = 0; f < base.frameCount; f++) {
            for (let k = 3; k < 7; k++) {
              const a = both[f * 7 + k];
              const b = aimOnly[f * 7 + k];
              if (a !== b) {
                throw new Error(`run ${runs}: frame ${f}: rotation component ${k - 3} is ${a} with the followPath, ${b} without (aim influence ${aimInfluence}, follow influence ${body.influence})`);
              }
            }
            if (both[f * 7] !== aimOnly[f * 7] || both[f * 7 + 1] !== aimOnly[f * 7 + 1] || both[f * 7 + 2] !== aimOnly[f * 7 + 2]) {
              moved++;
            }
          }
        },
      ),
      { numRuns: 100 },
    );
    expect(runs).toBeGreaterThanOrEqual(100);
    expect(moved).toBeGreaterThan(0); // the followPath really moved the entity in some frames
  });

  describe('deterministic special cases', () => {
    const points: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 6, y: 1, z: 0 },
      { x: 10, y: 3, z: 5 },
      { x: 4, y: 4, z: 9 },
    ];
    const target: Vec3 = { x: 50, y: 10, z: 30 };
    const sceneWith = (forwardAxis: AxisToken, upAxis: AxisToken, constraints: Constraint[]): Scene => ({
      fps: 24,
      frameCount: 10,
      path: { points, closed: false },
      targets: { goal: target },
      entities: [{ id: 'subject', forwardAxis, upAxis, constraints }],
    });

    it('followPath at influence exactly 0 leaves position and rotation equal to the state before it', () => {
      const aim: Constraint = { type: 'aimAt', order: 0, influence: 1, target: 'goal' };
      for (const align of [true, false, undefined]) {
        const follow: FollowPathConstraint = { type: 'followPath', order: 1, influence: 0, speed: 3, startOffset: 1 };
        if (align !== undefined) follow.alignToPath = align;
        const before = bake(sceneWith('+Z', '+Y', [aim])).transforms[0];
        const after = bake(sceneWith('+Z', '+Y', [aim, follow])).transforms[0];
        for (let i = 0; i < before.length; i++) {
          if (!(Math.abs(before[i] - after[i]) <= TOLERANCE)) {
            throw new Error(`align ${String(align)}: index ${i}: ${after[i]} with influence 0, ${before[i]} before`);
          }
        }
      }
      // Rest pose too: a lone followPath at influence 0 stays at the origin with identity rotation.
      const lone = bake(sceneWith('+Z', '+Y', [{ type: 'followPath', order: 0, influence: 0, speed: 3, startOffset: 1, alignToPath: true }])).transforms[0];
      for (let f = 0; f < 10; f++) {
        const expected = [0, 0, 0, 0, 0, 0, 1];
        for (let k = 0; k < 7; k++) near('lone followPath', f, `component ${k}`, lone[f * 7 + k], expected[k]);
      }
      expect(lone.length).toBe(70);
    });

    it('aimAt at influence exactly 1 points the forward axis at the target for all 24 axis pairs', () => {
      const expectedDir: Vec3 = { x: 0, y: 0, z: 0 };
      const len = Math.hypot(target.x, target.y, target.z);
      expectedDir.x = target.x / len; expectedDir.y = target.y / len; expectedDir.z = target.z / len;
      const f: Vec3 = { x: 0, y: 0, z: 0 };
      const rotated: Vec3 = { x: 0, y: 0, z: 0 };
      const q: Quat = { x: 0, y: 0, z: 0, w: 1 };
      for (const [forwardAxis, upAxis] of VALID_AXIS_PAIRS) {
        const baked = bake(sceneWith(forwardAxis, upAxis, [{ type: 'aimAt', order: 0, influence: 1, target: 'goal' }])).transforms[0];
        axisVector(forwardAxis, f);
        for (let frame = 0; frame < 10; frame++) {
          const i = frame * 7;
          q.x = baked[i + 3]; q.y = baked[i + 4]; q.z = baked[i + 5]; q.w = baked[i + 6];
          rotateVec(q, f, rotated);
          const err = Math.hypot(rotated.x - expectedDir.x, rotated.y - expectedDir.y, rotated.z - expectedDir.z);
          if (!(err <= 1e-6)) {
            throw new Error(`${forwardAxis}/${upAxis}: frame ${frame}: rotated forward is ${err} from the target direction`);
          }
          near(`${forwardAxis}/${upAxis}`, frame, 'position x', baked[i], 0);
          near(`${forwardAxis}/${upAxis}`, frame, 'position y', baked[i + 1], 0);
          near(`${forwardAxis}/${upAxis}`, frame, 'position z', baked[i + 2], 0);
        }
      }
      expect(VALID_AXIS_PAIRS.length).toBe(24);
    });
  });
});
