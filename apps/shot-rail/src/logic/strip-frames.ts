// Shot_Strip frame picker. Pure. Frames are whole numbers.

import { SHOT_LENGTH_MAX, SHOT_LENGTH_MIN, STRIP_PICTURE_COUNT } from './constants.js';

/**
 * The whole frame numbers at which the strip pictures are taken.
 *
 * Picture k (0 to STRIP_PICTURE_COUNT - 1) is at round(k * (shotLength - 1) / (STRIP_PICTURE_COUNT - 1)).
 * The first value is 0 and the last is shotLength - 1 (the last frame). The product is
 * computed before the division, and the division by 5 leaves fractions in steps of 0.2,
 * so a value is never exactly halfway and Math.round has no tie to break.
 * Values are strictly increasing for every length from SHOT_LENGTH_MIN to SHOT_LENGTH_MAX.
 *
 * Returns a new array. Throws an Error naming the value when shotLength is not a whole
 * number from SHOT_LENGTH_MIN to SHOT_LENGTH_MAX.
 */
export function stripFrames(shotLength: number): number[] {
  if (!Number.isInteger(shotLength) || shotLength < SHOT_LENGTH_MIN || shotLength > SHOT_LENGTH_MAX) {
    throw new Error(
      `stripFrames: shotLength must be a whole number from ${SHOT_LENGTH_MIN} to ${SHOT_LENGTH_MAX}, got ${String(shotLength)}`,
    );
  }
  const lastFrame = shotLength - 1;
  const gaps = STRIP_PICTURE_COUNT - 1;
  const frames: number[] = [];
  for (let k = 0; k < STRIP_PICTURE_COUNT; k++) {
    frames.push(Math.round((k * lastFrame) / gaps) + 0);
  }
  return frames;
}
