// Spike S2: a keyframed target (built by hand from the baked subject) and aimAt.
// The camera's forward vector must point at the target on every displayed frame 0 to 59.
// The camera is held at (0, 5, 0) by a followPath with speed 0 on a small open path.

import { describe, expect, it } from 'vitest';
import {
  bake,
  createArcLengthTable,
  createCurve,
  evaluateEntity,
  rotateVec,
  validateScene,
} from '../../src/logic/pathkit.js';
import type { Keyframe, OutBuffer, Scene } from '../../src/logic/pathkit.js';
import {
  BAKE_FPS,
  BAKED_LAP_FRAMES,
  CAMERA_FORWARD_AXIS,
  CAMERA_UP_AXIS,
  CAR_FORWARD_AXIS,
  CAR_UP_AXIS,
  EASE_AMPLITUDE,
  FRAME_RATE,
  LAP_FRAMES,
  LAP_SECONDS,
  SUBJECT_ENTITY_ID,
} from '../../src/logic/constants.js';
import { DEFAULT_ROAD_CLOSED, DEFAULT_ROAD_POINTS } from '../../src/logic/default-road.js';
import { remapDisplayedFrame } from '../../src/logic/frame-remap.js';

const SHOT_FRAMES = 60;
const TOLERANCE = 1e-9;
const CAMERA_ID = 'cam-1';
const TARGET_NAME = 'subject-target';
const CAMERA_X = 0;
const CAMERA_Y = 5;
const CAMERA_Z = 0;

function makeOut(): OutBuffer {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };
}

// Bake the subject as in S1.
const roadLength = createArcLengthTable(
  createCurve(DEFAULT_ROAD_POINTS, DEFAULT_ROAD_CLOSED),
).length;

const subjectScene: Scene = {
  fps: BAKE_FPS,
  frameCount: BAKED_LAP_FRAMES,
  path: { points: DEFAULT_ROAD_POINTS.map((p) => ({ ...p })), closed: DEFAULT_ROAD_CLOSED },
  targets: {},
  entities: [
    {
      id: SUBJECT_ENTITY_ID,
      forwardAxis: CAR_FORWARD_AXIS,
      upAxis: CAR_UP_AXIS,
      constraints: [
        {
          type: 'followPath',
          order: 0,
          influence: 1,
          speed: roadLength / LAP_SECONDS,
          startOffset: 0,
          alignToPath: true,
        },
      ],
    },
  ],
};

const subjectBaked = bake(subjectScene);

// Baked subject position at a baked frame, copied into a plain value.
function subjectAtBakedFrame(bakedFrame: number): { x: number; y: number; z: number } {
  const out = makeOut();
  evaluateEntity(subjectBaked, SUBJECT_ENTITY_ID, bakedFrame, out);
  return { x: out.position.x, y: out.position.y, z: out.position.z };
}

// The keyframed target: displayed frame f takes the baked position at the REMAPPED frame.
const keyframes: Keyframe[] = [];
for (let f = 0; f < SHOT_FRAMES; f++) {
  const b = remapDisplayedFrame(f, LAP_FRAMES, BAKED_LAP_FRAMES, EASE_AMPLITUDE);
  keyframes.push({ frame: f, position: subjectAtBakedFrame(b) });
}

const cameraScene: Scene = {
  fps: FRAME_RATE,
  frameCount: SHOT_FRAMES,
  // A small open path; its first point is the camera's fixed position.
  path: {
    points: [
      { x: CAMERA_X, y: CAMERA_Y, z: CAMERA_Z },
      { x: CAMERA_X + 5, y: CAMERA_Y, z: CAMERA_Z },
      { x: CAMERA_X + 10, y: CAMERA_Y, z: CAMERA_Z },
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
        { type: 'followPath', order: 0, influence: 1, speed: 0, startOffset: 0 },
        { type: 'aimAt', order: 1, influence: 1, target: TARGET_NAME },
      ],
    },
  ],
};

describe('S2: keyframed target and aimAt', () => {
  it('the camera scene is valid and bakes', () => {
    expect(() => validateScene(cameraScene)).not.toThrow();
    expect(() => bake(cameraScene)).not.toThrow();
  });

  it('the target has exactly 60 keyframes with frames 0 to 59 in order', () => {
    const target = cameraScene.targets[TARGET_NAME];
    if (!('keyframes' in target)) throw new Error('S2: target must be keyframed');
    expect(target.keyframes.length).toBe(SHOT_FRAMES);
    for (let i = 0; i < SHOT_FRAMES; i++) {
      if (target.keyframes[i].frame !== i) {
        throw new Error(`S2 keyframes: index ${i} has frame ${target.keyframes[i].frame}, expected ${i}`);
      }
    }
  });

  it('the camera forward vector points at the target on every frame', () => {
    const baked = bake(cameraScene);
    const out = makeOut();
    const forward = { x: 0, y: 0, z: -1 }; // CAMERA_FORWARD_AXIS is -Z
    expect(CAMERA_FORWARD_AXIS).toBe('-Z');
    let maxError = 0;

    for (let f = 0; f < SHOT_FRAMES; f++) {
      evaluateEntity(baked, CAMERA_ID, f, out);

      // The camera must sit at its fixed position.
      const px = Math.abs(out.position.x - CAMERA_X);
      const py = Math.abs(out.position.y - CAMERA_Y);
      const pz = Math.abs(out.position.z - CAMERA_Z);
      if (px > TOLERANCE || py > TOLERANCE || pz > TOLERANCE) {
        throw new Error(
          `S2 position: frame ${f} is (${out.position.x}, ${out.position.y}, ${out.position.z}), expected (0, 5, 0)`,
        );
      }

      // Expected direction, worked out here from the remapped baked frame (not from the keyframes).
      const b = remapDisplayedFrame(f, LAP_FRAMES, BAKED_LAP_FRAMES, EASE_AMPLITUDE);
      const s = subjectAtBakedFrame(b);
      const dx = s.x - CAMERA_X;
      const dy = s.y - CAMERA_Y;
      const dz = s.z - CAMERA_Z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (!(len > 0)) throw new Error(`S2 direction: frame ${f} camera and target coincide`);

      const got = rotateVec(out.rotation, forward);
      const ex = Math.abs(got.x - dx / len);
      const ey = Math.abs(got.y - dy / len);
      const ez = Math.abs(got.z - dz / len);
      const e = Math.max(ex, ey, ez);
      if (e > maxError) maxError = e;
      if (e > TOLERANCE) {
        throw new Error(
          `S2 aim: frame ${f} forward (${got.x}, ${got.y}, ${got.z}), expected (${dx / len}, ${dy / len}, ${dz / len}), largest difference ${e}`,
        );
      }
    }
    console.log(`S2 largest forward-vector component error over frames 0 to 59: ${maxError}`);
  });
});
