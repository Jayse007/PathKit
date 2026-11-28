// Motion check model (task 39.1): turns the findings of a motion check into rows for a list, and says which
// frame a row goes to. Pure: no DOM, no clock, no I/O, no randomness, and it never changes its inputs.
//
// All finding wording comes from findings.ts (describeFinding, NO_PROBLEMS_MESSAGE). The only wording written
// here is the error row: a text label and a "what to do" line (see ERROR_SEVERITY_LABEL, ERROR_WHAT_TO_DO).

import { NO_PROBLEMS_MESSAGE, describeFinding } from './findings.js';
import type { SeverityText } from './findings.js';
import type { Finding } from './pathkit.js';

/** The text label of a row. A finding row is 'Warning' or 'Note'. The error row is 'Error'. The empty row has none. */
export type RowSeverityLabel = SeverityText | 'Error' | '';

export type MotionCheckRowKind = 'finding' | 'empty' | 'error';

export interface MotionCheckRow {
  readonly kind: MotionCheckRowKind;
  /** Text severity label, so severity is never shown by colour alone. '' for the empty row. */
  readonly severityLabel: RowSeverityLabel;
  /** The plain wording (a finding), the no-problems message (empty) or what failed (error). */
  readonly wording: string;
  /** The one-line explanation (a finding; may be ''), or what the User can do (error). '' for the empty row. */
  readonly explanation: string;
  /** The frame the row goes to. null when the row cannot be activated (empty row, error row, bad frame). */
  readonly frame: number | null;
}

/** The start of the rig's message when the motion check threw. The rig builds it; this only recognises it. */
export const MOTION_CHECK_FAILED_PREFIX = 'the motion check could not run';

/** Text label of the error row. A plain UI label, not finding wording. */
export const ERROR_SEVERITY_LABEL = 'Error';

/** What the User can do after a failed check (Requirement 9.8). A plain UI message, not finding wording. */
export const ERROR_WHAT_TO_DO = 'Change a setting to run the check again. The shot itself still plays.';

/** Shown as "what failed" when the failure message is blank. */
export const ERROR_FALLBACK_WHAT_FAILED = 'The motion check could not run.';

/**
 * The failure message of a motion check, or null when `message` is not one. `message` is the `message` of
 * a successful re-bake outcome (null when nothing went wrong).
 */
export function motionCheckFailureOf(message: string | null): string | null {
  if (message === null) return null;
  const trimmed = message.trim();
  return trimmed.toLowerCase().startsWith(MOTION_CHECK_FAILED_PREFIX) ? trimmed : null;
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The rows of the list. A failure gives one error row (what failed, what to do), whatever the findings are.
 * No findings gives one empty row with NO_PROBLEMS_MESSAGE. Otherwise one row per finding, in the input order.
 */
export function buildMotionCheckRows(
  findings: readonly Finding[],
  failureMessage: string | null,
): MotionCheckRow[] {
  if (failureMessage !== null) {
    const trimmed = failureMessage.trim();
    return [
      {
        kind: 'error',
        severityLabel: ERROR_SEVERITY_LABEL,
        wording: trimmed === '' ? ERROR_FALLBACK_WHAT_FAILED : capitalised(trimmed),
        explanation: ERROR_WHAT_TO_DO,
        frame: null,
      },
    ];
  }
  if (findings.length === 0) {
    return [{ kind: 'empty', severityLabel: '', wording: NO_PROBLEMS_MESSAGE, explanation: '', frame: null }];
  }
  const rows: MotionCheckRow[] = [];
  for (const finding of findings) {
    const text = describeFinding(finding);
    rows.push({
      kind: 'finding',
      severityLabel: text.severityText,
      wording: text.wording,
      explanation: text.explanation,
      frame: Number.isFinite(finding.frame) ? finding.frame : null,
    });
  }
  return rows;
}

/**
 * The frame to go to when the row at `index` is activated: the finding's own frame (not the row index).
 * null when the index is not a row, or the row has no frame (empty row, error row).
 */
export function activateRow(rows: readonly MotionCheckRow[], index: number): number | null {
  if (!Number.isInteger(index) || index < 0 || index >= rows.length) return null;
  return rows[index].frame;
}
