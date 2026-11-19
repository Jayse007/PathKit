import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { rawSmoothCurveCandidate } from './smooth-curve-generator.js';

// Temporary measurement of the smooth curve generator's rejection rate. Safe to delete.
describe('smooth curve generator stats', () => {
  it('draws 1000 raw candidates and reports how many were rejected', () => {
    const start = performance.now();
    const draws = fc.sample(rawSmoothCurveCandidate, { numRuns: 1000, seed: 12345 });
    const ms = performance.now() - start;
    const rejected = draws.filter((d) => d === null).length;
    const pct = (rejected / 1000) * 100;
    console.log(`Smooth curve generator: ${rejected} of 1000 rejected (${pct.toFixed(1)}%), ${ms.toFixed(0)} ms`);
    expect(draws.length).toBe(1000);
  });
});
