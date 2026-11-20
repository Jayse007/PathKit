import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import type { BakedData } from '../../src/bake.js';
import { evaluateEntity } from '../../src/evaluate.js';
import type { OutBuffer } from '../../src/evaluate.js';
import type { Scene } from '../../src/scene.js';
import { arbValidScene } from '../helpers/scene-generators.js';

// Feature: path-core, Property 35: Evaluator is read-only and allocation-free
// **Validates: Requirements 7.10, 7.11**

const GC_MISSING_MESSAGE =
  "globalThis.gc is not available: the heap check cannot run. Check that spikes/path-core/vitest.config.ts sets pool: 'forks' with poolOptions.forks.execArgv ['--expose-gc'].";

function makeOut(): OutBuffer {
  return { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
}

/** Freezes plain objects and arrays only. Typed arrays (Object.freeze throws on them) and Maps (freeze does not stop set()) are left alone. */
function freezePlain(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  if (ArrayBuffer.isView(value) || value instanceof Map) return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  for (let i = 0; i < keys.length; i++) freezePlain(record[keys[i]]);
}

/** Copies every typed array of the baked data (setup code, allocation is fine here). */
function snapshotTyped(arrays: readonly Float64Array[]): Float64Array[] {
  return arrays.map((a) => a.slice());
}

function compareTyped(name: string, before: readonly Float64Array[], after: readonly Float64Array[], ids: readonly string[]): void {
  if (before.length !== after.length) {
    throw new Error(`${name}: array count changed from ${before.length} to ${after.length}`);
  }
  for (let e = 0; e < before.length; e++) {
    const a = before[e];
    const b = after[e];
    if (a.length !== b.length) throw new Error(`${name} of entity "${ids[e]}": length changed from ${a.length} to ${b.length}`);
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) {
        throw new Error(`${name} of entity "${ids[e]}" index ${i}: was ${a[i]}, is now ${b[i]}`);
      }
    }
  }
}

function compareNumbers(name: string, before: readonly number[], after: readonly number[]): void {
  if (before.length !== after.length) throw new Error(`${name}: length changed from ${before.length} to ${after.length}`);
  for (let i = 0; i < before.length; i++) {
    if (!Object.is(before[i], after[i])) throw new Error(`${name} index ${i}: was ${before[i]}, is now ${after[i]}`);
  }
}

describe('Property 35: Evaluator is read-only and allocation-free', () => {
  it('for any valid scene, repeated calls leave the baked data unchanged and always return the reused Out_Buffer', () => {
    fc.assert(
      fc.property(arbValidScene, fc.integer({ min: 0, max: 0x7fffffff }), (scene, seed) => {
        const baked = bake(scene);

        // Snapshots taken before the calls.
        const fps = baked.fps;
        const frameCount = baked.frameCount;
        const ids = baked.entityIds.slice();
        const mapKeys = Array.from(baked.entityIndex.keys());
        const mapValues = Array.from(baked.entityIndex.values());
        const heldBefore = baked.heldFromFrame.slice();
        const driversBefore = baked.rotationDrivers.slice();
        const transformsBefore = snapshotTyped(baked.transforms);
        const travelledBefore = snapshotTyped(baked.travelled);
        const aimBefore = snapshotTyped(baked.aimDirections);

        freezePlain(baked); // plain objects and arrays only

        const out = makeOut();
        let state = seed >>> 0;
        let calls = 0;
        if (ids.length > 0) {
          for (let n = 0; n < 300; n++) {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            const e = state % ids.length;
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            // Include the first and last frame regularly, otherwise random frames.
            const f = n % 7 === 0 ? 0 : n % 7 === 1 ? frameCount - 1 : state % frameCount;
            const returned = evaluateEntity(baked, ids[e], f, out);
            if (returned !== out) {
              throw new Error(`call ${n} (entity "${ids[e]}", frame ${f}): returned object is not the Out_Buffer passed in`);
            }
            calls++;
          }
        }

        // Scalars and plain data unchanged.
        if (baked.fps !== fps) throw new Error(`fps changed from ${fps} to ${baked.fps}`);
        if (baked.frameCount !== frameCount) throw new Error(`frameCount changed from ${frameCount} to ${baked.frameCount}`);
        if (baked.entityIds.length !== ids.length) throw new Error(`entityIds length changed from ${ids.length} to ${baked.entityIds.length}`);
        for (let i = 0; i < ids.length; i++) {
          if (baked.entityIds[i] !== ids[i]) throw new Error(`entityIds index ${i}: was "${ids[i]}", is now "${baked.entityIds[i]}"`);
        }
        if (baked.entityIndex.size !== mapKeys.length) {
          throw new Error(`entityIndex size changed from ${mapKeys.length} to ${baked.entityIndex.size}`);
        }
        for (let i = 0; i < mapKeys.length; i++) {
          const v = baked.entityIndex.get(mapKeys[i]);
          if (v !== mapValues[i]) throw new Error(`entityIndex entry "${mapKeys[i]}": was ${mapValues[i]}, is now ${v}`);
        }
        compareNumbers('heldFromFrame', heldBefore, baked.heldFromFrame);
        compareNumbers('rotationDrivers', driversBefore, baked.rotationDrivers);
        compareTyped('transforms', transformsBefore, baked.transforms, ids);
        compareTyped('travelled', travelledBefore, baked.travelled, ids);
        compareTyped('aimDirections', aimBefore, baked.aimDirections, ids);

        // Once-per-run check that the property exercised calls whenever there were entities.
        expect(calls).toBe(ids.length > 0 ? 300 : 0);
      }),
      // arbValidScene can set alignToPath, and each such bake builds a 1024-sample RMF table, so 100 runs.
      { numRuns: 100 },
    );
  });

  it('100,000 calls with a reused Out_Buffer grow heapUsed by less than 1 MB', () => {
    const scene: Scene = {
      fps: 30,
      frameCount: 120,
      path: {
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 2, z: 3 },
          { x: 18, y: -1, z: 12 },
          { x: 25, y: 4, z: 20 },
        ],
        closed: false,
      },
      targets: {},
      entities: [
        {
          id: 'alpha',
          forwardAxis: '+Z',
          upAxis: '+Y',
          constraints: [{ type: 'followPath', order: 0, influence: 1, speed: 1, startOffset: 0, alignToPath: true }],
        },
        {
          id: 'beta',
          forwardAxis: '+X',
          upAxis: '+Y',
          constraints: [{ type: 'followPath', order: 0, influence: 1, speed: 2, startOffset: 1, alignToPath: true }],
        },
      ],
    };
    const baked: BakedData = bake(scene);

    // Precompute the (id, frame) pairs before the measured section, so the loop below only indexes into them.
    const pairCount = baked.entityIds.length * baked.frameCount;
    const pairIds: string[] = new Array<string>(pairCount);
    const pairFrames = new Int32Array(pairCount);
    let p = 0;
    for (let e = 0; e < baked.entityIds.length; e++) {
      for (let f = 0; f < baked.frameCount; f++) {
        pairIds[p] = baked.entityIds[e];
        pairFrames[p] = f;
        p++;
      }
    }

    const out = makeOut();
    const gc = (globalThis as { gc?: () => void }).gc;

    // Warm-up, so the optimiser and inline caches are settled before measuring.
    for (let i = 0; i < 1000; i++) {
      const k = i % pairCount;
      evaluateEntity(baked, pairIds[k], pairFrames[k], out);
    }

    if (typeof gc !== 'function') {
      throw new Error(GC_MISSING_MESSAGE);
    }

    const total = 100000;
    // Numbers (the loop counter, the failure count and the heap readings) are fine here: V8 keeps small integers
    // and doubles in registers or as immediates, so they do not allocate on the heap. Objects, arrays, strings
    // and closures do, and any of them created per iteration would show up as heap growth and invalidate the check.
    let mismatches = 0;
    let k = 0;
    gc();
    const heapBefore = process.memoryUsage().heapUsed;
    for (let i = 0; i < total; i++) {
      const returned = evaluateEntity(baked, pairIds[k], pairFrames[k], out);
      if (returned !== out) mismatches++;
      k++;
      if (k === pairCount) k = 0;
    }
    gc();
    const heapAfter = process.memoryUsage().heapUsed;

    const growth = heapAfter - heapBefore;
    expect(mismatches, `${mismatches} of ${total} calls did not return the Out_Buffer passed in`).toBe(0);
    if (growth >= 1048576) {
      throw new Error(`heapUsed grew by ${growth} bytes over ${total} calls (limit 1048576 bytes)`);
    }
  });
});
