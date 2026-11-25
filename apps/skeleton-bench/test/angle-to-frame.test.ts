import { describe, expect, it } from 'vitest';
import { angleToFrame } from '../src/logic/frame-mapper.js';

// Design Properties 1 and 2. Requirements 5.2 to 5.7, 35.2.
describe('angleToFrame', () => {
  it('matches the hand-written table', () => {
    const table: ReadonlyArray<readonly [number, number]> = [
      [0, 0],
      [90, 90],
      [180, 180],
      [270, 270],
      [-90, 270],
      [360, 0],
      [359.9, 0],
      [0.4, 0],
      [0.5, 1],
      [720, 0],
    ];
    for (let i = 0; i < table.length; i++) {
      const angle = table[i][0];
      const want = table[i][1];
      const got = angleToFrame(angle);
      if (got !== want) {
        throw new Error(`table check: index ${i}, angle ${angle}, expected ${want}, got ${got}`);
      }
    }
  });

  it('returns only whole frames 0 to 359 for -720 to 720 in steps of 0.25', () => {
    let index = 0;
    for (let a = -720; a <= 720; a += 0.25) {
      const got = angleToFrame(a);
      if (!Number.isInteger(got) || got < 0 || got > 359) {
        throw new Error(`sweep check: index ${index}, angle ${a}, got ${got}`);
      }
      index++;
    }
    expect(index).toBe(5761);
  });

  it('throws with the value in the message for non-finite input', () => {
    const bad: ReadonlyArray<readonly [number, string]> = [
      [NaN, 'NaN'],
      [Infinity, 'Infinity'],
      [-Infinity, '-Infinity'],
    ];
    for (let i = 0; i < bad.length; i++) {
      expect(() => angleToFrame(bad[i][0])).toThrow(Error);
      expect(() => angleToFrame(bad[i][0])).toThrow(bad[i][1]);
    }
  });

  it('gives the same output for the same input', () => {
    const inputs = [0, 0.5, 359.9, -90, 720, 123.25];
    for (let i = 0; i < inputs.length; i++) {
      const first = angleToFrame(inputs[i]);
      const second = angleToFrame(inputs[i]);
      if (first !== second) {
        throw new Error(`repeat check: index ${i}, angle ${inputs[i]}, got ${first} then ${second}`);
      }
    }
  });
});
