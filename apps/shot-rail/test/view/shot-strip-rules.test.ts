// Tests for the Shot_Strip text rules.
//
// Source lines these tests should catch:
// - Using frame + 1 in the label (for example `Frame ${frame + 1}`): the rows for 0, 143 and 599 fail.
// - Dropping the whole-number check (for example only checking frame < 0): 1.5 and NaN no longer throw.

import { describe, expect, it } from 'vitest';
import { stripAriaLabel, stripLabel } from '../../src/view/shot-strip-rules.js';

describe('shot strip text', () => {
  it.each([
    { frame: 0, label: 'Frame 0', aria: 'Go to frame 0' },
    { frame: 143, label: 'Frame 143', aria: 'Go to frame 143' },
    { frame: 599, label: 'Frame 599', aria: 'Go to frame 599' },
  ])('frame $frame gives "$label" and "$aria"', ({ frame, label, aria }) => {
    expect(stripLabel(frame)).toBe(label);
    expect(stripAriaLabel(frame)).toBe(aria);
  });

  it.each([-1, 1.5, NaN])('both functions throw an Error naming themselves for frame %s', (bad) => {
    expect(() => stripLabel(bad)).toThrow(Error);
    expect(() => stripLabel(bad)).toThrow(/stripLabel/);
    expect(() => stripAriaLabel(bad)).toThrow(Error);
    expect(() => stripAriaLabel(bad)).toThrow(/stripAriaLabel/);
  });
});
