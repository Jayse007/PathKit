// Target_Converter: turns a baked subject into a keyframed target, one keyframe per displayed frame.
// Pure given its inputs. Allocation is allowed here (setup code, not the evaluation path).

import { evaluateEntity } from './pathkit.js';
import type { BakedData, Keyframe, OutBuffer } from './pathkit.js';

/**
 * Builds exactly `displayedFrameCount` keyframes, one per displayed frame 0..N-1.
 * Keyframe f holds the baked position of `subjectEntityId` at baked frame `remap(f)`,
 * shifted by (0, heightOffsetM, 0). x and z are copied unchanged.
 *
 * Throws an Error naming the value when `displayedFrameCount` is not a whole number >= 0.
 * Errors from `remap` and `evaluateEntity` (unknown id, baked frame out of range) pass through.
 */
export function buildKeyframedTarget(
  bakedSubject: BakedData,
  subjectEntityId: string,
  displayedFrameCount: number,
  remap: (displayedFrame: number) => number,
  heightOffsetM: number,
): { keyframes: Keyframe[] } {
  if (!Number.isInteger(displayedFrameCount) || displayedFrameCount < 0) {
    throw new Error(
      `buildKeyframedTarget: displayedFrameCount must be a whole number of 0 or more, got ${String(displayedFrameCount)}`,
    );
  }

  const scratch: OutBuffer = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };
  const keyframes: Keyframe[] = [];

  for (let f = 0; f < displayedFrameCount; f++) {
    const bakedFrame = remap(f);
    evaluateEntity(bakedSubject, subjectEntityId, bakedFrame, scratch);
    keyframes.push({
      frame: f,
      position: {
        x: scratch.position.x,
        y: scratch.position.y + heightOffsetM,
        z: scratch.position.z,
      },
    });
  }

  return { keyframes };
}
