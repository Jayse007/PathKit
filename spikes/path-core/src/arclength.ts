// Arc-length table: maps a distance in metres to a curve parameter t in [0, 1].
//
// Accuracy note: the table has min(1024, max(2, 64 * segmentCount)) entries.
// For paths with more than about 100 points the 1024-entry cap leaves fewer
// than about 10 samples per segment, so length accuracy degrades.
import type { Vec3 } from './math.js';
import type { Curve } from './curve.js';

export interface ArcLengthTable {
  readonly length: number; // metres
  readonly entryCount: number; // <= 1024, counts the entry for t = 0
  pointAtDistance(d: number, out: Vec3): Vec3;
  tangentAtDistance(d: number, out: Vec3): Vec3;
  parameterAtDistance(d: number): number;
}

const MAX_ENTRIES = 1024;

/**
 * Builds the table once (setup code). Entry i holds the parameter
 * t_i = i / (entryCount - 1) and the cumulative chord length up to it.
 * entryCount = min(1024, max(2, 64 * segmentCount)) in total, so there are
 * entryCount - 1 chord intervals.
 */
export function createArcLengthTable(curve: Curve): ArcLengthTable {
  const segmentCount = curve.closed ? curve.pointCount : curve.pointCount - 1;
  const entryCount = Math.min(MAX_ENTRIES, Math.max(2, 64 * segmentCount));
  const params = new Float64Array(entryCount);
  const dists = new Float64Array(entryCount);

  const prev: Vec3 = { x: 0, y: 0, z: 0 };
  const cur: Vec3 = { x: 0, y: 0, z: 0 };
  const last = entryCount - 1;
  curve.pointAt(0, prev);
  params[0] = 0;
  dists[0] = 0;
  let total = 0;
  for (let i = 1; i < entryCount; i++) {
    const t = i === last ? 1 : i / last;
    curve.pointAt(t, cur);
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    const dz = cur.z - prev.z;
    total += Math.sqrt(dx * dx + dy * dy + dz * dz);
    params[i] = t;
    dists[i] = total;
    prev.x = cur.x;
    prev.y = cur.y;
    prev.z = cur.z;
  }
  const length = total;
  const closed = curve.closed;

  const parameterAtDistance = (d: number): number => {
    let dist = d;
    if (closed) {
      if (length > 0) {
        dist = d - length * Math.floor(d / length);
        if (dist >= length) dist = 0;
        if (dist < 0) dist = 0;
      } else {
        dist = 0;
      }
    } else if (dist < 0 || !(dist === dist)) {
      dist = 0;
    } else if (dist > length) {
      dist = length;
    }

    // Find the largest index lo with dists[lo] <= dist, lo in [0, last - 1].
    let lo = 0;
    let hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (dists[mid] <= dist) lo = mid;
      else hi = mid;
    }
    const d0 = dists[lo];
    const span = dists[lo + 1] - d0;
    if (!(span > 0)) return params[lo];
    const f = (dist - d0) / span;
    return params[lo] + f * (params[lo + 1] - params[lo]);
  };

  return {
    length,
    entryCount,
    parameterAtDistance,
    pointAtDistance(d: number, out: Vec3): Vec3 {
      return curve.pointAt(parameterAtDistance(d), out);
    },
    tangentAtDistance(d: number, out: Vec3): Vec3 {
      return curve.tangentAt(parameterAtDistance(d), out);
    },
  };
}
