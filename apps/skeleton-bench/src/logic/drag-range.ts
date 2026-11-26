/**
 * Drag_Range and Fraction_To_Pixels. Pure: no state.
 * Offsets are fractions of the viewport (x of the width, y of the height).
 */

import { BENCH_MAX_FRACTION_AT_0, BENCH_MIN_FRACTION_AT_100 } from '../constants.js';

/** An offset in fractions of the viewport. */
export interface Offset {
  readonly x: number;
  readonly y: number;
}

function requireFinite(value: number, fn: string, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${fn}: ${name} must be a finite number, got ${String(value)}`);
  }
}

/**
 * Limit each way, as a fraction of the viewport, at an Explode_Amount in percent.
 * L(e) = 0.25 - (0.25 - 0.10) * e / 100. The amount is clamped to 0 to 100.
 */
export function benchLimit(explodePercent: number): number {
  requireFinite(explodePercent, 'benchLimit', 'explode amount');
  const e = Math.min(100, Math.max(0, explodePercent));
  return BENCH_MAX_FRACTION_AT_0 - (BENCH_MAX_FRACTION_AT_0 - BENCH_MIN_FRACTION_AT_100) * e / 100;
}

function clampAxis(value: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, value));
}

/** Clamp each axis of the offset to [-L, +L] independently. */
export function clampOffset(fx: number, fy: number, explodePercent: number): Offset {
  requireFinite(fx, 'clampOffset', 'offset x');
  requireFinite(fy, 'clampOffset', 'offset y');
  const limit = benchLimit(explodePercent);
  return { x: clampAxis(fx, limit), y: clampAxis(fy, limit) };
}

/** The zero offset. */
export function resetOffset(): Offset {
  return { x: 0, y: 0 };
}

/** Convert a fraction and a viewport size in pixels to pixels. No rounding. */
export function fractionToPixels(fraction: number, sizePx: number): number {
  requireFinite(fraction, 'fractionToPixels', 'fraction');
  requireFinite(sizePx, 'fractionToPixels', 'viewport size');
  return fraction * sizePx;
}
