import { describe, expect, it } from 'vitest';
import { SPIN_MAX_STEP_S, spinTimeStep } from '../src/logic/spin-step.js';

// Requirement 13.5. Expected values are typed in by hand.
describe('spinTimeStep', () => {
  it('gives the step in seconds, capped at 0.1', () => {
    // [prevMs, nowMs, expected seconds]
    const rows: ReadonlyArray<readonly [number, number, number]> = [
      [1000, 1016, 0.016],
      [1000, 1050, 0.05],
      [1000, 1100, 0.1],
      [1000, 1101, 0.1],
      [1000, 61000, 0.1],
      [0, 5, 0.005],
    ];
    for (let i = 0; i < rows.length; i++) {
      const [prev, now, expected] = rows[i]!;
      const got = spinTimeStep(prev, now);
      if (Math.abs(got - expected) > 1e-9) throw new Error(`spinTimeStep row ${i}: expected ${expected}, got ${got}`);
    }
    expect(SPIN_MAX_STEP_S).toBe(0.1);
  });

  it('is never negative: equal or backwards times give 0', () => {
    expect(spinTimeStep(1000, 1000)).toBe(0);
    expect(spinTimeStep(1000, 900)).toBe(0);
  });

  it('gives 0 for a value that is not finite', () => {
    expect(spinTimeStep(NaN, 10)).toBe(0);
    expect(spinTimeStep(10, Infinity)).toBe(0);
  });
});
