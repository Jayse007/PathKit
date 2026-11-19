import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import { rotationMinimizingFrames } from '../../src/frames.js';
import type { Frame } from '../../src/frames.js';
import { arbCurveInput, arbScalar, arbVec3 } from '../helpers/basic-generators.js';
import type { Vec3 } from '../helpers/basic-generators.js';

// Feature: path-core, Property 15: RMF frames are orthonormal
// **Validates: Requirements 4.1, 4.2, 4.5, 4.6**

const TOLERANCE = 1e-6;

type UpKind = 'random' | 'omitted' | 'zero' | 'up' | 'parallel';
const arbUpKind: fc.Arbitrary<UpKind> = fc.constantFrom<UpKind>(
  'random',
  'omitted',
  'zero',
  'up',
  'parallel',
);

/** Non-zero scalar (positive or negative), used to scale the first tangent. */
const arbNonZeroScalar = arbScalar.filter((s) => s !== 0);

const norm = (v: Vec3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
const dotp = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const isFiniteVec = (v: Vec3): boolean =>
  Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

function checkFrames(frames: Frame[]): void {
  for (const f of frames) {
    for (const v of [f.position, f.tangent, f.normal, f.binormal]) {
      expect(isFiniteVec(v)).toBe(true);
    }
    expect(Math.abs(norm(f.tangent) - 1)).toBeLessThan(TOLERANCE);
    expect(Math.abs(norm(f.normal) - 1)).toBeLessThan(TOLERANCE);
    expect(Math.abs(norm(f.binormal) - 1)).toBeLessThan(TOLERANCE);
    expect(Math.abs(dotp(f.tangent, f.normal))).toBeLessThan(TOLERANCE);
    expect(Math.abs(dotp(f.tangent, f.binormal))).toBeLessThan(TOLERANCE);
    expect(Math.abs(dotp(f.normal, f.binormal))).toBeLessThan(TOLERANCE);
  }
}

describe('Property 15: RMF frames are orthonormal', () => {
  it('frames are finite and orthonormal for random, omitted, zero, up and parallel initialUp', () => {
    fc.assert(
      fc.property(
        arbCurveInput,
        fc.integer({ min: 2, max: 300 }),
        arbUpKind,
        arbVec3,
        arbNonZeroScalar,
        (input, count, kind, randomUp, factor) => {
          const curve = createCurve(input.points, input.closed);

          let frames: Frame[];
          switch (kind) {
            case 'random':
              frames = rotationMinimizingFrames(curve, count, randomUp);
              break;
            case 'omitted':
              frames = rotationMinimizingFrames(curve, count);
              break;
            case 'zero':
              frames = rotationMinimizingFrames(curve, count, { x: 0, y: 0, z: 0 });
              break;
            case 'up':
              frames = rotationMinimizingFrames(curve, count, { x: 0, y: 1, z: 0 });
              break;
            case 'parallel': {
              // The factor may be negative, so this covers parallel and anti-parallel.
              const t0 = curve.tangentAt(0);
              frames = rotationMinimizingFrames(curve, count, {
                x: t0.x * factor,
                y: t0.y * factor,
                z: t0.z * factor,
              });
              break;
            }
          }

          expect(frames.length).toBe(count);
          checkFrames(frames);

          const start = curve.pointAt(0);
          const end = curve.pointAt(1);
          expect(frames[0].position).toEqual(start);
          expect(frames[count - 1].position).toEqual(end);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Straight curve along +Y example', () => {
  it('stays orthonormal and finite with initialUp exactly parallel to the first tangent', () => {
    const curve = createCurve(
      [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 2, z: 0 },
      ],
      false,
    );
    const count = 10;
    const frames = rotationMinimizingFrames(curve, count, { x: 0, y: 1, z: 0 });

    expect(frames.length).toBe(count);
    checkFrames(frames);
    expect(frames[0].position).toEqual(curve.pointAt(0));
    expect(frames[count - 1].position).toEqual(curve.pointAt(1));
  });
});
