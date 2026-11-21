import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import { rotateVec } from '../../src/math.js';
import type { Quat, Vec3 } from '../../src/math.js';
import { axisVector } from '../../src/scene.js';
import type { AxisToken, Scene } from '../../src/scene.js';
import { arbValidAxisPair, coord } from '../helpers/basic-generators.js';

// Feature: path-core, Property 29: Keyframed targets interpolate and hold
// **Validates: Requirements 6.8**

const DIRECTION_TOLERANCE = 1e-9;
const FORWARD_TOLERANCE = 1e-4;
/** The forward check is skipped when the aim is within 3.1 degrees of vertical. */
const FORWARD_CHECK_MAX_ABS_Y = Math.cos((3.1 * Math.PI) / 180);

// The entity has one aimAt (influence 1) and no followPath, so it stays at the origin.
// Every keyframe position has x in [5, 25]. Every lerp between two of them also has x >= 5,
// so every target is at least 5 m from the origin and no frame is coincident.

interface Spec {
  frameCount: number;
  frames: number[];
  positions: Vec3[];
}

interface RegimeCounts {
  before: number;
  on: number;
  between: number;
  after: number;
  forwardChecked: number;
}

function newCounts(): RegimeCounts {
  return { before: 0, on: 0, between: 0, after: 0, forwardChecked: 0 };
}

const PATH_POINTS: Vec3[] = [
  { x: 0, y: 0, z: 0 },
  { x: 8, y: 2, z: 3 },
  { x: 12, y: 5, z: -4 },
];

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const arbKeyPosition: fc.Arbitrary<Vec3> = fc.record({
  x: coord(5, 25),
  y: coord(-20, 20),
  z: coord(-20, 20),
});

/**
 * Keyframes with strictly increasing integer frames: n keyframes, gaps in [1, gapMax],
 * the first frame chosen by `anchor` from the frame count, the total span and a random 0..99.
 */
function arbSpec(
  nMin: number,
  nMax: number,
  gapMax: number,
  anchor: (frameCount: number, span: number, r: number) => number,
): fc.Arbitrary<Spec> {
  return fc
    .tuple(fc.integer({ min: 1, max: 40 }), fc.integer({ min: nMin, max: nMax }), fc.integer({ min: 0, max: 99 }))
    .chain(([frameCount, n, r]) =>
      fc
        .tuple(
          fc.array(fc.integer({ min: 1, max: gapMax }), { minLength: n - 1, maxLength: n - 1 }),
          fc.array(arbKeyPosition, { minLength: n, maxLength: n }),
        )
        .map(([gaps, positions]): Spec => {
          let span = 0;
          for (const g of gaps) span += g;
          const frames = [anchor(frameCount, span, r)];
          for (const g of gaps) frames.push(frames[frames.length - 1] + g);
          return { frameCount, frames, positions };
        }),
    );
}

const arbSpecAny: fc.Arbitrary<Spec> = fc.oneof(
  // a single keyframe, anywhere from well before the range to well after it
  arbSpec(1, 1, 1, (_fc, _span, r) => (r % 70) - 15),
  // keyframes starting at frame 0 with small gaps (many frames land exactly on keyframes)
  arbSpec(2, 12, 3, () => 0),
  // keyframes inside the range with room before and after (when the range is long enough)
  arbSpec(2, 4, 4, (_fc, _span, r) => 1 + (r % 5)),
  // all keyframes before frame 0 (negative frames), so every baked frame is after the last
  arbSpec(1, 5, 6, (_fc, span, r) => -1 - span - (r % 20)),
  // all keyframes at or beyond frameCount, so every baked frame is before the first
  arbSpec(1, 5, 6, (frameCount, _span, r) => frameCount + (r % 20)),
  // first keyframe negative, last often beyond the range: frames lie between two outside keyframes
  arbSpec(2, 12, 30, (_fc, _span, r) => -1 - (r % 10)),
  // many keyframes (8 to 12) with gaps of 1 and larger
  arbSpec(8, 12, 4, (_fc, _span, r) => (r % 30) - 10),
);

// ---------------------------------------------------------------------------
// Own interpolation and checks
// ---------------------------------------------------------------------------

/** Expected target position at an integer frame, written independently of src. */
function expectedPosition(spec: Spec, frame: number): Vec3 {
  const n = spec.frames.length;
  if (frame <= spec.frames[0]) return { ...spec.positions[0] };
  if (frame >= spec.frames[n - 1]) return { ...spec.positions[n - 1] };
  let i = n - 2;
  while (spec.frames[i] > frame) i--;
  const a = spec.positions[i];
  const b = spec.positions[i + 1];
  const t = (frame - spec.frames[i]) / (spec.frames[i + 1] - spec.frames[i]);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

function regimeOf(spec: Spec, frame: number): 'before' | 'on' | 'between' | 'after' {
  if (frame < spec.frames[0]) return 'before';
  if (frame > spec.frames[spec.frames.length - 1]) return 'after';
  return spec.frames.indexOf(frame) >= 0 ? 'on' : 'between';
}

function sceneOf(spec: Spec, forwardAxis: AxisToken, upAxis: AxisToken): Scene {
  return {
    fps: 24,
    frameCount: spec.frameCount,
    path: { points: PATH_POINTS, closed: false },
    targets: { goal: { keyframes: spec.frames.map((frame, i) => ({ frame, position: spec.positions[i] })) } },
    entities: [
      {
        id: 'subject',
        forwardAxis,
        upAxis,
        constraints: [{ type: 'aimAt', order: 0, influence: 1, target: 'goal' }],
      },
    ],
  };
}

/** Bakes the scene and checks every frame. Throws on the first miss. Updates the regime counts. */
function checkSpec(label: string, spec: Spec, forwardAxis: AxisToken, upAxis: AxisToken, counts: RegimeCounts): void {
  const baked = bake(sceneOf(spec, forwardAxis, upAxis));
  const dirs = baked.aimDirections[0];
  const transforms = baked.transforms[0];
  if (dirs.length !== spec.frameCount * 3) {
    throw new Error(`${label}: aimDirections length ${dirs.length}, expected ${spec.frameCount * 3}`);
  }

  const forward: Vec3 = axisVector(forwardAxis, { x: 0, y: 0, z: 0 });
  const rotated: Vec3 = { x: 0, y: 0, z: 0 };
  const q: Quat = { x: 0, y: 0, z: 0, w: 1 };

  for (let f = 0; f < spec.frameCount; f++) {
    counts[regimeOf(spec, f)]++;

    const p = expectedPosition(spec, f);
    const len = Math.hypot(p.x, p.y, p.z);
    if (!(len >= 5)) throw new Error(`${label}: frame ${f}: test bug, expected target length ${len} is below 5`);
    const ex = p.x / len;
    const ey = p.y / len;
    const ez = p.z / len;

    const i = f * 3;
    const dx = dirs[i];
    const dy = dirs[i + 1];
    const dz = dirs[i + 2];
    if (
      !(Math.abs(dx - ex) <= DIRECTION_TOLERANCE) ||
      !(Math.abs(dy - ey) <= DIRECTION_TOLERANCE) ||
      !(Math.abs(dz - ez) <= DIRECTION_TOLERANCE)
    ) {
      throw new Error(
        `${label}: frame ${f} (${regimeOf(spec, f)}): aim direction (${dx}, ${dy}, ${dz}), expected (${ex}, ${ey}, ${ez}); keyframe frames [${spec.frames.join(', ')}]`,
      );
    }

    if (Math.abs(ey) < FORWARD_CHECK_MAX_ABS_Y) {
      const t = f * 7;
      q.x = transforms[t + 3]; q.y = transforms[t + 4]; q.z = transforms[t + 5]; q.w = transforms[t + 6];
      rotateVec(q, forward, rotated);
      if (
        !(Math.abs(rotated.x - ex) <= FORWARD_TOLERANCE) ||
        !(Math.abs(rotated.y - ey) <= FORWARD_TOLERANCE) ||
        !(Math.abs(rotated.z - ez) <= FORWARD_TOLERANCE)
      ) {
        throw new Error(
          `${label}: frame ${f}: rotated forward (${rotated.x}, ${rotated.y}, ${rotated.z}) is not along (${ex}, ${ey}, ${ez}) for ${forwardAxis}/${upAxis}`,
        );
      }
      counts.forwardChecked++;
    }
  }
}

describe('Property 29: Keyframed targets interpolate and hold', () => {
  it('aim direction follows lerp between keyframes and holds the first and last positions outside them', () => {
    let runs = 0;
    const counts = newCounts();
    fc.assert(
      fc.property(arbSpecAny, arbValidAxisPair, (spec, axes) => {
        runs++;
        checkSpec(`run ${runs}`, spec, axes[0], axes[1], counts);
      }),
      { numRuns: 200 },
    );
    expect(runs).toBeGreaterThanOrEqual(200);
    expect(counts.before).toBeGreaterThan(0);
    expect(counts.on).toBeGreaterThan(0);
    expect(counts.between).toBeGreaterThan(0);
    expect(counts.after).toBeGreaterThan(0);
    expect(counts.forwardChecked).toBeGreaterThan(0);
  });

  describe('deterministic special cases', () => {
    const P1: Vec3 = { x: 10, y: 3, z: -4 };
    const P2: Vec3 = { x: 6, y: 12, z: 2 };
    const P3: Vec3 = { x: 20, y: -9, z: 15 };

    it('a single keyframe gives a constant target for every frame, before, on and after it', () => {
      const counts = newCounts();
      checkSpec('single', { frameCount: 15, frames: [7], positions: [P1] }, '+Z', '+Y', counts);
      expect(counts.before).toBe(7);
      expect(counts.on).toBe(1);
      expect(counts.after).toBe(7);
      expect(counts.between).toBe(0);
    });

    it('keyframes exactly on frames, with holds before the first and after the last', () => {
      const counts = newCounts();
      checkSpec('on frames', { frameCount: 20, frames: [3, 7, 12], positions: [P1, P2, P3] }, '+X', '+Y', counts);
      expect(counts.before).toBe(3);
      expect(counts.on).toBe(3);
      expect(counts.between).toBe(3 + 4); // frames 4..6 and 8..11
      expect(counts.after).toBe(7); // frames 13..19
    });

    it('keyframes entirely before the range (negative frames) hold the last position', () => {
      const counts = newCounts();
      checkSpec('all negative', { frameCount: 10, frames: [-10, -4, -1], positions: [P1, P2, P3] }, '-Z', '+X', counts);
      expect(counts.after).toBe(10);
    });

    it('keyframes entirely beyond the range hold the first position', () => {
      const counts = newCounts();
      checkSpec('all beyond', { frameCount: 10, frames: [10, 25, 40], positions: [P1, P2, P3] }, '+Y', '-Z', counts);
      expect(counts.before).toBe(10);
    });

    it('frames between two keyframes that are both outside the range interpolate', () => {
      const counts = newCounts();
      checkSpec('straddle', { frameCount: 10, frames: [-5, 50], positions: [P1, P3] }, '-X', '+Z', counts);
      expect(counts.between).toBe(10);
    });

    it('many keyframes with gaps of 1 and larger', () => {
      const frames = [-3, -2, 0, 1, 4, 5, 9, 10, 17, 18, 30, 31];
      const positions: Vec3[] = frames.map((_, i) => ({ x: 5 + (i * 7) % 20, y: ((i * 11) % 41) - 20, z: ((i * 13) % 41) - 20 }));
      const counts = newCounts();
      checkSpec('many', { frameCount: 40, frames, positions }, '+Z', '-Y', counts);
      expect(counts.on + counts.between + counts.before + counts.after).toBe(40);
      expect(counts.after).toBe(8); // frames 32..39
    });
  });
});
