import { describe, expect, it } from 'vitest';
import { angleLabel, framingLabel } from '../../src/logic/labels.js';

// Hand-written tables. The inputs are boundary values, not computed results.
const ELEVATION_TABLE: Array<[number, string]> = [
  [-10.1, 'low angle'],
  [-10, 'eye level'],
  [-9.9, 'eye level'],
  [9.9, 'eye level'],
  [10, 'eye level'],
  [10.1, 'high angle'],
  [59.9, 'high angle'],
  [60, 'high angle'],
  [60.1, 'overhead'],
];

const FILL_TABLE: Array<[number, string]> = [
  [34.9, 'wide'],
  [35, 'medium'],
  [35.1, 'medium'],
  [69.9, 'medium'],
  [70, 'medium'],
  [70.1, 'close-up'],
];

describe('angleLabel', () => {
  it('matches the elevation table at every boundary', () => {
    for (let i = 0; i < ELEVATION_TABLE.length; i++) {
      const [input, expected] = ELEVATION_TABLE[i];
      const actual = angleLabel(input);
      if (actual !== expected) {
        throw new Error(`angleLabel table: index ${i}, input ${input}, expected ${expected}, got ${actual}`);
      }
    }
  });

  it('keeps eye level inclusive at +10 (catches <= 10 changed to < 10)', () => {
    expect(angleLabel(10)).toBe('eye level');
  });

  it('gives overhead, not high angle, far above 60', () => {
    expect(angleLabel(90)).toBe('overhead');
    expect(angleLabel(-90)).toBe('low angle');
  });
});

describe('framingLabel', () => {
  it('matches the fill table at every boundary', () => {
    for (let i = 0; i < FILL_TABLE.length; i++) {
      const [input, expected] = FILL_TABLE[i];
      const actual = framingLabel(input);
      if (actual !== expected) {
        throw new Error(`framingLabel table: index ${i}, input ${input}, expected ${expected}, got ${actual}`);
      }
    }
  });

  it('accepts 0 and 100', () => {
    expect(framingLabel(0)).toBe('wide');
    expect(framingLabel(100)).toBe('close-up');
  });

  it('throws naming the value for -0.1, 100.1, NaN and Infinity', () => {
    const bad: Array<[number, string]> = [
      [-0.1, '-0.1'],
      [100.1, '100.1'],
      [NaN, 'NaN'],
      [Infinity, 'Infinity'],
    ];
    for (const [input, text] of bad) {
      expect(() => framingLabel(input), `input ${text}`).toThrow(text);
    }
  });
});
