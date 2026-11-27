import { describe, expect, it } from 'vitest';
import {
  initialPlaybackState,
  pausePlayback,
  playPlayback,
  seekPlayback,
  stepPlayback,
  type PlaybackState,
} from '../../src/logic/playback.js';

// Expected values are written by hand as literals. 30 fps, so one frame = 1000 / 30 = 33.333... ms.
// The catch-up cap is the literal 5 frames per call. No constant is imported as an expectation.

function playing(frame: number, accumulatorMs: number): PlaybackState {
  return { playing: true, frame, accumulatorMs };
}

function paused(frame: number, accumulatorMs: number): PlaybackState {
  return { playing: false, frame, accumulatorMs };
}

describe('initial state', () => {
  it('starts paused at frame 0 with nothing accumulated', () => {
    expect(initialPlaybackState()).toEqual({ playing: false, frame: 0, accumulatorMs: 0 });
  });
});

describe('play and pause', () => {
  it('play from the start sets playing and keeps frame 0', () => {
    expect(playPlayback(initialPlaybackState(), 100)).toEqual({ playing: true, frame: 0, accumulatorMs: 0 });
  });

  it.each([
    ['at the last frame', 100, 100],
    ['past the last frame', 120, 100],
  ])('play %s restarts at frame 0', (_label, frame, lastFrame) => {
    expect(playPlayback(paused(frame, 0), lastFrame)).toEqual({ playing: true, frame: 0, accumulatorMs: 0 });
  });

  it('play in the middle keeps the frame and clears the accumulator', () => {
    expect(playPlayback(paused(50, 20), 100)).toEqual({ playing: true, frame: 50, accumulatorMs: 0 });
  });

  it('pause keeps the frame, clears playing and the accumulator', () => {
    expect(pausePlayback(playing(42, 20))).toEqual({ playing: false, frame: 42, accumulatorMs: 0 });
  });

  it('pause on an already paused state changes nothing but the accumulator', () => {
    expect(pausePlayback(paused(7, 12))).toEqual({ playing: false, frame: 7, accumulatorMs: 0 });
  });
});

describe('seek', () => {
  // Rows: requested frame, lastFrame 100, expected frame.
  it.each([
    [-5, 0], // below 0 clamps to 0
    [150, 100], // above the last frame clamps to 100
    [3.4, 3], // rounds down
    [3.6, 4], // rounds up
    [2.5, 3], // half rounds up
    [0, 0],
    [100, 100],
  ])('seek to %s gives frame %s', (requested, expected) => {
    expect(seekPlayback(paused(10, 0), requested, 100).frame).toBe(expected);
  });

  it('keeps playing true when it was true, and clears the accumulator', () => {
    expect(seekPlayback(playing(10, 20), 30, 100)).toEqual({ playing: true, frame: 30, accumulatorMs: 0 });
  });

  it('keeps playing false when it was false (a scrub never starts playback)', () => {
    expect(seekPlayback(paused(10, 20), 30, 100)).toEqual({ playing: false, frame: 30, accumulatorMs: 0 });
  });
});

describe('step', () => {
  it('while paused changes nothing, whatever the elapsed time', () => {
    expect(stepPlayback(paused(7, 12), 1000, 100)).toEqual({ playing: false, frame: 7, accumulatorMs: 12 });
  });

  it('33.34 ms advances 1 frame', () => {
    // 33.34 * 30 / 1000 = 1.0002 -> 1 frame; remainder 33.34 - 33.3333 = 0.00667 ms.
    const next = stepPlayback(playing(0, 0), 33.34, 100);
    expect(next.playing).toBe(true);
    expect(next.frame).toBe(1);
    expect(next.accumulatorMs).toBeCloseTo(0.00667, 4);
  });

  it('100 ms advances 3 frames with nothing left over', () => {
    // 100 * 30 / 1000 = 3 exactly; remainder 100 - 3 * 33.3333 = 0.
    const next = stepPlayback(playing(0, 0), 100, 100);
    expect(next.frame).toBe(3);
    expect(next.accumulatorMs).toBeCloseTo(0, 6);
  });

  it('33.33 ms advances 0 frames and keeps the time', () => {
    // 33.33 * 30 / 1000 = 0.9999 -> 0 frames; the whole 33.33 ms stays in the accumulator.
    expect(stepPlayback(playing(4, 0), 33.33, 100)).toEqual({ playing: true, frame: 4, accumulatorMs: 33.33 });
  });

  it('0 ms changes nothing', () => {
    expect(stepPlayback(playing(4, 12), 0, 100)).toEqual({ playing: true, frame: 4, accumulatorMs: 12 });
  });

  it('accumulates sub-frame time across calls: two 20 ms steps advance 1 frame', () => {
    // Step 1: 20 * 30 / 1000 = 0.6 -> 0 frames, accumulator 20.
    const first = stepPlayback(playing(0, 0), 20, 100);
    expect(first.frame).toBe(0);
    expect(first.accumulatorMs).toBe(20);
    // Step 2: total 40 ms -> 1.2 -> 1 frame; remainder 40 - 33.3333 = 6.6667 ms.
    const second = stepPlayback(first, 20, 100);
    expect(second.frame).toBe(1);
    expect(second.accumulatorMs).toBeCloseTo(6.6667, 3);
  });

  it('144 ticks of 1000 / 144 ms (one second on a 144 Hz screen) advance exactly 30 frames', () => {
    // 144 ticks x 6.9444 ms = 1000 ms = 30 frames at 30 fps. Without PLAYBACK_FRAME_EPSILON the running total comes out a hair under 30 frames and the result is frame 29.
    let state = playPlayback(initialPlaybackState(), 1000);
    for (let i = 0; i < 144; i++) state = stepPlayback(state, 1000 / 144, 1000);
    expect(state.frame).toBe(30);
    expect(state.accumulatorMs).toBe(0);
  });
});

describe('catch-up cap', () => {
  it('10 000 ms advances at most 5 frames', () => {
    // 10000 * 30 / 1000 = 300 frames wanted; capped at 5. Backlog dropped, accumulator 0.
    expect(stepPlayback(playing(10, 0), 10000, 1000)).toEqual({ playing: true, frame: 15, accumulatorMs: 0 });
  });

  it('200 ms (6 frames wanted) advances 5, not 6', () => {
    // 200 * 30 / 1000 = 6 > 5, so 10 + 5 = 15.
    expect(stepPlayback(playing(10, 0), 200, 1000).frame).toBe(15);
  });

  it('166.67 ms (5 frames) is under the cap and keeps its remainder', () => {
    // 166.67 * 30 / 1000 = 5.0001 -> 5 frames; remainder 166.67 - 166.6667 = 0.0033 ms.
    const next = stepPlayback(playing(10, 0), 166.67, 1000);
    expect(next.frame).toBe(15);
    expect(next.accumulatorMs).toBeCloseTo(0.0033, 3);
  });

  it('drops the backlog: a 0 ms step after a capped step does not move', () => {
    const capped = stepPlayback(playing(10, 0), 10000, 1000);
    expect(stepPlayback(capped, 0, 1000)).toEqual({ playing: true, frame: 15, accumulatorMs: 0 });
  });
});

describe('last frame', () => {
  it('reaching the last frame stops playback there and clears the accumulator', () => {
    // Frame 9, lastFrame 10, 33.34 ms = 1 frame -> 10.
    expect(stepPlayback(playing(9, 10), 33.34, 10)).toEqual({ playing: false, frame: 10, accumulatorMs: 0 });
  });

  it('clamps when the step would pass the last frame', () => {
    // Frame 8 + 3 = 11 > 10, so 10.
    expect(stepPlayback(playing(8, 0), 100, 10)).toEqual({ playing: false, frame: 10, accumulatorMs: 0 });
  });

  it('clamps when a capped step would pass the last frame', () => {
    // Frame 8 + 5 (cap) = 13 > 10, so 10.
    expect(stepPlayback(playing(8, 0), 10000, 10)).toEqual({ playing: false, frame: 10, accumulatorMs: 0 });
  });
});

describe('invalid input', () => {
  it.each([
    ['negative', -1, /-1/],
    ['NaN', Number.NaN, /NaN/],
    ['Infinity', Number.POSITIVE_INFINITY, /Infinity/],
    ['-Infinity', Number.NEGATIVE_INFINITY, /-Infinity/],
  ])('step throws naming elapsedMs when it is %s (playing or paused)', (_label, value, pattern) => {
    expect(() => stepPlayback(playing(0, 0), value, 100)).toThrow(pattern);
    expect(() => stepPlayback(paused(0, 0), value, 100)).toThrow(pattern);
  });

  const badLastFrames: Array<[string, number, RegExp]> = [
    ['non-whole', 1.5, /1\.5/],
    ['negative', -1, /-1/],
    ['NaN', Number.NaN, /NaN/],
  ];
  const lastFrameRows: Array<[string, (last: number) => unknown, number, RegExp]> = [];
  for (const [label, value, pattern] of badLastFrames) {
    lastFrameRows.push([`step, lastFrame ${label}`, (last) => stepPlayback(playing(0, 0), 10, last), value, pattern]);
    lastFrameRows.push([`play, lastFrame ${label}`, (last) => playPlayback(paused(0, 0), last), value, pattern]);
    lastFrameRows.push([`seek, lastFrame ${label}`, (last) => seekPlayback(paused(0, 0), 3, last), value, pattern]);
  }
  it.each(lastFrameRows)('%s throws naming the value', (_label, call, value, pattern) => {
    expect(() => call(value)).toThrow(pattern);
  });

  it.each([
    ['NaN', Number.NaN, /NaN/],
    ['Infinity', Number.POSITIVE_INFINITY, /Infinity/],
    ['-Infinity', Number.NEGATIVE_INFINITY, /-Infinity/],
  ])('seek throws naming the frame when it is %s', (_label, value, pattern) => {
    expect(() => seekPlayback(paused(0, 0), value, 100)).toThrow(pattern);
  });
});

describe('inputs are not mutated', () => {
  const calls: Array<[string, (s: PlaybackState) => PlaybackState]> = [
    ['play', (s) => playPlayback(s, 100)],
    ['pause', (s) => pausePlayback(s)],
    ['seek', (s) => seekPlayback(s, 30, 100)],
    ['step', (s) => stepPlayback(s, 100, 100)],
  ];
  it.each(calls)('%s leaves the input object as it was and returns a new object', (_name, call) => {
    const input = playing(20, 12);
    const copy = { ...input };
    const result = call(input);
    expect(input).toEqual(copy);
    expect(result).not.toBe(input);
  });
});

describe('events that must not start playback', () => {
  // Only the events this pure module owns. Load sample, mode, Shot_Type, Subject, Shot_Length
  // and re-bake are outside this module; they must not call playPlayback (checked in the view tasks).
  it.each([
    ['start', () => initialPlaybackState()],
    ['pause', () => pausePlayback(playing(5, 3))],
    ['scrub (seek)', () => seekPlayback(paused(5, 3), 40, 100)],
    ['keyboard step (seek by one frame)', () => seekPlayback(paused(5, 3), 6, 100)],
    ['step while paused', () => stepPlayback(paused(5, 3), 500, 100)],
  ])('%s leaves playing false', (_label, make) => {
    expect(make().playing).toBe(false);
  });
});

describe('frames are always whole numbers', () => {
  it('holds over many elapsed values and chained steps', () => {
    const elapsedValues = [0, 1, 7.5, 16.7, 33.33, 33.34, 50, 99.99, 100, 250, 1000, 12345.678];
    for (let i = 0; i < elapsedValues.length; i += 1) {
      const next = stepPlayback(playing(3, 5), elapsedValues[i]!, 1000);
      if (!Number.isInteger(next.frame)) {
        throw new Error(`whole-frame check: elapsed index ${i} gave frame ${next.frame}`);
      }
    }
    let state = playPlayback(initialPlaybackState(), 1000);
    let previous = 0;
    for (let i = 0; i < 300; i += 1) {
      state = stepPlayback(state, 16.7, 1000);
      if (!Number.isInteger(state.frame) || state.frame < previous || state.frame > 1000) {
        throw new Error(`whole-frame check: chained step ${i} gave frame ${state.frame} after ${previous}`);
      }
      if (state.accumulatorMs < 0 || state.accumulatorMs >= 33.34) {
        throw new Error(`accumulator check: chained step ${i} gave ${state.accumulatorMs}`);
      }
      previous = state.frame;
    }
    const seeked = seekPlayback(paused(0, 0), 7.49, 100);
    if (!Number.isInteger(seeked.frame)) {
      throw new Error(`whole-frame check: seek gave frame ${seeked.frame}`);
    }
  });
});
