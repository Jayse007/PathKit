import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../src/logic/pathkit.js';
import { validateRoad } from '../../src/logic/road-validation.js';

const Y = 0.9;

// Flat zigzag candidate: point i is at x = 10 * i, z = 0 or 5 (alternating), y = 0.9.
// Consecutive points differ in x, and the last differs from the first, so none coincide.
function candidate(count: number): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    points.push({ x: 10 * i, y: Y, z: (i % 2) * 5 });
  }
  return points;
}

describe('validateRoad', () => {
  it('refuses 2 points and names the count and the range 3 to 100', () => {
    const result = validateRoad(candidate(2));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('2');
    expect(result.message).toContain('3');
    expect(result.message).toContain('100');
  });

  it('refuses 101 points and names the count and the range 3 to 100', () => {
    const result = validateRoad(candidate(101));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('101');
    expect(result.message).toContain('3');
    expect(result.message).toContain('100');
  });

  it('accepts exactly 3 points as a closed road with the same points', () => {
    const result = validateRoad(candidate(3));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.road.closed).toBe(true);
    expect(result.road.points).toEqual([
      { x: 0, y: 0.9, z: 0 },
      { x: 10, y: 0.9, z: 5 },
      { x: 20, y: 0.9, z: 0 },
    ]);
  });

  it('accepts exactly 100 points', () => {
    const result = validateRoad(candidate(100));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.road.points.length).toBe(100);
  });

  it('refuses a flat road with one duplicated consecutive point', () => {
    const points = candidate(6);
    points[3] = { x: points[2].x, y: points[2].y, z: points[2].z };
    expect(validateRoad(points).ok).toBe(false);
  });

  it('refuses a flat road whose last point equals the first', () => {
    const points = candidate(6);
    points[5] = { x: points[0].x, y: points[0].y, z: points[0].z };
    expect(validateRoad(points).ok).toBe(false);
  });

  it('refuses a road with one point at a different y', () => {
    const points = candidate(6);
    points[4] = { x: points[4].x, y: 1.9, z: points[4].z };
    expect(validateRoad(points).ok).toBe(false);
  });
});
