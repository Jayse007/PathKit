// About_Panel (task 42.1): the panel that shows the honest limits (Requirements 21.1 to 21.5, 21.7, 21.8).
// It touches the DOM, so no test imports this file. All the text is in about-panel-rules.ts.
//
// Element: a native <dialog> opened with showModal(). Chosen because the browser then gives, without code of
// ours, a real modal: the rest of the page is inert (no Tab, no click, no screen-reader reach outside), focus
// moves into the dialog (to the Close button, its first focusable element), and Escape asks it to close.
// A hand-made overlay would need a focus trap, an aria-modal attribute and a hidden background written by hand.
//
// Focus: the element focused before opening is remembered; when the dialog closes (Close button, Escape, or
// a browser close request) focus goes back to it, or to the About button if that element is gone.
//
// Keys while the dialog is open: one keydown listener on the document in the CAPTURE phase runs before every
// other keydown listener (keyboard.ts, guides-view.ts, hints.ts). While the dialog is open it stops the event
// from going further, so no app key (T, G, A, M, Space, arrows, ?, and so on) and not the first-time hint's
// Escape listener sees the key. Default actions are kept: Tab moves focus inside the dialog, arrows scroll it,
// Enter and Space press the focused button. For Escape it also calls preventDefault (so the browser's own
// close request does not fire a second time) and closes the dialog itself. keyboard.ts also ignores keys
// while a dialog is open, as a second guard.
//
// Nothing here runs per frame. The text is built once, when the panel is created.

import {
  ABOUT_BUTTON_LABEL,
  ABOUT_BUTTON_TOOLTIP,
  ABOUT_CLOSE_LABEL,
  ABOUT_SECTIONS,
  ABOUT_TITLE,
} from './about-panel-rules.js';
import type { AboutSection } from './about-panel-rules.js';

// View-only values (not in the design's Named constants table).
const DIALOG_ID = 'about-panel';
const TITLE_ID = 'about-title';
const BODY_ID = 'about-body';
const CLOSE_BUTTON_ID = 'about-close';
const OPEN_BUTTON_ID = 'about-button';
const ESCAPE_KEY = 'Escape';
const SECTION_HEADING_TAG = 'h3';
const SCROLL_TOP = 0;

export interface AboutPanel {
  /** Show the panel as a modal. Does nothing if it is already open. */
  open(): void;
  /** Close the panel and return focus. Does nothing if it is closed. */
  close(): void;
  /** Whether the panel is open. */
  isOpen(): boolean;
  /** Remove the listeners. */
  dispose(): void;
}

/** Builds the heading, the paragraphs or the list of one section. */
function buildSection(section: AboutSection): HTMLElement {
  const box = document.createElement('section');
  box.id = section.id;
  const heading = document.createElement(SECTION_HEADING_TAG);
  heading.textContent = section.heading;
  box.appendChild(heading);
  if (section.intro !== '') {
    const intro = document.createElement('p');
    intro.textContent = section.intro;
    box.appendChild(intro);
  }
  if (section.kind === 'list') {
    const list = document.createElement('ul');
    for (const text of section.lines) {
      const item = document.createElement('li');
      item.textContent = text;
      list.appendChild(item);
    }
    box.appendChild(list);
  } else {
    for (const text of section.lines) {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      box.appendChild(paragraph);
    }
  }
  return box;
}

/**
 * Builds the About panel on the elements of index.html (#about-button, #about-panel, #about-title, #about-body,
 * #about-close). Returns null when one is missing or the dialog is not an HTMLDialogElement.
 */
export function createAboutPanel(): AboutPanel | null {
  const dialog = document.getElementById(DIALOG_ID);
  const title = document.getElementById(TITLE_ID);
  const body = document.getElementById(BODY_ID);
  const closeButton = document.getElementById(CLOSE_BUTTON_ID);
  const openButton = document.getElementById(OPEN_BUTTON_ID);
  if (!(dialog instanceof HTMLDialogElement) || title === null || body === null) return null;
  if (!(closeButton instanceof HTMLButtonElement) || !(openButton instanceof HTMLButtonElement)) return null;

  title.textContent = ABOUT_TITLE;
  closeButton.textContent = ABOUT_CLOSE_LABEL;
  openButton.textContent = ABOUT_BUTTON_LABEL;
  openButton.title = ABOUT_BUTTON_TOOLTIP; // layout.ts copies this into the hint line on keyboard focus
  for (const section of ABOUT_SECTIONS) body.appendChild(buildSection(section));

  let opener: HTMLElement | null = null; // the element that had focus when the panel opened

  const open = (): void => {
    if (dialog.open) return;
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal(); // focus moves to the Close button (autofocus in index.html)
    dialog.scrollTop = SCROLL_TOP;
  };

  const close = (): void => {
    if (dialog.open) dialog.close(); // the 'close' event below returns focus
  };

  // Fires for every way of closing, including a browser close request that skips the keydown listener.
  const onClosed = (): void => {
    const target = opener !== null && opener.isConnected ? opener : openButton;
    opener = null;
    target.focus();
  };

  const onKeyDownCapture = (event: KeyboardEvent): void => {
    if (!dialog.open || event.isComposing) return;
    event.stopPropagation(); // no other keydown listener sees a key while the panel is open
    if (event.key === ESCAPE_KEY) {
      event.preventDefault(); // no second, native close request
      close();
    }
  };

  openButton.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  dialog.addEventListener('close', onClosed);
  document.addEventListener('keydown', onKeyDownCapture, true);

  return {
    open,
    close,
    isOpen: (): boolean => dialog.open,
    dispose(): void {
      openButton.removeEventListener('click', open);
      closeButton.removeEventListener('click', close);
      dialog.removeEventListener('close', onClosed);
      document.removeEventListener('keydown', onKeyDownCapture, true);
    },
  };
}
