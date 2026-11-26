import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../src/logic/contrast.js';
import { CLEAN_FILLS, LOOK_PALETTES, cleanFillIndex } from '../src/render/looks.js';

// Task 17.6: the three Clean_Engineering greys, each against the Clean_Engineering background.
describe('Clean_Engineering greys', () => {
  const background = LOOK_PALETTES.Clean_Engineering.background;
  const handValues = [3.16, 4.84, 7.33];

  it('uses the background #eceff1', () => {
    expect(background).toBe('#eceff1');
  });

  it.each([0, 1, 2])('grey %i has contrast at least 3 and matches the hand value', (i) => {
    const ratio = contrastRatio(CLEAN_FILLS[i]!, background);
    expect(ratio).toBeGreaterThanOrEqual(3);
    expect(Math.abs(ratio - handValues[i]!)).toBeLessThanOrEqual(0.01);
  });

  it('the three greys are pairwise different', () => {
    expect(new Set(CLEAN_FILLS).size).toBe(3);
  });

  it('assigns A, B, C, A, B, C, A, B to Part indices 0 to 7', () => {
    const got = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => cleanFillIndex(i));
    expect(got).toEqual([0, 1, 2, 0, 1, 2, 0, 1]);
  });
});
