// Layout rules (task 36.1): pure data for the page layout. No DOM, no Three.js, so a test may import it.
// The wording of every explanation comes from term-text.ts; this file only says which element gets which line.
// The two messages for the empty regions are written here and are the only new wording of task 36.1.

import { MEASURE_TERMS } from '../logic/term-text.js';
import type { TermLine } from '../logic/term-text.js';

/** An element that gets a one-line explanation (hover through `title`, keyboard focus through the hint line). */
export interface TermBinding {
  /** Id of the element in index.html. */
  readonly elementId: string;
  /** The line from term-text.ts. */
  readonly line: TermLine;
}

/**
 * The elements index.html has from the start. The two guide checkboxes are made later by main.ts, which
 * passes MEASURE_TERMS.thirdsGuide and MEASURE_TERMS.safeAreaGuide to createGuideToggle itself.
 * The stage gets the zoom line because the mouse wheel over it changes the lens only.
 */
export const TERM_BINDINGS: readonly TermBinding[] = [
  { elementId: 'lens', line: MEASURE_TERMS.lens },
  { elementId: 'stage', line: MEASURE_TERMS.lensZoom },
];

/** A region that can be empty, and the message it shows then. The message says what the User can do next. */
export interface EmptyRegion {
  /** Id of the element that holds the message. */
  readonly messageId: string;
  readonly message: string;
}

export const EMPTY_REGIONS: readonly EmptyRegion[] = [
  {
    messageId: 'controls-empty',
    message:
      'The camera controls are not built yet. For now: pick a lens and turn the guides on or off here, click a camera tile under the main view to make it the main camera, and press Play on the timeline.',
  },
  {
    messageId: 'readout-empty',
    message:
      'The readout is empty. Press Play on the timeline to watch the shot. The angle, framing, field of view and distance will appear here once the readout is built.',
  },
];

/** Shown in the hint line when nothing explainable has keyboard focus. */
export const HINT_PLACEHOLDER = 'Press Tab to move to a control. Its one-line explanation shows here.';

/** The text for the hint line: the title of the focused element, or the placeholder when it has none. */
export function hintTextFor(title: string | null | undefined): string {
  if (title === null || title === undefined) return HINT_PLACEHOLDER;
  const trimmed = title.trim();
  return trimmed === '' ? HINT_PLACEHOLDER : trimmed;
}
