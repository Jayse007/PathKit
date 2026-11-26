// Target_Converter tests (task 20.2).
// Fixture: a subject on a straight line. fps 24, speed 24 m/s, so the subject moves exactly
// 1 m per baked frame along +X. Path runs (0, 2, -3) to (48, 2, -3), so baked frames 0..24
// never reach the path end. Hand-written expected position at baked frame b: (b, 2, -3).

import { describe, expect, it } from 'vitest';
import { bake } from '../../src/logic/pathkit.js';
import type { Scene } from '../../src/logic/pathkit.js';
import { buildKeyframedTarget } from '../../src/logic/target-converter.js';

const SUBJECT_ID = 'subject';
const BAKED_FRAMES = 25;
const TOLERANCE = 1e-6;
const BASE_Y = 2;
const BASE_Z = -3;

const scene: Scene = {
  fps: 24,
  frameCount: BAKED_FRAMES,
  path: {
    points: [
      { x: 0, y: BASE_Y, z: BASE_Z },
      { x: 48, y: BASE_Y, z: BASE_Z },
    ],
    closed: false,
  },
  targets: {},
  entities: [
    {
      id: SUBJECT_ID,
      forwardAxis: '+Z',
      upAxis: '+Y',
      constraints: [
        { type: 'followPath', order: 0, influence: 1, speed: 24, startOffset: 0 },
      ],
    },
  ],
};
const baked = bake(scene);

// Hand-written remap table: displayed frame -> baked frame.
// Out of order, with repeats and the last baked frame, so remap(f) differs from f.
const REMAP_TABLE = [0, 0, 3, 5, 5, 24, 12, 1];
const DISPLAYED_FRAMES = REMAP_TABLE.length;
const remap = (f: number): number => REMAP_TABLE[f];

// Hand-written offsets and the y each one must give for baked y = 2.
const CASES: readonly { offset: number; expectedY: number }[] = [
  { offset: 0, expectedY: 2 },
  { offset: 1.5, expectedY: 3.5 },
  { offset: -0.3, expectedY: 1.7 },
  { offset: 40, expectedY: 42 },
];

function near(check: string, index: number, actual: number, expected: number): void {
  if (!(Math.abs(actual - expected) <= TOLERANCE)) {
    throw new Error(`${check}: index ${index}: got ${actual}, expected ${expected}`);
  }
}

describe('buildKeyframedTarget', () => {
  it('makes exactly one keyframe per displayed frame, with frame equal to its index', () => {
    for (const { offset } of CASES) {
      const { keyframes } = buildKeyframedTarget(baked, SUBJECT_ID, DISPLAYED_FRAMES, remap, offset);
      if (keyframes.length !== DISPLAYED_FRAMES) {
        throw new Error(`keyframe count (offset ${offset}): got ${keyframes.length}, expected ${DISPLAYED_FRAMES}`);
      }
      for (let f = 0; f < DISPLAYED_FRAMES; f++) {
        if (keyframes[f].frame !== f) {
          throw new Error(`keyframe frame (offset ${offset}): index ${f}: got ${keyframes[f].frame}`);
        }
      }
    }
  });

  it('puts the baked position at remap(f) in keyframe f, shifted up by the offset only in y', () => {
    for (const { offset, expectedY } of CASES) {
      const { keyframes } = buildKeyframedTarget(baked, SUBJECT_ID, DISPLAYED_FRAMES, remap, offset);
      for (let f = 0; f < DISPLAYED_FRAMES; f++) {
        const p = keyframes[f].position;
        near(`x at remapped frame (offset ${offset})`, f, p.x, REMAP_TABLE[f]);
        near(`y (offset ${offset})`, f, p.y, expectedY);
        near(`z (offset ${offset})`, f, p.z, BASE_Z);
      }
    }
  });

  it('shifts every keyframe by exactly the offset compared with offset 0', () => {
    const flat = buildKeyframedTarget(baked, SUBJECT_ID, DISPLAYED_FRAMES, remap, 0).keyframes;
    for (const { offset } of CASES) {
      const lifted = buildKeyframedTarget(baked, SUBJECT_ID, DISPLAYED_FRAMES, remap, offset).keyframes;
      for (let f = 0; f < DISPLAYED_FRAMES; f++) {
        near(`y rise (offset ${offset})`, f, lifted[f].position.y - flat[f].position.y, offset);
        near(`x equal (offset ${offset})`, f, lifted[f].position.x, flat[f].position.x);
        near(`z equal (offset ${offset})`, f, lifted[f].position.z, flat[f].position.z);
      }
    }
  });

  it('returns no keyframes for 0 frames and throws for a count that is not a whole number of 0 or more', () => {
    expect(buildKeyframedTarget(baked, SUBJECT_ID, 0, remap, 1.5).keyframes).toHaveLength(0);
    expect(() => buildKeyframedTarget(baked, SUBJECT_ID, -1, remap, 0)).toThrow(/-1/);
    expect(() => buildKeyframedTarget(baked, SUBJECT_ID, 2.5, remap, 0)).toThrow(/2\.5/);
    expect(() => buildKeyframedTarget(baked, SUBJECT_ID, Number.NaN, remap, 0)).toThrow(/NaN/);
  });
});
