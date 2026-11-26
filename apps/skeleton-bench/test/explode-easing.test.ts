import { describe, expect, it } from 'vitest';
import { explodeFrame } from '../src/logic/explode-easing.js';
import { partPathPoints } from '../src/logic/part-path.js';
import type { Point3 } from '../src/logic/part-path.js';

// Design Property 12. Requirements 8.1 to 8.7, 13.3, 35.5.
// All expected values are typed in by hand. Smoothstep(t) = 3t^2 - 2t^3, frame = floor(eased * 59 + 0.5).
const TOL = 1e-9;

function near(name: string, index: number, got: number, expected: number): void {
  if (!(Math.abs(got - expected) <= TOL)) {
    throw new Error(`${name}: index ${index}, expected ${expected}, got ${got}`);
  }
}

function checkPoints(name: string, got: readonly Point3[], expected: readonly Point3[]): void {
  if (got.length !== expected.length) {
    throw new Error(`${name}: expected ${expected.length} points, got ${got.length}`);
  }
  for (let i = 0; i < expected.length; i++) {
    for (let k = 0; k < 3; k++) {
      near(`${name} point ${i} axis ${k}`, i * 3 + k, got[i][k], expected[i][k]);
    }
  }
}

describe('explodeFrame', () => {
  it('gives frames 0, 9, 30, 50, 59 at 0, 25, 50, 75, 100 percent', () => {
    const table: ReadonlyArray<readonly [number, number]> = [
      [0, 0],
      [25, 9],
      [50, 30],
      [75, 50],
      [100, 59],
    ];
    for (let i = 0; i < table.length; i++) {
      const got = explodeFrame(table[i][0]);
      if (got !== table[i][1]) {
        throw new Error(`table check: index ${i}, amount ${table[i][0]}, expected ${table[i][1]}, got ${got}`);
      }
    }
  });

  it('never decreases from 0 to 100 percent in steps of 1', () => {
    let prev = explodeFrame(0);
    for (let a = 1; a <= 100; a++) {
      const f = explodeFrame(a);
      if (f < prev) {
        throw new Error(`monotone check: index ${a}, frame ${f} is below previous ${prev}`);
      }
      prev = f;
    }
  });

  it('clamps -5 to frame 0 and 105 to frame 59', () => {
    expect(explodeFrame(-5)).toBe(0);
    expect(explodeFrame(105)).toBe(59);
  });

  it('gives whole frames inside 0 to 59 for amounts from -10 to 110 in steps of 0.5', () => {
    for (let i = 0; i <= 240; i++) {
      const a = -10 + i * 0.5;
      const f = explodeFrame(a);
      if (!Number.isInteger(f) || f < 0 || f > 59) {
        throw new Error(`range check: index ${i}, amount ${a}, frame ${f}`);
      }
    }
  });

  it('throws for NaN and infinite amounts', () => {
    expect(() => explodeFrame(Number.NaN)).toThrow();
    expect(() => explodeFrame(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => explodeFrame(Number.NEGATIVE_INFINITY)).toThrow();
  });
});

describe('partPathPoints', () => {
  it('bows toward +Y for v = (0.6, 0, 0)', () => {
    const pts = partPathPoints([0, 0, 0], [0.6, 0, 0]);
    checkPoints('x vector', pts, [
      [0, 0, 0],
      [0.2, 0.09, 0],
      [0.4, 0.09, 0],
      [0.6, 0, 0],
    ]);
  });

  it('uses +Z as the bow direction for v = (0, 0.6, 0)', () => {
    const pts = partPathPoints([0, 0, 0], [0, 0.6, 0]);
    checkPoints('y vector', pts, [
      [0, 0, 0],
      [0, 0.2, 0.09],
      [0, 0.4, 0.09],
      [0, 0.6, 0],
    ]);
  });

  it('throws when the explode vector is shorter than 0.1 m', () => {
    expect(() => partPathPoints([0, 0, 0], [0.09, 0, 0])).toThrow();
    expect(() => partPathPoints([0, 0, 0], [0, 0, 0])).toThrow();
  });
});
