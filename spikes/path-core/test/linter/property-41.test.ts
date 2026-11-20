import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import { motionLinter } from '../../src/linter.js';
import type { Finding } from '../../src/linter.js';
import { buildFixture } from '../helpers/baked-builder.js';
import type { FixtureEntity } from '../helpers/baked-builder.js';
import { arbValidScene } from '../helpers/scene-generators.js';

// Feature: path-core, Property 41: Speed spike uses the median of non-held frames
// **Validates: Requirements 9.3, 9.4, 9.9**
//
// Constant-speed path following cannot trigger speed-spike, so generated scenes (Property B) almost
// never reach the emitting branch. The main coverage is the hand-built fixtures (part 1) and
// Property A, which builds BakedData by hand with buildFixture and compares against an independent oracle.

type V3 = [number, number, number];

function spikeFrames(findings: readonly Finding[], entityId: string): number[] {
  const out: number[] = [];
  for (const x of findings) if (x.code === 'speed-spike' && x.entityId === entityId) out.push(x.frame);
  return out;
}

// ---------------------------------------------------------------------------
// Part 1: hand-built fixtures with exact answers (fps 1, so speed = step length)
// ---------------------------------------------------------------------------

type Axis = 'x' | 'y' | 'z';

/** Positions are the cumulative sum of the speeds along one axis, starting at (0,0,0) on frame 0. */
function positionsAlong(speeds: readonly number[], axis: Axis): V3[] {
  const out: V3[] = [[0, 0, 0]];
  let total = 0;
  for (const s of speeds) {
    total += s;
    out.push([axis === 'x' ? total : 0, axis === 'y' ? total : 0, axis === 'z' ? total : 0]);
  }
  return out;
}

/** Speed-spike frames of entity 'rover' for the given per-frame speeds (frames 1..n). */
function roverSpikes(speeds: readonly number[], axis: Axis = 'x', held = -1): number[] {
  const { scene, baked } = buildFixture(speeds.length + 1, 1, [
    { id: 'rover', positions: positionsAlong(speeds, axis), heldFromFrame: held },
  ]);
  return spikeFrames(motionLinter(scene, baked), 'rover');
}

describe('Property 41: speed spike uses the median of non-held frames', () => {
  it('a: speeds 1,1,1,1,10 spike on frame 5 only', () => {
    expect(roverSpikes([1, 1, 1, 1, 10])).toEqual([5]);
  });

  it('b: the comparison is strict: 3 times the median does not spike, 3.01 does', () => {
    expect(roverSpikes([1, 1, 1, 1, 3])).toEqual([]);
    expect(roverSpikes([1, 1, 1, 1, 3.01])).toEqual([5]);
  });

  it('c: a median of 0 gives no finding even when one frame moves', () => {
    expect(roverSpikes([0, 0, 0, 0, 5])).toEqual([]);
  });

  it('d: the median of an even count is the average of the two middle values', () => {
    // Speeds 1,1,3,5 sorted: middle values 1 and 3. Average 2, limit 6.
    //   [1,1,3,5]: 5 is not > 6, so no spike. A lower median (1, limit 3) would flag frame 4;
    //   an upper median (3, limit 9) gives none, so the next case separates it.
    expect(roverSpikes([1, 1, 3, 5])).toEqual([]);
    // Speeds 1,1,3,8: average 2, limit 6, so 8 spikes on frame 4. An upper median (3, limit 9)
    // would give no spike; a lower median (1, limit 3) would also give frame 4 (3 is not > 3).
    expect(roverSpikes([1, 1, 3, 8])).toEqual([4]);
  });

  it('e: movement along y only and along z only still spikes', () => {
    expect(roverSpikes([1, 1, 1, 1, 10], 'y')).toEqual([5]);
    expect(roverSpikes([1, 1, 1, 1, 10], 'z')).toEqual([5]);
  });

  it('f: held frames are excluded from the list and cannot emit', () => {
    const speeds = [1, 1, 1, 17, 0, 0, 0];
    expect(roverSpikes(speeds, 'x', 4)).toEqual([]);
    expect(roverSpikes(speeds, 'x', 5)).toEqual([4]);
  });

  it('g: heldFromFrame 0 excludes every frame, so a jump gives no finding', () => {
    expect(roverSpikes([1, 1, 1, 50], 'x', 0)).toEqual([]);
  });

  it('extra i: two speeds [1, 7] give median 4 (average) and 7 is not > 12', () => {
    expect(roverSpikes([1, 7])).toEqual([]);
  });

  it('extra ii: a single speed is its own median and cannot spike', () => {
    expect(roverSpikes([5])).toEqual([]);
  });

  it('extra iii: frameCount 1 has no speeds, no median, no finding and no error', () => {
    const { scene, baked } = buildFixture(1, 1, [{ id: 'rover', positions: [[0, 0, 0]] }]);
    expect(spikeFrames(motionLinter(scene, baked), 'rover')).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Property A: random hand-built fixtures against an independent oracle
  // -------------------------------------------------------------------------

  interface StepSpec { kind: number; mag: number; dirKind: number; a: number; b: number; c: number }
  interface EntitySpec { steps: StepSpec[]; stopAt: number; heldSel: number }

  const arbStep: fc.Arbitrary<StepSpec> = fc.record({
    kind: fc.integer({ min: 0, max: 9 }),
    mag: fc.integer({ min: 0, max: 1000 }),
    dirKind: fc.integer({ min: 0, max: 9 }),
    a: fc.integer({ min: 0, max: 2000 }),
    b: fc.integer({ min: 0, max: 2000 }),
    c: fc.integer({ min: 0, max: 2000 }),
  });
  const arbEntitySpec: fc.Arbitrary<EntitySpec> = fc.record({
    steps: fc.array(arbStep, { minLength: 19, maxLength: 19 }),
    stopAt: fc.integer({ min: 0, max: 40 }),
    heldSel: fc.integer({ min: 0, max: 25 }),
  });
  const arbCaseA = fc.record({
    frameCount: fc.integer({ min: 2, max: 20 }),
    fps: fc.constantFrom(1, 24, 30, 60),
    entities: fc.array(arbEntitySpec, { minLength: 1, maxLength: 2 }),
  });

  const AXIS_DIRS: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

  function stepDirection(s: StepSpec): V3 {
    if (s.dirKind < 6) return AXIS_DIRS[s.dirKind];
    const x = s.a / 1000 - 1;
    const y = s.b / 1000 - 1;
    const z = s.c / 1000 - 1;
    const len = Math.hypot(x, y, z);
    if (len < 0.1) return [1, 0, 0];
    return [x / len, y / len, z / len];
  }

  /** Mostly small similar steps (0.5..1.5), some zero steps, some big jumps (5..50). */
  function stepLength(s: StepSpec): number {
    if (s.kind === 0) return 0;
    if (s.kind === 1) return 5 + (45 * s.mag) / 1000;
    return 0.5 + s.mag / 1000;
  }

  function positionsOf(spec: EntitySpec, frameCount: number): V3[] {
    const out: V3[] = [[0, 0, 0]];
    for (let f = 1; f < frameCount; f++) {
      const prev = out[f - 1];
      const len = f >= spec.stopAt ? 0 : stepLength(spec.steps[f - 1]);
      const d = stepDirection(spec.steps[f - 1]);
      out.push([prev[0] + d[0] * len, prev[1] + d[1] * len, prev[2] + d[2] * len]);
    }
    return out;
  }

  function heldOf(spec: EntitySpec, frameCount: number): number {
    return spec.heldSel < 8 ? -1 : (spec.heldSel - 8) % frameCount;
  }

  /** Oracle: expected spike frames, or null for frames near the boundary (skipped by the caller). */
  function oracle(
    positions: readonly V3[], fps: number, held: number,
  ): { expected: number[]; skip: Set<number>; hadList: boolean; median: number } {
    const speedByFrame: number[] = [0];
    for (let f = 1; f < positions.length; f++) {
      const p = positions[f];
      const q = positions[f - 1];
      speedByFrame.push(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * fps);
    }
    const listFrames: number[] = [];
    const list: number[] = [];
    for (let f = 1; f < positions.length; f++) {
      if (held >= 0 && f >= held) continue;
      listFrames.push(f);
      list.push(speedByFrame[f]);
    }
    const expected: number[] = [];
    const skip = new Set<number>();
    if (list.length === 0) return { expected, skip, hadList: false, median: 0 };
    const sorted = list.slice();
    sorted.sort((u, v) => (u < v ? -1 : u > v ? 1 : 0));
    const n = sorted.length;
    const median = n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    if (median === 0) return { expected, skip, hadList: true, median };
    const limit = 3 * median;
    for (let i = 0; i < listFrames.length; i++) {
      const s = list[i];
      if (Math.abs(s - limit) <= 1e-9 * limit) skip.add(listFrames[i]);
      else if (s > limit) expected.push(listFrames[i]);
    }
    return { expected, skip, hadList: true, median };
  }

  it('A: spike frames equal the independent oracle on random hand-built fixtures', () => {
    let runs = 0;
    let withSpike = 0;
    let withoutSpike = 0;
    let withHeldExcluded = 0;
    fc.assert(
      fc.property(arbCaseA, (c) => {
        runs++;
        const specs = c.entities.map((spec, i) => ({
          id: `e${i}`,
          positions: positionsOf(spec, c.frameCount),
          held: heldOf(spec, c.frameCount),
        }));
        const entities: FixtureEntity[] = specs.map((s) => ({
          id: s.id, positions: s.positions, heldFromFrame: s.held,
        }));
        const { scene, baked } = buildFixture(c.frameCount, c.fps, entities);
        const findings = motionLinter(scene, baked);
        for (const s of specs) {
          const o = oracle(s.positions, c.fps, s.held);
          const actual = spikeFrames(findings, s.id);
          for (const fr of actual) {
            if (fr < 1 || fr >= c.frameCount) {
              throw new Error(`speed-spike run ${runs}: entity ${s.id} finding at out-of-range frame ${fr}`);
            }
          }
          for (let f = 1; f < c.frameCount; f++) {
            if (o.skip.has(f)) continue;
            const exp = o.expected.includes(f);
            const got = actual.includes(f);
            if (exp !== got) {
              throw new Error(
                `speed-spike run ${runs}: entity ${s.id} frame ${f} (fps ${c.fps}, frameCount ${c.frameCount}, ` +
                `heldFromFrame ${s.held}, oracle median ${o.median}): expected ${exp ? 'finding' : 'no finding'} ` +
                `but found ${got ? 'finding' : 'none'}; expected frames [${o.expected.join(',')}], actual [${actual.join(',')}]`,
              );
            }
          }
          if (o.hadList && o.median > 0) {
            if (o.expected.length > 0) withSpike++;
            else withoutSpike++;
          }
          if (s.held >= 0 && s.held <= c.frameCount - 1) withHeldExcluded++;
        }
      }),
      { numRuns: 200 },
    );
    expect(runs).toBeGreaterThanOrEqual(200);
    expect(withSpike).toBeGreaterThan(0);
    expect(withoutSpike).toBeGreaterThan(0);
    expect(withHeldExcluded).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Property B: soundness over baked generated scenes
  // -------------------------------------------------------------------------

  it('B: every speed-spike on a baked scene exceeds 3 times the recomputed median; median 0 gives none', () => {
    let runs = 0;
    fc.assert(
      fc.property(arbValidScene, (scene) => {
        runs++;
        const baked = bake(scene);
        const findings = motionLinter(scene, baked);
        for (let e = 0; e < baked.entityIds.length; e++) {
          const id = baked.entityIds[e];
          const held = baked.heldFromFrame[e];
          const t = baked.transforms[e];
          const speedAt = (f: number): number => {
            const i = f * 7;
            const j = (f - 1) * 7;
            return Math.hypot(t[i] - t[j], t[i + 1] - t[j + 1], t[i + 2] - t[j + 2]) * baked.fps;
          };
          const list: number[] = [];
          for (let f = 1; f < baked.frameCount; f++) {
            if (held >= 0 && f >= held) continue;
            list.push(speedAt(f));
          }
          const actual = spikeFrames(findings, id);
          let median = 0;
          if (list.length > 0) {
            list.sort((u, v) => (u < v ? -1 : u > v ? 1 : 0));
            const n = list.length;
            median = n % 2 === 1 ? list[(n - 1) / 2] : (list[n / 2 - 1] + list[n / 2]) / 2;
          }
          if (!(median > 0) && actual.length > 0) {
            throw new Error(`speed-spike B run ${runs}: entity ${id} has findings at [${actual.join(',')}] but the median is ${median} (list length ${list.length})`);
          }
          for (const fr of actual) {
            if (held >= 0 && fr >= held) {
              throw new Error(`speed-spike B run ${runs}: entity ${id} finding on held frame ${fr} (heldFromFrame ${held})`);
            }
            const s = speedAt(fr);
            if (!(s > 3 * median * (1 - 1e-9))) {
              throw new Error(`speed-spike B run ${runs}: entity ${id} frame ${fr}: speed ${s} is not > 3 * median ${median}`);
            }
          }
        }
      }),
      { numRuns: 100 },
    );
    expect(runs).toBeGreaterThanOrEqual(100);
  });
});
