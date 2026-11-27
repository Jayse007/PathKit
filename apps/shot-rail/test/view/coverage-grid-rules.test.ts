import { describe, expect, it } from 'vitest';
import {
  addCamera,
  GRID_REFRESH_INTERVAL_MS,
  selectMain,
  shouldRenderGrid,
} from '../../src/view/coverage-grid-rules.js';
import type { GridMode } from '../../src/view/coverage-grid-rules.js';

// All expected values below are written by hand. The refresh interval is 100 ms
// (1000 ms / 10 Hz) and the camera limit is 6. Neither is read from the code under test.

type Row = [GridMode, boolean, boolean, number, boolean];

// mode, changed, playing, msSinceLast, expected decision
const RENDER_TABLE: Row[] = [
  // Angle, changed: always draws, whatever the playing flag or the time.
  ['angle', true, true, 0, true],
  ['angle', true, true, 99, true],
  ['angle', true, true, 100, true],
  ['angle', true, true, 250, true],
  ['angle', true, false, 0, true],
  ['angle', true, false, 99, true],
  ['angle', true, false, 100, true],
  ['angle', true, false, 250, true],
  // Angle, nothing changed, playing: draws only once 100 ms have passed.
  ['angle', false, true, 0, false],
  ['angle', false, true, 99, false],
  ['angle', false, true, 100, true],
  ['angle', false, true, 250, true],
  // Angle, nothing changed, stopped: never draws.
  ['angle', false, false, 0, false],
  ['angle', false, false, 99, false],
  ['angle', false, false, 100, false],
  ['angle', false, false, 250, false],
  // Move mode: never draws, whatever else is true.
  ['move', true, true, 0, false],
  ['move', true, true, 99, false],
  ['move', true, true, 100, false],
  ['move', true, true, 250, false],
  ['move', true, false, 0, false],
  ['move', true, false, 99, false],
  ['move', true, false, 100, false],
  ['move', true, false, 250, false],
  ['move', false, true, 0, false],
  ['move', false, true, 99, false],
  ['move', false, true, 100, false],
  ['move', false, true, 250, false],
  ['move', false, false, 0, false],
  ['move', false, false, 99, false],
  ['move', false, false, 100, false],
  ['move', false, false, 250, false],
];

describe('shouldRenderGrid', () => {
  // Catches: removing the Angle-mode check (the 'move' rows turn true);
  // dropping the `changed` shortcut (angle/changed rows turn false when time < 100);
  // ignoring `playing` (stopped rows turn true at 100 and 250).
  it.each(RENDER_TABLE)(
    'mode %s, changed %s, playing %s, %i ms -> %s',
    (mode, changed, playing, ms, expected) => {
      expect(shouldRenderGrid(mode, changed, playing, ms)).toBe(expected);
    },
  );

  // Catches: using >= vs > (100 must draw), or an interval of 1000 / 30 = 33.3 (99 would draw).
  it('while playing and unchanged, 99 ms does not draw and 100 ms does', () => {
    expect(shouldRenderGrid('angle', false, true, 99)).toBe(false);
    expect(shouldRenderGrid('angle', false, true, 100)).toBe(true);
  });

  // Catches: changing PLAYBACK_RATE_GRID or the formula (1000 / 30 gives 33.33, not 100).
  it('the refresh interval is 100 ms (1000 / 10 Hz)', () => {
    expect(GRID_REFRESH_INTERVAL_MS).toBe(100);
  });
});

describe('addCamera', () => {
  // Catches: adding the wrong amount, or an off-by-one limit that refuses at 5.
  it.each([
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
  ])('a list of %i cameras accepts one more and becomes %i', (before, after) => {
    const result = addCamera(before);
    expect(result).toEqual({ ok: true, count: after });
  });

  // Catches: `>` instead of `>=` (the seventh camera would be accepted); count changed on refusal.
  it('refuses a seventh camera and leaves the count at 6', () => {
    const result = addCamera(6);
    expect(result.ok).toBe(false);
    expect(result.count).toBe(6);
  });

  // Catches: a limit check that only tests `=== 6` (a count above the limit would be accepted).
  it('refuses at counts above the limit and returns the count unchanged', () => {
    const seven = addCamera(7);
    const ten = addCamera(10);
    expect(seven.ok).toBe(false);
    expect(seven.count).toBe(7);
    expect(ten.ok).toBe(false);
    expect(ten.count).toBe(10);
  });

  // Catches: an empty message, or a message that does not state the limit of 6.
  it('the refusal message states the limit of 6', () => {
    const result = addCamera(6);
    if (result.ok) throw new Error('addCamera(6) was accepted');
    expect(result.message).toContain('6');
    expect(result.message).toContain('cameras');
    expect(result.message).toContain('At most 6');
  });
});

describe('selectMain', () => {
  // Catches: returning a fixed id or the first camera instead of the clicked one.
  it('a click on tile 3 selects cam-3', () => {
    expect(selectMain('cam-3')).toBe('cam-3');
  });

  // Catches: an id mapping that swaps or shifts tiles (e.g. returning the previous or next id).
  it.each(['cam-1', 'cam-2', 'cam-3', 'cam-4', 'cam-5', 'cam-6'])(
    'a click on %s selects that same camera',
    (id) => {
      expect(selectMain(id)).toBe(id);
    },
  );
});
