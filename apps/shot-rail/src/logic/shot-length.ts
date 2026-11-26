// Shot_Length validation: a whole number of displayed frames from 60 to 600.

import { SHOT_LENGTH_MIN, SHOT_LENGTH_MAX } from './constants.js';

export type ShotLengthResult =
  | { ok: true; value: number }
  | { ok: false; message: string };

export function validateShotLength(value: number): ShotLengthResult {
  const range = `${SHOT_LENGTH_MIN} to ${SHOT_LENGTH_MAX}`;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return {
      ok: false,
      message: `Shot length must be a whole number of frames from ${range}, got ${String(value)}.`,
    };
  }
  if (!Number.isInteger(value)) {
    return {
      ok: false,
      message: `Shot length must be a whole number of frames from ${range}, got ${value}.`,
    };
  }
  if (value < SHOT_LENGTH_MIN || value > SHOT_LENGTH_MAX) {
    return {
      ok: false,
      message: `Shot length must be from ${range} frames, got ${value}.`,
    };
  }
  return { ok: true, value };
}
