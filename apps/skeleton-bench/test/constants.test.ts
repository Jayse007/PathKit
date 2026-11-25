import { describe, expect, it } from 'vitest';
import {
  CAMERA_ELEVATION_COS,
  CAMERA_ELEVATION_SIN,
  CAMERA_MIN_CLEARANCE_M,
  EXPLODED_BOX_HALF_X,
  EXPLODED_BOX_HALF_Y,
  EXPLODED_BOX_HALF_Z,
  EXPLODED_BOX_RADIUS,
  LAP_COUNT,
  LAP_DISTANCES,
  ORBIT_SPEED_DEG_PER_S,
} from '../src/constants.js';

// Hand-written expected values. Nothing here is computed by the code under test.
const TOL = 1e-12;

function check(name: string, index: number, actual: number, expected: number, tol: number): void {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(`${name}[${index}]: expected ${expected}, got ${actual}`);
  }
}

describe('constants consistency', () => {
  it('EXPLODED_BOX_RADIUS is sqrt(1.2^2 + 0.6^2 + 0.4^2) = 1.4', () => {
    // 1.44 + 0.36 + 0.16 = 1.96, sqrt = 1.4
    const sumSquares =
      EXPLODED_BOX_HALF_X * EXPLODED_BOX_HALF_X +
      EXPLODED_BOX_HALF_Y * EXPLODED_BOX_HALF_Y +
      EXPLODED_BOX_HALF_Z * EXPLODED_BOX_HALF_Z;
    expect(sumSquares).toBeCloseTo(1.96, 12);
    expect(Math.sqrt(sumSquares)).toBeCloseTo(1.4, 12);
    expect(EXPLODED_BOX_RADIUS).toBeCloseTo(1.4, 12);
  });

  it('ORBIT_SPEED_DEG_PER_S is 360 * 30 / 360 = 30', () => {
    expect(ORBIT_SPEED_DEG_PER_S).toBe(30);
  });

  it('elevation sin and cos are 5/13 and 12/13 and sin^2 + cos^2 = 1', () => {
    expect(Math.abs(CAMERA_ELEVATION_SIN - 5 / 13)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(CAMERA_ELEVATION_COS - 12 / 13)).toBeLessThanOrEqual(TOL);
    const sum =
      CAMERA_ELEVATION_SIN * CAMERA_ELEVATION_SIN + CAMERA_ELEVATION_COS * CAMERA_ELEVATION_COS;
    expect(Math.abs(sum - 1)).toBeLessThanOrEqual(1e-12);
  });

  it('LAP_COUNT is 4 and matches LAP_DISTANCES', () => {
    expect(LAP_COUNT).toBe(4);
    expect(LAP_DISTANCES.length).toBe(4);
  });

  it('LAP_DISTANCES are exactly 6.5, 5.2, 3.9, 2.6', () => {
    const expected = [6.5, 5.2, 3.9, 2.6];
    for (let i = 0; i < expected.length; i++) {
      check('LAP_DISTANCES', i, LAP_DISTANCES[i], expected[i], TOL);
    }
  });

  it('each lap has r = d * 12/13 and h = d * 5/13 (hand-written values) and r^2 + h^2 = d^2', () => {
    const expectedR = [6.0, 4.8, 3.6, 2.4];
    const expectedH = [2.5, 2.0, 1.5, 1.0];
    for (let i = 0; i < LAP_DISTANCES.length; i++) {
      const d = LAP_DISTANCES[i];
      const r = d * CAMERA_ELEVATION_COS;
      const h = d * CAMERA_ELEVATION_SIN;
      check('r', i, r, expectedR[i], 1e-9);
      check('h', i, h, expectedH[i], 1e-9);
      check('r^2+h^2', i, r * r + h * h, d * d, 1e-9);
    }
  });

  it('LAP_DISTANCES is strictly decreasing', () => {
    for (let i = 1; i < LAP_DISTANCES.length; i++) {
      if (!(LAP_DISTANCES[i] < LAP_DISTANCES[i - 1])) {
        throw new Error(
          `LAP_DISTANCES not strictly decreasing at index ${i}: ${LAP_DISTANCES[i - 1]} then ${LAP_DISTANCES[i]}`,
        );
      }
    }
  });

  it('every d - R is at least CAMERA_MIN_CLEARANCE_M', () => {
    for (let i = 0; i < LAP_DISTANCES.length; i++) {
      const clearance = LAP_DISTANCES[i] - EXPLODED_BOX_RADIUS;
      // Hand-written clearances are 5.1, 3.8, 2.5 and 1.2 m; the smallest margin over 1.0 is 0.2 m.
      if (!(clearance >= CAMERA_MIN_CLEARANCE_M)) {
        throw new Error(`clearance[${i}]: ${clearance} is below ${CAMERA_MIN_CLEARANCE_M}`);
      }
    }
  });
});
