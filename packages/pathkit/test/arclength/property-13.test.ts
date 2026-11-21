import { describe, it } from 'vitest';
import fc from 'fast-check';
import { createCurve } from '../../src/curve.js';
import { createArcLengthTable } from '../../src/arclength.js';
import { smoothCurvePoints } from '../helpers/smooth-curve-generator.js';

// Feature: path-core, Property 13: Equal distance steps give equal chords
// **Validates: Requirements 3.3, 3.7**

const NUM_RUNS = 100;
const RELATIVE_TOLERANCE = 0.01;

let worstDeviation = 0;
let curveCount = 0;

describe('Property 13: Equal distance steps give equal chords', () => {
  it('positions at k * length / N have consecutive chords within 1 percent of length / N', () => {
    fc.assert(
      fc.property(smoothCurvePoints, ({ points, N }) => {
        curveCount++;
        const curve = createCurve(points, false);
        const table = createArcLengthTable(curve);
        const step = table.length / N;

        const start = table.pointAtDistance(0, { x: 0, y: 0, z: 0 });
        let prevX = start.x;
        let prevY = start.y;
        let prevZ = start.z;
        const cur = { x: 0, y: 0, z: 0 };
        for (let k = 1; k <= N; k++) {
          table.pointAtDistance(k * step, cur);
          const chord = Math.hypot(cur.x - prevX, cur.y - prevY, cur.z - prevZ);
          const deviation = Math.abs(chord - step) / step;
          if (deviation > worstDeviation) worstDeviation = deviation;
          if (!(Math.abs(chord - step) <= RELATIVE_TOLERANCE * step)) {
            throw new Error(
              `chord ${k}: |chord - step| / step = ${deviation} exceeds ${RELATIVE_TOLERANCE} (chord ${chord}, step ${step})`,
            );
          }
          prevX = cur.x;
          prevY = cur.y;
          prevZ = cur.z;
        }
      }),
      { numRuns: NUM_RUNS },
    );
    console.log(
      `Property 13 worst chord deviation: ${(worstDeviation * 100).toFixed(4)}% over ${curveCount} curves`,
    );
  });
});
