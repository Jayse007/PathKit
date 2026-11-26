/**
 * Explode_Easing. Pure: no state. App code, not PathKit.
 * Maps an Explode_Amount in percent to a whole Part-scene frame 0 to 59.
 */

import { EXPLODE_FRAMES } from '../constants.js';
import { roundHalfUp } from './frame-mapper.js';

/** Smoothstep of the clamped amount, scaled to the last Part-scene frame and rounded half up. */
export function explodeFrame(amountPercent: number): number {
  if (!Number.isFinite(amountPercent)) {
    throw new Error(`explodeFrame: amount must be a finite number, got ${String(amountPercent)}`);
  }
  const t = Math.min(100, Math.max(0, amountPercent)) / 100;
  const eased = 3 * t * t - 2 * t * t * t;
  const frame = roundHalfUp(eased * (EXPLODE_FRAMES - 1));
  return Math.min(EXPLODE_FRAMES - 1, Math.max(0, frame));
}
