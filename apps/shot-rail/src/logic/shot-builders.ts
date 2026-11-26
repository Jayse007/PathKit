// Shot_Builder: builds the one-entity PathKit scene for a camera, for each of the four shot types.
// Pure. Allocation is allowed here (setup code, not the evaluation path).
//
// Constraint order is fixed: orbitAround (or followPath) at order 0, aimAt at order 1.
// Bearing is measured from +Z toward +X, so a position is centre + radius * (sin(bearing), 0, cos(bearing)).

import type { Entity, Scene, Target, Vec3 } from './pathkit.js';
import {
  CAMERA_FORWARD_AXIS,
  CAMERA_UP_AXIS,
  CRANE_RISE_M,
  FRAME_RATE,
  ORBIT_SWEEP_DEG,
  PLACEHOLDER_PATH,
  PUSH_IN_END_RATIO,
  SUBJECT_ENTITY_ID,
} from './constants.js';

export type ShotType = 'push-in' | 'orbit' | 'tracking' | 'crane';

export interface CameraPlacement {
  bearingDeg: number; // measured from +Z toward +X
  heightM: number; // relative to subject centre
  horizontalDistanceM: number;
  lensMm: number;
}

type RailPath = { points: Vec3[]; closed: boolean };

const DEG_TO_RAD = Math.PI / 180;

function targetAt(target: Target, which: 'first' | 'last'): Vec3 {
  if ('keyframes' in target) {
    const ks = target.keyframes;
    if (ks.length === 0) {
      throw new Error('buildCameraScene: the subject target has no keyframes');
    }
    return ks[which === 'first' ? 0 : ks.length - 1].position;
  }
  return target;
}

/**
 * The straight 2-point open rail for a push-in or crane shot.
 * Start: subject position at the first frame plus (r sin b, height, r cos b).
 * Push-in end: subject position at the last frame plus the same offset, with r and height times PUSH_IN_END_RATIO.
 * Crane end: start plus (0, CRANE_RISE_M, 0).
 */
export function buildRail(
  shotType: 'push-in' | 'crane',
  placement: CameraPlacement,
  subjectTarget: Target,
): RailPath {
  const bearing = placement.bearingDeg * DEG_TO_RAD;
  const sinB = Math.sin(bearing);
  const cosB = Math.cos(bearing);
  const r = placement.horizontalDistanceM;
  const h = placement.heightM;

  const first = targetAt(subjectTarget, 'first');
  const start: Vec3 = {
    x: first.x + r * sinB,
    y: first.y + h,
    z: first.z + r * cosB,
  };

  let end: Vec3;
  if (shotType === 'push-in') {
    const last = targetAt(subjectTarget, 'last');
    end = {
      x: last.x + r * PUSH_IN_END_RATIO * sinB,
      y: last.y + h * PUSH_IN_END_RATIO,
      z: last.z + r * PUSH_IN_END_RATIO * cosB,
    };
  } else {
    end = { x: start.x, y: start.y + CRANE_RISE_M, z: start.z };
  }

  return { points: [start, end], closed: false };
}

function railLength(path: RailPath): number {
  let total = 0;
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1];
    const b = path.points[i];
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return total;
}

/**
 * Builds a scene with one camera entity (id = cameraId).
 * - tracking: orbitAround speed 0 at the placement offset, then aimAt the subject.
 * - orbit: orbitAround at ORBIT_SWEEP_DEG over the shot, then aimAt the subject.
 * - push-in, crane: followPath along a rail, then aimAt the subject.
 *
 * `path`: for push-in and crane, a non-null path is used as the rail and null means the rail is built
 * from the subject target (see buildRail). For orbit and tracking the scene path is `path` or PLACEHOLDER_PATH.
 * A rail of length 0 gives speed 0; the bake then reports the degenerate rail.
 */
export function buildCameraScene(
  shotType: ShotType,
  placement: CameraPlacement,
  shotLengthFrames: number,
  subjectTarget: Target,
  centreTarget: Target,
  cameraId: string,
  path: RailPath | null,
): Scene {
  if (!Number.isInteger(shotLengthFrames) || shotLengthFrames <= 0) {
    throw new Error(
      `buildCameraScene: shotLengthFrames must be a whole number above 0, got ${String(shotLengthFrames)}`,
    );
  }

  const isRail = shotType === 'push-in' || shotType === 'crane';
  let scenePath: RailPath;
  const targets: Record<string, Target> = { [SUBJECT_ENTITY_ID]: subjectTarget };
  let constraints: Entity['constraints'];

  if (isRail) {
    scenePath = path ?? buildRail(shotType, placement, subjectTarget);
    // Rail speed = length * FRAME_RATE / shot length, so travelled(N - 1) = length * (N - 1) / N < length.
    const speed = (railLength(scenePath) * FRAME_RATE) / shotLengthFrames;
    constraints = [
      { type: 'followPath', order: 0, influence: 1, speed, startOffset: 0, alignToPath: false },
      { type: 'aimAt', order: 1, influence: 1, target: SUBJECT_ENTITY_ID },
    ];
  } else {
    scenePath = path ?? PLACEHOLDER_PATH;
    const centreName = `centre-${cameraId}`;
    targets[centreName] = centreTarget;
    const speed = shotType === 'orbit' ? ORBIT_SWEEP_DEG / (shotLengthFrames / FRAME_RATE) : 0;
    constraints = [
      {
        type: 'orbitAround',
        order: 0,
        influence: 1,
        target: centreName,
        radius: placement.horizontalDistanceM,
        axis: '+Y',
        speed,
        startAngle: placement.bearingDeg,
      },
      { type: 'aimAt', order: 1, influence: 1, target: SUBJECT_ENTITY_ID },
    ];
  }

  return {
    fps: FRAME_RATE,
    frameCount: shotLengthFrames,
    path: scenePath,
    targets,
    entities: [
      {
        id: cameraId,
        forwardAxis: CAMERA_FORWARD_AXIS,
        upAxis: CAMERA_UP_AXIS,
        constraints,
      },
    ],
  };
}
