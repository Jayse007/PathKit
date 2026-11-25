import { describe, expect, it } from 'vitest';
import type { Finding } from '../src/pathkit-api.js';
import { findingsToPlainText, findingToPlainText, NO_FINDINGS_TEXT } from '../src/logic/finding-text.js';

// Spike S3, finding text table. Requirements 16.7, 16.8.

function finding(code: string, message: string): Finding {
  return { frame: 3, entityId: 'cam', severity: 'warning', code, message };
}

const TABLE: ReadonlyArray<readonly [string, string]> = [
  ['path-end-reached', 'The camera reached the end of its path and stopped there.'],
  ['rotation-conflict', 'Two rules tried to turn the camera in different ways, so one of them was overridden.'],
  ['aim-vertical', 'The camera looks almost straight up or down, so its sideways tilt may jump.'],
  ['speed-spike', 'The camera speeds up suddenly for a moment.'],
  ['roll-change', 'The camera tilts sideways sharply between two frames.'],
];

describe('finding text (Spike S3)', () => {
  it('maps each of the five linter codes to its plain sentence', () => {
    for (const [code, text] of TABLE) {
      expect(findingToPlainText(finding(code, 'raw linter message'))).toBe(text);
    }
  });

  it('falls back to the finding message for an unknown code', () => {
    expect(findingToPlainText(finding('something-new', 'raw linter message'))).toBe('raw linter message');
    expect(findingToPlainText(finding('toString', 'inherited name message'))).toBe('inherited name message');
  });

  it('gives "No findings reported." for an empty list', () => {
    expect(NO_FINDINGS_TEXT).toBe('No findings reported.');
    expect(findingsToPlainText([])).toEqual(['No findings reported.']);
  });
});
