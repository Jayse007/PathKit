// Plain-words findings: turns motionLinter findings into text for the Findings panel.
// Pure. Wording comes from the design's "Plain-words findings table".

import type { Finding, Severity } from './pathkit.js';

export type SeverityText = 'Note' | 'Warning';

export interface FindingText {
  frame: number;
  entityId: string;
  severityText: SeverityText;
  wording: string;
  explanation: string;
}

export interface FindingsDescription {
  items: FindingText[];
  // Non-empty only when there are no findings.
  emptyMessage: string;
}

interface PlainWords {
  severityText: SeverityText;
  wording: string;
  explanation: string;
}

export const NO_PROBLEMS_MESSAGE =
  'No problems found. This check is rough, so it can miss things. Judge the shot by watching it.';

const PLAIN_WORDS: Readonly<Record<string, PlainWords>> = {
  'path-end-reached': {
    severityText: 'Note',
    wording: 'Camera reaches the end of its rail',
    explanation:
      'The rail camera has travelled its full length; it holds its final position for the rest of the shot.',
  },
  'rotation-conflict': {
    severityText: 'Warning',
    wording: "Two things are steering the camera's rotation",
    explanation:
      "More than one constraint (for example aim and an aligned rail) is trying to set the camera's facing at once.",
  },
  'aim-vertical': {
    severityText: 'Warning',
    wording: 'Camera points almost straight up or down',
    explanation:
      'Looking nearly vertical makes the camera\'s "up" direction unstable from one frame to the next.',
  },
  'speed-spike': {
    severityText: 'Warning',
    wording: 'Camera suddenly speeds up',
    explanation: "This frame's movement is more than three times the shot's typical speed.",
  },
  'roll-change': {
    severityText: 'Warning',
    wording: 'Camera tilts sharply between frames',
    explanation:
      "The camera's horizon rotates by more than the comfortable per-frame limit.",
  },
};

function severityToText(severity: Severity): SeverityText {
  return severity === 'warning' ? 'Warning' : 'Note';
}

// Looks up by own key only, so codes such as "constructor" are treated as unknown.
function lookup(code: string): PlainWords | undefined {
  return Object.prototype.hasOwnProperty.call(PLAIN_WORDS, code) ? PLAIN_WORDS[code] : undefined;
}

// A known code uses the table. An unknown code uses the finding's own severity and message.
export function describeFinding(finding: Finding): FindingText {
  const known = lookup(finding.code);
  if (known !== undefined) {
    return {
      frame: finding.frame,
      entityId: finding.entityId,
      severityText: known.severityText,
      wording: known.wording,
      explanation: known.explanation,
    };
  }
  return {
    frame: finding.frame,
    entityId: finding.entityId,
    severityText: severityToText(finding.severity),
    wording: finding.message,
    explanation: '',
  };
}

// Keeps the input order. An empty list gives no items and the no-problems message.
export function describeFindings(findings: readonly Finding[]): FindingsDescription {
  const items: FindingText[] = [];
  for (const finding of findings) items.push(describeFinding(finding));
  return { items, emptyMessage: items.length === 0 ? NO_PROBLEMS_MESSAGE : '' };
}
