/**
 * Frame_Mapper, angle half. Pure: no state, no zoom input.
 * Frames are whole numbers 0 to 359 (one frame per degree).
 */

/** Map an orbit angle in degrees to a whole frame 0 to 359. */
export function angleToFrame(angleDeg: number): number {
  if (!Number.isFinite(angleDeg)) {
    throw new Error(`angleToFrame: angle must be a finite number, got ${String(angleDeg)}`);
  }
  const wrapped = ((angleDeg % 360) + 360) % 360;
  return Math.floor(wrapped + 0.5) % 360;
}
