// Tests for the Shot_Strip frame picker.
//
// Source lines these tests should catch:
// - Using round(k * length / 5) instead of round(k * (length - 1) / 5): the last value
//   becomes the shot length itself (for example 60), which is out of range.
// - Using Math.floor instead of Math.round. For length 60 the exact values are
//   59 * k / 5 for k = 0..5: 0, 11.8, 23.6, 35.4, 47.2, 59. Math.floor would change 12 to 11
//   and 24 to 23. It would not change 35 or 47 (35.4 and 47.2 round down either way).

import { describe, expect, it } from 'vitest';
import { stripFrames } from '../../src/logic/strip-frames.js';

describe('stripFrames', () => {
  it.each([
    { length: 60, expected: [0, 12, 24, 35, 47, 59] },
    { length: 240, expected: [0, 48, 96, 143, 191, 239] },
    { length: 600, expected: [0, 120, 240, 359, 479, 599] },
  ])('length $length gives $expected', ({ length, expected }) => {
    expect(stripFrames(length)).toEqual(expected);
  });

  it('gives six whole, increasing values from 0 to length - 1 for every length 60 to 600', () => {
    let problem = '';
    for (let length = 60; length <= 600 && problem === ''; length++) {
      const values = stripFrames(length);
      if (values.length !== 6) {
        problem = `length ${length}: expected 6 values, got ${values.length}`;
        break;
      }
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (!Number.isInteger(v) || Object.is(v, -0)) {
          problem = `length ${length}, index ${i}: value ${String(v)} is not a whole number or is -0`;
          break;
        }
        if (i > 0 && !(v > values[i - 1])) {
          problem = `length ${length}, index ${i}: value ${v} is not greater than ${values[i - 1]}`;
          break;
        }
      }
      if (problem === '' && values[0] !== 0) {
        problem = `length ${length}, index 0: value ${values[0]} is not 0`;
      }
      if (problem === '' && values[5] !== length - 1) {
        problem = `length ${length}, index 5: value ${values[5]} is not ${length - 1}`;
      }
    }
    expect(problem).toBe('');
  });

  it('matches exact whole-number rounding floor((2 * k * (length - 1) + 5) / 10) for every length 60 to 600', () => {
    let problem = '';
    for (let length = 60; length <= 600 && problem === ''; length++) {
      const values = stripFrames(length);
      for (let k = 0; k < 6; k++) {
        const want = Math.floor((2 * k * (length - 1) + 5) / 10);
        if (values[k] !== want) {
          problem = `length ${length}, index ${k}: value ${String(values[k])}, expected ${want}`;
          break;
        }
      }
    }
    expect(problem).toBe('');
  });

  it.each([59, 601, 60.5, NaN, Infinity, -1, 0])('throws an Error naming stripFrames for length %s', (bad) => {
    expect(() => stripFrames(bad)).toThrow(Error);
    expect(() => stripFrames(bad)).toThrow(/stripFrames/);
  });

  // A shared array returned by every call would make `first` change after the second call.
  it('returns a new array each call', () => {
    const first = stripFrames(60);
    const second = stripFrames(240);
    expect(first).toEqual([0, 12, 24, 35, 47, 59]);
    expect(second).not.toBe(first);
    first[1] = 999;
    expect(stripFrames(60)).toEqual([0, 12, 24, 35, 47, 59]);
  });
});
