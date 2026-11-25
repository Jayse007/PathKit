// Camera blend (Spike S2): reads two baked laps at the same whole frame and blends them
// with PathKit lerp and slerp. All buffers are allocated once in createCameraBlender.
// blendCamera allocates nothing: no objects, arrays or closures per call.
import {
  evaluateEntity,
  lerp,
  slerp,
  type BakedData,
  type OutBuffer,
  type Quat,
  type Vec3,
} from '../pathkit-api.js';
import { LAP_COUNT } from '../constants.js';
import { LAP_ENTITY_ID } from './laps.js';

/** Preallocated storage for the blend. Create once at load. */
export interface CameraBlender {
  readonly lower: OutBuffer;
  readonly upper: OutBuffer;
  /** Result position. Overwritten by every blendCamera call. */
  readonly position: Vec3;
  /** Result rotation. Overwritten by every blendCamera call. */
  readonly rotation: Quat;
}

export function createCameraBlender(): CameraBlender {
  return {
    lower: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    },
    upper: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };
}

/**
 * Blend the camera pose for a whole frame and a zoom value into blender.position and blender.rotation.
 * Both laps are read at the same whole frame; only the weight is fractional.
 * Throws if laps does not hold the lap scenes or the frame is not a whole frame in range
 * (evaluateEntity checks the frame).
 */
export function blendCamera(
  laps: readonly BakedData[],
  frame: number,
  zoom: number,
  blender: CameraBlender,
): CameraBlender {
  // Same rule as zoomSelection (p = Z * 3, i = min(floor(p), 2), w = p - i), written inline
  // because zoomSelection returns a new object and this path must not allocate.
  if (!Number.isFinite(zoom)) {
    throw new Error(`blendCamera: zoom must be a finite number, got ${String(zoom)}`);
  }
  const z = Math.min(1, Math.max(0, zoom));
  const p = z * (LAP_COUNT - 1);
  const lowerIndex = Math.min(Math.floor(p), LAP_COUNT - 2);
  const weight = p - lowerIndex;
  const lowerBaked = laps[lowerIndex];
  const upperBaked = laps[lowerIndex + 1];
  if (lowerBaked === undefined || upperBaked === undefined) {
    throw new Error(`blendCamera: laps ${lowerIndex} and ${lowerIndex + 1} are required, got ${laps.length} laps`);
  }
  evaluateEntity(lowerBaked, LAP_ENTITY_ID, frame, blender.lower);
  evaluateEntity(upperBaked, LAP_ENTITY_ID, frame, blender.upper);
  lerp(blender.lower.position, blender.upper.position, weight, blender.position);
  slerp(blender.lower.rotation, blender.upper.rotation, weight, blender.rotation);
  return blender;
}
