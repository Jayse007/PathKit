// Spike S6: one scene or two.
// Question: does a camera bake to the same numbers inside one combined scene as when baked alone?
//   Combined scene: one rail camera plus three orbiting cameras, one two-point open rail path.
//   Separate bakes: the rail camera alone (with the rail), and the three orbit cameras together
//   (with PLACEHOLDER_PATH).
// For every camera and every baked frame, all 7 values (3 position, 4 rotation) must agree within 1e-9.
// All match: prints "S6 Outcome A". Any mismatch: the test fails naming camera, frame and component,
// and the build notes record Outcome B (no question to the User).
//
// Source line it should catch: in makeTargets() or the combined scene, give two cameras the same
// target name with different keyframes (for example, make the orbit cameras' target differ between
// the combined scene and the separate scene). The comparison then fails.

import { describe, expect, it } from 'vitest';
import { bake, evaluateEntity, validateScene } from '../../src/logic/pathkit.js';
import type { Entity, Keyframe, OutBuffer, Scene } from '../../src/logic/pathkit.js';

type Targets = Scene['targets'];
import {
  BAKE_FPS,
  BAKED_LAP_FRAMES,
  CAMERA_FORWARD_AXIS,
  CAMERA_IDS,
  CAMERA_UP_AXIS,
  LAP_SECONDS,
  ORBIT_SWEEP_DEG,
  PLACEHOLDER_PATH,
  SUBJECT_CENTRE_HEIGHT,
  SUBJECT_ENTITY_ID,
} from '../../src/logic/constants.js';

const TOLERANCE = 1e-9;
const CENTRE_ID = 'centre';
const COMPONENTS = ['pos.x', 'pos.y', 'pos.z', 'rot.x', 'rot.y', 'rot.z', 'rot.w'] as const;

const RAIL_ID = CAMERA_IDS[0];
const ORBIT_IDS = [CAMERA_IDS[1], CAMERA_IDS[2], CAMERA_IDS[3]] as const;

// Two-point open rail, to the side of the subject's line.
const RAIL_START = { x: -10, y: 3, z: 0 };
const RAIL_END = { x: 10, y: 3, z: 0 };
const RAIL_PATH = { points: [RAIL_START, RAIL_END], closed: false };
const RAIL_LENGTH_M = Math.hypot(
  RAIL_END.x - RAIL_START.x,
  RAIL_END.y - RAIL_START.y,
  RAIL_END.z - RAIL_START.z,
);
// Half the lap's travel, so the rail camera stays inside the open path.
const RAIL_SPEED = RAIL_LENGTH_M / LAP_SECONDS / 2;

// Subject moves along a straight line in front of the rail (hand-chosen line, from constants for the step).
const SUBJECT_Z = 8;
const SUBJECT_X_START = -8;
const SUBJECT_X_SPAN = 16;
function subjectPosition(f: number) {
  return {
    x: SUBJECT_X_START + (SUBJECT_X_SPAN * f) / BAKED_LAP_FRAMES,
    y: SUBJECT_CENTRE_HEIGHT,
    z: SUBJECT_Z,
  };
}

function makeTargets(): Targets {
  const subjectKeys: Keyframe[] = [];
  const centreKeys: Keyframe[] = [];
  for (let f = 0; f < BAKED_LAP_FRAMES; f++) {
    const p = subjectPosition(f);
    subjectKeys.push({ frame: f, position: { x: p.x, y: p.y, z: p.z } });
    centreKeys.push({ frame: f, position: { x: p.x, y: p.y + 1.5, z: p.z } });
  }
  return {
    [SUBJECT_ENTITY_ID]: { keyframes: subjectKeys },
    [CENTRE_ID]: { keyframes: centreKeys },
  };
}

function railCamera(): Entity {
  return {
    id: RAIL_ID,
    forwardAxis: CAMERA_FORWARD_AXIS,
    upAxis: CAMERA_UP_AXIS,
    constraints: [
      { type: 'followPath', order: 0, influence: 1, speed: RAIL_SPEED, startOffset: 0, alignToPath: false },
      { type: 'aimAt', order: 1, influence: 1, target: SUBJECT_ENTITY_ID },
    ],
  };
}

function orbitCamera(id: string, radius: number, speedDegPerSecond: number, startAngle: number): Entity {
  return {
    id,
    forwardAxis: CAMERA_FORWARD_AXIS,
    upAxis: CAMERA_UP_AXIS,
    constraints: [
      {
        type: 'orbitAround',
        order: 0,
        influence: 1,
        target: CENTRE_ID,
        radius,
        axis: '+Y',
        speed: speedDegPerSecond,
        startAngle,
      },
      { type: 'aimAt', order: 1, influence: 1, target: SUBJECT_ENTITY_ID },
    ],
  };
}

function orbitCameras(): Entity[] {
  const sweepSpeed = ORBIT_SWEEP_DEG / LAP_SECONDS;
  return [
    orbitCamera(ORBIT_IDS[0], 6, sweepSpeed, 0),
    orbitCamera(ORBIT_IDS[1], 12, -sweepSpeed / 2, 90),
    orbitCamera(ORBIT_IDS[2], 20, sweepSpeed * 2, 200),
  ];
}

function makeScene(path: { points: { x: number; y: number; z: number }[]; closed: boolean }, entities: Entity[]): Scene {
  return {
    fps: BAKE_FPS,
    frameCount: BAKED_LAP_FRAMES,
    path: { points: path.points.map((p) => ({ ...p })), closed: path.closed },
    targets: makeTargets(),
    entities,
  };
}

function makeOut(): OutBuffer {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };
}

function readValues(out: OutBuffer, into: Float64Array): void {
  into[0] = out.position.x;
  into[1] = out.position.y;
  into[2] = out.position.z;
  into[3] = out.rotation.x;
  into[4] = out.rotation.y;
  into[5] = out.rotation.z;
  into[6] = out.rotation.w;
}

describe('S6: one scene or two', () => {
  it('combined scene and both separate scenes are valid', () => {
    const combined = makeScene(RAIL_PATH, [railCamera(), ...orbitCameras()]);
    const railAlone = makeScene(RAIL_PATH, [railCamera()]);
    const orbitsAlone = makeScene(PLACEHOLDER_PATH, orbitCameras());
    expect(() => validateScene(combined)).not.toThrow();
    expect(() => validateScene(railAlone)).not.toThrow();
    expect(() => validateScene(orbitsAlone)).not.toThrow();
  });

  it('combined bake equals the separate bakes for every camera, frame and component', () => {
    const combined = bake(makeScene(RAIL_PATH, [railCamera(), ...orbitCameras()]));
    const railAlone = bake(makeScene(RAIL_PATH, [railCamera()]));
    const orbitsAlone = bake(makeScene(PLACEHOLDER_PATH, orbitCameras()));

    const cameras: { id: string; separate: ReturnType<typeof bake> }[] = [
      { id: RAIL_ID, separate: railAlone },
      { id: ORBIT_IDS[0], separate: orbitsAlone },
      { id: ORBIT_IDS[1], separate: orbitsAlone },
      { id: ORBIT_IDS[2], separate: orbitsAlone },
    ];

    const outA = makeOut();
    const outB = makeOut();
    const a = new Float64Array(7);
    const b = new Float64Array(7);
    let worstOverall = 0;
    let mismatches = 0;
    let firstMismatch = '';

    for (const cam of cameras) {
      let compared = 0;
      let worst = 0;
      for (let f = 0; f < BAKED_LAP_FRAMES; f++) {
        evaluateEntity(combined, cam.id, f, outA);
        evaluateEntity(cam.separate, cam.id, f, outB);
        readValues(outA, a);
        readValues(outB, b);
        for (let c = 0; c < 7; c++) {
          compared++;
          const diff = Math.abs(a[c] - b[c]);
          if (!(diff <= TOLERANCE)) {
            mismatches++;
            if (firstMismatch === '') {
              firstMismatch = `S6 mismatch: camera ${cam.id}, frame ${f}, component ${COMPONENTS[c]}: combined ${a[c]}, separate ${b[c]}, difference ${diff}`;
            }
          }
          if (diff > worst) worst = diff;
        }
      }
      if (worst > worstOverall) worstOverall = worst;
      console.log(
        `S6 camera ${cam.id}: ${BAKED_LAP_FRAMES} frames x 7 values = ${compared} compared, largest difference ${worst}`,
      );
    }

    console.log(`S6 tolerance: ${TOLERANCE}; largest difference over all cameras: ${worstOverall}; mismatching values: ${mismatches}`);
    if (mismatches === 0) {
      console.log('S6 Outcome A');
    } else {
      console.log(`S6 Outcome B (combined bake differs from separate bakes). ${firstMismatch}`);
      throw new Error(firstMismatch);
    }
    expect(mismatches).toBe(0);
  });
});
