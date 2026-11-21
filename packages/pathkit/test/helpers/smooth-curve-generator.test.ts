import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { rawSmoothCurveCandidate } from './smooth-curve-generator.js';

// Measures the smooth curve generator's rejection rate with a fixed seed.
describe('smooth curve generator', () => {
  it('rejects fewer than 60% of 300 raw candidates', () => {
    const start = performance.now();
    const draws = fc.sample(rawSmoothCurveCandidate, { numRuns: 300, seed: 12345 });
    const ms = performance.now() - start;
    const rejected = draws.filter((d) => d === null).length;
    const pct = (rejected / 300) * 100;
    console.log(`Smooth curve generator: ${rejected} of 300 rejected (${pct.toFixed(1)}%), ${ms.toFixed(0)} ms`);
    expect(draws.length).toBe(300);
    expect(rejected / 300).toBeLessThan(0.6);
  });
});
