import { describe, expect, it } from 'vitest';
import { createArcLengthTable, createCurve } from '../../src/logic/pathkit.js';
import {
  DEFAULT_ROAD_POINT_COUNT,
  SUBJECT_CENTRE_HEIGHT,
} from '../../src/logic/constants.js';
import { DEFAULT_ROAD_CLOSED, DEFAULT_ROAD_POINTS } from '../../src/logic/default-road.js';

const MIN_RADIUS_M = 8;

// Radius of the circle through three points on the ground plane (x, z).
// Side lengths a, b, c; area from the cross product; R = abc / (4 area).
// Collinear points (area 0) have an infinite radius.
function circleRadius(
  p: { x: number; z: number },
  q: { x: number; z: number },
  r: { x: number; z: number },
): number {
  const a = Math.hypot(q.x - r.x, q.z - r.z);
  const b = Math.hypot(p.x - r.x, p.z - r.z);
  const c = Math.hypot(p.x - q.x, p.z - q.z);
  const cross = (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const area = Math.abs(cross) / 2;
  if (area === 0) return Infinity;
  return (a * b * c) / (4 * area);
}

describe('default Road points', () => {
  const pts = DEFAULT_ROAD_POINTS;
  const n = pts.length;

  it('is closed and has the named point count', () => {
    expect(DEFAULT_ROAD_CLOSED).toBe(true);
    expect(n).toBe(DEFAULT_ROAD_POINT_COUNT);
    expect(n).toBe(12);
  });

  it('puts every point at the subject centre height', () => {
    for (let i = 0; i < n; i++) {
      if (pts[i]!.y !== SUBJECT_CENTRE_HEIGHT) {
        throw new Error(
          `check "y equals SUBJECT_CENTRE_HEIGHT" failed at index ${i}: y = ${pts[i]!.y}, expected ${SUBJECT_CENTRE_HEIGHT}`,
        );
      }
    }
  });

  it('has no two consecutive points equal, including last to first', () => {
    for (let i = 0; i < n; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % n]!;
      if (a.x === b.x && a.y === b.y && a.z === b.z) {
        throw new Error(
          `check "consecutive points differ" failed at index ${i}: (${a.x}, ${a.y}, ${a.z}) equals the next point`,
        );
      }
    }
  });

  it('has a length of 110 to 130 m (printed)', () => {
    const curve = createCurve(pts.map((p) => ({ x: p.x, y: p.y, z: p.z })), DEFAULT_ROAD_CLOSED);
    const table = createArcLengthTable(curve);
    console.log(`default Road length: ${table.length.toFixed(2)} m`);
    expect(table.length).toBeGreaterThanOrEqual(110);
    expect(table.length).toBeLessThanOrEqual(130);
  });

  it('has a bend radius of at least 8 m at every three consecutive points', () => {
    let smallest = Infinity;
    for (let i = 0; i < n; i++) {
      const r = circleRadius(pts[i]!, pts[(i + 1) % n]!, pts[(i + 2) % n]!);
      if (r < smallest) smallest = r;
      if (!(r >= MIN_RADIUS_M)) {
        throw new Error(
          `check "bend radius >= ${MIN_RADIUS_M} m" failed at index ${i}: radius = ${r}`,
        );
      }
    }
    console.log(`default Road tightest bend radius: ${smallest.toFixed(2)} m`);
  });
});
