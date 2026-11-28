// Keyboard rules (task 37.2): pure functions for the keyboard wiring. No DOM, no I/O, so a test may import
// this file. It decides which focused elements take typing, which keys the browser already handles on an
// element (so the app must not act twice), which actions repeat, and what the "next" lens and shot type are.
// The key table itself is ../logic/key-map.ts; nothing here is a second key table.

import { LENS_PRESETS_MM } from '../logic/constants.js';
import type { KeyAction } from '../logic/key-map.js';
import type { ShotType } from '../logic/shot-builders.js';

// View-only values (not in the design's Named constants table).
/** <input> types that take typed text or numbers. An input with no type attribute reports 'text'. */
const TEXT_INPUT_TYPES: readonly string[] = ['', 'text', 'number', 'search', 'email', 'url', 'tel', 'password'];
/** <input> types the browser operates with Space (button-like). */
const SPACE_INPUT_TYPES: readonly string[] = ['button', 'submit', 'reset', 'checkbox', 'radio', 'image', 'file'];
const RANGE_INPUT_TYPE = 'range';
const TAG_INPUT = 'INPUT';
const TAG_TEXTAREA = 'TEXTAREA';
const TAG_SELECT = 'SELECT';
const TAG_BUTTON = 'BUTTON';
/** The order of the Shot_Type menu in controls.ts. */
const SHOT_TYPE_CYCLE: readonly ShotType[] = ['push-in', 'orbit', 'tracking', 'crane'];
/** Actions that go on repeating while the key is held. */
const REPEATING_ACTIONS: readonly KeyAction[] = ['step-back', 'step-forward', 'zoom-in', 'zoom-out'];
/** Actions on keys that a range slider already uses (Left, Right, Home, End). */
const SLIDER_NATIVE_ACTIONS: readonly KeyAction[] = ['step-back', 'step-forward', 'first-frame', 'last-frame'];
/** Actions keyboard.ts leaves alone. */
const UNHANDLED_ACTIONS: readonly KeyAction[] = ['toggle-thirds', 'toggle-safe-area', 'capture-frame', 'open-about'];
const SLOT_ACTIONS: readonly KeyAction[] = [
  'select-slot-1',
  'select-slot-2',
  'select-slot-3',
  'select-slot-4',
  'select-slot-5',
  'select-slot-6',
];

/**
 * Whether the key map must be switched off for the focused element. True for an <input> whose type takes
 * typing, a <textarea>, a <select> (its arrows, Home, End, letters and digits pick an option) and anything
 * contentEditable. `tagName` is upper case, as the DOM gives it for HTML elements. `inputType` is the
 * input's `type` property (only read when the tag is INPUT).
 * Range sliders are NOT text fields: the app's keys that a slider does not use (A, M, L, + and so on) still work.
 */
export function focusInTextField(tagName: string, inputType: string, isContentEditable: boolean): boolean {
  if (isContentEditable) return true;
  if (tagName === TAG_TEXTAREA || tagName === TAG_SELECT) return true;
  return tagName === TAG_INPUT && TEXT_INPUT_TYPES.includes(inputType);
}

/**
 * Whether the browser already acts on this key for the focused element, so the app must not act as well.
 * - A range slider (the scrub slider, the lens slider) uses Left, Right, Home and End.
 * - A button, checkbox or radio is operated with Space.
 * Anything else: false. (Text fields and selects are handled by focusInTextField.)
 */
export function nativeKeyConflict(action: KeyAction, tagName: string, inputType: string): boolean {
  if (tagName === TAG_INPUT && inputType === RANGE_INPUT_TYPE) return SLIDER_NATIVE_ACTIONS.includes(action);
  if (action !== 'toggle-play') return false;
  return tagName === TAG_BUTTON || (tagName === TAG_INPUT && SPACE_INPUT_TYPES.includes(inputType));
}

/**
 * Whether keyboard.ts acts on the action. False for the actions it leaves alone: T and G (guides-view.ts has
 * its own listener), and capture-frame and open-about (tasks 45 and 42 do not exist yet).
 */
export function isHandledHere(action: KeyAction): boolean {
  return !UNHANDLED_ACTIONS.includes(action);
}

/** Whether a held key repeats the action: stepping and zooming do, everything else acts once per press. */
export function allowsRepeat(action: KeyAction): boolean {
  return REPEATING_ACTIONS.includes(action);
}

/** 0 to 5 for select-slot-1 to select-slot-6, -1 for any other action. */
export function slotIndexOf(action: KeyAction): number {
  return SLOT_ACTIONS.indexOf(action);
}

/**
 * The lens preset after the current lens: the first preset above it, or the first preset when none is above.
 * From a custom lens (not a preset) this is the next preset above it.
 */
export function nextLensPreset(currentMm: number): number {
  for (const preset of LENS_PRESETS_MM) {
    if (preset > currentMm) return preset;
  }
  return LENS_PRESETS_MM[0];
}

/** The Shot_Type after this one, in the order of the Shot_Type menu, wrapping at the end. */
export function nextShotType(current: ShotType): ShotType {
  const index = SHOT_TYPE_CYCLE.indexOf(current);
  return SHOT_TYPE_CYCLE[(index + 1) % SHOT_TYPE_CYCLE.length];
}
