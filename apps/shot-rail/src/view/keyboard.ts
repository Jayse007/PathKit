// Keyboard (task 37.2): one keydown listener that asks actionForKey (the only key table) what a key means
// and calls the matching handler. It touches the DOM, so no test imports this file. The pure rules (text
// fields, native key conflicts, repeat, next lens, next shot type) are in keyboard-rules.ts.
//
// This file decides nothing about the camera. main.ts supplies the handlers, and each one takes the same
// path as the matching control (tile click, mode button, lens menu, Shot_Type menu, Play button).
//
// T and G (thirds and safe area) are NOT handled here: guides-view.ts already has its own listener for
// them. This module ignores those two actions and does not call preventDefault for them, so they run once.
// capture-frame (C key, task 45.1) calls onCapture, the same path as the Capture button.
// open-about (? key, task 42.1) calls onOpenAbout. While any modal <dialog> is open (the About panel) this
// module ignores every key; about-panel.ts also stops keys before they get here.
//
// Nothing is created per key press: the listener is made once and reads only what the event gives.

import { actionForKey } from '../logic/key-map.js';
import type { KeyAction } from '../logic/key-map.js';
import type { GridMode } from './coverage-grid-rules.js';
import { allowsRepeat, focusInTextField, isHandledHere, nativeKeyConflict, slotIndexOf } from './keyboard-rules.js';
import type { Timeline } from './timeline.js';

// View-only values (not in the design's Named constants table).
const FRAME_STEP = 1;
const FIRST_FRAME = 0;
/** Matches a dialog that is open. The browser sets the `open` attribute while showModal() is in effect. */
const OPEN_DIALOG_SELECTOR = 'dialog[open]';

export interface KeyboardOptions {
  /** Only the transport methods are used. Stepping and first/last pause, as scrubbing does. */
  timeline: Pick<Timeline, 'frame' | 'lastFrame' | 'togglePlay' | 'seekTo'>;
  /** Same path as the Angle and Move buttons. */
  onMode: (mode: GridMode) => void;
  /** Same path as a tile click for the camera in list position `index` (0 to 5). Does nothing or says so if there is none. */
  onSelectSlot: (index: number) => void;
  /** Next lens preset after the main camera's lens, applied without a re-bake. */
  onCycleLens: () => void;
  /** +1 zooms in, -1 zooms out, applied without a re-bake. */
  onZoom: (direction: 1 | -1) => void;
  /** Next Shot_Type for the main camera, through the same path as the Shot_Type menu. */
  onCycleShotType: () => void;
  /** Opens the About panel (the ? key). Same path as the About button. */
  onOpenAbout: () => void;
  /** Saves the main view at the frame shown now as a PNG (the C key). Same path as the Capture button. */
  onCapture: () => void;
}

export interface Keyboard {
  /** Remove the listener. */
  dispose(): void;
}

/** Runs the handler for an action. Returns false for an action this module leaves alone. */
function run(action: KeyAction, options: KeyboardOptions): boolean {
  switch (action) {
    case 'toggle-play':
      options.timeline.togglePlay();
      return true;
    case 'step-back':
      options.timeline.seekTo(options.timeline.frame() - FRAME_STEP);
      return true;
    case 'step-forward':
      options.timeline.seekTo(options.timeline.frame() + FRAME_STEP);
      return true;
    case 'first-frame':
      options.timeline.seekTo(FIRST_FRAME);
      return true;
    case 'last-frame':
      options.timeline.seekTo(options.timeline.lastFrame());
      return true;
    case 'mode-angle':
      options.onMode('angle');
      return true;
    case 'mode-move':
      options.onMode('move');
      return true;
    case 'select-slot-1':
    case 'select-slot-2':
    case 'select-slot-3':
    case 'select-slot-4':
    case 'select-slot-5':
    case 'select-slot-6':
      options.onSelectSlot(slotIndexOf(action));
      return true;
    case 'cycle-lens':
      options.onCycleLens();
      return true;
    case 'zoom-in':
      options.onZoom(1);
      return true;
    case 'zoom-out':
      options.onZoom(-1);
      return true;
    case 'cycle-shot-type':
      options.onCycleShotType();
      return true;
    case 'open-about':
      options.onOpenAbout();
      return true;
    case 'capture-frame':
      options.onCapture();
      return true;
    case 'toggle-thirds': // guides-view.ts handles T
    case 'toggle-safe-area': // guides-view.ts handles G
      return false;
  }
}

/** Adds the one keydown listener (on the document). */
export function createKeyboard(options: KeyboardOptions): Keyboard {
  const onKeyDown = (event: KeyboardEvent): void => {
    // actionForKey cannot see modifiers. Shift is allowed because '+' and '?' need it.
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (document.querySelector(OPEN_DIALOG_SELECTOR) !== null) return; // a modal dialog is open: no app keys
    const target = event.target instanceof Element ? event.target : null;
    const tagName = target === null ? '' : target.tagName;
    const inputType = target instanceof HTMLInputElement ? target.type : '';
    const editable = target instanceof HTMLElement && target.isContentEditable;
    const action = actionForKey(event.key, focusInTextField(tagName, inputType, editable));
    if (action === null) return;
    if (!isHandledHere(action)) return;
    if (nativeKeyConflict(action, tagName, inputType)) return; // the browser acts on this key; do not act twice
    if (event.repeat && !allowsRepeat(action)) {
      event.preventDefault(); // swallow the repeat (Space must not scroll) but do not act again
      return;
    }
    if (run(action, options)) event.preventDefault();
  };
  document.addEventListener('keydown', onKeyDown);
  return {
    dispose(): void {
      document.removeEventListener('keydown', onKeyDown);
    },
  };
}
