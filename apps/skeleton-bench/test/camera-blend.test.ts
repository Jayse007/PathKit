import { describe, expect, it } from 'vitest';
import { evaluateEntity, type OutBuffer } from '../src/pathkit-api.js';
import { bakeLaps, LAP_ENTITY_ID } from '../src/pathkit/laps.js';
import { blendCamera, createCameraBlender } from '../src/pathkit/camera-blend.js';
import { zoomSelection } from '../src/logic/frame-mapper.js';
import {
  AIM_TOLERANCE_DEG,
  BEARING_TOLERANCE_DEG,
  CAMERA_MIN_CLEARANCE_M,
  EXPLODED_BOX_HALF_X,
  EXPLODED_BOX_HALF_Y,
  EXPLODED_BOX_HALF_Z,
  EXPLODED_BOX_RADIUS,
  ORBIT_LAP_FRAMES,
  S2_ZOOM_GRID_STEPS,
} from '../src/constants.js';

// Spike S2 and View_Pair validity. Design Properties 5, 6 and 9.
// Requirements 4.3, 4.4, 6.10, 11.2, 11.3, 11.4, 11.11, 35.15.
// Expected values below are written by hand from the design, not computed by the code under test.
const TOL = 1e-9;
const RAD_TO_DEG = 180 / Math.PI;

const laps = bakeLaps();
const blender = createCameraBlender();

function zoomAt(k: number): number {
  return k / S2_ZOOM_GRID_STEPS;
}

/** Distance from point (x, y, z) to the nearest point of the Exploded_Box (centred on the origin). */
function boxClearance(x: number, y: number, z: number): number {
  const dx = Math.max(Math.abs(x) - EXPLODED_BOX_HALF_X, 0);
  const dy = Math.max(Math.abs(y) - EXPLODED_BOX_HALF_Y, 0);
  const dz = Math.max(Math.abs(z) - EXPLODED_BOX_HALF_Z, 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Bearing in degrees 0 to 360 from the +Z axis towards +X. */
function bearingDeg(x: number, z: number): number {
  let b = Math.atan2(x, z) * RAD_TO_DEG;
  if (b < 0) b += 360;
  return b;
}

/** Rotate the local -Z vector by the unit quaternion in the blender. Returns [x, y, z]. */
function forwardOf(q: { x: number; y: number; z: number; w: number }): [number, number, number] {
  return [
    -2 * (q.x * q.z + q.w * q.y),
    -2 * (q.y * q.z - q.w * q.x),
    -(1 - 2 * (q.x * q.x + q.y * q.y)),
  ];
}

describe('camera blend (Spike S2)', () => {
  it('keeps the Bearing, aims at the centre and has distance 6.5 - 3.9 * Z for every frame and zoom grid point', () => {
    for (let k = 0; k <= S2_ZOOM_GRID_STEPS; k++) {
      const z = zoomAt(k);
      const expectedDistance = 6.5 - 3.9 * z;
      for (let f = 0; f < ORBIT_LAP_FRAMES; f++) {
        blendCamera(laps, f, z, blender);
        const p = blender.position;

        let diff = Math.abs(bearingDeg(p.x, p.z) - f);
        if (diff > 180) diff = 360 - diff;
        if (!(diff <= BEARING_TOLERANCE_DEG)) {
          throw new Error(`bearing check: k ${k}, frame ${f}, difference ${diff} deg`);
        }

        const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        if (!(Math.abs(dist - expectedDistance) <= TOL)) {
          throw new Error(`distance check: k ${k}, frame ${f}, expected ${expectedDistance}, got ${dist}`);
        }

        // Angle between the rotated -Z forward vector and the direction from the camera to the centre.
        const fw = forwardOf(blender.rotation);
        const dx = -p.x / dist;
        const dy = -p.y / dist;
        const dz = -p.z / dist;
        const dot = fw[0] * dx + fw[1] * dy + fw[2] * dz;
        const cx = fw[1] * dz - fw[2] * dy;
        const cy = fw[2] * dx - fw[0] * dz;
        const cz = fw[0] * dy - fw[1] * dx;
        const aimDeg = Math.atan2(Math.sqrt(cx * cx + cy * cy + cz * cz), dot) * RAD_TO_DEG;
        if (!(aimDeg <= AIM_TOLERANCE_DEG)) {
          throw new Error(`aim check: k ${k}, frame ${f}, aim error ${aimDeg} deg`);
        }
      }
    }
  });

  it('keeps the camera outside the Exploded_Box over all 360 frames and every zoom grid point', () => {
    for (let k = 0; k <= S2_ZOOM_GRID_STEPS; k++) {
      const z = zoomAt(k);
      const d = 6.5 - 3.9 * z;
      for (let f = 0; f < ORBIT_LAP_FRAMES; f++) {
        blendCamera(laps, f, z, blender);
        const p = blender.position;
        const c = boxClearance(p.x, p.y, p.z);
        if (!(c >= CAMERA_MIN_CLEARANCE_M)) {
          throw new Error(`clearance check: k ${k}, frame ${f}, clearance ${c}, minimum ${CAMERA_MIN_CLEARANCE_M}`);
        }
        if (!(c >= d - EXPLODED_BOX_RADIUS - TOL)) {
          throw new Error(`lower bound check: k ${k}, frame ${f}, clearance ${c}, d - R ${d - EXPLODED_BOX_RADIUS}`);
        }
      }
    }
  });

  it('finds a minimum clearance of 1.2035 m near frame 72 at Z = 1, below what four bearings would show', () => {
    let min = Infinity;
    let minFrame = -1;
    let minAtFour = Infinity;
    for (let f = 0; f < ORBIT_LAP_FRAMES; f++) {
      blendCamera(laps, f, 1, blender);
      const p = blender.position;
      const c = boxClearance(p.x, p.y, p.z);
      if (c < min) {
        min = c;
        minFrame = f;
      }
      if (f % 90 === 0 && c < minAtFour) minAtFour = c;
    }
    expect(Math.abs(min - 1.2035)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(minFrame - 72)).toBeLessThanOrEqual(2);
    expect(min).toBeLessThan(1.2649 - 0.05);
    // The four side-on bearings alone give at least 1.2649 m, so they could not find the true minimum.
    expect(minAtFour).toBeGreaterThanOrEqual(1.2649 - 0.001);
  });

  it('puts the camera at the hand-written positions at Z = 0.5', () => {
    const table: ReadonlyArray<readonly [number, number, number, number]> = [
      [0, 0, 1.75, 4.2],
      [90, 4.2, 1.75, 0],
      [45, 2.9698, 1.75, 2.9698],
    ];
    for (let i = 0; i < table.length; i++) {
      const [f, x, y, z] = table[i];
      blendCamera(laps, f, 0.5, blender);
      const p = blender.position;
      if (Math.abs(p.x - x) > 1e-3 || Math.abs(p.y - y) > 1e-3 || Math.abs(p.z - z) > 1e-3) {
        throw new Error(`position check: frame ${f}, expected (${x}, ${y}, ${z}), got (${p.x}, ${p.y}, ${p.z})`);
      }
    }
  });

  it('gives the hand-written forward vectors at Z = 0.5 on frames 0 and 90', () => {
    const table: ReadonlyArray<readonly [number, number, number, number]> = [
      [0, 0, -5 / 13, -12 / 13],
      [90, -12 / 13, -5 / 13, 0],
    ];
    for (let i = 0; i < table.length; i++) {
      const [f, x, y, z] = table[i];
      blendCamera(laps, f, 0.5, blender);
      const fw = forwardOf(blender.rotation);
      if (Math.abs(fw[0] - x) > 1e-3 || Math.abs(fw[1] - y) > 1e-3 || Math.abs(fw[2] - z) > 1e-3) {
        throw new Error(`forward check: frame ${f}, expected (${x}, ${y}, ${z}), got (${fw[0]}, ${fw[1]}, ${fw[2]})`);
      }
    }
  });

  it('never increases the distance as Z grows, at each bearing', () => {
    for (let f = 0; f < ORBIT_LAP_FRAMES; f++) {
      let previous = Infinity;
      for (let k = 0; k <= S2_ZOOM_GRID_STEPS; k++) {
        blendCamera(laps, f, zoomAt(k), blender);
        const p = blender.position;
        const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        if (!(dist <= previous + TOL)) {
          throw new Error(`monotone check: frame ${f}, k ${k}, distance ${dist}, previous ${previous}`);
        }
        previous = dist;
      }
    }
  });

  it('keeps the Bearing under zoom and the distance under the angle', () => {
    // Zoom never changes the Bearing: same frame, every Z, same bearing as Z = 0.
    for (let f = 0; f < ORBIT_LAP_FRAMES; f++) {
      blendCamera(laps, f, 0, blender);
      const base = bearingDeg(blender.position.x, blender.position.z);
      for (let k = 1; k <= S2_ZOOM_GRID_STEPS; k++) {
        blendCamera(laps, f, zoomAt(k), blender);
        let diff = Math.abs(bearingDeg(blender.position.x, blender.position.z) - base);
        if (diff > 180) diff = 360 - diff;
        if (!(diff <= BEARING_TOLERANCE_DEG)) {
          throw new Error(`zoom-bearing check: frame ${f}, k ${k}, bearing moved by ${diff} deg`);
        }
      }
    }
    // The angle never changes the distance: same Z, every frame, same distance as frame 0.
    for (let k = 0; k <= S2_ZOOM_GRID_STEPS; k++) {
      const z = zoomAt(k);
      blendCamera(laps, 0, z, blender);
      const p0 = blender.position;
      const base = Math.sqrt(p0.x * p0.x + p0.y * p0.y + p0.z * p0.z);
      for (let f = 1; f < ORBIT_LAP_FRAMES; f++) {
        blendCamera(laps, f, z, blender);
        const p = blender.position;
        const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        if (!(Math.abs(dist - base) <= TOL)) {
          throw new Error(`angle-distance check: k ${k}, frame ${f}, distance ${dist}, frame 0 distance ${base}`);
        }
      }
    }
  });

  it('selects the same laps and weight as zoomSelection', () => {
    // blendCamera repeats the zoomSelection rule inline. Rebuild the blend from zoomSelection's answer
    // and compare. Includes joints (1/3, 2/3), values just either side of them, and out-of-range values.
    const zooms = [
      0, 0.1, 0.25, 1 / 3, 0.3334, 0.5, 0.6666, 2 / 3, 0.7, 0.9, 0.999, 1, -0.5, 7,
    ];
    const lower: OutBuffer = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
    const upper: OutBuffer = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
    const frames = [0, 37, 100, 271, 359];
    for (let i = 0; i < zooms.length; i++) {
      const sel = zoomSelection(zooms[i]);
      for (let j = 0; j < frames.length; j++) {
        const f = frames[j];
        evaluateEntity(laps[sel.lowerLap], LAP_ENTITY_ID, f, lower);
        evaluateEntity(laps[sel.upperLap], LAP_ENTITY_ID, f, upper);
        const ex = lower.position.x + (upper.position.x - lower.position.x) * sel.weight;
        const ey = lower.position.y + (upper.position.y - lower.position.y) * sel.weight;
        const ez = lower.position.z + (upper.position.z - lower.position.z) * sel.weight;
        blendCamera(laps, f, zooms[i], blender);
        const p = blender.position;
        if (Math.abs(p.x - ex) > 1e-12 || Math.abs(p.y - ey) > 1e-12 || Math.abs(p.z - ez) > 1e-12) {
          throw new Error(
            `selection check: zoom ${zooms[i]}, frame ${f}, laps ${sel.lowerLap}/${sel.upperLap}, weight ${sel.weight}, ` +
              `expected (${ex}, ${ey}, ${ez}), got (${p.x}, ${p.y}, ${p.z})`,
          );
        }
      }
    }
  });

  it('throws on a non-finite zoom, as zoomSelection does', () => {
    expect(() => blendCamera(laps, 0, Number.NaN, blender)).toThrow(Error);
    expect(() => blendCamera(laps, 0, Number.POSITIVE_INFINITY, blender)).toThrow(Error);
    expect(() => zoomSelection(Number.NaN)).toThrow(Error);
  });
});
