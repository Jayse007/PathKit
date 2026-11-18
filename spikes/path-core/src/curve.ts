import type { Vec3 } from './math';
import { length, sub } from './math';

export interface Curve {
  readonly closed: boolean;
  readonly pointCount: number;
  pointAt(t: number, out?: Vec3): Vec3;
  /** Unit-length tangent. */
  tangentAt(t: number, out?: Vec3): Vec3;
}

// Per-segment data layout in the Float64Array: 12 values per segment.
// [p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, m1.x, m1.y, m1.z, m2.x, m2.y, m2.z]
// Each segment is a cubic Hermite curve in local parameter u in [0, 1]. The
// tangents m1 and m2 come from the non-uniform (centripetal) Catmull-Rom
// formulation, scaled to the segment's knot interval.
const STRIDE = 12;

/**
 * Creates a centripetal Catmull-Rom curve through the points.
 * Open curves use reflected phantom end points; closed curves wrap indices.
 * The input points are copied, never retained or mutated.
 */
export function createCurve(points: readonly Vec3[], closed: boolean): Curve {
  const n = points.length;
  if (n < 2) {
    throw new Error(`Curve needs at least 2 points, got ${n}`);
  }
  if (closed && n < 3) {
    throw new Error(`Closed curve needs at least 3 points, got ${n}`);
  }
  for (let i = 0; i < n - 1; i++) {
    if (sameSpot(points[i], points[i + 1])) {
      throw new Error(`Coincident points at indexes ${i} and ${i + 1}`);
    }
  }
  if (closed && sameSpot(points[n - 1], points[0])) {
    throw new Error(`Coincident points at indexes ${n - 1} and 0`);
  }

  const segmentCount = closed ? n : n - 1;
  const data = new Float64Array(segmentCount * STRIDE);

  const pts: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    pts.push({ x: points[i].x, y: points[i].y, z: points[i].z });
  }

  const ctrl = (idx: number): Vec3 => {
    if (closed) return pts[((idx % n) + n) % n];
    if (idx < 0) {
      // reflected phantom point: 2*P0 - P1
      return { x: 2 * pts[0].x - pts[1].x, y: 2 * pts[0].y - pts[1].y, z: 2 * pts[0].z - pts[1].z };
    }
    if (idx > n - 1) {
      return {
        x: 2 * pts[n - 1].x - pts[n - 2].x,
        y: 2 * pts[n - 1].y - pts[n - 2].y,
        z: 2 * pts[n - 1].z - pts[n - 2].z,
      };
    }
    return pts[idx];
  };

  const knot = (a: Vec3, b: Vec3): number => Math.sqrt(length(sub(b, a)));

  for (let s = 0; s < segmentCount; s++) {
    const p0 = ctrl(s - 1);
    const p1 = ctrl(s);
    const p2 = ctrl(s + 1);
    const p3 = ctrl(s + 2);
    const d01 = knot(p0, p1);
    const d12 = knot(p1, p2);
    const d23 = knot(p2, p3);
    const d02 = d01 + d12;
    const d13 = d12 + d23;
    const base = s * STRIDE;
    const comps: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
    for (let c = 0; c < 3; c++) {
      const k = comps[c];
      const a0 = p0[k], a1 = p1[k], a2 = p2[k], a3 = p3[k];
      const m1 = d12 * ((a1 - a0) / d01 - (a2 - a0) / d02 + (a2 - a1) / d12);
      const m2 = d12 * ((a2 - a1) / d12 - (a3 - a1) / d13 + (a3 - a2) / d23);
      data[base + c] = a1;
      data[base + 3 + c] = a2;
      data[base + 6 + c] = m1;
      data[base + 9 + c] = m2;
    }
  }

  // Resolves t to a segment base offset (stored in scratch) and local u.
  let scratchBase = 0;
  let scratchU = 0;
  const locate = (tIn: number): void => {
    let t = tIn;
    if (closed) {
      t = t - Math.floor(t);
    } else if (t < 0) {
      t = 0;
    } else if (t > 1) {
      t = 1;
    }
    const sc = t * segmentCount;
    let i = Math.floor(sc);
    if (i >= segmentCount) i = segmentCount - 1;
    if (i < 0) i = 0;
    let u = sc - i;
    if (u < 0) u = 0;
    if (u > 1) u = 1;
    scratchBase = i * STRIDE;
    scratchU = u;
  };

  return {
    closed,
    pointCount: n,
    pointAt(t: number, out?: Vec3): Vec3 {
      locate(t);
      const b = scratchBase;
      const u = scratchU;
      const u2 = u * u;
      const u3 = u2 * u;
      const h00 = 2 * u3 - 3 * u2 + 1;
      const h10 = u3 - 2 * u2 + u;
      const h01 = -2 * u3 + 3 * u2;
      const h11 = u3 - u2;
      const r = out ?? { x: 0, y: 0, z: 0 };
      r.x = h00 * data[b] + h01 * data[b + 3] + h10 * data[b + 6] + h11 * data[b + 9];
      r.y = h00 * data[b + 1] + h01 * data[b + 4] + h10 * data[b + 7] + h11 * data[b + 10];
      r.z = h00 * data[b + 2] + h01 * data[b + 5] + h10 * data[b + 8] + h11 * data[b + 11];
      return r;
    },
    tangentAt(t: number, out?: Vec3): Vec3 {
      locate(t);
      const b = scratchBase;
      const u = scratchU;
      const u2 = u * u;
      const d00 = 6 * u2 - 6 * u;
      const d10 = 3 * u2 - 4 * u + 1;
      const d01 = -6 * u2 + 6 * u;
      const d11 = 3 * u2 - 2 * u;
      let x = d00 * data[b] + d01 * data[b + 3] + d10 * data[b + 6] + d11 * data[b + 9];
      let y = d00 * data[b + 1] + d01 * data[b + 4] + d10 * data[b + 7] + d11 * data[b + 10];
      let z = d00 * data[b + 2] + d01 * data[b + 5] + d10 * data[b + 8] + d11 * data[b + 11];
      let len = Math.sqrt(x * x + y * y + z * z);
      if (!(len >= 1e-12)) {
        // Chord direction of the segment.
        x = data[b + 3] - data[b];
        y = data[b + 4] - data[b + 1];
        z = data[b + 5] - data[b + 2];
        len = Math.sqrt(x * x + y * y + z * z);
      }
      const r = out ?? { x: 0, y: 0, z: 0 };
      if (len > 0) {
        const inv = 1 / len;
        r.x = x * inv; r.y = y * inv; r.z = z * inv;
      } else {
        r.x = 0; r.y = 0; r.z = 0;
      }
      return r;
    },
  };
}

function sameSpot(a: Vec3, b: Vec3): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}
