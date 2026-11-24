// Frame_Remap: picks the baked subject frame for each displayed frame. Pure.

/**
 * Maps a displayed frame to a whole baked frame in [0, bakedLapFrames - 1].
 *
 * u = (f mod lapFrames) / lapFrames          (remainder first, then divide)
 * s = u + A * sin(2 pi u) / (2 pi)
 * b = min(round(s * bakedLapFrames), bakedLapFrames - 1)
 *
 * Throws an Error naming the value when displayedFrame is not a whole number >= 0.
 */
export function remapDisplayedFrame(
  displayedFrame: number,
  lapFrames: number,
  bakedLapFrames: number,
  easeAmplitude: number,
): number {
  if (!Number.isInteger(displayedFrame) || displayedFrame < 0) {
    throw new Error(
      `remapDisplayedFrame: displayedFrame must be a whole number of 0 or more, got ${String(displayedFrame)}`,
    );
  }
  const u = (displayedFrame % lapFrames) / lapFrames;
  const s = u + (easeAmplitude * Math.sin(2 * Math.PI * u)) / (2 * Math.PI);
  const b = Math.min(Math.round(s * bakedLapFrames), bakedLapFrames - 1);
  // "+ 0" turns a negative zero into 0.
  return b + 0;
}
