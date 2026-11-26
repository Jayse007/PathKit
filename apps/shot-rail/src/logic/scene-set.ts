// Scene_Set: arranges the camera scene(s) for one rig.
// Pure. Allocation is allowed here (setup code, not the evaluation path).
//
// S6 outcome (recorded in docs/build-notes.md, Task 11.2): Outcome A.
// Reason: S6 baked one combined scene with every camera and each camera alone, over 1920 frames x 7 values
// per camera. The largest difference was 0 (tolerance 1e-9), so one combined scene gives the same baked
// values as separate scenes. Outcome B (Main_Camera alone in scene 1, the others in scene 2) is not needed.
// The outcome is fixed here at build time. It is not tested at runtime and the code never branches on it.

import type { Scene, Target } from './pathkit.js';
import { buildCameraScene } from './shot-builders.js';
import type { CameraPlacement, ShotType } from './shot-builders.js';

/** Recorded S6 result. 'A' = one scene with every camera. */
export const S6_OUTCOME: 'A' = 'A';

export interface SceneSet {
  scenes: { scene: Scene; cameraIds: string[] }[]; // 1 entry for Outcome A
  mainCameraId: string;
}

type RailPath = { points: { x: number; y: number; z: number }[]; closed: boolean };

/**
 * Builds the Scene_Set: ONE scene holding every camera (Outcome A).
 * The Main_Camera is the first entity, then the other cameras in map order. Each camera is built by
 * `buildCameraScene` (so each keeps its own `centre-<id>` target name); the combined scene takes the
 * Main_Camera's path (a rail camera's own rail, or the Road / placeholder path) and the union of all targets.
 * The shared subject target is the same under every camera, so the union does not change any camera's values.
 *
 * Throws an Error naming the id when `mainCameraId` is not in `cameras`, when `cameras` is empty,
 * when a camera other than the main camera is a rail shot (push-in or crane), or when a non-rail camera
 * has no entry in `centreTargets`.
 */
export function buildSceneSet(
  mainCameraId: string,
  cameras: Map<string, { shotType: ShotType; placement: CameraPlacement }>,
  shotLengthFrames: number,
  subjectTarget: Target,
  centreTargets: Map<string, Target>,
  roadPoints: RailPath | null,
): SceneSet {
  if (!cameras.has(mainCameraId)) {
    throw new Error(`buildSceneSet: the main camera "${mainCameraId}" is not in the cameras`);
  }

  // One scene has one path, so a non-main rail camera would follow the main camera's path.
  for (const [id, cam] of cameras) {
    if (id !== mainCameraId && (cam.shotType === 'push-in' || cam.shotType === 'crane')) {
      throw new Error(`buildSceneSet: camera "${id}" is a ${cam.shotType} shot, but only the main camera can be a rail shot.`);
    }
  }

  // Main camera first, then the rest in map order.
  const orderedIds: string[] = [mainCameraId];
  for (const id of cameras.keys()) {
    if (id !== mainCameraId) orderedIds.push(id);
  }

  let combined: Scene | null = null;
  for (const id of orderedIds) {
    const cam = cameras.get(id);
    if (cam === undefined) continue; // not reachable: ids come from the map
    const isRail = cam.shotType === 'push-in' || cam.shotType === 'crane';
    const centre = centreTargets.get(id);
    if (centre === undefined && !isRail) {
      throw new Error(`buildSceneSet: camera "${id}" has no centre target`);
    }
    const one = buildCameraScene(
      cam.shotType,
      cam.placement,
      shotLengthFrames,
      subjectTarget,
      centre ?? subjectTarget, // rail cameras ignore the centre target
      id,
      roadPoints,
    );
    if (combined === null) {
      combined = one; // the Main_Camera's scene supplies fps, frameCount and path
    } else {
      Object.assign(combined.targets, one.targets);
      combined.entities.push(...one.entities);
    }
  }

  if (combined === null) {
    throw new Error('buildSceneSet: there are no cameras');
  }

  return {
    scenes: [{ scene: combined, cameraIds: orderedIds }],
    mainCameraId,
  };
}
