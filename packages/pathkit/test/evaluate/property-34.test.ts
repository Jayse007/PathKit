import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import type { BakedData } from '../../src/bake.js';
import { evaluateEntity } from '../../src/evaluate.js';
import type { OutBuffer } from '../../src/evaluate.js';
import type { Scene } from '../../src/scene.js';
import { arbValidScene } from '../helpers/scene-generators.js';

// Feature: path-core, Property 34: Evaluator returns baked values
// **Validates: Requirements 7.9**

const FIELDS = ['position.x', 'position.y', 'position.z', 'rotation.x', 'rotation.y', 'rotation.z', 'rotation.w'] as const;

function makeOut(): OutBuffer {
  return { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
}

/** Writes a distinct sentinel into all seven fields, so an unwritten field keeps a recognisable wrong value. */
function fillSentinels(out: OutBuffer, counter: number): void {
  const base = 1e9 + counter * 7;
  out.position.x = base;
  out.position.y = base + 1;
  out.position.z = base + 2;
  out.rotation.x = base + 3;
  out.rotation.y = base + 4;
  out.rotation.z = base + 5;
  out.rotation.w = base + 6;
}

function readField(out: OutBuffer, k: number): number {
  switch (k) {
    case 0: return out.position.x;
    case 1: return out.position.y;
    case 2: return out.position.z;
    case 3: return out.rotation.x;
    case 4: return out.rotation.y;
    case 5: return out.rotation.z;
    default: return out.rotation.w;
  }
}

/** Plain checks: same object returned, and each of the seven numbers equals the stored value. Throws on any difference. */
function checkCall(baked: BakedData, id: string, frame: number, out: OutBuffer): void {
  const index = baked.entityIndex.get(id);
  if (index === undefined) throw new Error(`entity "${id}" is missing from entityIndex`);
  const stored = baked.transforms[index];
  const returned = evaluateEntity(baked, id, frame, out);
  if (returned !== out) throw new Error(`entity "${id}" frame ${frame}: returned value is not the Out_Buffer object passed in`);
  for (let k = 0; k < 7; k++) {
    const expected = stored[frame * 7 + k];
    const actual = readField(out, k);
    if (Number.isNaN(actual)) throw new Error(`entity "${id}" frame ${frame} field ${FIELDS[k]}: value is NaN, expected ${expected}`);
    if (actual !== expected) {
      throw new Error(`entity "${id}" frame ${frame} field ${FIELDS[k]}: got ${actual}, baked value is ${expected}`);
    }
  }
}

/** Deterministic Fisher-Yates driven by a 32-bit LCG seeded from the property's own input. */
function shuffleInPlace(items: [number, number][], seed: number): void {
  let state = seed >>> 0;
  for (let i = items.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = Math.floor((state / 4294967296) * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
}

describe('Property 34: Evaluator returns baked values', () => {
  it('for any valid scene, every entity and frame in shuffled order returns the same buffer holding the seven baked numbers', () => {
    fc.assert(
      fc.property(arbValidScene, fc.integer({ min: 0, max: 0x7fffffff }), (scene, seed) => {
        const baked = bake(scene);
        const pairs: [number, number][] = [];
        for (let e = 0; e < baked.entityIds.length; e++) {
          for (let f = 0; f < baked.frameCount; f++) pairs.push([e, f]);
        }
        shuffleInPlace(pairs, seed);

        const out = makeOut(); // one buffer reused for every call
        let counter = 0;
        for (const [e, f] of pairs) {
          fillSentinels(out, counter++);
          checkCall(baked, baked.entityIds[e], f, out);
        }
        // Once-per-run check that the property actually exercised calls.
        expect(counter).toBe(baked.entityIds.length * baked.frameCount);
      }),
      // arbValidScene can set alignToPath, and each such bake builds a 1024-sample RMF table, so 100 runs.
      { numRuns: 100 },
    );
  });

  describe('hand-built moving scene', () => {
    const FRAME_COUNT = 10;
    const scene: Scene = {
      fps: 30,
      frameCount: FRAME_COUNT,
      path: {
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 5, y: 2, z: 1 },
          { x: 9, y: -1, z: 4 },
        ],
        closed: false,
      },
      targets: {},
      entities: [
        {
          id: 'mover',
          forwardAxis: '+Z',
          upAxis: '+Y',
          constraints: [{ type: 'followPath', order: 0, influence: 1, speed: 2, startOffset: 1, alignToPath: true }],
        },
      ],
    };

    it('each of the seven fields equals its own stored baked value on every frame (swapped fields would fail)', () => {
      const baked = bake(scene);
      const out = makeOut();
      for (let f = 0; f < FRAME_COUNT; f++) {
        fillSentinels(out, f);
        checkCall(baked, 'mover', f, out);
      }

      // Once-per-run checks that the fields are distinguishable, so a swap could not go unnoticed.
      const last = FRAME_COUNT - 1;
      fillSentinels(out, 0);
      evaluateEntity(baked, 'mover', last, out);
      const { x, y, z } = out.position;
      expect(x).not.toBe(y);
      expect(y).not.toBe(z);
      expect(x).not.toBe(z);
      const q = out.rotation;
      expect(new Set([q.x, q.y, q.z, q.w]).size).toBeGreaterThan(1);
      // The mover really moves.
      const first = makeOut();
      evaluateEntity(baked, 'mover', 0, first);
      expect(first.position.x).not.toBe(x);
    });
  });
});
