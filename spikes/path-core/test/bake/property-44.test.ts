import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import { createArcLengthTable } from '../../src/arclength.js';
import { createCurve } from '../../src/curve.js';
import { quatAngle } from '../../src/math.js';
import type { Quat } from '../../src/math.js';
import type { Scene } from '../../src/scene.js';
import { arbValidAxisPair } from '../helpers/basic-generators.js';
import { smoothCurvePoints } from '../helpers/smooth-curve-generator.js';

// Feature: path-core, Property 44: alignToPath orientation changes smoothly
// **Validates: Requirements 6.10**

const ANGLE_SLACK = 0.001;

// Worst angle / bound ratio and run counters over the whole property run.
let worstRatio = 0;
let totalRuns = 0;
let heldRuns = 0;
let notHeldRuns = 0;

describe('Property 44: alignToPath orientation changes smoothly', () => {
  it('rotates by at most 2 * (speed / fps) / rMin + 0.001 radians between consecutive frames when the earlier frame is not held', () => {
    fc.assert(
      fc.property(
        smoothCurvePoints,
        arbValidAxisPair,
        fc.constantFrom(24, 30, 60),
        fc.integer({ min: 10, max: 120 }),
        fc.integer({ min: 0, max: 1000 }), // travel factor step
        fc.integer({ min: 0, max: 1000 }), // start offset step (0 gives offset 0)
        (sample, pair, fps, frameCount, factorStep, offsetStep) => {
          totalRuns++;
          // Expected values come from the test's own curve and table, not from bake.ts.
          const pathLength = createArcLengthTable(createCurve(sample.points, false)).length;
          const factor = 0.3 + (factorStep / 1000) * 2.7; // travel over the range is 0.3x to 3x the path length
          const speed = (factor * pathLength * fps) / frameCount;
          const startOffset = (offsetStep / 1000) * (pathLength / 2);
          const label = `run ${totalRuns} (${pair[0]}/${pair[1]}, fps ${fps}, frames ${frameCount}, speed ${speed})`;

          const scene: Scene = {
            fps,
            frameCount,
            path: { points: sample.points, closed: false },
            targets: {},
            entities: [
              {
                id: 'subject',
                forwardAxis: pair[0],
                upAxis: pair[1],
                constraints: [{ type: 'followPath', order: 0, influence: 1, speed, startOffset, alignToPath: true }],
              },
            ],
          };
          const baked = bake(scene);
          const transforms = baked.transforms[0];

          // The held frame computed in the test: first frame whose unclamped distance reaches the length.
          let ownHeld = -1;
          for (let f = 0; f < frameCount; f++) {
            if (startOffset + (speed * f) / fps >= pathLength) {
              ownHeld = f;
              break;
            }
          }
          const heldFrom = baked.heldFromFrame[0];
          if (heldFrom !== ownHeld) {
            throw new Error(`${label}: baked heldFromFrame is ${heldFrom}, test computes ${ownHeld}`);
          }
          if (ownHeld >= 0) heldRuns++;
          else notHeldRuns++;

          const bound = (2 * (speed / fps)) / sample.rMin + ANGLE_SLACK;
          const prev: Quat = { x: 0, y: 0, z: 0, w: 1 };
          const next: Quat = { x: 0, y: 0, z: 0, w: 1 };
          for (let f = 1; f < frameCount; f++) {
            if (ownHeld >= 0 && f - 1 >= ownHeld) break; // frame f-1 is held, so is every later one
            const a = (f - 1) * 7;
            const b = f * 7;
            prev.x = transforms[a + 3];
            prev.y = transforms[a + 4];
            prev.z = transforms[a + 5];
            prev.w = transforms[a + 6];
            next.x = transforms[b + 3];
            next.y = transforms[b + 4];
            next.z = transforms[b + 5];
            next.w = transforms[b + 6];
            const angle = quatAngle(prev, next);
            const ratio = angle / bound;
            if (ratio > worstRatio) worstRatio = ratio;
            if (!(angle <= bound)) {
              throw new Error(
                `${label}: frames ${f - 1} -> ${f} rotate by ${angle} rad, bound is ${bound} (rMin ${sample.rMin})`,
              );
            }
          }
        },
      ),
      { numRuns: 100 },
    );
    console.log(
      `Property 44 worst angle/bound ratio: ${worstRatio.toFixed(4)} over ${totalRuns} runs (${heldRuns} runs reached the path end)`,
    );
    expect(heldRuns).toBeGreaterThan(0);
    expect(notHeldRuns).toBeGreaterThan(0);
  });
});
