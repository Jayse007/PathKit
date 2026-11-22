import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import { bakedPosition, buildOrbitScene, scaleOf } from '../helpers/orbit-generators.js';
import type { OrbitCase } from '../helpers/orbit-generators.js';
import type { AxisToken } from '../../src/scene.js';

// Feature: orbit-around, Property O5: A full lap returns to the start
// Validates: Requirements 2.16, 8.9
//
// With speed = direction * laps * 360 * fps / N, where N divides 360, frame N is exactly `laps` whole turns
// from frame 0, so the position at frame N equals the position at frame 0. The scene has frameCount = N + 1,
// so frame N is the last frame. The centre is static, because a moving centre would move the position.
// Source lines this should catch: `frame` replaced by `frame - 1` in the angle, or `startAngle` applied
// in a way that depends on the frame.

const DIVISORS_OF_360 = [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 60, 72, 90];
const AXES: AxisToken[] = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];

interface LapCase {
  c: OrbitCase;
  n: number;
}

function lapCase(
  n: number,
  laps: number,
  direction: number,
  axis: AxisToken,
  fps: number,
  startAngle: number,
  radius: number,
  centre: [number, number, number],
): LapCase {
  return {
    n,
    c: {
      fps,
      frameCount: n + 1,
      axis,
      radius,
      speed: (direction * laps * 360 * fps) / n,
      startAngle,
      centre: { kind: 'static', c: centre },
    },
  };
}

function checkLap({ c, n }: LapCase): void {
  const baked = bake(buildOrbitScene(c));
  const tol = 1e-9 * scaleOf(c);
  const first = bakedPosition(baked, 0, 0, [0, 0, 0]);
  const last = bakedPosition(baked, 0, n, [0, 0, 0]);
  for (let k = 0; k < 3; k++) {
    if (!(Math.abs(last[k] - first[k]) <= tol)) {
      throw new Error(
        `Property O5: frame ${n} component ${k} is ${last[k]} but frame 0 is ${first[k]} (more than ${tol} apart); case ${JSON.stringify(c)}`,
      );
    }
  }
  expect(c.frameCount).toBe(n + 1);
}

const arbLap = fc
  .record({
    n: fc.constantFrom(...DIVISORS_OF_360),
    laps: fc.integer({ min: 1, max: 3 }),
    direction: fc.constantFrom(1, -1),
    axis: fc.constantFrom(...AXES),
    fps: fc.constantFrom(24, 30, 60),
    startAngle: fc.integer({ min: -720, max: 720 }),
    radius: fc.integer({ min: 0, max: 300 }).map((i) => i / 10),
    cx: fc.integer({ min: -1000, max: 1000 }),
    cy: fc.integer({ min: -1000, max: 1000 }),
    cz: fc.integer({ min: -1000, max: 1000 }),
  })
  .map((r) => lapCase(r.n, r.laps, r.direction, r.axis, r.fps, r.startAngle, r.radius, [r.cx / 10, r.cy / 10, r.cz / 10]));

// Forced: N = 1 with speed = 360 * fps (a turn of exactly 360 degrees per frame), N = 90 (the last divisor
// below 119), both directions, every axis.
const FORCED: LapCase[] = [
  lapCase(1, 1, 1, '+Y', 30, 0, 5, [0, 0, 0]),
  lapCase(1, 1, -1, '-Z', 60, 45, 5, [1, 2, 3]),
  lapCase(90, 1, 1, '+X', 24, 0, 30, [0, 0, 0]),
  lapCase(90, 3, -1, '-X', 60, -720, 0.1, [-100, 100, -100]),
  lapCase(4, 1, 1, '+Y', 30, 0, 0, [0, 0, 0]), // radius 0 and startAngle 0
  ...AXES.map((axis) => lapCase(12, 2, 1, axis, 30, 17, 3, [5, -5, 5])),
];

describe('Feature: orbit-around, Property O5: A full lap returns to the start', () => {
  it('the position at frame N equals the position at frame 0', () => {
    fc.assert(
      fc.property(arbLap, (lap) => {
        checkLap(lap);
      }),
      { numRuns: 100, examples: FORCED.map((lap) => [lap] as [LapCase]) },
    );
  });

  it('forced: a turn of exactly 360 degrees per frame (N = 1, speed = 360 * fps), and N as the last frame', () => {
    expect(FORCED.some((l) => l.n === 1 && l.c.speed === 360 * l.c.fps)).toBe(true);
    expect(FORCED.every((l) => l.c.frameCount === l.n + 1)).toBe(true);
    expect(new Set(FORCED.map((l) => l.c.axis)).size).toBe(6);
    for (const lap of FORCED) checkLap(lap);
  });
});
