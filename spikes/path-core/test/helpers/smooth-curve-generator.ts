import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import { createArcLengthTable } from '../../src/arclength.js';
import type { Vec3 } from '../../src/math.js';

/** A smooth open curve: its points, minimum radius of curvature and a sample count N. */
export interface SmoothCurveSample {
  points: Vec3[];
  rMin: number;
  N: number;
}

const MIN_N = 50;
const MAX_N = 200;
const RMIN_SAMPLES = 4096; // number of intervals; 4097 sample positions
const MIN_SPACING = 1e-3;

/** Maps an integer in [-1000000, 1000000] evenly onto [min, max]. */
const scaled = (min: number, max: number) =>
  fc.integer({ min: -1000000, max: 1000000 }).map((i) => min + ((i + 1000000) / 2000000) * (max - min));

interface Sinusoid {
  amp: number; // 20 to 100
  cycles: number; // 0.25 to 1 full cycle over the whole curve
  phase: number; // 0 to 2*pi
}

interface AxisSpec {
  count: number; // 2 or 3 active sinusoids
  waves: Sinusoid[]; // always 3 drawn, the first `count` are used
}

const arbSinusoid: fc.Arbitrary<Sinusoid> = fc.record({
  amp: scaled(20, 100),
  cycles: scaled(0.25, 1),
  phase: scaled(0, 2 * Math.PI),
});

const arbAxis: fc.Arbitrary<AxisSpec> = fc.record({
  count: fc.integer({ min: 2, max: 3 }),
  waves: fc.tuple(arbSinusoid, arbSinusoid, arbSinusoid).map((t) => [...t]),
});

const arbCurveSpec = fc.record({
  pointCount: fc.integer({ min: 8, max: 20 }),
  x: arbAxis,
  y: arbAxis,
  z: arbAxis,
});

const evalAxis = (a: AxisSpec, u: number): number => {
  let sum = 0;
  for (let i = 0; i < a.count; i++) {
    const w = a.waves[i];
    sum += w.amp * Math.sin(2 * Math.PI * w.cycles * u + w.phase);
  }
  return sum;
};

interface CurveStage {
  points: Vec3[];
  rMin: number;
  length: number;
}

/** Builds the points, the real curve and table, and estimates rMin. Null when the points are unusable. */
function buildCurveStage(spec: {
  pointCount: number;
  x: AxisSpec;
  y: AxisSpec;
  z: AxisSpec;
}): CurveStage | null {
  const n = spec.pointCount;
  const points: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    points.push({ x: evalAxis(spec.x, u), y: evalAxis(spec.y, u), z: evalAxis(spec.z, u) });
  }
  for (let i = 0; i < n - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < MIN_SPACING) return null;
  }

  const curve = createCurve(points, false);
  const table = createArcLengthTable(curve);
  const length = table.length;

  // Radius of curvature between consecutive samples: chord / turning angle of the unit tangent.
  let rMin = Infinity;
  let prevP = curve.pointAt(0);
  let prevT = curve.tangentAt(0);
  for (let i = 1; i <= RMIN_SAMPLES; i++) {
    const t = i / RMIN_SAMPLES;
    const p = curve.pointAt(t);
    const tan = curve.tangentAt(t);
    const chord = Math.hypot(p.x - prevP.x, p.y - prevP.y, p.z - prevP.z);
    const cx = prevT.y * tan.z - prevT.z * tan.y;
    const cy = prevT.z * tan.x - prevT.x * tan.z;
    const cz = prevT.x * tan.y - prevT.y * tan.x;
    const dot = prevT.x * tan.x + prevT.y * tan.y + prevT.z * tan.z;
    const angle = Math.atan2(Math.hypot(cx, cy, cz), dot);
    if (angle > 0 && chord > 0) {
      const r = chord / angle;
      if (r < rMin) rMin = r;
    }
    prevP = p;
    prevT = tan;
  }
  if (!(rMin > 0) || !(length > 0)) return null;
  return { points, rMin, length };
}

/**
 * Raw candidate: a smooth curve with N chosen in [nMin, 200], or null when the
 * curve is rejected (ceil(3 * length / rMin) > 200, or unusable points).
 * Exposed so the rejection rate can be measured.
 */
export const rawSmoothCurveCandidate: fc.Arbitrary<SmoothCurveSample | null> = arbCurveSpec.chain(
  (spec): fc.Arbitrary<SmoothCurveSample | null> => {
    const stage = buildCurveStage(spec);
    if (stage === null) return fc.constant(null);
    const needed = Math.ceil((3 * stage.length) / stage.rMin);
    if (needed > MAX_N) return fc.constant(null);
    const nMin = Math.max(MIN_N, needed);
    return fc
      .integer({ min: nMin, max: MAX_N })
      .map((N) => ({ points: stage.points, rMin: stage.rMin, N }));
  },
);

/** Open smooth curves with rMin >= 3 * length / N, N in [50, 200]. */
export const smoothCurvePoints: fc.Arbitrary<SmoothCurveSample> = rawSmoothCurveCandidate.filter(
  (c): c is SmoothCurveSample => c !== null,
);
