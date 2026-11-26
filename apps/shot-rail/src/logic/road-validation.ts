// Road validation. Pure. Runs before bake, so the user sees one message style.
// Checks point count, flatness (one shared y) and coincident consecutive points,
// so nothing thrown by createCurve needs to be caught for these defects.

import type { Vec3 } from './pathkit.js';
import { ROAD_POINTS_MIN, ROAD_POINTS_MAX } from './constants.js';

export interface Road {
  points: Vec3[];
  closed: true;
}

export type RoadValidation =
  | { ok: true; road: Road }
  | { ok: false; message: string };

function refuse(message: string): RoadValidation {
  return { ok: false, message };
}

/**
 * Validates candidate Road points. Returns `{ ok: true, road }` (a closed Road holding
 * a copy of the points) or `{ ok: false, message }`. Never mutates the input.
 *
 * Refused: fewer than 3 or more than 100 points (message names the count and the range),
 * a non-finite coordinate, points whose y differ, and coincident consecutive points
 * (including last to first, because the Road is closed).
 */
export function validateRoad(points: readonly Vec3[]): RoadValidation {
  const n = points.length;
  if (n < ROAD_POINTS_MIN || n > ROAD_POINTS_MAX) {
    return refuse(
      `The road has ${n} points. It needs ${ROAD_POINTS_MIN} to ${ROAD_POINTS_MAX} points.`,
    );
  }

  for (let i = 0; i < n; i++) {
    const p = points[i];
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      return refuse(`Road point ${i} has a coordinate that is not a finite number.`);
    }
  }

  const y0 = points[0].y;
  for (let i = 1; i < n; i++) {
    if (points[i].y !== y0) {
      return refuse(
        `The road must be flat: point ${i} has y ${points[i].y} but point 0 has y ${y0}.`,
      );
    }
  }

  for (let i = 0; i < n; i++) {
    const a = points[i];
    const j = (i + 1) % n; // the last point is compared with the first
    const b = points[j];
    if (a.x === b.x && a.y === b.y && a.z === b.z) {
      return refuse(`Road points ${i} and ${j} are in the same place. Move one of them.`);
    }
  }

  return { ok: true, road: { points: points.map((p) => ({ x: p.x, y: p.y, z: p.z })), closed: true } };
}
