// Pure rules for the Timeline (task 34.1): the last frame of a shot, the frame counter texts, and the
// finding marks. No Three.js, no DOM, no I/O, no clock. Frames are whole numbers.

import { FRAME_RATE } from '../logic/constants.js';
import { frameToSeconds, scrubToFrame } from '../logic/frame-mapper.js';

/** Shown when the shot has no findings (an empty region says what the User can do). */
export const NO_FINDING_MARKS_TEXT =
  'No findings to mark. A mark appears here at each frame where the motion check finds something.';

/**
 * The last frame of a shot: shotLengthFrames - 1.
 * Throws an Error naming the value when it is not a whole number >= 1.
 */
export function lastFrameOf(shotLengthFrames: number): number {
  if (!Number.isInteger(shotLengthFrames) || shotLengthFrames < 1) {
    throw new Error(`timeline: shotLengthFrames must be a whole number >= 1, got ${String(shotLengthFrames)}`);
  }
  return shotLengthFrames - 1;
}

/**
 * One counter text per frame, index = frame: "Frame 12 of 239 (0.40 s)". Built once per shot length so the
 * per-frame path only reads a string that already exists.
 */
export function buildFrameCounterTexts(shotLengthFrames: number): string[] {
  const last = lastFrameOf(shotLengthFrames);
  const texts: string[] = [];
  for (let frame = 0; frame <= last; frame++) {
    texts.push(`Frame ${frame} of ${last} (${frameToSeconds(frame, FRAME_RATE).toFixed(2)} s)`);
  }
  return texts;
}

/**
 * The frames that get a mark: whole numbers in [0, lastFrame], each frame once, in ascending order.
 * A finding frame outside the range is clamped to it; a frame that is not a finite number is skipped.
 */
export function findingMarkFrames(findings: readonly { readonly frame: number }[], lastFrame: number): number[] {
  const seen = new Set<number>();
  for (const finding of findings) {
    if (!Number.isFinite(finding.frame)) continue;
    seen.add(scrubToFrame(finding.frame, lastFrame));
  }
  return Array.from(seen).sort((a, b) => a - b);
}

/** Where a mark sits along the scrub track, from 0 (frame 0) to 1 (last frame). 0 when the shot has one frame. */
export function findingMarkFraction(frame: number, lastFrame: number): number {
  if (lastFrame <= 0) return 0;
  return Math.min(Math.max(frame / lastFrame, 0), 1);
}

/** Text form of the marks, so colour and position are not the only cue. */
export function findingMarksSummary(frames: readonly number[]): string {
  if (frames.length === 0) return NO_FINDING_MARKS_TEXT;
  return `Findings at frames ${frames.join(', ')}.`;
}
