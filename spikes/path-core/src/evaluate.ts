import type { Quat, Vec3 } from './math.js';
import type { BakedData } from './bake.js';

/** Caller-provided output buffer. evaluateEntity writes into it and returns it. */
export interface OutBuffer {
  position: Vec3;
  rotation: Quat;
}

/** Number of baked values per entity per frame: position x, y, z then rotation x, y, z, w. */
const TRANSFORM_STRIDE = 7;

/**
 * Reads the baked position and rotation of one entity at one frame into `out`.
 * Reads baked data only. Allocates nothing on the success path.
 * Throws for an unknown id (checked first) or a frame that is not an integer in [0, frameCount - 1].
 * `out` is not touched when it throws.
 */
export function evaluateEntity(
  baked: BakedData,
  entityId: string,
  frame: number,
  out: OutBuffer,
): OutBuffer {
  const index = baked.entityIndex.get(entityId);
  if (index === undefined) {
    throw new Error(`Unknown entity id "${entityId}"`);
  }
  if (!(Number.isInteger(frame) && frame >= 0 && frame < baked.frameCount)) {
    throw new Error(`Frame ${frame} is outside the valid range [0, ${baked.frameCount - 1}]`);
  }
  const transforms = baked.transforms[index];
  const i = frame * TRANSFORM_STRIDE;
  out.position.x = transforms[i];
  out.position.y = transforms[i + 1];
  out.position.z = transforms[i + 2];
  out.rotation.x = transforms[i + 3];
  out.rotation.y = transforms[i + 4];
  out.rotation.z = transforms[i + 5];
  out.rotation.w = transforms[i + 6];
  return out;
}
