import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import type { BakedData } from '../../src/bake.js';
import type { Constraint, Scene, Target } from '../../src/scene.js';
import { arbClosed, arbPointList, arbValidAxisPair, arbVec3, coord } from '../helpers/basic-generators.js';

// Feature: path-core, Property 23: Constraint order is by order value
// **Validates: Requirements 5.10**

/** All permutations of a list (at most 24 for 4 items). Setup code, not the evaluation path. */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    for (const tail of permutations(rest)) out.push([items[i], ...tail]);
  }
  return out;
}

/** Plain element-for-element comparison of two typed arrays. Returns a description of the first difference, or null. */
function firstArrayDifference(name: string, a: Float64Array, b: Float64Array): string | null {
  if (a.length !== b.length) return `${name}: length ${a.length} !== ${b.length}`;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return `${name}[${i}]: ${a[i]} !== ${b[i]}`;
  }
  return null;
}

/** Compares entity 0 of two bakes in every field. Returns the first difference, or null when identical. */
function firstBakeDifference(a: BakedData, b: BakedData): string | null {
  const t = firstArrayDifference('transforms', a.transforms[0], b.transforms[0]);
  if (t !== null) return t;
  const tr = firstArrayDifference('travelled', a.travelled[0], b.travelled[0]);
  if (tr !== null) return tr;
  const aim = firstArrayDifference('aimDirections', a.aimDirections[0], b.aimDirections[0]);
  if (aim !== null) return aim;
  if (a.heldFromFrame[0] !== b.heldFromFrame[0]) {
    return `heldFromFrame: ${a.heldFromFrame[0]} !== ${b.heldFromFrame[0]}`;
  }
  if (a.rotationDrivers[0] !== b.rotationDrivers[0]) {
    return `rotationDrivers: ${a.rotationDrivers[0]} !== ${b.rotationDrivers[0]}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Generator, local to this file: one entity with 2 to 4 constraints
// ---------------------------------------------------------------------------

const arbInfluence = fc.oneof(fc.constant(0), fc.constant(1), coord(0, 1));
const arbFollowBody = fc.record({ influence: arbInfluence, speed: coord(-10, 10), startOffset: coord(-50, 50) });
const arbAimBody = fc.record({ influence: arbInfluence, target: fc.constantFrom('s0', 'k0') });

/**
 * One entity, one path (open or closed), a static target s0 and a keyframed target k0.
 * The entity has 2 to 4 constraints, always at least one followPath and one aimAt, with
 * distinct integer order values drawn independently of the list position.
 * alignToPath is never true here, so no per-bake RMF table is built.
 */
const arbOrderScene: fc.Arbitrary<Scene> = fc
  .record({ closed: arbClosed, fps: fc.constantFrom(24, 30, 60), frameCount: fc.integer({ min: 2, max: 40 }) })
  .chain((h) =>
    fc
      .record({
        points: arbPointList(h.closed),
        staticPos: arbVec3,
        keyA: arbVec3,
        keyB: arbVec3,
        axes: arbValidAxisPair,
        extraKinds: fc.array(fc.boolean(), { minLength: 0, maxLength: 2 }), // true = followPath
        follows: fc.array(arbFollowBody, { minLength: 4, maxLength: 4 }),
        aims: fc.array(arbAimBody, { minLength: 4, maxLength: 4 }),
        orders: fc.uniqueArray(fc.integer({ min: -20, max: 20 }), { minLength: 4, maxLength: 4 }),
      })
      .map((r): Scene => {
        const kinds: boolean[] = [true, false, ...r.extraKinds];
        const constraints: Constraint[] = kinds.map((isFollow, i): Constraint => {
          if (isFollow) {
            const b = r.follows[i];
            return { type: 'followPath', order: r.orders[i], influence: b.influence, speed: b.speed, startOffset: b.startOffset };
          }
          const b = r.aims[i];
          return { type: 'aimAt', order: r.orders[i], influence: b.influence, target: b.target };
        });
        const targets: Record<string, Target> = {
          s0: r.staticPos,
          k0: {
            keyframes: [
              { frame: 0, position: r.keyA },
              { frame: h.frameCount, position: r.keyB },
            ],
          },
        };
        return {
          fps: h.fps,
          frameCount: h.frameCount,
          path: { points: r.points, closed: h.closed },
          targets,
          entities: [{ id: 'subject', forwardAxis: r.axes[0], upAxis: r.axes[1], constraints }],
        };
      }),
  );

describe('Property 23: Constraint order is by order value', () => {
  it('bakes identically for every permutation of the constraint list when order values are distinct', () => {
    let runs = 0;
    let bakes = 0;
    fc.assert(
      fc.property(arbOrderScene, (scene) => {
        const run = runs++;
        const list = scene.entities[0].constraints;
        const perms = permutations(list);
        if (perms.length !== [1, 1, 2, 6, 24][list.length]) {
          throw new Error(`run ${run}: expected ${list.length}! permutations, got ${perms.length}`);
        }
        const reference = bake({ ...scene, entities: [{ ...scene.entities[0], constraints: perms[0] }] });
        for (let p = 1; p < perms.length; p++) {
          const permuted = bake({ ...scene, entities: [{ ...scene.entities[0], constraints: perms[p] }] });
          bakes++;
          const diff = firstBakeDifference(reference, permuted);
          if (diff !== null) {
            const orders = perms[p].map((c) => `${c.type}@${c.order}`).join(', ');
            throw new Error(`run ${run}, permutation ${p} [${orders}] differs from permutation 0: ${diff}`);
          }
        }
      }),
      { numRuns: 200 },
    );
    expect(runs).toBeGreaterThanOrEqual(200);
    expect(bakes).toBeGreaterThan(200);
  });

  it('applies equal-order constraints in list order (stable sort)', () => {
    // With influence 1 each constraint replaces what the stack holds, so the final result depends on
    // which constraint ran last (followPath vs followPath) or on the position the aim started from
    // (aimAt vs followPath). Both list orders are baked and must differ. Then each list is compared with
    // the same constraints given distinct orders 0, 1 in that list order, which a stable sort must match.
    const path = { points: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }], closed: false };
    const sceneWith = (constraints: Constraint[]): Scene => ({
      fps: 30,
      frameCount: 5,
      path,
      targets: { aimed: { x: 3, y: 4, z: 2 } },
      entities: [{ id: 'subject', forwardAxis: '+Z', upAxis: '+Y', constraints }],
    });
    const withOrders = (list: Constraint[], orders: number[]): Constraint[] =>
      list.map((c, i) => ({ ...c, order: orders[i] }));

    const farFollow: Constraint = { type: 'followPath', order: 0, influence: 1, speed: 0, startOffset: 6 };
    const nearFollow: Constraint = { type: 'followPath', order: 0, influence: 1, speed: 0, startOffset: 1 };
    const aim: Constraint = { type: 'aimAt', order: 0, influence: 1, target: 'aimed' };
    const pairs: { name: string; first: Constraint; second: Constraint }[] = [
      { name: 'followPath then followPath', first: nearFollow, second: farFollow },
      { name: 'aimAt then followPath', first: aim, second: nearFollow },
    ];

    for (const pair of pairs) {
      const forward = [pair.first, pair.second];
      const backward = [pair.second, pair.first];

      const equalForward = bake(sceneWith(withOrders(forward, [0, 0])));
      const equalBackward = bake(sceneWith(withOrders(backward, [0, 0])));
      const distinctForward = bake(sceneWith(withOrders(forward, [0, 1])));
      const distinctBackward = bake(sceneWith(withOrders(backward, [0, 1])));

      // The two list orders must produce different results, or the test cannot see the sort.
      if (firstBakeDifference(equalForward, equalBackward) === null) {
        throw new Error(`${pair.name}: both list orders baked identically, so the scene cannot show the order`);
      }
      const f = firstBakeDifference(equalForward, distinctForward);
      if (f !== null) throw new Error(`${pair.name}, list order [first, second]: equal orders differ from orders 0,1: ${f}`);
      const b = firstBakeDifference(equalBackward, distinctBackward);
      if (b !== null) throw new Error(`${pair.name}, list order [second, first]: equal orders differ from orders 0,1: ${b}`);
    }
    expect(pairs.length).toBe(2);
  });
});
