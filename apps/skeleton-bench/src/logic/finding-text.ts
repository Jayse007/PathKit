// Plain-words text for motion linter findings (Motion_Check panel).
import type { Finding } from '../pathkit-api.js';

export const NO_FINDINGS_TEXT = 'No findings reported.';

const PLAIN_TEXT: Readonly<Record<string, string>> = {
  'path-end-reached': 'The camera reached the end of its path and stopped there.',
  'rotation-conflict': 'Two rules tried to turn the camera in different ways, so one of them was overridden.',
  'aim-vertical': 'The camera looks almost straight up or down, so its sideways tilt may jump.',
  'speed-spike': 'The camera speeds up suddenly for a moment.',
  'roll-change': 'The camera tilts sideways sharply between two frames.',
};

/** Plain sentence for one finding. An unknown code falls back to the finding's own message. */
export function findingToPlainText(finding: Finding): string {
  if (Object.prototype.hasOwnProperty.call(PLAIN_TEXT, finding.code)) {
    return PLAIN_TEXT[finding.code];
  }
  return finding.message;
}

/** Plain sentences for a list of findings. An empty list gives one line: "No findings reported." */
export function findingsToPlainText(findings: readonly Finding[]): string[] {
  if (findings.length === 0) return [NO_FINDINGS_TEXT];
  return findings.map(findingToPlainText);
}
