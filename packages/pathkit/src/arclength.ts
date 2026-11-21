// Arc-length table: maps a distance in metres to a curve parameter t in [0, 1].
//
// The table always has exactly 1024 entries in total (including t = 0), at
// t_i = i / 1023. Lookups use monotone cubic Hermite interpolation of t as a
// function of distance s.
//
// Accuracy note: for paths with more than about 100 points the fixed
// 1024-entry table leaves fewer than about 10 samples per segment, so length
// and position accuracy degrades.
import type { Vec3 } from './math.js';
import type { Curve } from './curve.js';

export interface ArcLengthTable {
  readonly length: number; // metres
  readonly entryCount: number; // always 1024, counts the entry for t = 0
  pointAtDistance(d: number, out: Vec3): Vec3;
  tangentAtDistance(d: number, out: Vec3): Vec3;
  parameterAtDistance(d: number): number;
}

const ENTRY_COUNT = 1024;

/**
 * Builds the table once (setup code). Entry i holds the parameter
 * t_i = i / 1023 and the cumulative chord length up to it, so there are 1023
 * chord intervals. Node slopes dt/ds for the Hermite lookup are computed here
 * (Fritsch-Butland weighted harmonic mean, then the standard limiter).
 */
export function createArcLengthTable(curve: Curve): ArcLengthTable {
  const entryCount = ENTRY_COUNT;
  const last = entryCount - 1;
  const params = new Float64Array(entryCount);
  const dists = new Float64Array(entryCount);
  const slopes = new Float64Array(entryCount);

  const prev: Vec3 = { x: 0, y: 0, z: 0 };
  const cur: Vec3 = { x: 0, y: 0, z: 0 };
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

  // Secant slopes per interval. A zero-length interval gets secant 0, which
  // makes both of its neighbouring node slopes 0 below (never NaN/Infinity).
  const secants = new Float64Array(last);
  for (let k = 0; k < last; k++) {
    const h = dists[k + 1] - dists[k];
    secants[k] = h > 0 ? (params[k + 1] - params[k]) / h : 0;
  }
  slopes[0] = secants[0];
  slopes[last] = secants[last - 1];
  for (let k = 1; k < last; k++) {
    const dPrev = secants[k - 1];
    const dNext = secants[k];
    if (dPrev > 0 && dNext > 0) {
      const hPrev = dists[k] - dists[k - 1];
      const hNext = dists[k + 1] - dists[k];
      const w1 = 2 * hNext + hPrev;
      const w2 = hNext + 2 * hPrev;
      slopes[k] = (w1 + w2) / (w1 / dPrev + w2 / dNext);
    } else {
      slopes[k] = 0;
    }
  }
  // Limit so (mA/delta)^2 + (mB/delta)^2 <= 9. Scaling only shrinks slopes, so
  // intervals already processed stay within the limit.
  for (let k = 0; k < last; k++) {
    const delta = secants[k];
    if (!(delta > 0)) continue;
    const a = slopes[k] / delta;
    const b = slopes[k + 1] / delta;
    const sum = a * a + b * b;
    if (sum > 9) {
      const tau = 3 / Math.sqrt(sum);
      slopes[k] *= tau;
      slopes[k + 1] *= tau;
    }
  }

  const parameterAtDistance = (d: number): number => {
    let dist = d;
    if (closed) {
      if (length > 0) {
        dist = d - length * Math.floor(d / length);
        if (!(dist >= 0) || dist >= length) dist = 0;
      } else {
        dist = 0;
      }
    } else {
      if (!(dist > 0)) return 0;
      if (dist >= length) return 1;
    }
    if (dist === 0) return 0;

    // Find the largest index lo with dists[lo] <= dist, lo in [0, last - 1].
    let lo = 0;
    let hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (dists[mid] <= dist) lo = mid;
      else hi = mid;
    }
    const d0 = dists[lo];
    const h = dists[lo + 1] - d0;
    const y0 = params[lo];
    if (!(h > 0)) return y0;
    const y1 = params[lo + 1];
    const u = (dist - d0) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    const t =
      (2 * u3 - 3 * u2 + 1) * y0 +
      (u3 - 2 * u2 + u) * h * slopes[lo] +
      (-2 * u3 + 3 * u2) * y1 +
      (u3 - u2) * h * slopes[lo + 1];
    if (t < y0) return y0;
    if (t > y1) return y1;
    return t;
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
