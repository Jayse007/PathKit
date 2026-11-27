// Playback stepping. Pure: time is passed in, nothing is read from a clock. Frames are whole numbers.

import { FRAME_RATE, PLAYBACK_MAX_CATCHUP_FRAMES } from './constants.js';

export interface PlaybackState {
  readonly playing: boolean;
  readonly frame: number;
  readonly accumulatorMs: number;
}

/** Guard for rounding noise when elapsed time is an exact multiple of the frame interval. */
export const PLAYBACK_FRAME_EPSILON = 1e-9;

const MS_PER_SECOND = 1000;

function assertLastFrame(lastFrame: number): void {
  if (!Number.isInteger(lastFrame) || lastFrame < 0) {
    throw new Error(`playback: lastFrame must be a whole number >= 0, got ${String(lastFrame)}`);
  }
}

/** The state at start: paused at frame 0, nothing accumulated. */
export function initialPlaybackState(): PlaybackState {
  return { playing: false, frame: 0, accumulatorMs: 0 };
}

/**
 * The explicit play action, the only function that sets playing to true.
 * At the last frame it restarts from frame 0.
 */
export function playPlayback(state: PlaybackState, lastFrame: number): PlaybackState {
  assertLastFrame(lastFrame);
  const frame = state.frame >= lastFrame ? 0 : state.frame;
  return { playing: true, frame, accumulatorMs: 0 };
}

/** Pause: keeps the frame, clears the accumulator. */
export function pausePlayback(state: PlaybackState): PlaybackState {
  return { playing: false, frame: state.frame, accumulatorMs: 0 };
}

/**
 * Move to a whole frame (scrub or keyboard step). Leaves playing as it was, so it never
 * starts playback. The frame is clamped to [0, lastFrame] and rounded; the accumulator is cleared.
 */
export function seekPlayback(state: PlaybackState, frame: number, lastFrame: number): PlaybackState {
  assertLastFrame(lastFrame);
  if (!Number.isFinite(frame)) {
    throw new Error(`seekPlayback: frame must be a finite number, got ${String(frame)}`);
  }
  const clamped = Math.min(Math.max(frame, 0), lastFrame);
  return { playing: state.playing, frame: Math.round(clamped) + 0, accumulatorMs: 0 };
}

/**
 * Advance by elapsedMs. A paused state is returned unchanged (as a copy).
 * Whole frames are taken from the accumulator; at most PLAYBACK_MAX_CATCHUP_FRAMES per call,
 * and any backlog beyond that is dropped. Reaching lastFrame stops playback there.
 * Throws an Error naming the value when elapsedMs is not finite or is negative.
 */
export function stepPlayback(state: PlaybackState, elapsedMs: number, lastFrame: number): PlaybackState {
  assertLastFrame(lastFrame);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new Error(`stepPlayback: elapsedMs must be a finite number >= 0, got ${String(elapsedMs)}`);
  }
  if (!state.playing) {
    return { playing: false, frame: state.frame, accumulatorMs: state.accumulatorMs };
  }

  const total = state.accumulatorMs + elapsedMs;
  const whole = Math.floor((total * FRAME_RATE) / MS_PER_SECOND + PLAYBACK_FRAME_EPSILON);

  if (whole > PLAYBACK_MAX_CATCHUP_FRAMES) {
    const frame = Math.min(state.frame + PLAYBACK_MAX_CATCHUP_FRAMES, lastFrame);
    return { playing: frame < lastFrame, frame, accumulatorMs: 0 };
  }

  const frame = Math.min(state.frame + whole, lastFrame);
  if (frame >= lastFrame) {
    return { playing: false, frame: lastFrame, accumulatorMs: 0 };
  }
  const remainder = Math.max(0, total - (whole * MS_PER_SECOND) / FRAME_RATE);
  return { playing: true, frame, accumulatorMs: remainder };
}
