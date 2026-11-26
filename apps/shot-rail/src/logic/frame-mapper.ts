// Frame_Mapper: scrub value, frame number and seconds. Pure. Frames are whole numbers.

/**
 * Clamps the scrub value to [0, lastFrame] first, then rounds to the nearest whole frame.
 * Adding 0 at the end turns -0 into 0, so the result is never -0.
 *
 * Throws an Error naming the value when scrubValue is not finite.
 */
export function scrubToFrame(scrubValue: number, lastFrame: number): number {
  if (!Number.isFinite(scrubValue)) {
    throw new Error(`scrubToFrame: scrubValue must be a finite number, got ${String(scrubValue)}`);
  }
  const clamped = Math.min(Math.max(scrubValue, 0), lastFrame);
  return Math.round(clamped) + 0;
}

/** Seconds at the start of a whole frame: frame / fps. */
export function frameToSeconds(frame: number, fps: number): number {
  return frame / fps;
}

/** Inverse of frameToSeconds: the nearest whole frame for a time in seconds. Never -0. */
export function secondsToFrame(seconds: number, fps: number): number {
  return Math.round(seconds * fps) + 0;
}
