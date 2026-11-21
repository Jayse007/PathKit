import type { Frame } from '../../src/frames.js';

// Twist helper for tests. Plain math written out by hand: it uses no frames.ts
// logic and no src/math.ts helpers, so a bug in the source cannot hide here.

interface V {
  x: number;
  y: number;
  z: number;
}

const AXIS_EPS = 1e-15;

const dotV = (a: V, b: V): number => a.x * b.x + a.y * b.y + a.z * b.z;
const crossV = (a: V, b: V): V => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const lenV = (a: V): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);

/**
 * Twist between frame a and frame b: the angle in [0, pi] between normal a
 * rotated by the minimal rotation taking tangent a to tangent b, and normal b.
 * Known limitation: if the tangents are exactly antiparallel (|axis| < 1e-15)
 * no rotation is applied, which is wrong for that case.
 */
function stepTwist(a: Frame, b: Frame): number {
  const axis = crossV(a.tangent, b.tangent);
  const axisLen = lenV(axis);
  let rotated: V = a.normal;
  if (axisLen >= AXIS_EPS) {
    const angle = Math.atan2(axisLen, dotV(a.tangent, b.tangent));
    const k: V = { x: axis.x / axisLen, y: axis.y / axisLen, z: axis.z / axisLen };
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const v = a.normal;
    const kxv = crossV(k, v);
    const kdv = dotV(k, v);
    // Rodrigues: v cos + (k x v) sin + k (k . v)(1 - cos)
    rotated = {
      x: v.x * cosA + kxv.x * sinA + k.x * kdv * (1 - cosA),
      y: v.y * cosA + kxv.y * sinA + k.y * kdv * (1 - cosA),
      z: v.z * cosA + kxv.z * sinA + k.z * kdv * (1 - cosA),
    };
  }
  const n = b.normal;
  return Math.atan2(lenV(crossV(rotated, n)), dotV(rotated, n));
}

/** One twist per consecutive pair of frames (length frames.length - 1). */
export function stepTwists(frames: Frame[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < frames.length; i++) {
    out.push(stepTwist(frames[i], frames[i + 1]));
  }
  return out;
}

/** Sum of the absolute step twists. */
export function totalTwist(frames: Frame[]): number {
  let sum = 0;
  for (let i = 0; i + 1 < frames.length; i++) {
    sum += Math.abs(stepTwist(frames[i], frames[i + 1]));
  }
  return sum;
}
