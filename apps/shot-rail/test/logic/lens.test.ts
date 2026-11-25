import { describe, expect, it } from 'vitest';
import { SENSOR_HEIGHT_MM, SENSOR_WIDTH_MM } from '../../src/logic/constants.js';
import { fieldOfViewForFocalLengthMm } from '../../src/logic/lens.js';

// Hand-written table, rounded to 1 decimal place: [focal mm, horizontal deg, vertical deg].
const TABLE: Array<[number, number, number]> = [
  [24, 73.7, 45.7],
  [35, 54.4, 32.3],
  [50, 39.6, 22.9],
  [85, 23.9, 13.6],
];

// A value rounded to 1 decimal place is within 0.05 of the true value.
const ROUNDING_TOLERANCE = 0.05;

describe('fieldOfViewForFocalLengthMm', () => {
  it('matches the hand-written table to 1 decimal place', () => {
    for (const [f, h, v] of TABLE) {
      const fov = fieldOfViewForFocalLengthMm(f);
      expect(Math.abs(fov.horizontalDeg - h), `horizontal at ${f} mm`).toBeLessThanOrEqual(ROUNDING_TOLERANCE);
      expect(Math.abs(fov.verticalDeg - v), `vertical at ${f} mm`).toBeLessThanOrEqual(ROUNDING_TOLERANCE);
    }
  });

  it('gives an unrounded 24 mm vertical value of 45.747 (not 45.75)', () => {
    const v = fieldOfViewForFocalLengthMm(24).verticalDeg;
    expect(Math.abs(v - 45.747)).toBeLessThan(0.001);
    expect(Math.abs(v - 45.75)).toBeGreaterThan(0.001);
  });

  it('agrees with an independent formula built from the sensor constants', () => {
    // Independent form: fov = 2 atan(half sensor / f), written here with atan2.
    for (const f of [8, 14, 24, 35, 50, 85, 135, 200]) {
      const fov = fieldOfViewForFocalLengthMm(f);
      const h = ((2 * Math.atan2(SENSOR_WIDTH_MM / 2, f)) * 180) / Math.PI;
      const v = ((2 * Math.atan2(SENSOR_HEIGHT_MM / 2, f)) * 180) / Math.PI;
      if (Math.abs(fov.horizontalDeg - h) > 1e-9) {
        throw new Error(`horizontal mismatch at ${f} mm: got ${fov.horizontalDeg}, expected ${h}`);
      }
      if (Math.abs(fov.verticalDeg - v) > 1e-9) {
        throw new Error(`vertical mismatch at ${f} mm: got ${fov.verticalDeg}, expected ${v}`);
      }
    }
  });

  it('throws an Error naming the value for 0 or less and for non-finite input', () => {
    const bad: Array<[number, string]> = [
      [0, '0'],
      [-1, '-1'],
      [-0.001, '-0.001'],
      [NaN, 'NaN'],
      [Infinity, 'Infinity'],
    ];
    for (const [value, text] of bad) {
      expect(() => fieldOfViewForFocalLengthMm(value), `input ${text}`).toThrow(Error);
      expect(() => fieldOfViewForFocalLengthMm(value), `input ${text}`).toThrow(text);
    }
  });

  it('gives the same output for the same input', () => {
    const a = fieldOfViewForFocalLengthMm(35);
    const b = fieldOfViewForFocalLengthMm(35);
    expect(b.horizontalDeg).toBe(a.horizontalDeg);
    expect(b.verticalDeg).toBe(a.verticalDeg);
  });
});
