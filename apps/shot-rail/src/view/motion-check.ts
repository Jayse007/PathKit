// Motion check list (task 39.1): the findings of the main camera's motion check, in plain words, below the
// readout in the right-hand column. Each finding is a button (so Enter and Space work, as they do on any
// button) that moves the Timeline to the frame of that finding. The Timeline pauses when it moves; nothing
// here starts playback.
//
// It touches the DOM, so no test imports this file. The rows, the wording and the frame to go to come from
// ../logic/motion-check-model.ts (pure) and ../logic/findings.ts. This file writes no finding wording.
//
// It is updated after each re-bake only (never per frame): update() builds the list again only when the
// rows changed, so a re-bake that gives the same findings does not repeat an announcement. The list is an
// aria-live="polite" region for that reason: it changes on a re-bake and at no other time.
//
// Severity is shown with a text label. A warning also gets the amber accent (--warning in index.html).

import { activateRow, buildMotionCheckRows } from '../logic/motion-check-model.js';
import type { MotionCheckRow } from '../logic/motion-check-model.js';
import type { Finding } from '../logic/pathkit.js';

// View-only values (not in the design's Named constants table).
const SECTION_ID = 'motion-check';
const HEADING_ID = 'motion-check-heading';
const LIST_ID = 'motion-check-list';
const HEADING_TEXT = 'Motion check';
const WARNING_LABEL = 'Warning';
const WARNING_COLOUR = 'var(--warning)';
const NOTE_COLOUR = 'var(--border)';
const MUTED_COLOUR = 'var(--text-muted)';
const SECTION_TOP_GAP_PX = 16;
const ITEM_GAP_PX = 8;
const ACCENT_WIDTH_PX = 4;
const LABEL_GAP_PX = 8;
const TEXT_ROW_PADDING = '4px 8px';
const SIGNATURE_SEPARATOR = '\u0001';

const frameText = (frame: number): string => `Frame ${frame}`;
const buttonTitle = (frame: number): string => `Go to frame ${frame} on the timeline. Press Enter or Space.`;

export interface MotionCheckOptions {
  /** Called with the frame of the activated finding. Pass the Timeline's seekTo (it pauses). */
  onActivate: (frame: number) => void;
}

export interface MotionCheck {
  /**
   * Show the main camera's findings, or the failure of the check. Call it after each re-bake, never per frame.
   * `failureMessage` is the rig's "the motion check could not run: ..." message, or null.
   */
  update(findings: readonly Finding[], failureMessage: string | null): void;
}

function signatureOf(rows: readonly MotionCheckRow[]): string {
  return rows
    .map((r) => [r.kind, r.severityLabel, r.wording, r.explanation, String(r.frame)].join(SIGNATURE_SEPARATOR))
    .join('\n');
}

/**
 * Builds the Motion_Check section at the end of `container` (the readout column). Returns null when
 * `container` is null. Call it after the Readout is created so the section comes below it.
 */
export function createMotionCheck(container: HTMLElement | null, options: MotionCheckOptions): MotionCheck | null {
  if (container === null) return null;

  const section = document.createElement('section');
  section.id = SECTION_ID;
  section.setAttribute('aria-labelledby', HEADING_ID);
  section.style.marginTop = `${SECTION_TOP_GAP_PX}px`;

  const heading = document.createElement('h2');
  heading.id = HEADING_ID;
  heading.textContent = HEADING_TEXT;

  const list = document.createElement('ul');
  list.id = LIST_ID;
  list.setAttribute('aria-live', 'polite');
  list.style.listStyle = 'none';
  list.style.margin = '0';
  list.style.padding = '0';

  section.append(heading, list);
  container.append(section);

  let rows: readonly MotionCheckRow[] = [];
  let shown = '';

  const makeItem = (row: MotionCheckRow, index: number): HTMLLIElement => {
    const item = document.createElement('li');
    item.style.marginBottom = `${ITEM_GAP_PX}px`;

    const isWarning = row.severityLabel === WARNING_LABEL;
    const body = row.frame === null ? document.createElement('div') : document.createElement('button');
    if (body instanceof HTMLButtonElement && row.frame !== null) {
      body.type = 'button';
      body.title = buttonTitle(row.frame);
      body.addEventListener('click', () => {
        const frame = activateRow(rows, index);
        if (frame !== null) options.onActivate(frame);
      });
    }
    if (row.frame === null) body.style.padding = TEXT_ROW_PADDING; // a button has its own padding
    body.style.display = 'block';
    body.style.width = '100%';
    body.style.textAlign = 'left';
    body.style.borderLeft = `${ACCENT_WIDTH_PX}px solid ${isWarning ? WARNING_COLOUR : NOTE_COLOUR}`;

    if (row.severityLabel !== '' || row.frame !== null) {
      const head = document.createElement('span');
      head.style.display = 'block';
      if (row.severityLabel !== '') {
        const label = document.createElement('strong');
        label.textContent = row.severityLabel;
        if (isWarning) label.style.color = WARNING_COLOUR;
        head.append(label);
      }
      if (row.frame !== null) {
        const where = document.createElement('span');
        where.textContent = frameText(row.frame);
        where.style.color = MUTED_COLOUR;
        where.style.marginLeft = row.severityLabel === '' ? '0' : `${LABEL_GAP_PX}px`;
        head.append(where);
      }
      body.append(head);
    }

    const wording = document.createElement('span');
    wording.style.display = 'block';
    wording.textContent = row.wording;
    body.append(wording);

    if (row.explanation !== '') {
      const explanation = document.createElement('span');
      explanation.style.display = 'block';
      explanation.style.color = MUTED_COLOUR;
      explanation.textContent = row.explanation;
      body.append(explanation);
    }

    item.append(body);
    return item;
  };

  return {
    update(findings: readonly Finding[], failureMessage: string | null): void {
      const next = buildMotionCheckRows(findings, failureMessage);
      const signature = signatureOf(next);
      if (signature === shown) return; // same list: do not rebuild, so nothing is announced again
      rows = next;
      shown = signature;
      list.replaceChildren(...next.map((row, index) => makeItem(row, index)));
    },
  };
}
