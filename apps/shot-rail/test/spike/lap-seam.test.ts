// Lap seam check (KI-11 regression, design Property 13).
// The subject's rotation at the last baked frame (1919) must be close to its rotation at
// baked frame 0 on the flat default Road, otherwise the car snaps once per lap.
// Part (a): the default Road stays under 2 degrees.
// Part (b): a hand-written twisted 3D figure-eight, baked directly with bake (Road
// validation bypassed, test only), shows more than 40 degrees. This proves the check can see a snap.

import { describe, expect, it } from 'vitest';
import {
  bake,
  createArcLengthTable,
  createCurve,
  evaluateEntity,
  quatAngle,
  quatInverse,
  quatMul,
} from '../../src/logic/pathkit.js';
import type { OutBuffer, Quat, Scene, Vec3 } from '../../src/logic/pathkit.js';
import {
  BAKE_FPS,
  BAKED_LAP_FRAMES,
  CAR_FORWARD_AXIS,
  CAR_UP_AXIS,
  LAP_SECONDS,
  SUBJECT_ENTITY_ID,
} from '../../src/logic/constants.js';
import { DEFAULT_ROAD_CLOSED, DEFAULT_ROAD_POINTS } from '../../src/logic/default-road.js';

// Limits from the task text (the User agreed them with the spec).
const MAX_SEAM_DEG_FLAT = 2;
const MIN_SEAM_DEG_TWISTED = 40;
const DEG_PER_RAD = 180 / Math.PI;

const LAST_FRAME = BAKED_LAP_FRAMES - 1;

// A 3D figure-eight: x = 20 sin t, y = 8 cos t, z = 10 sin 2t, sampled every 30 degrees of t.
// y differs between points (+8 to -8), so the loop is not flat and not planar.
// Values are written out by hand (rounded to 2 decimals); they are input data, not expected results.
const TWISTED_FIGURE_EIGHT: readonly Vec3[] = [
  { x: 0, y: 8, z: 0 },
  { x: 10, y: 6.93, z: 8.66 },
  { x: 17.32, y: 4, z: 8.66 },
  { x: 20, y: 0, z: 0 },
  { x: 17.32, y: -4, z: -8.66 },
  { x: 10, y: -6.93, z: -8.66 },
  { x: 0, y: -8, z: 0 },
  { x: -10, y: -6.93, z: 8.66 },
  { x: -17.32, y: -4, z: 8.66 },
  { x: -20, y: 0, z: 0 },
  { x: -17.32, y: 4, z: -8.66 },
  { x: -10, y: 6.93, z: -8.66 },
];

const IDENTITY: Quat = { x: 0, y: 0, z: 0, w: 1 };

function makeOut(): OutBuffer {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };
}

// One-lap scene for the subject on a closed path, built as in S1.
function lapScene(points: readonly Vec3[]): Scene {
  const length = createArcLengthTable(createCurve(points, true)).length;
  return {
    fps: BAKE_FPS,
    frameCount: BAKED_LAP_FRAMES,
    path: { points: points.map((p) => ({ ...p })), closed: DEFAULT_ROAD_CLOSED },
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
            speed: length / LAP_SECONDS,
            startOffset: 0,
            alignToPath: true,
          },
        ],
      },
    ],
  };
}

// Angle in degrees of the rotation quatInverse(a) * b, between baked frame 1919 and baked frame 0.
function seamAngleDeg(points: readonly Vec3[]): number {
  const baked = bake(lapScene(points));
  const out = makeOut();
  evaluateEntity(baked, SUBJECT_ENTITY_ID, LAST_FRAME, out);
  const a: Quat = { ...out.rotation };
  evaluateEntity(baked, SUBJECT_ENTITY_ID, 0, out);
  const b: Quat = { ...out.rotation };
  const relative = quatMul(quatInverse(a), b);
  return quatAngle(IDENTITY, relative) * DEG_PER_RAD;
}

describe('lap seam (KI-11)', () => {
  it('part (a): default Road, frame 1919 to frame 0 is at most 2 degrees', () => {
    const deg = seamAngleDeg(DEFAULT_ROAD_POINTS);
    console.log(`Lap seam, default Road (degrees): ${deg}`);
    expect(
      deg,
      `seam (a): default Road seam ${deg} degrees, limit ${MAX_SEAM_DEG_FLAT}`,
    ).toBeLessThanOrEqual(MAX_SEAM_DEG_FLAT);
  });

  it('part (b): twisted 3D figure-eight, frame 1919 to frame 0 is above 40 degrees', () => {
    const ys = new Set(TWISTED_FIGURE_EIGHT.map((p) => p.y));
    if (TWISTED_FIGURE_EIGHT.length < 8 || ys.size < 2) {
      throw new Error(`seam (b): the loop needs at least 8 points with different y, got ${TWISTED_FIGURE_EIGHT.length} points, ${ys.size} distinct y`);
    }
    const deg = seamAngleDeg(TWISTED_FIGURE_EIGHT);
    console.log(`Lap seam, twisted figure-eight (degrees): ${deg}`);
    expect(
      deg,
      `seam (b): twisted loop seam ${deg} degrees, must be above ${MIN_SEAM_DEG_TWISTED}`,
    ).toBeGreaterThan(MIN_SEAM_DEG_TWISTED);
  });
});
