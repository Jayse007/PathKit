// Layout (task 36.1): fills the regions that index.html defines. It writes the messages of the empty
// regions, puts the Term_Text lines on the lens menu and the main view, and shows the explanation of the
// focused control in the hint line, so keyboard users read the same text that hover shows.
// It touches the DOM, so no test imports this file. The data is in layout-rules.ts.
//
// Hover uses the native `title`. Keyboard focus uses one hint line (#term-hint) that copies the `title`
// of the focused element (or of its nearest ancestor with a title). A native title is never shown on focus,
// so the hint line is what makes the text visible there. One listener pair on the document covers every
// control, including the ones later tasks add, because it reads the title at the moment of focus.
// A title is also the accessible description of a labelled control, so screen readers get the same text.

import { EMPTY_REGIONS, HINT_PLACEHOLDER, TERM_BINDINGS, hintTextFor } from './layout-rules.js';

const HINT_ID = 'term-hint';

/** Writes the empty-region messages, the term titles and the hint-line listeners. Call once, first. */
export function applyLayout(): void {
  for (const region of EMPTY_REGIONS) {
    const box = document.getElementById(region.messageId);
    if (box !== null) box.textContent = region.message;
  }

  for (const binding of TERM_BINDINGS) {
    const element = document.getElementById(binding.elementId);
    if (element === null) continue;
    element.title = binding.line.text;
    document.querySelectorAll<HTMLElement>(`label[for="${binding.elementId}"]`).forEach((label) => {
      label.title = binding.line.text;
    });
  }

  const hint = document.getElementById(HINT_ID);
  if (hint === null) return;
  hint.textContent = HINT_PLACEHOLDER;

  document.addEventListener('focusin', (event: FocusEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const titled = target.closest('[title]');
    hint.textContent = hintTextFor(titled === null ? null : titled.getAttribute('title'));
  });
  document.addEventListener('focusout', () => {
    hint.textContent = HINT_PLACEHOLDER;
  });
}

/**
 * Hides or shows the "what to do next" message of an empty region. A later task calls this with `false`
 * when it puts real content in the region. Does nothing for an unknown id.
 */
export function setRegionEmpty(messageId: string, empty: boolean): void {
  const box = document.getElementById(messageId);
  if (box !== null) box.hidden = !empty;
}
