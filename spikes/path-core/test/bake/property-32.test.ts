import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import type { BakedData } from '../../src/bake.js';
import type { Constraint, Entity, Scene } from '../../src/scene.js';
import { VALID_AXIS_PAIRS } from '../helpers/basic-generators.js';
import { arbValidScene } from '../helpers/scene-generators.js';

// Feature: path-core, Property 32: Bake is complete, deterministic and non-mutating
// **Validates: Requirements 7.1, 7.2, 7.3, 7.7, 7.8, 10.10, 10.11**

const QUAT_TOLERANCE = 1e-9;

type NumArray = ArrayLike<number>;

/** Recursively freezes plain objects and arrays. The scene holds no typed arrays. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
}

function sameNumbers(label: string, name: string, a: NumArray, b: NumArray): void {
  if (a.length !== b.length) throw new Error(`${label}: ${name} length ${a.length} differs from ${b.length}`);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) throw new Error(`${label}: ${name}[${i}] is ${a[i]} in one bake and ${b[i]} in the other`);
  }
}

function sameStrings(label: string, name: string, a: readonly string[], b: readonly string[]): void {
  if (a.length !== b.length) throw new Error(`${label}: ${name} length ${a.length} differs from ${b.length}`);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) throw new Error(`${label}: ${name}[${i}] is "${a[i]}" in one bake and "${b[i]}" in the other`);
  }
}

/** Every field of two bakes must be identical (plain !==). */
function sameBaked(label: string, a: BakedData, b: BakedData): void {
  if (a.fps !== b.fps) throw new Error(`${label}: fps ${a.fps} differs from ${b.fps}`);
  if (a.frameCount !== b.frameCount) throw new Error(`${label}: frameCount ${a.frameCount} differs from ${b.frameCount}`);
  sameStrings(label, 'entityIds', a.entityIds, b.entityIds);
  if (a.entityIndex.size !== b.entityIndex.size) {
    throw new Error(`${label}: entityIndex size ${a.entityIndex.size} differs from ${b.entityIndex.size}`);
  }
  for (const [id, index] of a.entityIndex) {
    if (b.entityIndex.get(id) !== index) {
      throw new Error(`${label}: entityIndex["${id}"] is ${index} in one bake and ${b.entityIndex.get(id)} in the other`);
    }
  }
  sameNumbers(label, 'heldFromFrame', a.heldFromFrame, b.heldFromFrame);
  sameNumbers(label, 'rotationDrivers', a.rotationDrivers, b.rotationDrivers);
  const arrays = ['transforms', 'travelled', 'aimDirections'] as const;
  for (const name of arrays) {
    if (a[name].length !== b[name].length) {
      throw new Error(`${label}: ${name} has ${a[name].length} entities, other bake has ${b[name].length}`);
    }
    for (let e = 0; e < a[name].length; e++) {
      sameNumbers(label, `${name} of entity "${a.entityIds[e]}"`, a[name][e], b[name][e]);
    }
  }
}

/** Lengths, finiteness and unit quaternions of one bake, for the scene it came from. */
function checkComplete(label: string, scene: Scene, baked: BakedData): void {
  const n = scene.frameCount;
  if (baked.fps !== scene.fps) throw new Error(`${label}: baked fps ${baked.fps}, scene fps ${scene.fps}`);
  if (baked.frameCount !== n) throw new Error(`${label}: baked frameCount ${baked.frameCount}, scene frameCount ${n}`);
  const count = scene.entities.length;
  const lists: [string, number][] = [
    ['entityIds', baked.entityIds.length],
    ['transforms', baked.transforms.length],
    ['travelled', baked.travelled.length],
    ['aimDirections', baked.aimDirections.length],
    ['heldFromFrame', baked.heldFromFrame.length],
    ['rotationDrivers', baked.rotationDrivers.length],
    ['entityIndex', baked.entityIndex.size],
  ];
  for (const [name, size] of lists) {
    if (size !== count) throw new Error(`${label}: ${name} has ${size} entries, scene has ${count} entities`);
  }
  for (let e = 0; e < count; e++) {
    const id = scene.entities[e].id;
    if (baked.entityIds[e] !== id) throw new Error(`${label}: entityIds[${e}] is "${baked.entityIds[e]}", expected "${id}"`);
    if (baked.entityIndex.get(id) !== e) throw new Error(`${label}: entityIndex["${id}"] is ${baked.entityIndex.get(id)}, expected ${e}`);
    const tr = baked.transforms[e];
    const tv = baked.travelled[e];
    const aim = baked.aimDirections[e];
    if (tr.length !== n * 7) throw new Error(`${label}: entity "${id}" transforms length ${tr.length}, expected ${n * 7}`);
    if (tv.length !== n) throw new Error(`${label}: entity "${id}" travelled length ${tv.length}, expected ${n}`);
    if (aim.length !== n * 3) throw new Error(`${label}: entity "${id}" aimDirections length ${aim.length}, expected ${n * 3}`);
    for (let i = 0; i < tr.length; i++) {
      if (!Number.isFinite(tr[i])) throw new Error(`${label}: entity "${id}" transforms[${i}] is not finite: ${tr[i]}`);
    }
    for (let i = 0; i < tv.length; i++) {
      if (!Number.isFinite(tv[i])) throw new Error(`${label}: entity "${id}" travelled[${i}] is not finite: ${tv[i]}`);
    }
    for (let i = 0; i < aim.length; i++) {
      if (!Number.isFinite(aim[i])) throw new Error(`${label}: entity "${id}" aimDirections[${i}] is not finite: ${aim[i]}`);
    }
    for (let f = 0; f < n; f++) {
      const q = f * 7 + 3;
      const len = Math.hypot(tr[q], tr[q + 1], tr[q + 2], tr[q + 3]);
      if (!(Math.abs(len - 1) <= QUAT_TOLERANCE)) {
        throw new Error(`${label}: entity "${id}" frame ${f} quaternion length is ${len}, expected 1 within ${QUAT_TOLERANCE}`);
      }
    }
  }
}

describe('Property 32: Bake is complete, deterministic and non-mutating', () => {
  it('for any valid scene: complete arrays, finite unit output, identical on repeat, scene untouched, frozen scene bakes the same', () => {
    fc.assert(
      fc.property(arbValidScene, (scene) => {
        const before = structuredClone(scene);
        const first = bake(scene);
        const second = bake(scene);

        // Once-per-run checks.
        expect(scene).toEqual(before);

        checkComplete('first bake', scene, first);
        sameBaked('repeat bake', first, second);

        const frozen = deepFreeze(structuredClone(scene));
        const fromFrozen = bake(frozen);
        sameBaked('frozen scene', first, fromFrozen);
      }),
      // arbValidScene can set alignToPath, and each such bake builds a 1024-sample RMF table, so 100 runs.
      { numRuns: 100 },
    );
  });

  describe('influence 0 bakes to the rest pose on every frame', () => {
    const POINTS = [
      { x: 0, y: 0, z: 0 },
      { x: 5, y: 2, z: 1 },
      { x: 9, y: -1, z: 4 },
    ];
    const FRAME_COUNT = 12;

    function sceneWith(entities: Entity[], targets: Scene['targets'] = { away: { x: 10, y: 5, z: 3 } }): Scene {
      return {
        fps: 30,
        frameCount: FRAME_COUNT,
        path: { points: POINTS.map((p) => ({ ...p })), closed: false },
        targets,
        entities,
      };
    }

    function checkRest(label: string, baked: BakedData, entityIndex: number): void {
      const tr = baked.transforms[entityIndex];
      if (tr.length !== FRAME_COUNT * 7) throw new Error(`${label}: transforms length ${tr.length}, expected ${FRAME_COUNT * 7}`);
      const rest = [0, 0, 0, 0, 0, 0, 1];
      for (let f = 0; f < FRAME_COUNT; f++) {
        for (let k = 0; k < 7; k++) {
          const v = tr[f * 7 + k];
          if (v !== rest[k]) throw new Error(`${label}: frame ${f} component ${k} is ${v}, expected ${rest[k]}`);
        }
      }
    }

    const cases: [string, Constraint][] = [
      ['followPath alignToPath true', { type: 'followPath', order: 0, influence: 0, speed: 2, startOffset: 1, alignToPath: true }],
      ['followPath alignToPath false', { type: 'followPath', order: 0, influence: 0, speed: 2, startOffset: 1, alignToPath: false }],
      ['aimAt with a target away from the entity', { type: 'aimAt', order: 0, influence: 0, target: 'away' }],
    ];

    for (const [name, constraint] of cases) {
      it(`${name}: position (0,0,0) and rotation (0,0,0,1), all 24 axis pairs`, () => {
        for (const [forwardAxis, upAxis] of VALID_AXIS_PAIRS) {
          const scene = sceneWith([{ id: 'subject', forwardAxis, upAxis, constraints: [{ ...constraint }] }]);
          const baked = bake(scene);
          checkRest(`${name} ${forwardAxis}/${upAxis}`, baked, 0);
        }
      });
    }

    it('a rest-pose entity beside a moving one is unaffected by its neighbour (previous-frame state never seeds the stack)', () => {
      const scene = sceneWith([
        {
          id: 'mover',
          forwardAxis: '+Z',
          upAxis: '+Y',
          constraints: [
            { type: 'followPath', order: 0, influence: 1, speed: 3, startOffset: 0, alignToPath: true },
            { type: 'aimAt', order: 1, influence: 1, target: 'away' },
          ],
        },
        {
          id: 'still',
          forwardAxis: '+Z',
          upAxis: '+Y',
          constraints: [{ type: 'aimAt', order: 0, influence: 0, target: 'away' }],
        },
      ]);
      const baked = bake(scene);
      checkRest('still beside mover', baked, 1);
    });
  });

  describe('deterministic edge scenes', () => {
    it('a scene with zero entities bakes to an empty result with fps and frameCount preserved', () => {
      const scene: Scene = {
        fps: 24,
        frameCount: 7,
        path: {
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 4, y: 1, z: 0 },
            { x: 8, y: 0, z: 3 },
          ],
          closed: false,
        },
        targets: {},
        entities: [],
      };
      const baked = bake(scene);
      expect(baked.fps).toBe(24);
      expect(baked.frameCount).toBe(7);
      expect(baked.entityIds).toHaveLength(0);
      expect(baked.entityIndex.size).toBe(0);
      expect(baked.transforms).toHaveLength(0);
      expect(baked.travelled).toHaveLength(0);
      expect(baked.aimDirections).toHaveLength(0);
      expect(baked.heldFromFrame).toHaveLength(0);
      expect(baked.rotationDrivers).toHaveLength(0);
    });

    it('an entity with no constraints bakes to the rest pose on every frame, with zero travelled and aim', () => {
      const frameCount = 9;
      const scene: Scene = {
        fps: 30,
        frameCount,
        path: {
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 4, y: 1, z: 0 },
            { x: 8, y: 0, z: 3 },
          ],
          closed: true,
        },
        targets: {},
        entities: VALID_AXIS_PAIRS.map(([forwardAxis, upAxis], i) => ({
          id: `e${i}`,
          forwardAxis,
          upAxis,
          constraints: [],
        })),
      };
      const baked = bake(scene);
      for (let e = 0; e < scene.entities.length; e++) {
        const id = scene.entities[e].id;
        const tr = baked.transforms[e];
        if (tr.length !== frameCount * 7) throw new Error(`entity "${id}": transforms length ${tr.length}, expected ${frameCount * 7}`);
        for (let f = 0; f < frameCount; f++) {
          for (let k = 0; k < 7; k++) {
            const expected = k === 6 ? 1 : 0;
            if (tr[f * 7 + k] !== expected) {
              throw new Error(`entity "${id}": frame ${f} component ${k} is ${tr[f * 7 + k]}, expected ${expected}`);
            }
          }
          if (baked.travelled[e][f] !== 0) throw new Error(`entity "${id}": travelled[${f}] is ${baked.travelled[e][f]}, expected 0`);
        }
        for (let i = 0; i < frameCount * 3; i++) {
          if (baked.aimDirections[e][i] !== 0) throw new Error(`entity "${id}": aimDirections[${i}] is ${baked.aimDirections[e][i]}, expected 0`);
        }
        if (baked.heldFromFrame[e] !== -1) throw new Error(`entity "${id}": heldFromFrame is ${baked.heldFromFrame[e]}, expected -1`);
        if (baked.rotationDrivers[e] !== 0) throw new Error(`entity "${id}": rotationDrivers is ${baked.rotationDrivers[e]}, expected 0`);
      }
    });
  });
});
