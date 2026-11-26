import { describe, expect, it } from 'vitest';
import {
  fillFractionPercent,
  framingPercent,
  projectToNdc,
  subjectBoxCorners,
} from '../../src/logic/fill.js';
import { framingLabel } from '../../src/logic/labels.js';
import { fieldOfViewForFocalLengthMm } from '../../src/logic/lens.js';
import {
  ASPECT_RATIO,
  CAR_HALF_EXTENT_X,
  CAR_HALF_EXTENT_Y,
  CAR_HALF_EXTENT_Z,
} from '../../src/logic/constants.js';

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const ORIGIN = { x: 0, y: 0, z: 0 };
const CAMERA_AT_10 = { x: 0, y: 0, z: 10 };
const HALF = { x: CAR_HALF_EXTENT_X, y: CAR_HALF_EXTENT_Y, z: CAR_HALF_EXTENT_Z };
const TOLERANCE = 1e-9;

function check(name: string, index: number, actual: number, expected: number, tol: number): void {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(`${name}[${index}]: expected ${expected}, got ${actual} (tolerance ${tol})`);
  }
}

// Builds an NDC buffer from (x, y) pairs.
function ndcOf(...pairs: Array<[number, number]>): Float64Array {
  const out = new Float64Array(pairs.length * 2);
  for (let i = 0; i < pairs.length; i++) {
    out[i * 2] = pairs[i][0];
    out[i * 2 + 1] = pairs[i][1];
  }
  return out;
}

const verticalFovRad50 = (fieldOfViewForFocalLengthMm(50).verticalDeg * Math.PI) / 180;

// Design table, by code corner index (bit 0 = x, bit 1 = y, bit 2 = z, set = positive).
// Table corners 1 to 4 are the near corners (z = +2.2), which are code indices 4 to 7.
// Table corners 5 to 8 are the far corners (z = -2.2), which are code indices 0 to 3.
// Near depth 7.8 m, far depth 12.2 m. tan(half vertical fov) = 10.125 / 50 = 0.2025,
// tan(half horizontal fov) = 0.2025 * 16 / 9 = 0.36.
const NEAR_NDC_X = 0.9 / (0.36 * 7.8);
const NEAR_NDC_Y = 0.7 / (0.2025 * 7.8);
const FAR_NDC_X = 0.9 / (0.36 * 12.2);
const FAR_NDC_Y = 0.7 / (0.2025 * 12.2);

function expectedNdcForIndex(i: number): [number, number] {
  const sx = (i & 1) !== 0 ? 1 : -1;
  const sy = (i & 2) !== 0 ? 1 : -1;
  const near = (i & 4) !== 0;
  return near ? [sx * NEAR_NDC_X, sy * NEAR_NDC_Y] : [sx * FAR_NDC_X, sy * FAR_NDC_Y];
}

describe('fillFractionPercent', () => {
  it('height decides: x -0.2 to 0.2, y -0.5 to 0.5 gives 50 (medium)', () => {
    const ndc = ndcOf([-0.2, -0.5], [0.2, 0.5]);
    const fill = fillFractionPercent(ndc, 2);
    check('fill', 0, fill, 50, TOLERANCE);
    expect(framingLabel(fill)).toBe('medium');
  });

  it('width decides: x -0.9 to 0.9, y -0.1 to 0.1 gives 90 (close-up)', () => {
    const ndc = ndcOf([-0.9, -0.1], [0.9, 0.1]);
    const fill = fillFractionPercent(ndc, 2);
    check('fill', 0, fill, 90, TOLERANCE);
    expect(framingLabel(fill)).toBe('close-up');
  });

  it('partly outside: x -1.5 to 0.5, y -0.2 to 0.2 gives 75 (clipped to the frame)', () => {
    const ndc = ndcOf([-1.5, -0.2], [0.5, 0.2]);
    check('fill', 0, fillFractionPercent(ndc, 2), 75, TOLERANCE);
  });
});

describe('realistic pose (design table)', () => {
  it('all 8 corners match the design table to 5 decimals and the fill is 44.3 (medium)', () => {
    const corners = new Float64Array(24);
    const ndc = new Float64Array(16);
    subjectBoxCorners(ORIGIN, IDENTITY, HALF, corners);
    const inFront = projectToNdc(corners, 8, CAMERA_AT_10, IDENTITY, verticalFovRad50, ASPECT_RATIO, ndc);
    expect(inFront).toBe(true);
    for (let i = 0; i < 8; i++) {
      const [ex, ey] = expectedNdcForIndex(i);
      check('ndcX', i, ndc[i * 2], ex, 5e-6);
      check('ndcY', i, ndc[i * 2 + 1], ey, 5e-6);
    }
    // The two corners the task names, as written in the design table (5 decimal places).
    // Table corner 1 is code index 4; table corner 5 is code index 0.
    expect(ndc[4 * 2]).toBeCloseTo(-0.320513, 5);
    expect(ndc[4 * 2 + 1]).toBeCloseTo(-0.443178, 5);
    expect(ndc[0 * 2]).toBeCloseTo(-0.204918, 5);
    expect(ndc[0 * 2 + 1]).toBeCloseTo(-0.283344, 5);

    const fill = fillFractionPercent(ndc, 8);
    check('fill', 0, fill, (100 * 0.7) / (0.2025 * 7.8), TOLERANCE);
    check('fill to 1 decimal', 0, fill, 44.3, 0.05);
    expect(framingLabel(fill)).toBe('medium');
  });

  it('framingPercent gives the same fill as the three steps', () => {
    const fill = framingPercent(
      ORIGIN, IDENTITY, HALF, CAMERA_AT_10, IDENTITY, verticalFovRad50, ASPECT_RATIO,
      new Float64Array(24), new Float64Array(16),
    );
    check('fill', 0, fill, (100 * 0.7) / (0.2025 * 7.8), TOLERANCE);
  });
});

describe('moved and rotated poses', () => {
  it('moved car and camera give the same fill', () => {
    // Same pose as the design table, shifted by (3, 0.5, -2). Relative geometry is unchanged.
    const carAt = { x: 3, y: 0.5, z: -2 };
    const cameraAt = { x: 3, y: 0.5, z: 8 };
    const corners = new Float64Array(24);
    const ndc = new Float64Array(16);
    subjectBoxCorners(carAt, IDENTITY, HALF, corners);
    const inFront = projectToNdc(corners, 8, cameraAt, IDENTITY, verticalFovRad50, ASPECT_RATIO, ndc);
    expect(inFront).toBe(true);
    // Corner by corner, so a dropped position.y shows up here (the fill alone would not change).
    for (let i = 0; i < 8; i++) {
      const [ex, ey] = expectedNdcForIndex(i);
      check('ndcX', i, ndc[i * 2], ex, 5e-6);
      check('ndcY', i, ndc[i * 2 + 1], ey, 5e-6);
    }
    const fill = fillFractionPercent(ndc, 8);
    check('fill', 0, fill, (100 * 0.7) / (0.2025 * 7.8), TOLERANCE);
    check('fill to 1 decimal', 0, fill, 44.3, 0.05);
    expect(framingLabel(fill)).toBe('medium');
  });

  it('rotated camera: at (10, 0, 0) turned 90 degrees about +Y, looking along -X', () => {
    // The box z extent (+-2.2) now runs across the frame. Near corners (x = +0.9) are 9.1 m away.
    // Width decides: 100 * 2.2 / (0.36 * 9.1) = 67.155. Height would be only about 38.
    const cameraAt = { x: 10, y: 0, z: 0 };
    const cameraTurned = { x: 0, y: 0.70710678, z: 0, w: 0.70710678 };
    const corners = new Float64Array(24);
    const ndc = new Float64Array(16);
    subjectBoxCorners(ORIGIN, IDENTITY, HALF, corners);
    const inFront = projectToNdc(corners, 8, cameraAt, cameraTurned, verticalFovRad50, ASPECT_RATIO, ndc);
    expect(inFront).toBe(true);
    const fill = fillFractionPercent(ndc, 8);
    check('fill', 0, fill, 67.155, 0.01);
    expect(framingLabel(fill)).toBe('medium');
  });
});

describe('clipping and edge cases', () => {
  it('vertical clipping: y -1.5 to 0.5 is clipped to -1 to 0.5, giving 75', () => {
    const ndc = ndcOf([-0.2, -1.5], [0.2, 0.5]);
    check('fill', 0, fillFractionPercent(ndc, 2), 75, TOLERANCE);
  });

  it('a point on the camera counts as behind', () => {
    const points = new Float64Array([0, 0, 10]);
    const ndc = new Float64Array(2);
    const inFront = projectToNdc(points, 1, CAMERA_AT_10, IDENTITY, verticalFovRad50, ASPECT_RATIO, ndc);
    expect(inFront).toBe(false);
  });
});

describe('projectToNdc validation edges', () => {
  const pts = new Float64Array([0, 0, 0]);

  it('throws when verticalFovRad is pi', () => {
    expect(() =>
      projectToNdc(pts, 1, CAMERA_AT_10, IDENTITY, Math.PI, ASPECT_RATIO, new Float64Array(2)),
    ).toThrow();
  });

  it('throws when aspect is 0', () => {
    expect(() =>
      projectToNdc(pts, 1, CAMERA_AT_10, IDENTITY, verticalFovRad50, 0, new Float64Array(2)),
    ).toThrow();
  });

  it('throws when count is 1.5', () => {
    expect(() =>
      projectToNdc(new Float64Array(6), 1.5, CAMERA_AT_10, IDENTITY, verticalFovRad50, ASPECT_RATIO, new Float64Array(4)),
    ).toThrow();
  });

  it('throws when outNdc is one number too short', () => {
    // 2 points need 4 numbers.
    expect(() =>
      projectToNdc(new Float64Array(6), 2, CAMERA_AT_10, IDENTITY, verticalFovRad50, ASPECT_RATIO, new Float64Array(3)),
    ).toThrow();
  });
});

describe('behind the camera', () => {
  it('a point at z = 12 (camera at z = 10) makes projectToNdc return false and still writes the others', () => {
    const points = new Float64Array([0, 0, 0, 0, 0, 12]);
    const ndc = new Float64Array(4);
    const inFront = projectToNdc(points, 2, CAMERA_AT_10, IDENTITY, verticalFovRad50, ASPECT_RATIO, ndc);
    expect(inFront).toBe(false);
    check('ndc', 0, ndc[0], 0, 0);
    check('ndc', 1, ndc[1], 0, 0);
  });

  it('framingPercent returns 100 when a box corner is behind the camera', () => {
    // Box centred at z = 12: near-side corners at z = 9.8 are in front, far-side at z = 14.2 are behind.
    const fill = framingPercent(
      { x: 0, y: 0, z: 12 }, IDENTITY, HALF, CAMERA_AT_10, IDENTITY, verticalFovRad50, ASPECT_RATIO,
      new Float64Array(24), new Float64Array(16),
    );
    expect(fill).toBe(100);
  });
});

describe('invalid input', () => {
  it('throws naming the index and value for NaN', () => {
    const bad = new Float64Array([0, 0, 0, 0, NaN, 0]);
    expect(() =>
      projectToNdc(bad, 2, CAMERA_AT_10, IDENTITY, verticalFovRad50, ASPECT_RATIO, new Float64Array(4)),
    ).toThrow(/\[4\].*NaN/);
    expect(() => fillFractionPercent(ndcOf([0, NaN], [0, 0]), 2)).toThrow(/\[1\].*NaN/);
    expect(() =>
      subjectBoxCorners({ x: 0, y: NaN, z: 0 }, IDENTITY, HALF, new Float64Array(24)),
    ).toThrow(/\[1\].*NaN/);
  });

  it('throws naming the value for count 0', () => {
    expect(() =>
      projectToNdc(new Float64Array(3), 0, CAMERA_AT_10, IDENTITY, verticalFovRad50, ASPECT_RATIO, new Float64Array(2)),
    ).toThrow(/count.*0/);
    expect(() => fillFractionPercent(new Float64Array(2), 0)).toThrow(/pointCount.*0/);
  });
});
