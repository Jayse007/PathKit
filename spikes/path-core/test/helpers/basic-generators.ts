import fc from 'fast-check';

// Structural types matching the design (plain objects with numeric fields).
// Declared locally so the helpers do not depend on src existing yet.
export interface Vec3 { x: number; y: number; z: number }
export interface Quat { x: number; y: number; z: number; w: number }
export type AxisToken = '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z';

export const MIN_POINT_SPACING = 0.1;

const coord = (min: number, max: number) =>
  fc.double({ min, max, noNaN: true, noDefaultInfinity: true });

/** Finite Vec3 with every coordinate in [-100, 100]. */
export const arbVec3: fc.Arbitrary<Vec3> = fc.record({
  x: coord(-100, 100),
  y: coord(-100, 100),
  z: coord(-100, 100),
});

/** Unit quaternion (length 1 within floating point rounding). */
export const arbUnitQuat: fc.Arbitrary<Quat> = fc
  .record({ x: coord(-1, 1), y: coord(-1, 1), z: coord(-1, 1), w: coord(-1, 1) })
  .filter((q) => Math.hypot(q.x, q.y, q.z, q.w) >= 0.1)
  .map((q) => {
    const n = Math.hypot(q.x, q.y, q.z, q.w);
    return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
  });

/** Open (false) or closed (true) flag. */
export const arbClosed: fc.Arbitrary<boolean> = fc.boolean();

const arbUnitDirection: fc.Arbitrary<Vec3> = fc
  .record({ x: coord(-1, 1), y: coord(-1, 1), z: coord(-1, 1) })
  .filter((v) => Math.hypot(v.x, v.y, v.z) >= 0.1)
  .map((v) => {
    const n = Math.hypot(v.x, v.y, v.z);
    return { x: v.x / n, y: v.y / n, z: v.z / n };
  });

const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * Point list in which every consecutive pair is at least 0.1 apart, by
 * construction: each point is the previous point plus a unit direction scaled
 * by a step in [0.1, 10]. When `closed` is true the last point is also at
 * least 0.1 from the first, so the closing segment is non-degenerate.
 */
export function arbPointList(
  closed: boolean,
  minCountArg?: number,
  maxCount = 12,
): fc.Arbitrary<Vec3[]> {
  // Closed curves need at least 3 points; open curves need at least 2.
  const minCount = minCountArg ?? (closed ? 3 : 2);
  return fc
    .tuple(
      arbVec3,
      fc.array(
        fc.record({ dir: arbUnitDirection, step: coord(MIN_POINT_SPACING, 10) }),
        { minLength: minCount - 1, maxLength: maxCount - 1 },
      ),
    )
    .map(([start, steps]) => {
      const pts: Vec3[] = [start];
      for (const { dir, step } of steps) {
        const p = pts[pts.length - 1];
        pts.push({ x: p.x + dir.x * step, y: p.y + dir.y * step, z: p.z + dir.z * step });
      }
      return pts;
    })
    .filter((pts) => !closed || dist(pts[pts.length - 1], pts[0]) >= MIN_POINT_SPACING);
}

/** Curve input: an open/closed flag and a matching point list. */
export const arbCurveInput: fc.Arbitrary<{ points: Vec3[]; closed: boolean }> = arbClosed.chain(
  (closed) => arbPointList(closed).map((points) => ({ points, closed })),
);

export const AXIS_TOKENS: readonly AxisToken[] = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];

/** Which coordinate axis a token lies on. */
export const axisLetter = (t: AxisToken): 'X' | 'Y' | 'Z' => t[1] as 'X' | 'Y' | 'Z';

/** All 36 ordered (forwardAxis, upAxis) pairs. */
export const ALL_AXIS_PAIRS: readonly (readonly [AxisToken, AxisToken])[] = AXIS_TOKENS.flatMap(
  (f) => AXIS_TOKENS.map((u) => [f, u] as const),
);

/** 12 invalid pairs: both tokens on the same coordinate axis (includes +Z/-Z and identical pairs). */
export const INVALID_AXIS_PAIRS = ALL_AXIS_PAIRS.filter(([f, u]) => axisLetter(f) === axisLetter(u));

/** 24 valid pairs: tokens on different coordinate axes. */
export const VALID_AXIS_PAIRS = ALL_AXIS_PAIRS.filter(([f, u]) => axisLetter(f) !== axisLetter(u));

export const arbAnyAxisPair = fc.constantFrom(...ALL_AXIS_PAIRS);
export const arbInvalidAxisPair = fc.constantFrom(...INVALID_AXIS_PAIRS);
export const arbValidAxisPair = fc.constantFrom(...VALID_AXIS_PAIRS);
