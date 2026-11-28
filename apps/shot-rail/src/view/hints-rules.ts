// Hint rules (task 41.1): pure data and functions for the first-time mode hints. No DOM, no storage, so a
// test may import this file. The wording is the User's approved text, kept here (a view file, not src/logic).
// hints.ts does the DOM work and the storage reads and writes.

import { STORAGE_KEYS } from '../logic/constants.js';
import type { GridMode } from './coverage-grid-rules.js';

/** Approved wording. Do not change without the User's approval. */
export const ANGLE_HINT_TEXT =
  'Angle mode: compare up to six cameras side by side. Click a camera view to make it the main camera.';
export const MOVE_HINT_TEXT =
  'Move mode: shape how the main camera moves. Camera views are shown in Angle mode (key A).';
export const HINT_DISMISS_LABEL = 'Got it';

/**
 * The storage keys for the two hints. The annotations make the compiler refuse this file if the order of
 * STORAGE_KEYS ever changes, so a hint cannot be stored under the wrong key without a type error.
 */
const ANGLE_STORAGE_KEY: 'hintSeenAngle' = STORAGE_KEYS[0];
const MOVE_STORAGE_KEY: 'hintSeenMove' = STORAGE_KEYS[1];

/** The storage key (without the prefix, which storage.ts adds) of the seen flag for a mode. */
export function hintStorageKey(mode: GridMode): 'hintSeenAngle' | 'hintSeenMove' {
  return mode === 'angle' ? ANGLE_STORAGE_KEY : MOVE_STORAGE_KEY;
}

/** The hint text for a mode. */
export function hintTextForMode(mode: GridMode): string {
  return mode === 'angle' ? ANGLE_HINT_TEXT : MOVE_HINT_TEXT;
}

/**
 * Which mode's hint to show now: the current mode when its hint has not been seen, otherwise null.
 * `seenAngle` and `seenMove` are the stored seen flags.
 */
export function hintToShow(mode: GridMode, seenAngle: boolean, seenMove: boolean): GridMode | null {
  if (mode === 'angle') return seenAngle ? null : 'angle';
  return seenMove ? null : 'move';
}
