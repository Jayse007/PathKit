/**
 * Part path points. Pure: no state. Setup-time code (allocation is allowed here).
 * Four points for a Catmull-Rom curve from a Part's rest position along its explode vector,
 * bowed sideways so the path is not a straight line.
 */

import { PART_MIN_EXPLODE_M, PART_PATH_BOW_FRACTION, PART_PATH_VERTICAL_SIN } from '../constants.js';

export type Point3 = readonly [number, number, number];

function assertFinite3(p: Point3, name: string): void {
  for (let i = 0; i < 3; i++) {
    if (!Number.isFinite(p[i])) {
      throw new Error(`partPathPoints: ${name} must be finite, got ${String(p[i])} at index ${i}`);
    }
  }
}

/** Unit vector perpendicular to the unit vector n, closest to the reference axis (rx, ry, rz). */
function perpendicularNear(n: Point3, ref: Point3): Point3 {
  const d = n[0] * ref[0] + n[1] * ref[1] + n[2] * ref[2];
  const x = ref[0] - d * n[0];
  const y = ref[1] - d * n[1];
  const z = ref[2] - d * n[2];
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
}

/**
 * Return [P0, P1, P2, P3] for rest position p0 and explode vector v.
 * P1 = P0 + v/3 + b, P2 = P0 + 2v/3 + b, P3 = P0 + v, b = 0.15 * |v| * u.
 * u is the perpendicular to v closest to +Y, or closest to +Z when v is nearly vertical.
 * Throws if any input is not finite or |v| is below PART_MIN_EXPLODE_M.
 */
export function partPathPoints(p0: Point3, v: Point3): readonly [Point3, Point3, Point3, Point3] {
  assertFinite3(p0, 'rest position');
  assertFinite3(v, 'explode vector');
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len < PART_MIN_EXPLODE_M) {
    throw new Error(
      `partPathPoints: explode vector length ${String(len)} m is below the minimum ${String(PART_MIN_EXPLODE_M)} m`,
    );
  }
  const n: Point3 = [v[0] / len, v[1] / len, v[2] / len];
  // |unit(v) x Y| = hypot(n.x, n.z)
  const sinToY = Math.hypot(n[0], n[2]);
  const ref: Point3 = sinToY < PART_PATH_VERTICAL_SIN ? [0, 0, 1] : [0, 1, 0];
  const u = perpendicularNear(n, ref);
  const bowLen = PART_PATH_BOW_FRACTION * len;
  const bx = bowLen * u[0];
  const by = bowLen * u[1];
  const bz = bowLen * u[2];
  return [
    [p0[0], p0[1], p0[2]],
    [p0[0] + v[0] / 3 + bx, p0[1] + v[1] / 3 + by, p0[2] + v[2] / 3 + bz],
    [p0[0] + (2 * v[0]) / 3 + bx, p0[1] + (2 * v[1]) / 3 + by, p0[2] + (2 * v[2]) / 3 + bz],
    [p0[0] + v[0], p0[1] + v[1], p0[2] + v[2]],
  ];
}
