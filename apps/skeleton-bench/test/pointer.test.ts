import { describe, expect, it } from 'vitest';
import { classifyPointer } from '../src/logic/pointer.js';

// Design Property 16. Requirements 12.9, 35.16.
// The caller passes the largest distance seen so far; this helper does that by hand.
function classifyGesture(distances: readonly number[]) {
  let max = 0;
  for (const d of distances) {
    if (d > max) max = d;
  }
  return classifyPointer(max);
}

describe('classifyPointer', () => {
  it('is a click at 0 and at exactly 5 px', () => {
    expect(classifyPointer(0)).toBe('click');
    expect(classifyPointer(5)).toBe('click');
  });

  it('is a drag at 5.1 px and at 6 px', () => {
    expect(classifyPointer(5.1)).toBe('drag');
    expect(classifyPointer(6)).toBe('drag');
  });

  it('stays a drag when the pointer goes out to 6 px and back to 2 px', () => {
    expect(classifyGesture([0, 3, 6, 2])).toBe('drag');
    expect(classifyGesture([0, 3, 5, 2])).toBe('click');
  });

  it('rejects negative, NaN and infinite distances', () => {
    expect(() => classifyPointer(-1)).toThrow();
    expect(() => classifyPointer(Number.NaN)).toThrow();
    expect(() => classifyPointer(Number.POSITIVE_INFINITY)).toThrow();
  });
});
