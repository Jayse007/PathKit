import { describe, expect, it } from 'vitest';
import { explodeAnimationAmount, explodeToggleTarget } from '../src/logic/explode-animation.js';

// Requirement 13.1 (key E toggles 0 and 100) and decision 19. Expected values are typed in by hand.
const TOL = 1e-9;

function near(name: string, index: number, got: number, expected: number): void {
  if (!(Math.abs(got - expected) <= TOL)) {
    throw new Error(`${name}: index ${index}, expected ${expected}, got ${got}`);
  }
}

describe('explodeAnimationAmount', () => {
  it('moves in a straight line over 600 ms', () => {
    const table: ReadonlyArray<readonly [number, number, number, number]> = [
      // from, to, elapsed ms, expected
      [0, 100, 0, 0],
      [0, 100, 150, 25],
      [0, 100, 300, 50],
      [0, 100, 600, 100],
      [100, 0, 150, 75],
      [100, 0, 600, 0],
      [20, 60, 300, 40],
    ];
    for (let i = 0; i < table.length; i++) {
      const row = table[i];
      near('animation check', i, explodeAnimationAmount(row[0], row[1], row[2], 600), row[3]);
    }
  });

  it('holds the ends before the start and after the end', () => {
    near('before start', 0, explodeAnimationAmount(0, 100, -50, 600), 0);
    near('after end', 1, explodeAnimationAmount(0, 100, 5000, 600), 100);
  });

  it('jumps to the end for a zero or negative duration', () => {
    near('zero duration', 0, explodeAnimationAmount(0, 100, 0, 0), 100);
    near('negative duration', 1, explodeAnimationAmount(100, 0, 10, -1), 0);
  });

  it('throws with the value for non-finite input', () => {
    expect(() => explodeAnimationAmount(Number.NaN, 100, 0, 600)).toThrow('NaN');
    expect(() => explodeAnimationAmount(0, Number.POSITIVE_INFINITY, 0, 600)).toThrow('Infinity');
    expect(() => explodeAnimationAmount(0, 100, Number.NaN, 600)).toThrow('NaN');
    expect(() => explodeAnimationAmount(0, 100, 0, Number.NaN)).toThrow('NaN');
  });
});

describe('explodeToggleTarget', () => {
  it('goes to 100 from below 50 and to 0 from 50 or more', () => {
    const table: ReadonlyArray<readonly [number, number]> = [
      [0, 100],
      [49, 100],
      [50, 0],
      [99, 0],
      [100, 0],
    ];
    for (let i = 0; i < table.length; i++) {
      const row = table[i];
      const got = explodeToggleTarget(row[0]);
      if (got !== row[1]) throw new Error(`toggle check: index ${i}, expected ${row[1]}, got ${got}`);
    }
  });

  it('throws with the value for a non-finite target', () => {
    expect(() => explodeToggleTarget(Number.NaN)).toThrow('NaN');
  });
});

// Source line it should catch: in explodeToggleTarget change `>= 50` to `> 50`;
// the row [50, 0] of the toggle table must fail.
