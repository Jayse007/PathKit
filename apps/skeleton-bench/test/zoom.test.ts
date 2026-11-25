import { describe, expect, it } from 'vitest';
import { angleToFrame, zoomDistance, zoomSelection } from '../src/logic/frame-mapper.js';
import { S2_ZOOM_GRID_STEPS } from '../src/constants.js';

// Design Properties 3 and 4. Requirements 6.1 to 6.10, 5.8, 35.3, 35.15.
const TOL = 1e-9;

describe('zoomSelection', () => {
  it('matches the design table', () => {
    const table: ReadonlyArray<readonly [number, number, number, number]> = [
      [-0.2, 0, 1, 0],
      [0, 0, 1, 0],
      [0.25, 0, 1, 0.75],
      [0.5, 1, 2, 0.5],
      [0.75, 2, 3, 0.25],
      [1, 2, 3, 1],
      [1.5, 2, 3, 1],
    ];
    for (let i = 0; i < table.length; i++) {
      const [z, lower, upper, weight] = table[i];
      const got = zoomSelection(z);
      if (got.lowerLap !== lower || got.upperLap !== upper || Math.abs(got.weight - weight) > TOL) {
        throw new Error(
          `table check: index ${i}, zoom ${z}, expected (${lower},${upper},${weight}), got (${got.lowerLap},${got.upperLap},${got.weight})`,
        );
      }
    }
  });

  it('keeps weight in [0, 1] and lap indices valid over -0.5 to 1.5', () => {
    let count = 0;
    for (let k = -60; k <= 180; k++) {
      const z = k / 120;
      const s = zoomSelection(z);
      if (!(s.weight >= 0 && s.weight <= 1)) {
        throw new Error(`weight check: index ${k}, zoom ${z}, weight ${s.weight}`);
      }
      if (!Number.isInteger(s.lowerLap) || s.lowerLap < 0 || s.lowerLap > 2) {
        throw new Error(`lower lap check: index ${k}, zoom ${z}, lap ${s.lowerLap}`);
      }
      if (s.upperLap !== s.lowerLap + 1 || s.upperLap > 3) {
        throw new Error(`upper lap check: index ${k}, zoom ${z}, lap ${s.upperLap}`);
      }
      count++;
    }
    expect(count).toBe(241);
  });

  it('throws with the value in the message for non-finite input', () => {
    const bad: ReadonlyArray<readonly [number, string]> = [
      [NaN, 'NaN'],
      [Infinity, 'Infinity'],
      [-Infinity, '-Infinity'],
    ];
    for (let i = 0; i < bad.length; i++) {
      expect(() => zoomSelection(bad[i][0])).toThrow(Error);
      expect(() => zoomSelection(bad[i][0])).toThrow(bad[i][1]);
      expect(() => zoomDistance(bad[i][0])).toThrow(Error);
      expect(() => zoomDistance(bad[i][0])).toThrow(bad[i][1]);
    }
  });
});

describe('zoomDistance', () => {
  it('gives 4.55 m at Z = 0.5, 6.5 at 0 and 2.6 at 1, clamped outside', () => {
    const table: ReadonlyArray<readonly [number, number]> = [
      [0.5, 4.55],
      [0, 6.5],
      [1, 2.6],
      [-0.5, 6.5],
      [1.5, 2.6],
    ];
    for (let i = 0; i < table.length; i++) {
      const got = zoomDistance(table[i][0]);
      if (Math.abs(got - table[i][1]) > TOL) {
        throw new Error(`distance check: index ${i}, zoom ${table[i][0]}, expected ${table[i][1]}, got ${got}`);
      }
    }
  });

  it('never increases as Z increases over -0.5 to 1.5 in steps of 1/120', () => {
    let previous = zoomDistance(-60 / 120);
    for (let k = -59; k <= 180; k++) {
      const d = zoomDistance(k / 120);
      if (d > previous) {
        throw new Error(`monotonic check: index ${k}, zoom ${k / 120}, distance ${d} above previous ${previous}`);
      }
      previous = d;
    }
  });
});

describe('independence of angle and zoom', () => {
  it('gives the same frame and selection whatever the other input does', () => {
    let checks = 0;
    for (let k = 0; k <= S2_ZOOM_GRID_STEPS; k++) {
      const z = k / S2_ZOOM_GRID_STEPS;
      const baseSel = zoomSelection(z);
      const baseDist = zoomDistance(z);
      for (let a = 0; a < 360; a++) {
        const frame = angleToFrame(a);
        if (frame !== a) {
          throw new Error(`frame check: zoom index ${k}, angle ${a}, got ${frame}`);
        }
        const sel = zoomSelection(z);
        if (
          sel.lowerLap !== baseSel.lowerLap ||
          sel.upperLap !== baseSel.upperLap ||
          sel.weight !== baseSel.weight ||
          zoomDistance(z) !== baseDist
        ) {
          throw new Error(`independence check: zoom index ${k}, angle ${a}`);
        }
        checks++;
      }
    }
    expect(checks).toBe(13 * 360);
  });
});
