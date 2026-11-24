// Spike S1: constant spacing of the baked subject, and the remap.
// Part (a) measures the spacing deviation, prints it, and asserts the agreed tolerances.
// Part (b) checks the remap is whole, in range, and really eases.
//
// Agreed tolerances (User, 2026-11-24):
//   - each step's relative deviation from the mean step is at most 2% (0.02);
//   - the absolute difference between the sum of all 1920 steps and the road length is at most 0.001 m.
// Measured values (2026-11-24):
//   road length                      120.0016939269426 m
//   sum of all 1920 steps            120.00182472320051 m
//   mean step                        0.06250095037666693 m
//   min step                         0.061645873853354564 m
//   max step                         0.06335471825121827 m
//   largest relative deviation       0.013681016339098564 (at step 138)
//   sum minus road length            about 0.000131 m
//   remap step ratio (part b)        2.9999836394771395

import { describe, expect, it } from 'vitest';
import {
  bake,
  createArcLengthTable,
  createCurve,
  evaluateEntity,
  validateScene,
} from '../../src/logic/pathkit.js';
import type { OutBuffer, Scene } from '../../src/logic/pathkit.js';
import {
  BAKE_FPS,
  BAKED_LAP_FRAMES,
  CAR_FORWARD_AXIS,
  CAR_UP_AXIS,
  EASE_AMPLITUDE,
  LAP_FRAMES,
  LAP_SECONDS,
  SUBJECT_ENTITY_ID,
} from '../../src/logic/constants.js';
import { DEFAULT_ROAD_CLOSED, DEFAULT_ROAD_POINTS } from '../../src/logic/default-road.js';
import { remapDisplayedFrame } from '../../src/logic/frame-remap.js';

const MAX_RELATIVE_STEP_DEVIATION = 0.02;
const MAX_SUM_DIFFERENCE_METRES = 0.001;

const roadLength = createArcLengthTable(
  createCurve(DEFAULT_ROAD_POINTS, DEFAULT_ROAD_CLOSED),
).length;

const scene: Scene = {
  fps: BAKE_FPS,
  frameCount: BAKED_LAP_FRAMES,
  path: { points: DEFAULT_ROAD_POINTS.map((p) => ({ ...p })), closed: DEFAULT_ROAD_CLOSED },
  targets: {},
  entities: [
    {
      id: SUBJECT_ENTITY_ID,
      forwardAxis: CAR_FORWARD_AXIS,
      upAxis: CAR_UP_AXIS,
      constraints: [
        {
          type: 'followPath',
          order: 0,
          influence: 1,
          speed: roadLength / LAP_SECONDS,
          startOffset: 0,
          alignToPath: true,
        },
      ],
    },
  ],
};

function makeOut(): OutBuffer {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };
}

// Baked positions copied into plain arrays, read back through evaluateEntity.
function readPositions(baked: ReturnType<typeof bake>): Float64Array {
  const out = makeOut();
  const xyz = new Float64Array(BAKED_LAP_FRAMES * 3);
  for (let i = 0; i < BAKED_LAP_FRAMES; i++) {
    evaluateEntity(baked, SUBJECT_ENTITY_ID, i, out);
    xyz[i * 3] = out.position.x;
    xyz[i * 3 + 1] = out.position.y;
    xyz[i * 3 + 2] = out.position.z;
  }
  return xyz;
}

function dist(xyz: Float64Array, a: number, b: number): number {
  const dx = xyz[a * 3] - xyz[b * 3];
  const dy = xyz[a * 3 + 1] - xyz[b * 3 + 1];
  const dz = xyz[a * 3 + 2] - xyz[b * 3 + 2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

describe('S1: constant spacing and the remap', () => {
  it('the scene is valid and bakes', () => {
    expect(() => validateScene(scene)).not.toThrow();
  });

  it('part (a): measures the spacing of all 1920 baked steps', () => {
    const baked = bake(scene);
    const xyz = readPositions(baked);

    let sum = 0;
    const steps = new Float64Array(BAKED_LAP_FRAMES);
    for (let i = 0; i < BAKED_LAP_FRAMES; i++) {
      // Step i goes from baked frame i to the next one; the last goes from 1919 back to 0.
      const next = (i + 1) % BAKED_LAP_FRAMES;
      const d = dist(xyz, i, next);
      if (!(d > 0)) {
        throw new Error(`S1a: step ${i} must be above 0, got ${d}`);
      }
      steps[i] = d;
      sum += d;
    }
    const mean = sum / BAKED_LAP_FRAMES;

    let maxDev = 0;
    let maxDevIndex = 0;
    let minStep = Infinity;
    let maxStep = -Infinity;
    for (let i = 0; i < BAKED_LAP_FRAMES; i++) {
      const dev = Math.abs(steps[i] - mean) / mean;
      if (dev > maxDev) {
        maxDev = dev;
        maxDevIndex = i;
      }
      if (steps[i] < minStep) minStep = steps[i];
      if (steps[i] > maxStep) maxStep = steps[i];
    }

    // The User pastes these lines at checkpoint 6.2.
    console.log(`S1 road length (m): ${roadLength}`);
    console.log(`S1 sum of all ${BAKED_LAP_FRAMES} steps (m): ${sum}`);
    console.log(`S1 mean step (m): ${mean}`);
    console.log(`S1 min step (m): ${minStep}, max step (m): ${maxStep}`);
    console.log(`S1 largest relative deviation from the mean: ${maxDev} (at step ${maxDevIndex})`);

    expect(
      maxDev,
      `S1a: step ${maxDevIndex} deviates ${maxDev} from the mean, limit ${MAX_RELATIVE_STEP_DEVIATION}`,
    ).toBeLessThanOrEqual(MAX_RELATIVE_STEP_DEVIATION);
    expect(
      Math.abs(sum - roadLength),
      `S1a: sum of steps ${sum} m, road length ${roadLength} m, limit ${MAX_SUM_DIFFERENCE_METRES} m`,
    ).toBeLessThanOrEqual(MAX_SUM_DIFFERENCE_METRES);
  });

  it('part (b): the remap is whole and in range, and the steps ease', () => {
    const baked = bake(scene);
    const xyz = readPositions(baked);

    for (let f = 0; f <= 599; f++) {
      const b = remapDisplayedFrame(f, LAP_FRAMES, BAKED_LAP_FRAMES, EASE_AMPLITUDE);
      if (!Number.isInteger(b) || b < 0 || b > BAKED_LAP_FRAMES - 1) {
        throw new Error(`S1b: displayed frame ${f} remapped to ${b}, not a whole number in 0 to 1919`);
      }
    }

    let minStep = Infinity;
    let maxStep = -Infinity;
    for (let f = 0; f < LAP_FRAMES; f++) {
      const a = remapDisplayedFrame(f, LAP_FRAMES, BAKED_LAP_FRAMES, EASE_AMPLITUDE);
      const b = remapDisplayedFrame(f + 1, LAP_FRAMES, BAKED_LAP_FRAMES, EASE_AMPLITUDE);
      const d = dist(xyz, a, b);
      if (!(d > 0)) {
        throw new Error(`S1b: displayed frames ${f} to ${f + 1} picked baked frames ${a} and ${b}, distance ${d}`);
      }
      if (d < minStep) minStep = d;
      if (d > maxStep) maxStep = d;
    }
    const ratio = maxStep / minStep;
    console.log(`S1 remap step ratio (largest / smallest, displayed frames 0 to 240): ${ratio}`);
    // Hand check: ideal ratio about 3, worst case with rounding 11 / 5 = 2.2. With amplitude 0 it is about 1.
    expect(ratio).toBeGreaterThan(2);
  });
});
