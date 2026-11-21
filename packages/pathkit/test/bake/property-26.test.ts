import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import { createArcLengthTable } from '../../src/arclength.js';
import type { ArcLengthTable } from '../../src/arclength.js';
import { createCurve } from '../../src/curve.js';
import { rotationMinimizingFrames } from '../../src/frames.js';
import type { Frame } from '../../src/frames.js';
import { cross, dot, length, normalize, rotateVec } from '../../src/math.js';
import type { Quat, Vec3 } from '../../src/math.js';
import { axisVector } from '../../src/scene.js';
import type { AxisToken, Constraint, Scene } from '../../src/scene.js';
import { VALID_AXIS_PAIRS, arbValidAxisPair, coord } from '../helpers/basic-generators.js';
import { smoothCurvePoints } from '../helpers/smooth-curve-generator.js';

// Feature: path-core, Property 26: alignToPath rotates the entity axes onto the path frame
// **Validates: Requirements 6.2, 6.3**

const FORWARD_TOLERANCE = 1e-4;
const PERP_TOLERANCE = 1e-6;
const NORMAL_TOLERANCE = 1e-2;
const PROPER_TOLERANCE = 1e-6;
const DENSE_INTERVALS = 4096;

/** Path data built in the test, independent of bake.ts. The dense RMF is built once per context. */
interface PathContext {
  readonly points: Vec3[];
  readonly table: ArcLengthTable;
  readonly dense: Frame[];
  readonly length: number;
}

function contextOf(points: Vec3[]): PathContext {
  const curve = createCurve(points, false);
  const table = createArcLengthTable(curve);
  return { points, table, dense: rotationMinimizingFrames(curve, DENSE_INTERVALS + 1), length: table.length };
}

function sceneOf(
  points: Vec3[],
  forwardAxis: AxisToken,
  upAxis: AxisToken,
  fps: number,
  frameCount: number,
  constraints: Constraint[],
  targets: Scene['targets'] = {},
): Scene {
  return {
    fps,
    frameCount,
    path: { points, closed: false },
    targets,
    entities: [{ id: 'subject', forwardAxis, upAxis, constraints }],
  };
}

function distOf(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Bakes a single-followPath scene with alignToPath true and checks every frame:
 * forward onto the tangent, up perpendicular to it and near the dense RMF normal,
 * and a proper (non-mirror) rotation. Throws on the first miss.
 */
function checkAlignment(
  label: string,
  ctx: PathContext,
  forwardAxis: AxisToken,
  upAxis: AxisToken,
  fps: number,
  frameCount: number,
  speed: number,
  startOffset: number,
): void {
  const scene = sceneOf(ctx.points, forwardAxis, upAxis, fps, frameCount, [
    { type: 'followPath', order: 0, influence: 1, speed, startOffset, alignToPath: true },
  ]);
  const transforms = bake(scene).transforms[0];

  const f = axisVector(forwardAxis, { x: 0, y: 0, z: 0 });
  const u = axisVector(upAxis, { x: 0, y: 0, z: 0 });
  const r = cross(f, u);
  const q: Quat = { x: 0, y: 0, z: 0, w: 1 };
  const tangent: Vec3 = { x: 0, y: 0, z: 0 };
  const rf: Vec3 = { x: 0, y: 0, z: 0 };
  const ru: Vec3 = { x: 0, y: 0, z: 0 };
  const rr: Vec3 = { x: 0, y: 0, z: 0 };

  for (let frame = 0; frame < frameCount; frame++) {
    const raw = startOffset + (speed * frame) / fps;
    const d = Math.min(Math.max(raw, 0), ctx.length);
    ctx.table.tangentAtDistance(d, tangent);
    normalize(tangent, tangent);
    const t = ctx.table.parameterAtDistance(d);
    const normal = ctx.dense[Math.round(t * DENSE_INTERVALS)].normal;

    const i = frame * 7;
    q.x = transforms[i + 3];
    q.y = transforms[i + 4];
    q.z = transforms[i + 5];
    q.w = transforms[i + 6];
    rotateVec(q, f, rf);
    rotateVec(q, u, ru);
    rotateVec(q, r, rr);

    const forwardError = distOf(rf, tangent);
    if (!(forwardError <= FORWARD_TOLERANCE)) {
      throw new Error(
        `${label}: frame ${frame} (${forwardAxis}/${upAxis}) rotated forward is off the tangent by ${forwardError}`,
      );
    }
    const perp = dot(ru, tangent);
    if (!(Math.abs(perp) <= PERP_TOLERANCE)) {
      throw new Error(
        `${label}: frame ${frame} (${forwardAxis}/${upAxis}) rotated up . tangent = ${perp}, expected 0`,
      );
    }
    const normalError = distOf(ru, normal);
    if (!(normalError <= NORMAL_TOLERANCE)) {
      throw new Error(
        `${label}: frame ${frame} (${forwardAxis}/${upAxis}) rotated up is ${normalError} from the dense RMF normal`,
      );
    }
    const third = cross(rf, ru);
    const properError = distOf(third, rr);
    if (!(properError <= PROPER_TOLERANCE)) {
      throw new Error(
        `${label}: frame ${frame} (${forwardAxis}/${upAxis}) rotated forward x rotated up is ${properError} from the rotated third axis (mirror?)`,
      );
    }
  }
}

describe('Property 26: alignToPath rotates the entity axes onto the path frame', () => {
  it('aligns forward to the tangent and up to the RMF normal for any valid axis pair on smooth open paths', () => {
    let runs = 0;
    fc.assert(
      fc.property(
        smoothCurvePoints,
        arbValidAxisPair,
        fc.integer({ min: 12, max: 60 }),
        fc.integer({ min: 5, max: 40 }),
        coord(0.5, 50),
        fc.integer({ min: 0, max: 1000 }),
        (sample, pair, fps, frameCount, speed, offsetStep) => {
          runs++;
          const ctx = contextOf(sample.points); // dense RMF built once per run
          const startOffset = (offsetStep / 1000) * (ctx.length / 2);
          checkAlignment(`run ${runs}`, ctx, pair[0], pair[1], fps, frameCount, speed, startOffset);
        },
      ),
      { numRuns: 100 },
    );
    expect(runs).toBeGreaterThanOrEqual(100);
  });

  it('holds for all 24 valid axis pairs on one fixed open path', () => {
    const ctx = contextOf([
      { x: 0, y: 0, z: 0 },
      { x: 5, y: 1, z: 0 },
      { x: 10, y: 0, z: 2 },
      { x: 15, y: -1, z: 4 },
      { x: 20, y: 0, z: 5 },
    ]);
    expect(VALID_AXIS_PAIRS.length).toBe(24);
    for (const [forwardAxis, upAxis] of VALID_AXIS_PAIRS) {
      // 60 frames at 10 m/s and 24 fps travel 24.6 m, which passes the end (clamped frames included).
      checkAlignment('fixed path', ctx, forwardAxis, upAxis, 24, 60, 10, 0);
      checkAlignment('fixed path, offset', ctx, forwardAxis, upAxis, 24, 30, 3, ctx.length / 2);
    }
  });

  it('leaves the rotation of an earlier aimAt unchanged when alignToPath is false or omitted', () => {
    const points: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 6, y: 2, z: 1 },
      { x: 12, y: 0, z: 5 },
      { x: 18, y: -2, z: 6 },
    ];
    let runs = 0;
    let nonIdentity = 0;
    fc.assert(
      fc.property(
        arbValidAxisPair,
        fc.record({ x: coord(-20, 20), y: coord(-20, 20), z: coord(-20, 20) }).filter((v) => length(v) >= 1),
        fc.integer({ min: 5, max: 40 }),
        coord(0.5, 30),
        (pair, target, frameCount, speed) => {
          runs++;
          const aim: Constraint = { type: 'aimAt', order: 0, influence: 1, target: 'goal' };
          const targets = { goal: target };
          const only = bake(sceneOf(points, pair[0], pair[1], 24, frameCount, [aim], targets)).transforms[0];
          const variants: [string, Constraint][] = [
            ['alignToPath false', { type: 'followPath', order: 1, influence: 1, speed, startOffset: 0, alignToPath: false }],
            ['alignToPath omitted', { type: 'followPath', order: 1, influence: 1, speed, startOffset: 0 }],
          ];
          for (const [name, follow] of variants) {
            const both = bake(sceneOf(points, pair[0], pair[1], 24, frameCount, [aim, follow], targets)).transforms[0];
            for (let frame = 0; frame < frameCount; frame++) {
              for (let k = 3; k < 7; k++) {
                const i = frame * 7 + k;
                if (both[i] !== only[i]) {
                  throw new Error(
                    `run ${runs}: ${name}: frame ${frame} rotation component ${k - 3} is ${both[i]}, aimAt-only gives ${only[i]}`,
                  );
                }
              }
            }
          }
          for (let frame = 0; frame < frameCount; frame++) {
            const i = frame * 7;
            if (only[i + 3] !== 0 || only[i + 4] !== 0 || only[i + 5] !== 0) nonIdentity++;
          }
        },
      ),
      { numRuns: 200 },
    );
    expect(runs).toBeGreaterThanOrEqual(200);
    // The prior rotation is real, so "unchanged" is not just identity equals identity.
    expect(nonIdentity).toBeGreaterThan(0);
  });
});
