// Tests for src/logic/findings.ts. Expected texts are written by hand from the
// design's "Plain-words findings table", not taken from the code under test.
import { describe, expect, it } from 'vitest';
import { describeFinding, describeFindings } from '../../src/logic/findings.js';
import type { Finding, Severity } from '../../src/logic/pathkit.js';

function finding(code: string, severity: Severity, message: string): Finding {
  return { frame: 12, entityId: 'cam-1', severity, code, message };
}

describe('findings', () => {
  // The finding's own severity and message are deliberately different from the table,
  // so a lookup that fell back to them would fail.
  it.each([
    [
      'path-end-reached',
      'Note',
      'Camera reaches the end of its rail',
      'The rail camera has travelled its full length; it holds its final position for the rest of the shot.',
    ],
    [
      'rotation-conflict',
      'Warning',
      "Two things are steering the camera's rotation",
      "More than one constraint (for example aim and an aligned rail) is trying to set the camera's facing at once.",
    ],
    [
      'aim-vertical',
      'Warning',
      'Camera points almost straight up or down',
      'Looking nearly vertical makes the camera\'s "up" direction unstable from one frame to the next.',
    ],
    [
      'speed-spike',
      'Warning',
      'Camera suddenly speeds up',
      "This frame's movement is more than three times the shot's typical speed.",
    ],
    [
      'roll-change',
      'Warning',
      'Camera tilts sharply between frames',
      "The camera's horizon rotates by more than the comfortable per-frame limit.",
    ],
  ])('known code %s gives the design text', (code, severityText, wording, explanation) => {
    const otherSeverity: Severity = severityText === 'Note' ? 'warning' : 'info';
    const result = describeFinding(finding(code, otherSeverity, 'raw linter message'));
    expect(result).toEqual({
      frame: 12,
      entityId: 'cam-1',
      severityText,
      wording,
      explanation,
    });
  });

  it.each([
    ['info', 'Note'],
    ['warning', 'Warning'],
  ] as const)('unknown code with severity %s gives its own message and "%s"', (severity, text) => {
    const result = describeFinding(finding('made-up-code', severity, 'Something odd happened'));
    expect(result.wording).toBe('Something odd happened');
    expect(result.severityText).toBe(text);
    expect(result.explanation).toBe('');
    expect(result.frame).toBe(12);
    expect(result.entityId).toBe('cam-1');
  });

  it('treats a code that is an Object.prototype name as unknown', () => {
    const result = describeFinding(finding('constructor', 'info', 'own message here'));
    expect(result.wording).toBe('own message here');
    expect(result.severityText).toBe('Note');
  });

  it('an empty list gives no items and a no-problems text containing "rough"', () => {
    const result = describeFindings([]);
    expect(result.items).toEqual([]);
    expect(result.emptyMessage).toContain('No problems found');
    expect(result.emptyMessage).toContain('rough');
  });

  it('a non-empty list keeps the input order and has an empty emptyMessage', () => {
    const result = describeFindings([
      finding('roll-change', 'warning', 'm1'),
      finding('path-end-reached', 'info', 'm2'),
      finding('zzz', 'warning', 'm3'),
    ]);
    expect(result.items.map((item) => item.wording)).toEqual([
      'Camera tilts sharply between frames',
      'Camera reaches the end of its rail',
      'm3',
    ]);
    expect(result.emptyMessage).toBe('');
  });
});
