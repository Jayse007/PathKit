import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import { createArcLengthTable } from '../../src/arclength.js';
import { arbCurveInput } from '../helpers/basic-generators.js';

// Feature: path-core, Property 12: Arc-length clamp and wrap
// **Validates: Requirements 3.5, 3.6**

const TOLERANCE = 1e-9;
const RAW_MAX = 1000000;
const DENSE_STEPS = 200;

const arbRaw = fc.integer({ min: 0, max: RAW_MAX });
const arbRawList = fc.array(arbRaw, { minLength: 20, maxLength: 20 });

/** Maps an integer in [0, RAW_MAX] onto [-3 * length, 4 * length]. */
const toDistance = (raw: number, length: number): number =>
  -3 * length + (raw / RAW_MAX) * 7 * length;

/** Maps an integer in [0, RAW_MAX) onto [0, length). */
const toPeriodDistance = (raw: number, length: number): number => {
  const d = (raw / RAW_MAX) * length;
  return d < length ? d : 0;
};

const build = (input: { points: { x: number; y: number; z: number }[]; closed: boolean }) => {
  const curve = createCurve(input.points, input.closed);
  return { curve, table: createArcLengthTable(curve) };
};

const expectSameResults = (
  table: ReturnType<typeof createArcLengthTable>,
  a: number,
  b: number,
): void => {
  const pa = { x: 0, y: 0, z: 0 };
  const pb = { x: 0, y: 0, z: 0 };
  table.pointAtDistance(a, pa);
  table.pointAtDistance(b, pb);
  expect(Math.abs(pa.x - pb.x)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(pa.y - pb.y)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(pa.z - pb.z)).toBeLessThanOrEqual(TOLERANCE);
  const ta = { x: 0, y: 0, z: 0 };
  const tb = { x: 0, y: 0, z: 0 };
  table.tangentAtDistance(a, ta);
  table.tangentAtDistance(b, tb);
  expect(Math.abs(ta.x - tb.x)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(ta.y - tb.y)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(ta.z - tb.z)).toBeLessThanOrEqual(TOLERANCE);
};

describe('Property 12: Arc-length clamp and wrap', () => {
  it('open tables clamp d to [0, length]; closed tables wrap d into [0, length)', () => {
    fc.assert(
      fc.property(arbCurveInput, arbRaw, (input, raw) => {
        const { table } = build(input);
        const length = table.length;
        const d = toDistance(raw, length);
        const reduced = input.closed
          ? d - length * Math.floor(d / length)
          : Math.min(Math.max(d, 0), length);
        expectSameResults(table, d, reduced);
      }),
      { numRuns: 200 },
    );
  });

  it('closed tables treat d = k * length the same as d = 0', () => {
    fc.assert(
      fc.property(
        arbCurveInput.filter((input) => input.closed),
        fc.integer({ min: -3, max: 4 }),
        (input, k) => {
          const { table } = build(input);
          expectSameResults(table, k * table.length, 0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('parameterAtDistance never decreases as d increases (open: whole range; closed: one period)', () => {
    fc.assert(
      fc.property(arbCurveInput, arbRawList, (input, raws) => {
        const { table } = build(input);
        const length = table.length;
        const distances = raws
          .map((raw) => (input.closed ? toPeriodDistance(raw, length) : toDistance(raw, length)))
          .sort((a, b) => a - b);
        for (let i = 0; i + 1 < distances.length; i++) {
          expect(table.parameterAtDistance(distances[i])).toBeLessThanOrEqual(
            table.parameterAtDistance(distances[i + 1]),
          );
        }
        // Consecutive dense steps over the same range.
        const lo = input.closed ? 0 : -3 * length;
        const span = input.closed ? length : 7 * length;
        let prevT = table.parameterAtDistance(lo);
        for (let i = 1; i <= DENSE_STEPS; i++) {
          const d = input.closed ? (i / (DENSE_STEPS + 1)) * span : lo + (i / DENSE_STEPS) * span;
          const t = table.parameterAtDistance(d);
          expect(t).toBeGreaterThanOrEqual(prevT);
          prevT = t;
        }
      }),
      { numRuns: 200 },
    );
  });

  it('endpoints are exact: d = 0 gives t = 0; on open curves d = length gives t = 1', () => {
    fc.assert(
      fc.property(arbCurveInput, (input) => {
        const { table } = build(input);
        expect(table.parameterAtDistance(0)).toBe(0);
        if (!input.closed) {
          expect(table.parameterAtDistance(table.length)).toBe(1);
        }
      }),
      { numRuns: 200 },
    );
  });
});
