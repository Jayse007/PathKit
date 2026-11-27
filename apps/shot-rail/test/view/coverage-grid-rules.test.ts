import { describe, expect, it } from 'vitest';
import {
  addCamera,
  GRID_REFRESH_INTERVAL_MS,
  planMainChange,
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

describe('planMainChange', () => {
  type Cam = {
    id: string;
    shotType: 'push-in' | 'orbit' | 'tracking' | 'crane';
    bearingDeg: number;
    heightM: number;
    horizontalDistanceM: number;
    lensMm: number;
  };
  const cam = (id: string, shotType: Cam['shotType']): Cam => ({
    id,
    shotType,
    bearingDeg: 30,
    heightM: -0.3,
    horizontalDistanceM: 12,
    lensMm: 50,
  });

  // Catches: leaving a push-in on a non-main camera, or a wrong message.
  it('converts a push-in camera to orbit when another camera becomes main', () => {
    const plan = planMainChange([cam('cam-1', 'push-in'), cam('cam-2', 'orbit')], 'cam-2');
    expect(plan.cameras.map((c) => c.shotType)).toEqual(['orbit', 'orbit']);
    expect(plan.converted).toEqual(['cam-1']);
    expect(plan.message).toBe('cam-1 changed from push-in to orbit. Only the main camera can be a rail shot.');
  });

  // Catches: leaving crane out of the check.
  it('converts a crane camera to orbit when another camera becomes main', () => {
    const plan = planMainChange([cam('cam-1', 'crane'), cam('cam-2', 'orbit')], 'cam-2');
    expect(plan.cameras.map((c) => c.shotType)).toEqual(['orbit', 'orbit']);
    expect(plan.message).toBe('cam-1 changed from crane to orbit. Only the main camera can be a rail shot.');
  });

  // Catches: converting the camera that is already main.
  it('changes nothing when the new main is the push-in camera itself', () => {
    const plan = planMainChange([cam('cam-1', 'push-in'), cam('cam-2', 'orbit')], 'cam-1');
    expect(plan.cameras.map((c) => c.shotType)).toEqual(['push-in', 'orbit']);
    expect(plan.converted).toEqual([]);
    expect(plan.message).toBe('');
  });

  // Catches: rebuilding the converted camera from defaults.
  it('keeps bearing, height, distance and lens of a converted camera', () => {
    const plan = planMainChange([cam('cam-1', 'push-in'), cam('cam-2', 'orbit')], 'cam-2');
    expect(plan.cameras[0]).toEqual({
      id: 'cam-1',
      shotType: 'orbit',
      bearingDeg: 30,
      heightM: -0.3,
      horizontalDistanceM: 12,
      lensMm: 50,
    });
  });

  // Catches: mutating the input or returning the same array or objects.
  it('does not change the input and returns a different list', () => {
    const input = [cam('cam-1', 'push-in'), cam('cam-2', 'orbit')];
    const plan = planMainChange(input, 'cam-2');
    expect(input[0].shotType).toBe('push-in');
    expect(input[1].shotType).toBe('orbit');
    expect(plan.cameras).not.toBe(input);
    expect(plan.cameras[0]).not.toBe(input[0]);
    expect(plan.cameras[1]).not.toBe(input[1]);
  });

  // Catches: silently accepting an unknown id.
  it('throws with the id when the new main is not in the list', () => {
    expect(() => planMainChange([cam('cam-1', 'orbit')], 'cam-9')).toThrow('cam-9');
  });

  // Catches: converting the new main camera.
  it('keeps the crane shot of the new main camera', () => {
    const plan = planMainChange([cam('cam-1', 'orbit'), cam('cam-2', 'crane')], 'cam-2');
    expect(plan.cameras.map((c) => c.shotType)).toEqual(['orbit', 'crane']);
    expect(plan.converted).toEqual([]);
    expect(plan.message).toBe('');
  });

  // Catches: stopping after the first conversion, or a wrong sentence order.
  it('converts several cameras in list order with one message', () => {
    const plan = planMainChange(
      [cam('cam-1', 'push-in'), cam('cam-2', 'crane'), cam('cam-3', 'orbit')],
      'cam-3',
    );
    expect(plan.cameras.map((c) => c.shotType)).toEqual(['orbit', 'orbit', 'orbit']);
    expect(plan.converted).toEqual(['cam-1', 'cam-2']);
    expect(plan.message).toBe(
      'cam-1 changed from push-in to orbit. cam-2 changed from crane to orbit. Only the main camera can be a rail shot.',
    );
  });

  // Catches: converting tracking cameras.
  it('never changes orbit or tracking cameras', () => {
    const plan = planMainChange(
      [cam('cam-1', 'orbit'), cam('cam-2', 'tracking'), cam('cam-3', 'orbit')],
      'cam-3',
    );
    expect(plan.cameras.map((c) => c.shotType)).toEqual(['orbit', 'tracking', 'orbit']);
    expect(plan.converted).toEqual([]);
    expect(plan.message).toBe('');
  });
});
