import { describe, expect, it } from 'vitest';
import { BAKED_LAP_FRAMES, EASE_AMPLITUDE, LAP_FRAMES } from '../../src/logic/constants.js';
import { remapDisplayedFrame } from '../../src/logic/frame-remap.js';

function remap(f: number): number {
  return remapDisplayedFrame(f, LAP_FRAMES, BAKED_LAP_FRAMES, EASE_AMPLITUDE);
}

describe('remapDisplayedFrame', () => {
  it('matches the hand-written worked table', () => {
    // Expected values worked out by hand from the design formula.
    const table: Array<[number, number]> = [
      [0, 0],
      [1, 12],
      [60, 633],
      [120, 960],
      [239, 1908],
      [240, 0],
      [241, 12],
      [599, 956],
    ];
    for (const [f, expected] of table) {
      const got = remap(f);
      if (got !== expected) {
        throw new Error(`worked table: f=${f} expected ${expected}, got ${got}`);
      }
    }
    expect(table.length).toBe(8);
  });

  it('sweep f = 0..599 is deterministic, whole, in range, non-decreasing per lap, with varying steps', () => {
    const stepSizes = new Set<number>();
    let prev = -1;
    for (let f = 0; f < 600; f++) {
      const a = remap(f);
      const b = remap(f);
      if (a !== b) throw new Error(`repeatable: f=${f} gave ${a} then ${b}`);
      if (!Number.isInteger(a)) throw new Error(`whole number: f=${f} gave ${a}`);
      if (a < 0 || a > 1919) throw new Error(`range: f=${f} gave ${a}`);
      if (f % LAP_FRAMES !== 0) {
        if (a < prev) throw new Error(`non-decreasing: f=${f} gave ${a} after ${prev}`);
        stepSizes.add(a - prev);
      }
      prev = a;
    }
    if (stepSizes.size < 2) {
      throw new Error(`step sizes: expected at least 2 different sizes, got ${stepSizes.size}`);
    }
    expect(stepSizes.size).toBeGreaterThanOrEqual(2);
  });

  it('throws an Error naming the value for invalid frames', () => {
    const bad: Array<[number, string]> = [
      [-1, '-1'],
      [1.5, '1.5'],
      [NaN, 'NaN'],
      [Infinity, 'Infinity'],
      [-0.5, '-0.5'],
    ];
    for (const [value, text] of bad) {
      expect(() => remap(value)).toThrow(Error);
      expect(() => remap(value)).toThrow(text);
    }
  });
});
