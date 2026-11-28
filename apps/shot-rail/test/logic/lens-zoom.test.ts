import { describe, expect, it } from 'vitest';
import { lensAfterWheel, presetOf, stepLens } from '../../src/logic/lens-zoom.js';

describe('lens zoom', () => {
  it('stepLens zooms in by the ratio', () => {
    // 50 x 1.1 = 55
    expect(stepLens(50, 1, 1.1)).toBeCloseTo(55, 8);
  });

  it('stepLens zooms out by dividing by the ratio', () => {
    // 50 / 1.1 = 45.454545...
    expect(stepLens(50, -1, 1.1)).toBeCloseTo(45.45454545, 8);
  });

  it('clamps at the long end', () => {
    // 80 x 1.1 = 88, above 85
    expect(stepLens(80, 1, 1.1)).toBe(85);
  });

  it('clamps at the short end', () => {
    // 25 / 1.1 = 22.727, below 24
    expect(stepLens(25, -1, 1.1)).toBe(24);
  });

  it('stays put at either end of the range', () => {
    // 85 x 1.1 = 93.5 -> 85. 24 / 1.1 = 21.8 -> 24.
    expect(stepLens(85, 1, 1.1)).toBe(85);
    expect(stepLens(24, -1, 1.1)).toBe(24);
  });

  it('pulls a lens outside the range back in', () => {
    // 100 / 1.1 = 90.909 -> 85. 10 x 1.1 = 11 -> 24.
    expect(stepLens(100, -1, 1.1)).toBe(85);
    expect(stepLens(10, 1, 1.1)).toBe(24);
  });

  it('lensAfterWheel uses the 5 percent step by wheel direction', () => {
    // 50 x 1.05 = 52.5. 50 / 1.05 = 47.619047...
    expect(lensAfterWheel(50, -100)).toBeCloseTo(52.5, 8);
    expect(lensAfterWheel(50, 100)).toBeCloseTo(47.61904762, 8);
    expect(lensAfterWheel(50, 0)).toBe(50);
    expect(lensAfterWheel(90, 0)).toBe(85);
  });

  it('presetOf matches presets exactly', () => {
    expect(presetOf(24)).toBe(24);
    expect(presetOf(35)).toBe(35);
    expect(presetOf(50)).toBe(50);
    expect(presetOf(85)).toBe(85);
    expect(presetOf(36)).toBeNull();
    expect(presetOf(50.0000001)).toBeNull();
  });

  it('throws naming the bad value', () => {
    expect(() => stepLens(0, 1, 1.1)).toThrow(/got 0$/);
    expect(() => stepLens(NaN, 1, 1.1)).toThrow(/NaN/);
    expect(() => stepLens(-5, 1, 1.1)).toThrow(/-5/);
    expect(() => stepLens(50, 1, 1)).toThrow(/got 1$/);
    expect(() => lensAfterWheel(50, NaN)).toThrow(/NaN/);
    expect(() => lensAfterWheel(50, Infinity)).toThrow(/Infinity/);
  });

  it('reaches the long end after 14 steps in from 24', () => {
    // 24 x 1.1^13 = 82.854, still inside. 24 x 1.1^14 = 91.14, clamped to 85.
    let mm = 24;
    for (let i = 0; i < 13; i += 1) mm = stepLens(mm, 1, 1.1);
    expect(mm).toBeCloseTo(82.85, 1);
    expect(stepLens(mm, 1, 1.1)).toBe(85);
  });
});
