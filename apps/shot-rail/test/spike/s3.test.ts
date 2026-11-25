// Spike S3: orbitAround with speed 0 around a keyframed target.
// Camera minus target must be the same fixed offset on every frame, while the camera moves with the target.
// Expected offset is computed from the constants: radius 8, startAngle 30 degrees, axis +Y -> (radius sin a, 0, radius cos a).

import { describe, expect, it } from 'vitest';
import { bake, evaluateEntity, validateScene } from '../../src/logic/pathkit.js';
import type { Keyframe, OutBuffer, Scene } from '../../src/logic/pathkit.js';
import { CAMERA_FORWARD_AXIS, CAMERA_UP_AXIS } from '../../src/logic/constants.js';

const FRAMES = 60;
const TOLERANCE = 1e-9;
const CAMERA_ID = 'cam-1';
const TARGET_NAME = 'moving-target';
const RADIUS = 8;
const START_ANGLE_DEGREES = 30; // value given to the scene (input boundary)
const START_ANGLE_RADIANS = (START_ANGLE_DEGREES * Math.PI) / 180; // converted once, used for the expectation
const OFFSET_X = RADIUS * Math.sin(START_ANGLE_RADIANS);
const OFFSET_Y = 0;
const OFFSET_Z = RADIUS * Math.cos(START_ANGLE_RADIANS);

function makeOut(): OutBuffer {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };
}

// Straight line: x = 2 f - 10, y = 1, z = 3 - 0.5 f.
function targetX(f: number): number {
  return 2 * f - 10;
}
function targetZ(f: number): number {
  return 3 - 0.5 * f;
}

const keyframes: Keyframe[] = [];
for (let f = 0; f < FRAMES; f++) {
  keyframes.push({ frame: f, position: { x: targetX(f), y: 1, z: targetZ(f) } });
}

function makeScene(speed: number): Scene {
  return {
    fps: 24,
    frameCount: FRAMES,
    path: {
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 5, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
      ],
      closed: false,
    },
    targets: { [TARGET_NAME]: { keyframes } },
    entities: [
      {
        id: CAMERA_ID,
        forwardAxis: CAMERA_FORWARD_AXIS,
        upAxis: CAMERA_UP_AXIS,
        constraints: [
          {
            type: 'orbitAround',
            order: 0,
            influence: 1,
            target: TARGET_NAME,
            radius: RADIUS,
            axis: '+Y',
            speed,
            startAngle: START_ANGLE_DEGREES,
          },
        ],
      },
    ],
  };
}

describe('S3: orbitAround with speed 0 and a keyframed target', () => {
  it('the scene is valid and bakes', () => {
    const scene = makeScene(0);
    expect(() => validateScene(scene)).not.toThrow();
    expect(() => bake(scene)).not.toThrow();
  });

  it('camera minus target is the fixed offset on every frame, and the camera moves', () => {
    const baked = bake(makeScene(0));
    const out = makeOut();
    let maxError = 0;
    let firstX = 0;
    let lastX = 0;

    for (let f = 0; f < FRAMES; f++) {
      evaluateEntity(baked, CAMERA_ID, f, out);
      const ox = out.position.x - targetX(f);
      const oy = out.position.y - 1;
      const oz = out.position.z - targetZ(f);
      const e = Math.max(
        Math.abs(ox - OFFSET_X),
        Math.abs(oy - OFFSET_Y),
        Math.abs(oz - OFFSET_Z),
      );
      if (e > maxError) maxError = e;
      if (!(e <= TOLERANCE)) {
        throw new Error(
          `S3 offset: frame ${f} offset (${ox}, ${oy}, ${oz}), expected (${OFFSET_X}, ${OFFSET_Y}, ${OFFSET_Z}), largest difference ${e}`,
        );
      }
      if (f === 0) firstX = out.position.x;
      if (f === FRAMES - 1) lastX = out.position.x;
    }

    // The target moves 2 m per frame in x, so the camera must have moved 118 m in x.
    if (!(Math.abs(lastX - firstX - 118) <= TOLERANCE)) {
      throw new Error(`S3 movement: camera x moved ${lastX - firstX}, expected 118`);
    }
    console.log(`S3 largest offset component error over frames 0 to 59: ${maxError}`);
  });
});
