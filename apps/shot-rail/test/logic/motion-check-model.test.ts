// Tests for src/logic/motion-check-model.ts (task 39.2). Expected texts are written by hand from the
// design's "Plain-words findings table" and from the task text, not taken from the code under test.
// Only functions are imported from the model; no constant is used as an expectation.
import { describe, expect, it } from 'vitest';
import { activateRow, buildMotionCheckRows, motionCheckFailureOf } from '../../src/logic/motion-check-model.js';
import type { MotionCheckRow } from '../../src/logic/motion-check-model.js';
import type { Finding, Severity } from '../../src/logic/pathkit.js';

// The what-to-do line of the error row. If the User changes this wording, change it here only.
const WHAT_TO_DO = 'Change a setting to run the check again. The shot itself still plays.';

const NO_PROBLEMS =
  'No problems found. This check is rough, so it can miss things. Judge the shot by watching it.';

const FAILURE = 'the motion check could not run: the camera bake threw';

function finding(frame: number, code: string, severity: Severity, message: string): Finding {
  return { frame, entityId: 'cam-1', severity, code, message };
}

// Frames (10, 200, 7) differ from the indices (0, 1, 2) so an index returned by mistake shows up.
const THREE: Finding[] = [
  finding(10, 'speed-spike', 'info', 'raw message 1'),
  finding(200, 'path-end-reached', 'warning', 'raw message 2'),
  finding(7, 'roll-change', 'info', 'raw message 3'),
];

describe('buildMotionCheckRows', () => {
  // Catches: dropping the `findings.length === 0` branch (no empty row), or a wrong frame / label on it.
  it('an empty list gives exactly one empty row with the no-problems text and frame null', () => {
    expect(buildMotionCheckRows([], null)).toEqual([
      { kind: 'empty', severityLabel: '', wording: NO_PROBLEMS, explanation: '', frame: null },
    ]);
  });

  // Catches: sorting or reversing the loop, building the row from the wrong finding, or using the row index
  // as the frame, or leaving out severityLabel.
  it('two findings at frames 10 and 200 give two finding rows in input order with their words and label', () => {
    const rows = buildMotionCheckRows(
      [finding(10, 'speed-spike', 'info', 'raw 1'), finding(200, 'path-end-reached', 'warning', 'raw 2')],
      null,
    );
    expect(rows).toEqual([
      {
        kind: 'finding',
        severityLabel: 'Warning',
        wording: 'Camera suddenly speeds up',
        explanation: "This frame's movement is more than three times the shot's typical speed.",
        frame: 10,
      },
      {
        kind: 'finding',
        severityLabel: 'Note',
        wording: 'Camera reaches the end of its rail',
        explanation:
          'The rail camera has travelled its full length; it holds its final position for the rest of the shot.',
        frame: 200,
      },
    ]);
  });

  // The finding's own severity and message differ from the table, so a row built from them would fail.
  // Catches: using finding.severity or finding.message instead of describeFinding for a known code.
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
  ])('known code %s gives the table wording, explanation and label', (code, label, wording, explanation) => {
    const otherSeverity: Severity = label === 'Note' ? 'warning' : 'info';
    const rows = buildMotionCheckRows([finding(33, code, otherSeverity, 'raw linter message')], null);
    expect(rows).toEqual([{ kind: 'finding', severityLabel: label, wording, explanation, frame: 33 }]);
  });

  // Catches: the unknown-code branch ignoring the finding's severity (always 'Note'), or dropping its message.
  it.each([
    ['warning', 'Warning'],
    ['info', 'Note'],
  ] as const)('an unknown code with severity %s uses its own message, label %s and no explanation', (severity, label) => {
    const rows = buildMotionCheckRows([finding(5, 'made-up-code', severity, 'Something odd happened')], null);
    expect(rows).toEqual([
      { kind: 'finding', severityLabel: label, wording: 'Something odd happened', explanation: '', frame: 5 },
    ]);
  });

  // Catches: testing findings before the failure (the failure must win), or returning the findings as well.
  it('a failure message gives one error row whatever the findings are', () => {
    const withNone = buildMotionCheckRows([], FAILURE);
    const withThree = buildMotionCheckRows(THREE, FAILURE);
    expect(withNone).toHaveLength(1);
    expect(withThree).toEqual(withNone);
    expect(withThree[0].kind).toBe('error');
    expect(withThree[0].frame).toBeNull();
  });

  // Catches: leaving out the 'Error' label, not capitalising, not trimming, or putting a frame on the row.
  it('the error row has the label Error, the capitalised trimmed failure and no frame', () => {
    const rows = buildMotionCheckRows([], '  the motion check could not run: the camera bake threw  ');
    expect(rows[0]).toEqual({
      kind: 'error',
      severityLabel: 'Error',
      wording: 'The motion check could not run: the camera bake threw',
      explanation: WHAT_TO_DO,
      frame: null,
    });
  });

  // The one place the what-to-do wording is checked as a literal. Catches: an empty or changed what-to-do line.
  it('the error row says what the User can do', () => {
    expect(buildMotionCheckRows([], FAILURE)[0].explanation).toBe(
      'Change a setting to run the check again. The shot itself still plays.',
    );
  });

  // Catches: dropping the blank check, so an empty "what failed" is shown.
  it.each(['', '   '])('a blank failure message %j uses the fallback text', (blank) => {
    const rows = buildMotionCheckRows([], blank);
    expect(rows).toEqual([
      {
        kind: 'error',
        severityLabel: 'Error',
        wording: 'The motion check could not run.',
        explanation: WHAT_TO_DO,
        frame: null,
      },
    ]);
  });

  // Catches: Number.isFinite removed (a NaN or infinite frame would be passed on to the Timeline).
  it.each([NaN, Infinity, -Infinity])('a finding frame of %s becomes null', (frame) => {
    const rows = buildMotionCheckRows([finding(frame, 'speed-spike', 'info', 'raw')], null);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('finding');
    expect(rows[0].frame).toBeNull();
    expect(activateRow(rows, 0)).toBeNull();
  });

  // Catches: the model sorting, splicing or editing the input list or its findings.
  it('does not change its inputs', () => {
    const findings: Finding[] = [
      finding(200, 'path-end-reached', 'warning', 'raw 1'),
      finding(10, 'made-up-code', 'info', 'raw 2'),
    ];
    const before = JSON.stringify(findings);
    const rows = buildMotionCheckRows(findings, null);
    expect(JSON.stringify(findings)).toBe(before);
    const rowsBefore = JSON.stringify(rows);
    activateRow(rows, 0);
    activateRow(rows, 99);
    expect(JSON.stringify(rows)).toBe(rowsBefore);
  });
});

describe('motionCheckFailureOf', () => {
  // Catches: returning the untrimmed message, or the prefix check being case-sensitive in the wrong way.
  it('returns the trimmed message when it starts with the prefix', () => {
    expect(motionCheckFailureOf('  the motion check could not run: boom \n')).toBe(
      'the motion check could not run: boom',
    );
    expect(motionCheckFailureOf('The motion check could not run: boom')).toBe(
      'The motion check could not run: boom',
    );
  });

  // Catches: dereferencing null (a crash) or returning '' for no message.
  it('returns null for a null message', () => {
    expect(motionCheckFailureOf(null)).toBeNull();
  });

  // Catches: `includes` instead of `startsWith`, so a message that only contains the prefix counts as a failure.
  it.each([
    'Shot is shorter than the lens allows.',
    'note: the motion check could not run',
    '',
  ])('returns null for the message %j', (message) => {
    expect(motionCheckFailureOf(message)).toBeNull();
  });
});

describe('activateRow', () => {
  // Catches: returning the index instead of the finding's frame (the task's named mutation).
  it("returns the finding's own frame, not the row index", () => {
    const rows = buildMotionCheckRows(THREE, null);
    expect(activateRow(rows, 0)).toBe(10);
    expect(activateRow(rows, 1)).toBe(200);
    expect(activateRow(rows, 2)).toBe(7);
  });

  // Catches: a missing bounds check (-1 or length reads undefined and throws), or accepting a fraction or NaN.
  it.each([-1, 3, NaN, 1.5])('returns null for the index %s', (index) => {
    const rows = buildMotionCheckRows(THREE, null);
    expect(activateRow(rows, index)).toBeNull();
  });

  // Catches: giving the empty row or the error row a frame, so activating it would move the Timeline.
  it('returns null for the empty row and for the error row', () => {
    const empty: MotionCheckRow[] = buildMotionCheckRows([], null);
    const error: MotionCheckRow[] = buildMotionCheckRows(THREE, FAILURE);
    expect(activateRow(empty, 0)).toBeNull();
    expect(activateRow(error, 0)).toBeNull();
    expect(activateRow([], 0)).toBeNull();
  });
});
