import type { Curve } from './curve.js';
import type { Vec3 } from './math.js';
import { cross, dot, length, normalize, scale, sub } from './math.js';

export interface Frame { position: Vec3; tangent: Vec3; normal: Vec3; binormal: Vec3 }

const PARALLEL_EPS = 1e-9;
const CURVATURE_EPS = 1e-6;
const REFLECTION_EPS_SQ = 1e-24;
const DERIVATIVE_H = 1e-5;

function checkCount(count: number): void {
  if (!(Number.isInteger(count) && count >= 2)) {
    throw new Error(`Frame count must be an integer >= 2, got ${count}`);
  }
}

/**
 * Unit vector perpendicular to the tangent: the component of `v` perpendicular
 * to the tangent, normalised. If that remainder is below 1e-9 (v is zero or
 * parallel to the tangent), uses the world axis least aligned with the tangent,
 * crossed with the tangent twice.
 */
function perpendicularTo(tangent: Vec3, v: Vec3): Vec3 {
  const rest = sub(v, scale(tangent, dot(v, tangent)));
  if (length(rest) >= PARALLEL_EPS) {
    return normalize(rest);
  }
  const ax = Math.abs(tangent.x);
  const ay = Math.abs(tangent.y);
  const az = Math.abs(tangent.z);
  let axis: Vec3;
  if (ax <= ay && ax <= az) axis = { x: 1, y: 0, z: 0 };
  else if (ay <= az) axis = { x: 0, y: 1, z: 0 };
  else axis = { x: 0, y: 0, z: 1 };
  return normalize(cross(cross(axis, tangent), tangent));
}

function sampleParameter(i: number, count: number): number {
  return i / (count - 1);
}

/**
 * Rotation-minimizing frames by the double reflection method.
 * `initialUp` defaults to (0, 1, 0).
 */
export function rotationMinimizingFrames(curve: Curve, count: number, initialUp?: Vec3): Frame[] {
  checkCount(count);
  const up: Vec3 = initialUp ?? { x: 0, y: 1, z: 0 };
  const frames: Frame[] = [];

  for (let i = 0; i < count; i++) {
    const t = sampleParameter(i, count);
    const position = curve.pointAt(t);
    const tangent = curve.tangentAt(t);
    let normal: Vec3;

    if (i === 0) {
      normal = perpendicularTo(tangent, up);
    } else {
      const prev = frames[i - 1];
      // First reflection: across the plane bisecting the two positions.
      const v1 = sub(position, prev.position);
      const c1 = dot(v1, v1);
      let rL = prev.normal;
      let tL = prev.tangent;
      if (c1 >= REFLECTION_EPS_SQ) {
        rL = sub(prev.normal, scale(v1, (2 / c1) * dot(v1, prev.normal)));
        tL = sub(prev.tangent, scale(v1, (2 / c1) * dot(v1, prev.tangent)));
      }
      // Second reflection: across the plane bisecting the reflected and new tangents.
      const v2 = sub(tangent, tL);
      const c2 = dot(v2, v2);
      let r = rL;
      if (c2 >= REFLECTION_EPS_SQ) {
        r = sub(rL, scale(v2, (2 / c2) * dot(v2, rL)));
      }
      // Remove accumulated drift so the normal stays unit and perpendicular.
      normal = perpendicularTo(tangent, r);
    }

    frames.push({ position, tangent, normal, binormal: cross(tangent, normal) });
  }
  return frames;
}

/** Frenet frames. Where the tangent derivative (per unit of t) is below 1e-6, the previous normal is reused. */
export function frenetFrames(curve: Curve, count: number): Frame[] {
  checkCount(count);
  const frames: Frame[] = [];

  for (let i = 0; i < count; i++) {
    const t = sampleParameter(i, count);
    const position = curve.pointAt(t);
    const tangent = curve.tangentAt(t);

    const t0 = Math.max(0, t - DERIVATIVE_H);
    const t1 = Math.min(1, t + DERIVATIVE_H);
    const derivative = scale(sub(curve.tangentAt(t1), curve.tangentAt(t0)), 1 / (t1 - t0));
    const curvature = length(derivative);

    let normal: Vec3;
    if (curvature >= CURVATURE_EPS) {
      normal = perpendicularTo(tangent, derivative);
    } else if (i > 0) {
      normal = perpendicularTo(tangent, frames[i - 1].normal);
    } else {
      normal = perpendicularTo(tangent, { x: 0, y: 1, z: 0 });
    }

    frames.push({ position, tangent, normal, binormal: cross(tangent, normal) });
  }
  return frames;
}
