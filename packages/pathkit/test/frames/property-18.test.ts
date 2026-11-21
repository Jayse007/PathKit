import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import { frenetFrames } from '../../src/frames.js';
import { arbCurveInput, arbVec3 } from '../helpers/basic-generators.js';
import type { Vec3 } from '../helpers/basic-generators.js';

// Feature: path-core, Property 18: Frenet frames are well-formed and continuous at low curvature
// **Validates: Requirements 4.7, 4.9**

const TOLERANCE = 1e-6;

// Local copy of the evenly spread construction in basic-generators.ts
// (`coord` is not exported there).
const coord = (min: number, max: number) =>
  fc.integer({ min: -1000000, max: 1000000 }).map((i) => min + ((i + 1000000) / 2000000) * (max - min));

const arbRandomUnitDirection: fc.Arbitrary<Vec3> = fc
  .record({ x: coord(-1, 1), y: coord(-1, 1), z: coord(-1, 1) })
  .filter((v) => Math.hypot(v.x, v.y, v.z) >= 0.1)
  .map((v) => {
    const n = Math.hypot(v.x, v.y, v.z);
    return { x: v.x / n, y: v.y / n, z: v.z / n };
  });

// Includes the exact vertical directions so the vertical case is forced.
const arbDirection: fc.Arbitrary<Vec3> = fc.oneof(
  arbRandomUnitDirection,
  fc.constantFrom<Vec3>(
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: -1 },
  ),
);

const len = (v: Vec3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
const dotp = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const isFiniteVec = (v: Vec3): boolean =>
  Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

describe('Property 18: Frenet frames are well-formed and continuous at low curvature', () => {
  it('frames are finite, unit length and orthogonal on open and closed curves', () => {
    fc.assert(
      fc.property(arbCurveInput, fc.integer({ min: 2, max: 300 }), (input, count) => {
        const curve = createCurve(input.points, input.closed);
        const frames = frenetFrames(curve, count);
        expect(frames.length).toBe(count);

        // Plain checks, negated so that NaN fails.
        const requireUnit = (i: number, name: string, v: Vec3): void => {
          const dev = Math.abs(len(v) - 1);
          if (!(dev <= TOLERANCE)) {
            throw new Error(`frame ${i}: |${name} length - 1| = ${dev} exceeds ${TOLERANCE}`);
          }
        };
        const requireOrthogonal = (i: number, label: string, a: Vec3, b: Vec3): void => {
          const dev = Math.abs(dotp(a, b));
          if (!(dev < TOLERANCE)) {
            throw new Error(`frame ${i}: |${label}| = ${dev} exceeds ${TOLERANCE}`);
          }
        };
        for (let i = 0; i < frames.length; i++) {
          const f = frames[i];
          for (const name of ['position', 'tangent', 'normal', 'binormal'] as const) {
            if (!isFiniteVec(f[name])) {
              throw new Error(
                `frame ${i}: ${name} is not finite (${f[name].x}, ${f[name].y}, ${f[name].z})`,
              );
            }
          }
          requireUnit(i, 'tangent', f.tangent);
          requireUnit(i, 'normal', f.normal);
          requireOrthogonal(i, 't·n', f.tangent, f.normal);
          requireUnit(i, 'binormal', f.binormal);
          requireOrthogonal(i, 'b·t', f.binormal, f.tangent);

          // Handedness: binormal must equal tangent × normal.
          const t = f.tangent;
          const n = f.normal;
          const crossTN = {
            x: t.y * n.z - t.z * n.y,
            y: t.z * n.x - t.x * n.z,
            z: t.x * n.y - t.y * n.x,
          };
          for (const c of ['x', 'y', 'z'] as const) {
            if (!(Math.abs(f.binormal[c] - crossTN[c]) <= TOLERANCE)) {
              throw new Error(
                `frame ${i}: binormal.${c} = ${f.binormal[c]}, tangent × normal.${c} = ${crossTN[c]} (tolerance ${TOLERANCE})`,
              );
            }
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('straight lines with uneven spacing keep the first normal, perpendicularised to each tangent', () => {
    fc.assert(
      fc.property(
        arbVec3,
        arbDirection,
        fc.array(coord(0.1, 10), { minLength: 1, maxLength: 11 }),
        fc.integer({ min: 2, max: 300 }),
        (start, dir, steps, count) => {
          const points: Vec3[] = [start];
          let s = 0;
          for (const step of steps) {
            s += step;
            points.push({
              x: start.x + dir.x * s,
              y: start.y + dir.y * s,
              z: start.z + dir.z * s,
            });
          }
          const frames = frenetFrames(createCurve(points, false), count);
          expect(frames.length).toBe(count);

          const n0 = frames[0].normal;
          const comps = ['x', 'y', 'z'] as const;
          for (let i = 0; i < frames.length; i++) {
            const t = frames[i].tangent;
            const d = n0.x * t.x + n0.y * t.y + n0.z * t.z;
            const rx = n0.x - d * t.x;
            const ry = n0.y - d * t.y;
            const rz = n0.z - d * t.z;
            const rl = Math.sqrt(rx * rx + ry * ry + rz * rz);
            const expected = { x: rx / rl, y: ry / rl, z: rz / rl };
            for (const c of comps) {
              const actual = frames[i].normal[c];
              if (!(Math.abs(actual - expected[c]) <= TOLERANCE)) {
                throw new Error(
                  `frame ${i}: normal.${c} = ${actual}, expected ${expected[c]} (tolerance ${TOLERANCE})`,
                );
              }
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('normal persists through a straight stretch after a bend (planar curve)', () => {
    const points: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 6, y: 0, z: 0 },
      { x: 10, y: 0, z: 2 },
      { x: 12, y: 0, z: 6 },
      { x: 12, y: 0, z: 12 },
      { x: 12, y: 0, z: 18 },
      { x: 12, y: 0, z: 24 },
    ];
    const frames = frenetFrames(createCurve(points, false), 200);
    expect(frames.length).toBe(200);

    // The curve lies in the plane y = 0, so every genuine Frenet normal lies in that plane. On the straight stretch at the end (curvature below the threshold) the previous normal must be reused. If the code fell back to world up instead, normal.y would jump to 1.
    for (let i = 0; i < frames.length; i++) {
      const n = frames[i].normal;
      if (!isFiniteVec(n)) {
        throw new Error(`frame ${i}: normal is not finite (${n.x}, ${n.y}, ${n.z})`);
      }
      if (!(Math.abs(n.y) <= 1e-6)) {
        throw new Error(
          `frame ${i}: normal = (${n.x}, ${n.y}, ${n.z}) has |y| > 1e-6, expected the normal to stay in the plane y = 0`,
        );
      }
    }
  });
});
