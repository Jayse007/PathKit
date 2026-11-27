// Pure helpers for the Stage_Overview (task 31.1). No Three.js and no DOM, so a test can import this file.
//
// Both functions allocate. They run when the layout changes (a re-bake), never per frame.

import type { Vec3 } from '../logic/pathkit.js';

/** A rectangle on the ground plane (X and Z), given by its centre and half sizes in metres. */
export interface TopDownFraming {
  centreX: number;
  centreZ: number;
  halfWidth: number;
  halfHeight: number;
}

interface GroundPoint {
  x: number;
  z: number;
}

/**
 * The smallest rectangle with the given aspect (width / height) that holds every point, grown by
 * `marginFraction` on each side, and never smaller than `minHalfHeight` high (half). The rectangle is
 * centred on the middle of the points' bounding box. With no points it is centred on the origin.
 * Throws an Error when a coordinate is not a finite number, or when aspect or minHalfHeight is not above 0.
 */
export function computeTopDownFraming(
  points: readonly GroundPoint[],
  aspect: number,
  marginFraction: number,
  minHalfHeight: number,
): TopDownFraming {
  if (!(aspect > 0) || !Number.isFinite(aspect)) {
    throw new Error(`computeTopDownFraming: aspect must be a number above 0, got ${String(aspect)}`);
  }
  if (!(minHalfHeight > 0) || !Number.isFinite(minHalfHeight)) {
    throw new Error(`computeTopDownFraming: minHalfHeight must be a number above 0, got ${String(minHalfHeight)}`);
  }
  if (!(marginFraction >= 0) || !Number.isFinite(marginFraction)) {
    throw new Error(`computeTopDownFraming: marginFraction must be 0 or more, got ${String(marginFraction)}`);
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) {
      throw new Error(`computeTopDownFraming: point ${i} is not finite (x ${String(p.x)}, z ${String(p.z)})`);
    }
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  if (points.length === 0) {
    minX = 0;
    maxX = 0;
    minZ = 0;
    maxZ = 0;
  }

  const grow = 1 + marginFraction;
  const halfWidthNeeded = ((maxX - minX) / 2) * grow;
  const halfHeightNeeded = ((maxZ - minZ) / 2) * grow;
  const halfWidth = Math.max(halfWidthNeeded, halfHeightNeeded * aspect, minHalfHeight * aspect);
  return {
    centreX: (minX + maxX) / 2,
    centreZ: (minZ + maxZ) / 2,
    halfWidth,
    halfHeight: halfWidth / aspect,
  };
}

/**
 * The end of a straight rail, from the camera's position at the first and last displayed frame of the shot.
 * A rail camera moves at constant speed and covers (N - 1) / N of the rail by its last frame (design: shot
 * builders, rail speed = length x FRAME_RATE / shot length), so the rail end is the first position plus
 * (last - first) x N / (N - 1). Writes into `out` and returns it. When `shotLengthFrames` is below 2 the
 * last position is returned unchanged (there is no movement to extend).
 */
export function extendRailEnd(first: Vec3, last: Vec3, shotLengthFrames: number, out: Vec3): Vec3 {
  const scale = shotLengthFrames >= 2 ? shotLengthFrames / (shotLengthFrames - 1) : 1;
  out.x = first.x + (last.x - first.x) * scale;
  out.y = first.y + (last.y - first.y) * scale;
  out.z = first.z + (last.z - first.z) * scale;
  return out;
}
