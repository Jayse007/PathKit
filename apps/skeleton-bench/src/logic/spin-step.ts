/**
 * Impeller spin time step (Requirement 13.5). Pure.
 * Seconds between two animation-frame times in milliseconds, capped at SPIN_MAX_STEP_S
 * so that a hidden tab does not cause a jump, and never negative.
 * Returns 0 for any value that is not a finite number.
 */

export const SPIN_MAX_STEP_S = 0.1;

export function spinTimeStep(prevMs: number, nowMs: number): number {
  if (!Number.isFinite(prevMs) || !Number.isFinite(nowMs)) return 0;
  const seconds = (nowMs - prevMs) / 1000;
  if (seconds <= 0) return 0;
  return Math.min(SPIN_MAX_STEP_S, seconds);
}
