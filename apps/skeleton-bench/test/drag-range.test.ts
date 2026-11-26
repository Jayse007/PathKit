import { describe, expect, it } from 'vitest';
import { benchLimit, clampOffset, fractionToPixels, resetOffset } from '../src/logic/drag-range.js';

// Design Properties 14 and 15. Requirements 7.1 to 7.12, 35.4.
// All expected values are typed in by hand: L(e) = 0.25 - 0.15 * e / 100.
const TOL = 1e-9;

function near(name: string, index: number, got: number, expected: number): void {
  if (!(Math.abs(got - expected) <= TOL)) {
    throw new Error(`${name}: index ${index}, expected ${expected}, got ${got}`);
  }
}

describe('limits and pixels', () => {
  it('gives limits 0.25, 0.175 and 0.10 at 0, 50 and 100 percent', () => {
    const table: ReadonlyArray<readonly [number, number]> = [
      [0, 0.25],
      [50, 0.175],
      [100, 0.1],
    ];
    for (let i = 0; i < table.length; i++) {
      near('limit check', i, benchLimit(table[i][0]), table[i][1]);
    }
  });

  it('gives the 1000 x 800 px table: 250/200, 175/140, 100/80', () => {
    const table: ReadonlyArray<readonly [number, number, number]> = [
      [0, 250, 200],
      [50, 175, 140],
      [100, 100, 80],
    ];
    for (let i = 0; i < table.length; i++) {
      const [e, wantX, wantY] = table[i];
      const lim = benchLimit(e);
      near('pixel x check', i, fractionToPixels(lim, 1000), wantX);
      near('pixel y check', i, fractionToPixels(lim, 800), wantY);
    }
    // Plain multiply, no rounding.
    expect(fractionToPixels(0.123456, 1000)).toBeCloseTo(123.456, 9);
  });
});

describe('clampOffset', () => {
  it('leaves an offset inside the area unchanged', () => {
    const inside: ReadonlyArray<readonly [number, number, number]> = [
      [0, 0, 0],
      [0.1, -0.2, 0],
      [-0.24, 0.24, 0],
      [0.05, 0.09, 100],
      [-0.17, 0.1, 50],
    ];
    for (let i = 0; i < inside.length; i++) {
      const r = clampOffset(inside[i][0], inside[i][1], inside[i][2]);
      near('inside x check', i, r.x, inside[i][0]);
      near('inside y check', i, r.y, inside[i][1]);
    }
  });

  it('leaves an offset exactly on the edge unchanged', () => {
    const edge: ReadonlyArray<readonly [number, number, number]> = [
      [0.25, -0.25, 0],
      [0.175, -0.175, 50],
      [0.1, -0.1, 100],
      [-0.25, 0.25, 0],
    ];
    for (let i = 0; i < edge.length; i++) {
      const r = clampOffset(edge[i][0], edge[i][1], edge[i][2]);
      near('edge x check', i, r.x, edge[i][0]);
      near('edge y check', i, r.y, edge[i][1]);
    }
  });

  it('gives the nearest edge for an offset outside the area', () => {
    const rows: ReadonlyArray<readonly [number, number, number, number, number]> = [
      // fx, fy, e, wantX, wantY
      [0.5, 0.5, 0, 0.25, 0.25],
      [-0.5, -0.5, 0, -0.25, -0.25],
      [0.3, -0.3, 50, 0.175, -0.175],
      [-0.9, 0.9, 100, -0.1, 0.1],
      [0.2, 0.2, 100, 0.1, 0.1],
    ];
    for (let i = 0; i < rows.length; i++) {
      const [fx, fy, e, wx, wy] = rows[i];
      const r = clampOffset(fx, fy, e);
      near('outside x check', i, r.x, wx);
      near('outside y check', i, r.y, wy);
    }
  });

  it('clamps each axis independently', () => {
    const a = clampOffset(0.9, 0.05, 50);
    near('x out, y in: x', 0, a.x, 0.175);
    near('x out, y in: y', 0, a.y, 0.05);
    const b = clampOffset(-0.03, -0.9, 50);
    near('x in, y out: x', 1, b.x, -0.03);
    near('x in, y out: y', 1, b.y, -0.175);
  });

  it('gives (0, 0) from resetOffset', () => {
    const r = resetOffset();
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });

  it('shrinks the area as Explode_Amount grows from 0 to 100', () => {
    let previous = Infinity;
    for (let e = 0; e <= 100; e++) {
      const lim = benchLimit(e);
      const expected = 0.25 - 0.0015 * e;
      near('limit formula check', e, lim, expected);
      if (!(lim < previous)) {
        throw new Error(`shrink check: index ${e}, limit ${lim} not below previous ${previous}`);
      }
      // A far offset lands on the limit, so the clamped area shrinks too.
      const r = clampOffset(1, -1, e);
      near('shrunk x check', e, r.x, expected);
      near('shrunk y check', e, r.y, -expected);
      previous = lim;
    }
  });

  it('re-clamps an offset that is outside the new area when Explode_Amount changes', () => {
    const atZero = clampOffset(0.2, -0.22, 0);
    near('start x', 0, atZero.x, 0.2);
    near('start y', 0, atZero.y, -0.22);
    const atFifty = clampOffset(atZero.x, atZero.y, 50);
    near('at 50 x', 1, atFifty.x, 0.175);
    near('at 50 y', 1, atFifty.y, -0.175);
    const atHundred = clampOffset(atFifty.x, atFifty.y, 100);
    near('at 100 x', 2, atHundred.x, 0.1);
    near('at 100 y', 2, atHundred.y, -0.1);
  });

  it('throws with the value in the message for non-finite input', () => {
    const bad: ReadonlyArray<readonly [number, string]> = [
      [NaN, 'NaN'],
      [Infinity, 'Infinity'],
      [-Infinity, '-Infinity'],
    ];
    for (let i = 0; i < bad.length; i++) {
      const [v, text] = bad[i];
      expect(() => benchLimit(v)).toThrow(text);
      expect(() => clampOffset(v, 0, 0)).toThrow(text);
      expect(() => clampOffset(0, v, 0)).toThrow(text);
      expect(() => clampOffset(0, 0, v)).toThrow(text);
      expect(() => fractionToPixels(v, 1000)).toThrow(text);
      expect(() => fractionToPixels(0.5, v)).toThrow(text);
    }
  });
});
