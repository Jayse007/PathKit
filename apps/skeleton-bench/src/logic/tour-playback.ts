// Tour playback helpers. Pure functions on numbers: no allocation, no clock access.
// The caller keeps `elapsedMs` and adds time only while the Tour status is 'playing',
// so Pause holds the frame and Resume continues from it.
import { FPS, TOUR_REDUCED_MOTION_HOLD_MS } from '../constants.js';
import { evaluateEntity, type BakedData, type OutBuffer } from '../pathkit-api.js';
import { TOUR_ENTITY_ID, tourSlotMiddleFrame } from '../pathkit/tour.js';
import { isTourPlaying, type AppState } from '../state.js';

/** Visible label shown beside the disabled controls while the Tour plays (Requirement 16.11). */
export const TOUR_LOCKED_LABEL = 'Stop the tour to use this';

function requireNonNegative(value: number, fn: string, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fn}: ${name} must be a finite number of 0 or more, got ${String(value)}`);
  }
}

/** Whole frame for the elapsed time at 30 fps (floor). Not clamped: compare with the frame count to detect the end. */
export function tourFrameAtElapsed(elapsedMs: number): number {
  requireNonNegative(elapsedMs, 'tourFrameAtElapsed', 'elapsed time');
  return Math.floor((elapsedMs * FPS) / 1000);
}

/** True when the elapsed time has reached the last frame's end, so the Tour must stop and cut back. */
export function tourHasEnded(elapsedMs: number, frameCount: number): boolean {
  return tourFrameAtElapsed(elapsedMs) >= frameCount;
}

/** Reduced motion: the Part index shown at this elapsed time (one Part per hold). */
export function reducedMotionPartIndex(elapsedMs: number): number {
  requireNonNegative(elapsedMs, 'reducedMotionPartIndex', 'elapsed time');
  return Math.floor(elapsedMs / TOUR_REDUCED_MOTION_HOLD_MS);
}

/** Reduced motion: true when every Part has been held for TOUR_REDUCED_MOTION_HOLD_MS. */
export function reducedMotionHasEnded(elapsedMs: number, partCount: number): boolean {
  return reducedMotionPartIndex(elapsedMs) >= partCount;
}

/** Reduced motion: the baked frame to jump to for a Part, the middle of its slot. */
export function reducedMotionFrame(partIndex: number): number {
  if (!Number.isInteger(partIndex) || partIndex < 0) {
    throw new Error(`reducedMotionFrame: partIndex must be a whole number of 0 or more, got ${String(partIndex)}`);
  }
  return tourSlotMiddleFrame(partIndex);
}

/** Writes the Tour camera pose for a whole frame into `out`. Allocates nothing. */
export function readTourPose(tour: BakedData, frame: number, out: OutBuffer): OutBuffer {
  evaluateEntity(tour, TOUR_ENTITY_ID, frame, out);
  return out;
}

/** True while the orbit, zoom, explode and move controls must be disabled and the locked label shown. */
export function tourControlsLocked(state: AppState): boolean {
  return isTourPlaying(state);
}
