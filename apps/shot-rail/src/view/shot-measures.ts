// Shot measures: the numbers and labels that describe one camera against the subject at one frame.
// Pure: no DOM, no Three.js, no clock. The Coverage_Grid tile captions and the Readout both call
// measureShot, so the two always agree (task 38.1; the code was moved here out of coverage-grid.ts).
//
// measureShot allocates nothing: it writes into a caller-supplied ShotMeasures and uses module-level
// scratch arrays made once at load (single-threaded, no re-entrancy, as in fill.ts).

import type { OutBuffer, Vec3 } from '../logic/pathkit.js';
import {
  ASPECT_RATIO,
  CAR_HALF_EXTENT_X,
  CAR_HALF_EXTENT_Y,
  CAR_HALF_EXTENT_Z,
} from '../logic/constants.js';
import { framingPercent } from '../logic/fill.js';
import { angleLabel, framingLabel } from '../logic/labels.js';
import type { AngleLabel, FramingLabel } from '../logic/labels.js';

// View-only values (not in the design's Named constants table).
const RAD_TO_DEG = 180 / Math.PI;
const SCRATCH_CORNERS_LENGTH = 24; // 8 corners x 3
const SCRATCH_NDC_LENGTH = 16; // 8 corners x 2

// The car's box. The car is the only Subject.
export const SUBJECT_HALF_EXTENTS: Vec3 = { x: CAR_HALF_EXTENT_X, y: CAR_HALF_EXTENT_Y, z: CAR_HALF_EXTENT_Z };

/** What measureShot writes. One object, reused for every call. */
export interface ShotMeasures {
  /** From the true subject centre to the camera, in degrees. 0 is level, above is positive. */
  elevationDeg: number;
  /** Camera to subject centre, sideways only (height ignored), in metres. */
  horizontalDistanceM: number;
  /** Camera to subject centre, height included, in metres. */
  straightLineDistanceM: number;
  /** Percent of the frame the subject's box covers, 0 to 100. */
  fillPercent: number;
  angle: AngleLabel;
  framing: FramingLabel;
}

/** A ShotMeasures to pass to measureShot. Allocates once. The starting values mean nothing. */
export function createShotMeasures(): ShotMeasures {
  return {
    elevationDeg: 0,
    horizontalDistanceM: 0,
    straightLineDistanceM: 0,
    fillPercent: 0,
    angle: 'eye level',
    framing: 'medium',
  };
}

const scratchCorners = new Float64Array(SCRATCH_CORNERS_LENGTH);
const scratchNdc = new Float64Array(SCRATCH_NDC_LENGTH);

/**
 * Measures `camera` against `subject` (both baked positions and rotations at the same displayed frame)
 * for a lens with vertical field of view `verticalFovRad`, at the app's fixed aspect ratio. Writes into
 * `out` and returns it. Elevation uses the true subject centre. Throws what framingLabel throws when the
 * fill is not a finite number from 0 to 100.
 */
export function measureShot(
  camera: OutBuffer,
  subject: OutBuffer,
  verticalFovRad: number,
  out: ShotMeasures,
): ShotMeasures {
  const dx = camera.position.x - subject.position.x;
  const dy = camera.position.y - subject.position.y;
  const dz = camera.position.z - subject.position.z;
  const horizontal = Math.sqrt(dx * dx + dz * dz);
  out.horizontalDistanceM = horizontal;
  out.straightLineDistanceM = Math.sqrt(dx * dx + dy * dy + dz * dz);
  out.elevationDeg = Math.atan2(dy, horizontal) * RAD_TO_DEG;
  out.angle = angleLabel(out.elevationDeg);

  out.fillPercent = framingPercent(
    subject.position,
    subject.rotation,
    SUBJECT_HALF_EXTENTS,
    camera.position,
    camera.rotation,
    verticalFovRad,
    ASPECT_RATIO,
    scratchCorners,
    scratchNdc,
  );
  out.framing = framingLabel(out.fillPercent);
  return out;
}
