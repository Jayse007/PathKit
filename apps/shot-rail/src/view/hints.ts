// Hints (task 41.1): the one-line hint shown the first time Angle mode opens and the first time Move mode
// opens (requirement 18.3). Dismissing it stores the seen flag for that mode and it never shows again
// (requirement 18.4). It touches the DOM, so no test imports this file. The wording, the storage keys and
// the choice of hint are in hints-rules.ts.
//
// It has its own element (#mode-hint in index.html). It never touches #term-hint, the focus line of layout.ts.
// The element is plain text with a button. It does not take focus when it appears, it sits in the page flow
// (it covers nothing), it has no animation, and it is updated only when the mode changes (main.ts calls show
// once at startup and from applyMode), never per frame.
//
// Role: role="note". The hint is supporting information, not an alert. A live region would read it aloud over
// the status line's own "sample loaded" and "mode changed" announcements. The button is in the tab order, so a
// keyboard or screen-reader user reaches the text by moving to it.
//
// Escape dismisses the shown hint. The one keydown listener ignores every other key and never calls
// preventDefault, so it cannot interfere with keyboard.ts (which maps no Escape; key-map.ts has none).
//
// Switching mode without dismissing does NOT mark the hint seen (requirement 18.4 says "dismisses"). The
// shown hint is replaced by the new mode's hint if that one is unseen, otherwise hidden.
// A failing storage does not block use: readSetting returns false and writeSetting does nothing, and the
// seen flags are also kept in memory, so a hint dismissed in this session does not come back.

import { readSetting, writeSetting } from '../logic/storage.js';
import type { StorageLike } from '../logic/storage.js';
import type { GridMode } from './coverage-grid-rules.js';
import { HINT_DISMISS_LABEL, hintStorageKey, hintTextForMode, hintToShow } from './hints-rules.js';

// View-only values (not in the design's Named constants table).
const HINT_ID = 'mode-hint';
const HINT_TEXT_ID = 'mode-hint-text';
const HINT_BUTTON_ID = 'mode-hint-dismiss';
const FOCUS_RETURN_ID = 'stage';
const ESCAPE_KEY = 'Escape';
const SEEN_FALLBACK: boolean = false;

export interface Hints {
  /** Show the hint for this mode if it is unseen; otherwise hide any hint. Call at start and on every mode change. */
  show(mode: GridMode): void;
  /** Remove the listeners. */
  dispose(): void;
}

/**
 * Builds the hint behaviour on the elements of index.html. Returns null when they are missing.
 * `storage` is for tests; leave it out to use localStorage.
 */
export function createHints(storage?: StorageLike | null): Hints | null {
  const box = document.getElementById(HINT_ID);
  const text = document.getElementById(HINT_TEXT_ID);
  const button = document.getElementById(HINT_BUTTON_ID);
  if (box === null || text === null || button === null) return null;
  button.textContent = HINT_DISMISS_LABEL;

  // Seen flags: null until read from storage. Read at most once per mode, then kept in memory.
  let seenAngle: boolean | null = null;
  let seenMove: boolean | null = null;
  let shown: GridMode | null = null;

  const isSeen = (mode: GridMode): boolean => {
    if (mode === 'angle') {
      if (seenAngle === null) {
        seenAngle = readSetting(hintStorageKey('angle'), SEEN_FALLBACK, storage) === true;
      }
      return seenAngle;
    }
    if (seenMove === null) {
      seenMove = readSetting(hintStorageKey('move'), SEEN_FALLBACK, storage) === true;
    }
    return seenMove;
  };

  const hide = (): void => {
    shown = null;
    box.hidden = true;
  };

  const show = (mode: GridMode): void => {
    const which = hintToShow(mode, isSeen('angle'), isSeen('move'));
    if (which === null) {
      hide();
      return;
    }
    if (shown === which) return; // already showing this one
    shown = which;
    text.textContent = hintTextForMode(which);
    box.hidden = false; // no focus() call: the hint never takes focus
  };

  const dismiss = (): void => {
    if (shown === null) return;
    const mode = shown;
    if (mode === 'angle') seenAngle = true;
    else seenMove = true;
    writeSetting(hintStorageKey(mode), true, storage);
    const hadFocus = document.activeElement === button;
    hide();
    // A hidden button cannot keep focus. Return it to the main view so keyboard use continues from there.
    if (hadFocus) document.getElementById(FOCUS_RETURN_ID)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (shown === null || event.key !== ESCAPE_KEY || event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    dismiss(); // no preventDefault, no stopPropagation: other listeners are not affected
  };

  button.addEventListener('click', dismiss);
  document.addEventListener('keydown', onKeyDown);
  hide();

  return {
    show,
    dispose(): void {
      button.removeEventListener('click', dismiss);
      document.removeEventListener('keydown', onKeyDown);
    },
  };
}
