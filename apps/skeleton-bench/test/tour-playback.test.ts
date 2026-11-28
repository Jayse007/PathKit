import { describe, expect, it } from 'vitest';
import { tourPartIndexAt } from '../src/logic/tour-playback.js';

// These hand-written values catch two source mistakes in tourPartIndexAt:
// floor changed to Math.round (frame 45 would give Part 1), or the Math.min clamp removed (frame 720 would give 8).
describe('tourPartIndexAt', () => {
  it('stays on Part 0 for frames 0, 44, 45 and 89 (8 Parts)', () => {
    expect([0, 44, 45, 89].map((f) => tourPartIndexAt(f, 8))).toEqual([0, 0, 0, 0]);
  });

  it('moves to the next Part at each multiple of 90 (8 Parts)', () => {
    expect(tourPartIndexAt(90, 8)).toBe(1);
    expect(tourPartIndexAt(359, 8)).toBe(3);
    expect(tourPartIndexAt(360, 8)).toBe(4);
  });

  it('gives the last Part for the last frame of the last slot', () => {
    expect(tourPartIndexAt(719, 8)).toBe(7);
    expect(tourPartIndexAt(539, 6)).toBe(5);
    expect(tourPartIndexAt(629, 7)).toBe(6);
  });

  it('clamps a frame past the end to the last Part', () => {
    expect(tourPartIndexAt(720, 8)).toBe(7);
  });

  it('throws for a negative or fractional frame, NaN, and fewer than 1 Part', () => {
    expect(() => tourPartIndexAt(-1, 8)).toThrow();
    expect(() => tourPartIndexAt(1.5, 8)).toThrow();
    expect(() => tourPartIndexAt(Number.NaN, 8)).toThrow();
    expect(() => tourPartIndexAt(0, 0)).toThrow();
  });
});
