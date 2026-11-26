import { describe, expect, it } from 'vitest';
import { frameToSeconds, scrubToFrame, secondsToFrame } from '../../src/logic/frame-mapper.js';

describe('scrubToFrame', () => {
  it('matches the hand-written table for lastFrame 239 and never returns -0', () => {
    // Expected values worked out by hand: clamp to [0, 239] first, then round (238.5 rounds to 239).
    const table: Array<[number, number]> = [
      [-5, 0],
      [-0.4, 0],
      [-0, 0],
      [0, 0],
      [0.4, 0],
      [238.5, 239],
      [239, 239],
      [239.5, 239],
      [244, 239],
    ];
    for (const [input, expected] of table) {
      const got = scrubToFrame(input, 239);
      if (got !== expected) {
        throw new Error(`scrub table: input=${input} expected ${expected}, got ${got}`);
      }
      if (Object.is(got, -0)) {
        throw new Error(`scrub table: input=${input} returned -0`);
      }
      if (!Number.isInteger(got)) {
        throw new Error(`scrub table: input=${input} returned ${got}, not a whole number`);
      }
    }
  });

  it('throws an Error that names the value for NaN, Infinity and -Infinity', () => {
    expect(() => scrubToFrame(Number.NaN, 239)).toThrow(Error);
    expect(() => scrubToFrame(Number.NaN, 239)).toThrow(/NaN/);
    expect(() => scrubToFrame(Number.POSITIVE_INFINITY, 239)).toThrow(/Infinity/);
    expect(() => scrubToFrame(Number.NEGATIVE_INFINITY, 239)).toThrow(/-Infinity/);
  });
});

describe('frameToSeconds and secondsToFrame', () => {
  it('round-trips every whole frame from 0 to 600 at 30 fps', () => {
    for (let f = 0; f <= 600; f += 1) {
      const got = secondsToFrame(frameToSeconds(f, 30), 30);
      if (got !== f) {
        throw new Error(`round trip at 30 fps: frame ${f} came back as ${got}`);
      }
      if (Object.is(got, -0)) {
        throw new Error(`round trip at 30 fps: frame ${f} came back as -0`);
      }
    }
  });
});
