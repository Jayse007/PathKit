// Spike S5: bake time for the subject plus six cameras.
// Two bakes are timed together: the subject (1920 frames at 240 fps) and one camera scene
// (six orbiting cameras, 240 frames at 30 fps, each orbitAround then aimAt).
// The time is printed with S5_TARGET_MS. The time is never asserted.

import { describe, expect, it } from 'vitest';
import { bake } from '../../src/logic/pathkit.js';
import type { Keyframe, Scene } from '../../src/logic/pathkit.js';
import {
  BAKE_FPS,
  BAKED_LAP_FRAMES,
  CAMERA_FORWARD_AXIS,
  CAMERA_IDS,
  CAMERA_RADIUS_MAX,
  CAMERA_RADIUS_MIN,
  CAR_FORWARD_AXIS,
  CAR_UP_AXIS,
  FRAME_RATE,
  LAP_FRAMES,
  LAP_SECONDS,
  ORBIT_SWEEP_DEG,
  PLACEHOLDER_PATH,
  S5_CAMERA_COUNT,
  S5_TARGET_MS,
  SUBJECT_ENTITY_ID,
  CAMERA_UP_AXIS,
} from '../../src/logic/constants.js';
import { DEFAULT_ROAD_CLOSED, DEFAULT_ROAD_POINTS } from '../../src/logic/default-road.js';

// Subject scene: the subject follows the default Road for one lap.
// The speed is a fixed example (metres per second); the exact road length does not matter for timing.
const SUBJECT_SPEED = 15;

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
          speed: SUBJECT_SPEED,
          startOffset: 0,
          alignToPath: true,
        },
      ],
    },
  ],
};

// Camera scene: the subject target is keyframed on every displayed frame
// (a circle of radius 20 m at the subject centre height, one turn per lap).
const SUBJECT_TARGET_RADIUS = 20;
const SUBJECT_TARGET_Y = DEFAULT_ROAD_POINTS[0].y;

function buildTargetKeys(): Keyframe[] {
  const keys: Keyframe[] = [];
  for (let f = 0; f < LAP_FRAMES; f++) {
    const a = (2 * Math.PI * f) / LAP_FRAMES;
    keys.push({
      frame: f,
      position: {
        x: SUBJECT_TARGET_RADIUS * Math.cos(a),
        y: SUBJECT_TARGET_Y,
        z: SUBJECT_TARGET_RADIUS * Math.sin(a),
      },
    });
  }
  return keys;
}

function buildCameraScene(cameraCount: number): Scene {
  const entities: Scene['entities'] = [];
  for (let i = 0; i < cameraCount; i++) {
    // Radii spread from the minimum to the maximum; start angles spread round the circle.
    const radius = CAMERA_RADIUS_MIN + ((CAMERA_RADIUS_MAX - CAMERA_RADIUS_MIN) * i) / (S5_CAMERA_COUNT - 1);
    entities.push({
      id: CAMERA_IDS[i],
      forwardAxis: CAMERA_FORWARD_AXIS,
      upAxis: CAMERA_UP_AXIS,
      constraints: [
        {
          type: 'orbitAround',
          order: 0,
          influence: 1,
          target: SUBJECT_ENTITY_ID,
          radius,
          axis: '+Y',
          speed: ORBIT_SWEEP_DEG / LAP_SECONDS,
          startAngle: (360 * i) / S5_CAMERA_COUNT,
        },
        { type: 'aimAt', order: 1, influence: 1, target: SUBJECT_ENTITY_ID },
      ],
    });
  }
  return {
    fps: FRAME_RATE,
    frameCount: LAP_FRAMES,
    path: { points: PLACEHOLDER_PATH.points.map((p) => ({ ...p })), closed: PLACEHOLDER_PATH.closed },
    targets: { [SUBJECT_ENTITY_ID]: { keyframes: buildTargetKeys() } },
    entities,
  };
}

describe('S5: bake time for the subject plus six cameras', () => {
  it('the constants agree: six cameras, six ids', () => {
    expect(S5_CAMERA_COUNT).toBe(CAMERA_IDS.length);
  });

  it('bakes the subject and six cameras, and prints the time', () => {
    const cameraScene = buildCameraScene(S5_CAMERA_COUNT);

    const start = performance.now();
    const bakedSubject = bake(subjectScene);
    const bakedCameras = bake(cameraScene);
    const elapsedMs = performance.now() - start;

    console.log(`S5 bake time (subject + ${S5_CAMERA_COUNT} cameras): ${elapsedMs.toFixed(2)} ms, target ${S5_TARGET_MS} ms (printed, not asserted)`);

    expect(bakedSubject.frameCount).toBe(BAKED_LAP_FRAMES);
    expect(bakedSubject.entityIds).toEqual([SUBJECT_ENTITY_ID]);
    expect(bakedCameras.frameCount).toBe(LAP_FRAMES);
    expect(bakedCameras.entityIds.length).toBe(S5_CAMERA_COUNT);
    expect(Array.from(bakedCameras.entityIds)).toEqual(Array.from(CAMERA_IDS));
  });
});
