export interface Vec3 { x: number; y: number; z: number }
export interface Quat { x: number; y: number; z: number; w: number }

// Every function reads all of its inputs into locals before writing to `out`,
// so `out` may alias any input. Inputs are never mutated.

export function add(a: Vec3, b: Vec3, out?: Vec3): Vec3 {
  const x = a.x + b.x;
  const y = a.y + b.y;
  const z = a.z + b.z;
  const r = out ?? { x: 0, y: 0, z: 0 };
  r.x = x; r.y = y; r.z = z;
  return r;
}

export function sub(a: Vec3, b: Vec3, out?: Vec3): Vec3 {
  const x = a.x - b.x;
  const y = a.y - b.y;
  const z = a.z - b.z;
  const r = out ?? { x: 0, y: 0, z: 0 };
  r.x = x; r.y = y; r.z = z;
  return r;
}

export function scale(a: Vec3, s: number, out?: Vec3): Vec3 {
  const x = a.x * s;
  const y = a.y * s;
  const z = a.z * s;
  const r = out ?? { x: 0, y: 0, z: 0 };
  r.x = x; r.y = y; r.z = z;
  return r;
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3, out?: Vec3): Vec3 {
  const x = a.y * b.z - a.z * b.y;
  const y = a.z * b.x - a.x * b.z;
  const z = a.x * b.y - a.y * b.x;
  const r = out ?? { x: 0, y: 0, z: 0 };
  r.x = x; r.y = y; r.z = z;
  return r;
}

export function length(a: Vec3): number {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

/** Returns a unit vector, or the zero vector when the length is below 1e-12. */
export function normalize(a: Vec3, out?: Vec3): Vec3 {
  const len = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  const r = out ?? { x: 0, y: 0, z: 0 };
  if (len < 1e-12) {
    r.x = 0; r.y = 0; r.z = 0;
    return r;
  }
  const inv = 1 / len;
  const x = a.x * inv;
  const y = a.y * inv;
  const z = a.z * inv;
  r.x = x; r.y = y; r.z = z;
  return r;
}

export function lerp(a: Vec3, b: Vec3, t: number, out?: Vec3): Vec3 {
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  const z = a.z + (b.z - a.z) * t;
  const r = out ?? { x: 0, y: 0, z: 0 };
  r.x = x; r.y = y; r.z = z;
  return r;
}

/**
 * Builds a quaternion from three orthonormal, right-handed basis vectors.
 * They are the images of the local x, y and z directions (the columns of the rotation matrix).
 */
export function quatFromBasis(x: Vec3, y: Vec3, z: Vec3, out?: Quat): Quat {
  const m00 = x.x, m10 = x.y, m20 = x.z;
  const m01 = y.x, m11 = y.y, m21 = y.z;
  const m02 = z.x, m12 = z.y, m22 = z.z;
  const trace = m00 + m11 + m22;
  let qx: number, qy: number, qz: number, qw: number;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    qw = 0.25 * s;
    qx = (m21 - m12) / s;
    qy = (m02 - m20) / s;
    qz = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    qw = (m21 - m12) / s;
    qx = 0.25 * s;
    qy = (m01 + m10) / s;
    qz = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    qw = (m02 - m20) / s;
    qx = (m01 + m10) / s;
    qy = 0.25 * s;
    qz = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    qw = (m10 - m01) / s;
    qx = (m02 + m20) / s;
    qy = (m12 + m21) / s;
    qz = 0.25 * s;
  }
  const r = out ?? { x: 0, y: 0, z: 0, w: 1 };
  r.x = qx; r.y = qy; r.z = qz; r.w = qw;
  return r;
}

/** Hamilton product a * b: applies b first, then a. */
export function quatMul(a: Quat, b: Quat, out?: Quat): Quat {
  const x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y;
  const y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x;
  const z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w;
  const w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
  const r = out ?? { x: 0, y: 0, z: 0, w: 1 };
  r.x = x; r.y = y; r.z = z; r.w = w;
  return r;
}

/** Inverse of a quaternion (the conjugate for a unit quaternion). */
export function quatInverse(a: Quat, out?: Quat): Quat {
  const n2 = a.x * a.x + a.y * a.y + a.z * a.z + a.w * a.w;
  const k = n2 > 0 ? 1 / n2 : 0;
  const x = -a.x * k;
  const y = -a.y * k;
  const z = -a.z * k;
  const w = a.w * k;
  const r = out ?? { x: 0, y: 0, z: 0, w: 1 };
  r.x = x; r.y = y; r.z = z; r.w = w;
  return r;
}

/** Rotates v by the unit quaternion q. */
export function rotateVec(q: Quat, v: Vec3, out?: Vec3): Vec3 {
  // t = 2 * (q.xyz x v); result = v + w * t + q.xyz x t
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  const x = v.x + q.w * tx + (q.y * tz - q.z * ty);
  const y = v.y + q.w * ty + (q.z * tx - q.x * tz);
  const z = v.z + q.w * tz + (q.x * ty - q.y * tx);
  const r = out ?? { x: 0, y: 0, z: 0 };
  r.x = x; r.y = y; r.z = z;
  return r;
}

/**
 * Spherical interpolation along the shorter arc (b is negated when dot < 0).
 * Falls back to a normalised lerp when the quaternions are nearly parallel.
 */
export function slerp(a: Quat, b: Quat, t: number, out?: Quat): Quat {
  let bx = b.x, by = b.y, bz = b.z, bw = b.w;
  let d = a.x * bx + a.y * by + a.z * bz + a.w * bw;
  if (d < 0) {
    d = -d;
    bx = -bx; by = -by; bz = -bz; bw = -bw;
  }
  let ka: number;
  let kb: number;
  if (d > 0.9995) {
    ka = 1 - t;
    kb = t;
  } else {
    const theta = Math.acos(d);
    const sinTheta = Math.sin(theta);
    ka = Math.sin((1 - t) * theta) / sinTheta;
    kb = Math.sin(t * theta) / sinTheta;
  }
  let x = ka * a.x + kb * bx;
  let y = ka * a.y + kb * by;
  let z = ka * a.z + kb * bz;
  let w = ka * a.w + kb * bw;
  const len = Math.sqrt(x * x + y * y + z * z + w * w);
  if (len > 0) {
    const inv = 1 / len;
    x *= inv; y *= inv; z *= inv; w *= inv;
  }
  const r = out ?? { x: 0, y: 0, z: 0, w: 1 };
  r.x = x; r.y = y; r.z = z; r.w = w;
  return r;
}

/** Angle in radians, in [0, pi], of the rotation taking a to b. */
export function quatAngle(a: Quat, b: Quat): number {
  const na = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z + a.w * a.w);
  const nb = Math.sqrt(b.x * b.x + b.y * b.y + b.z * b.z + b.w * b.w);
  const denom = na * nb;
  if (denom === 0) return 0;
  const d = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w) / denom;
  return 2 * Math.acos(d > 1 ? 1 : d);
}
