// Shared helpers for the orbit-around tests: case generator, forced cases, scene builder and
// plain-arithmetic oracles. Nothing here calls the baker's own maths to produce an expected value.
// Geometry and scalars come from fc.integer mapped onto ranges (testing-conventions rule 2).
import fc from 'fast-check';
import type { BakedData } from '../../src/bake.js';
import type { AxisToken, Constraint, Scene, Target } from '../../src/scene.js';

export type Triple = [number, number, number];

/** The six axis tokens mapped to unit vectors. Written here, independently of src. */
export const AXIS_UNIT: Readonly<Record<AxisToken, Triple>> = {
  '+X': [1, 0, 0],
  '-X': [-1, 0, 0],
  '+Y': [0, 1, 0],
  '-Y': [0, -1, 0],
  '+Z': [0, 0, 1],
  '-Z': [0, 0, -1],
};

export const ORBIT_AXES: readonly AxisToken[] = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];

export function dot3(a: readonly number[], b: readonly number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross3(a: readonly number[], b: readonly number[], out: number[] = [0, 0, 0]): number[] {
  const x = a[1] * b[2] - a[2] * b[1];
  const y = a[2] * b[0] - a[0] * b[2];
  const z = a[0] * b[1] - a[1] * b[0];
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

export function sub3(a: readonly number[], b: readonly number[], out: number[] = [0, 0, 0]): number[] {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}

export function len3(a: readonly number[]): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

/** The centre of the orbit: fixed, or moving by `step` per frame from `c0`. */
export type OrbitCentre =
  | { kind: 'static'; c: Triple }
  | { kind: 'linear'; c0: Triple; step: Triple };

export interface OrbitCase {
  fps: number;
  frameCount: number;
  axis: AxisToken;
  radius: number; // metres
  speed: number; // degrees per second
  startAngle: number; // degrees
  centre: OrbitCentre;
}

export interface OrbitCaseOptions {
  /** Smallest radius in metres. Default 0. Use 0.1 when the radius must be above 0. */
  minRadius?: number;
  /** Cap on |speed / fps| in degrees per frame. Default 720. */
  maxDegreesPerFrame?: number;
  /** Whether the centre may be keyframed (linear). Default true. */
  allowMovingCentre?: boolean;
}

const arbCoord10 = fc.integer({ min: -1000, max: 1000 }).map((i) => i / 10);
const arbStep10 = fc.integer({ min: -20, max: 20 }).map((i) => i / 10);
const arbTriple = (item: fc.Arbitrary<number>): fc.Arbitrary<Triple> =>
  fc.tuple(item, item, item).map(([x, y, z]): Triple => [x, y, z]);

/** Orbit cases spread evenly over their ranges. No fc.double. */
export function arbOrbitCase(opts: OrbitCaseOptions = {}): fc.Arbitrary<OrbitCase> {
  const minTenths = Math.round((opts.minRadius ?? 0) * 10);
  const maxDeg = opts.maxDegreesPerFrame ?? 720;
  const allowMoving = opts.allowMovingCentre ?? true;

  const arbStatic: fc.Arbitrary<OrbitCentre> = arbTriple(arbCoord10).map((c) => ({ kind: 'static', c }));
  const arbLinear: fc.Arbitrary<OrbitCentre> = fc
    .tuple(arbTriple(arbCoord10), arbTriple(arbStep10))
    .map(([c0, step]) => ({ kind: 'linear', c0, step }));
  const arbCentre = allowMoving ? fc.oneof(arbStatic, arbLinear) : arbStatic;

  return fc
    .constantFrom(24, 30, 60)
    .chain((fps) =>
      fc.record({
        fps: fc.constant(fps),
        frameCount: fc.integer({ min: 1, max: 120 }),
        axis: fc.constantFrom(...ORBIT_AXES),
        radius: fc.integer({ min: minTenths, max: 300 }).map((i) => i / 10),
        speed: fc.integer({ min: -maxDeg * fps, max: maxDeg * fps }),
        startAngle: fc.integer({ min: -720, max: 720 }),
        centre: arbCentre,
      }),
    );
}

const BASE_CASE: OrbitCase = {
  fps: 30,
  frameCount: 10,
  axis: '+Y',
  radius: 5,
  speed: 30,
  startAngle: 0,
  centre: { kind: 'static', c: [1, 2, 3] },
};

/** Special cases that random runs almost never hit (Requirement 8.21). */
export const FORCED_ORBIT_CASES: readonly OrbitCase[] = [
  { ...BASE_CASE, radius: 0 },
  { ...BASE_CASE, startAngle: 0 },
  { ...BASE_CASE, speed: 90 * BASE_CASE.fps, frameCount: 5 }, // 90 degrees per frame, frame 1 is at 90
  { ...BASE_CASE, speed: 360 * BASE_CASE.fps, frameCount: 5 }, // exactly one turn per frame
  { ...BASE_CASE, frameCount: 1 },
  ...ORBIT_AXES.map((axis): OrbitCase => ({ ...BASE_CASE, axis })),
];

export interface OrbitSceneExtra {
  /** Order of the orbit constraint. Default 0. */
  orbitOrder?: number;
  /** Influence of the orbit constraint. Default 1. */
  orbitInfluence?: number;
  /** Constraints appended after the orbit constraint. */
  constraints?: Constraint[];
  /** Targets added next to the centre Target, named `centre`. */
  targets?: Record<string, Target>;
}

/** Name of the centre Target in scenes built by buildOrbitScene. */
export const CENTRE_TARGET = 'centre';

/** Builds a Scene with one Entity `orbiter`, a fixed valid open path and the centre Target. */
export function buildOrbitScene(c: OrbitCase, extra: OrbitSceneExtra = {}): Scene {
  const centreTarget: Target =
    c.centre.kind === 'static'
      ? { x: c.centre.c[0], y: c.centre.c[1], z: c.centre.c[2] }
      : {
          keyframes: [
            {
              frame: 0,
              position: { x: c.centre.c0[0], y: c.centre.c0[1], z: c.centre.c0[2] },
            },
            {
              frame: c.frameCount,
              position: {
                x: c.centre.c0[0] + c.frameCount * c.centre.step[0],
                y: c.centre.c0[1] + c.frameCount * c.centre.step[1],
                z: c.centre.c0[2] + c.frameCount * c.centre.step[2],
              },
            },
          ],
        };

  return {
    fps: c.fps,
    frameCount: c.frameCount,
    path: {
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 5 },
        { x: 20, y: 0, z: 0 },
        { x: 30, y: 0, z: 5 },
      ],
      closed: false,
    },
    targets: { [CENTRE_TARGET]: centreTarget, ...(extra.targets ?? {}) },
    entities: [
      {
        id: 'orbiter',
        forwardAxis: '+Z',
        upAxis: '+Y',
        constraints: [
          {
            type: 'orbitAround',
            order: extra.orbitOrder ?? 0,
            influence: extra.orbitInfluence ?? 1,
            target: CENTRE_TARGET,
            radius: c.radius,
            axis: c.axis,
            speed: c.speed,
            startAngle: c.startAngle,
          },
          ...(extra.constraints ?? []),
        ],
      },
    ],
  };
}

/** The centre at an integer frame, from the Scene numbers. Writes into `out`. */
export function centreAt(c: OrbitCase, frame: number, out: number[] = [0, 0, 0]): number[] {
  if (c.centre.kind === 'static') {
    out[0] = c.centre.c[0];
    out[1] = c.centre.c[1];
    out[2] = c.centre.c[2];
  } else {
    out[0] = c.centre.c0[0] + frame * c.centre.step[0];
    out[1] = c.centre.c0[1] + frame * c.centre.step[1];
    out[2] = c.centre.c0[2] + frame * c.centre.step[2];
  }
  return out;
}

/** 1 + radius + largest centre coordinate magnitude over frames 0 and frameCount. Scales tolerances. */
export function scaleOf(c: OrbitCase): number {
  let largest = 0;
  const ends = c.centre.kind === 'static' ? [0] : [0, c.frameCount];
  const tmp = [0, 0, 0];
  for (const f of ends) {
    centreAt(c, f, tmp);
    largest = Math.max(largest, Math.abs(tmp[0]), Math.abs(tmp[1]), Math.abs(tmp[2]));
  }
  return 1 + c.radius + largest;
}

/** Reads the three position numbers of one entity at one frame into `out`. */
export function bakedPosition(baked: BakedData, entityIndex: number, frame: number, out: number[]): number[] {
  const t = baked.transforms[entityIndex];
  const i = frame * 7;
  out[0] = t[i];
  out[1] = t[i + 1];
  out[2] = t[i + 2];
  return out;
}
