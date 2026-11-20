import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import type { BakedData } from '../../src/bake.js';
import { evaluateEntity } from '../../src/evaluate.js';
import type { OutBuffer } from '../../src/evaluate.js';
import type { Scene } from '../../src/scene.js';

// Feature: path-core, Property 36: Evaluator rejects invalid arguments
// **Validates: Requirements 7.12, 7.13**

const FRAME_COUNT = 8;

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
      id: 'rover',
      forwardAxis: '+Z',
      upAxis: '+Y',
      constraints: [{ type: 'followPath', order: 0, influence: 1, speed: 2, startOffset: 0 }],
    },
    {
      id: 'Drone-2',
      forwardAxis: '+X',
      upAxis: '+Y',
      constraints: [{ type: 'followPath', order: 0, influence: 1, speed: 1, startOffset: 1 }],
    },
  ],
};

const IDS = ['rover', 'Drone-2'] as const;

const FIELDS = ['position.x', 'position.y', 'position.z', 'rotation.x', 'rotation.y', 'rotation.z', 'rotation.w'] as const;

function makeOut(): OutBuffer {
  return { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
}

/** Distinct sentinels in all seven fields (the values 1e9 + 1 ... 1e9 + 7 never occur as baked values). */
const SENTINELS = [1e9 + 1, 1e9 + 2, 1e9 + 3, 1e9 + 4, 1e9 + 5, 1e9 + 6, 1e9 + 7];

function fillSentinels(out: OutBuffer): void {
  out.position.x = SENTINELS[0];
  out.position.y = SENTINELS[1];
  out.position.z = SENTINELS[2];
  out.rotation.x = SENTINELS[3];
  out.rotation.y = SENTINELS[4];
  out.rotation.z = SENTINELS[5];
  out.rotation.w = SENTINELS[6];
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

function frameMessage(frame: number): string {
  return `Frame ${frame} is outside the valid range [0, ${FRAME_COUNT - 1}]`;
}

function idMessage(id: string): string {
  return `Unknown entity id "${id}"`;
}

/**
 * Plain checks, safe inside loops. Calls evaluateEntity with sentinels in `out` and requires that it throws a
 * plain Error (class exactly Error, not a SceneError) with exactly `message`, leaving all seven numbers of `out` untouched.
 */
function checkRejects(baked: BakedData, id: string, frame: number, message: string): void {
  const out = makeOut();
  fillSentinels(out);
  let thrown: unknown = undefined;
  let didThrow = false;
  try {
    evaluateEntity(baked, id, frame, out);
  } catch (e) {
    didThrow = true;
    thrown = e;
  }
  if (!didThrow) throw new Error(`id "${id}" frame ${frame}: expected a throw, but the call returned`);
  if (!(thrown instanceof Error)) throw new Error(`id "${id}" frame ${frame}: thrown value is not an Error`);
  if (thrown.constructor !== Error) {
    throw new Error(`id "${id}" frame ${frame}: thrown class is ${thrown.constructor.name}, expected exactly Error`);
  }
  if (thrown.message !== message) {
    throw new Error(`id "${id}" frame ${frame}: message is "${thrown.message}", expected "${message}"`);
  }
  for (let k = 0; k < 7; k++) {
    const actual = readField(out, k);
    if (actual !== SENTINELS[k]) {
      throw new Error(`id "${id}" frame ${frame}: out.${FIELDS[k]} changed from ${SENTINELS[k]} to ${actual} by a failing call`);
    }
  }
}

/** Plain check: the call is accepted and returns the same `out` object. */
function checkAccepts(baked: BakedData, id: string, frame: number): void {
  const out = makeOut();
  fillSentinels(out);
  const returned = evaluateEntity(baked, id, frame, out);
  if (returned !== out) throw new Error(`id "${id}" frame ${frame}: did not return the out buffer`);
  // The sentinels must have been overwritten, so an accepted call really wrote.
  for (let k = 0; k < 7; k++) {
    if (readField(out, k) === SENTINELS[k]) {
      throw new Error(`id "${id}" frame ${frame}: out.${FIELDS[k]} was not written by an accepted call`);
    }
  }
}

describe('Property 36: Evaluator rejects invalid arguments', () => {
  const baked = bake(scene);

  it('rejects non-integer and out-of-range frames with the exact frame message', () => {
    const frames = [
      NaN, Infinity, -Infinity, 0.5, -0.5, FRAME_COUNT - 0.5, 1e-9,
      -1, FRAME_COUNT, FRAME_COUNT + 1, 2 ** 31, Number.MAX_SAFE_INTEGER, -(2 ** 53),
    ];
    for (const id of IDS) {
      for (const frame of frames) {
        checkRejects(baked, id, frame, frameMessage(frame));
        // Once per call: vitest's own message comparison.
        expect(() => evaluateEntity(baked, id, frame, makeOut())).toThrow(new Error(frameMessage(frame)));
      }
    }
  });

  it('rejects unknown ids, including inherited object names and near misses, with the exact id message', () => {
    const ids = ['', 'constructor', '__proto__', 'toString', 'hasOwnProperty', 'ROVER', 'drone-2', 'rover ', 'Drone-2 '];
    for (const id of ids) {
      checkRejects(baked, id, 0, idMessage(id));
      expect(() => evaluateEntity(baked, id, 0, makeOut())).toThrow(new Error(idMessage(id)));
    }
  });

  it('reports the id error when both the id and the frame are wrong', () => {
    for (const frame of [-1, FRAME_COUNT, NaN, 0.5]) {
      checkRejects(baked, 'nobody', frame, idMessage('nobody'));
      expect(() => evaluateEntity(baked, 'nobody', frame, makeOut())).toThrow(new Error(idMessage('nobody')));
    }
  });

  it('accepts the first and last frame for every existing entity and returns out', () => {
    for (const id of baked.entityIds) {
      checkAccepts(baked, id, 0);
      checkAccepts(baked, id, FRAME_COUNT - 1);
    }
    expect(baked.entityIds.length).toBe(2);
  });

  it('leaves out untouched on a wrong id with a wrong frame, and on a wrong frame alone', () => {
    // checkRejects compares all seven numbers against distinct sentinels after the throw.
    checkRejects(baked, 'nobody', -1, idMessage('nobody'));
    checkRejects(baked, 'rover', FRAME_COUNT, frameMessage(FRAME_COUNT));
    checkRejects(baked, 'Drone-2', NaN, frameMessage(NaN));
    checkRejects(baked, 'rover', 0.5, frameMessage(0.5));
  });

  it('thrown errors are plain Error instances, not SceneError', () => {
    const cases: [string, number, string][] = [
      ['rover', -1, frameMessage(-1)],
      ['nobody', 0, idMessage('nobody')],
    ];
    for (const [id, frame, message] of cases) {
      let thrown: unknown = undefined;
      try {
        evaluateEntity(baked, id, frame, makeOut());
      } catch (e) {
        thrown = e;
      }
      expect(thrown instanceof Error).toBe(true);
      expect((thrown as Error).constructor === Error).toBe(true);
      expect((thrown as Error).message === message).toBe(true);
    }
  });

  it('for any integer frame near the valid range, throws iff out of range; non-integer frames always throw', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...IDS),
        fc.integer({ min: -50, max: FRAME_COUNT + 50 }),
        fc.constantFrom(0.25, 0.5, 0.75),
        (id, n, fraction) => {
          if (n < 0 || n > FRAME_COUNT - 1) {
            checkRejects(baked, id, n, frameMessage(n));
          } else {
            checkAccepts(baked, id, n);
          }
          const frame = n + fraction;
          checkRejects(baked, id, frame, frameMessage(frame));
        },
      ),
      { numRuns: 100 },
    );
  });
});
