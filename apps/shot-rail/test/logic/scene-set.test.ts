// Scene_Set tests (the S6 regression).
// S6 outcome recorded in docs/build-notes.md (Task 11.2): Outcome A = ONE scene with every camera.
// Expected values are written by hand (scene count, ids) or come from a separate solo bake of each camera
// built on its own through buildCameraScene (an independent route to the same numbers).
//
// Source line it should catch: in buildSceneSet, push a camera into the scene twice, or skip one camera
// in the loop (drop cam-3), or make two cameras share one `centre-<id>` target name.

import { describe, expect, it } from 'vitest';
import { bake, evaluateEntity, validateScene } from '../../src/logic/pathkit.js';
import type { Keyframe, OutBuffer, Target } from '../../src/logic/pathkit.js';
import { buildCameraScene } from '../../src/logic/shot-builders.js';
import type { CameraPlacement, ShotType } from '../../src/logic/shot-builders.js';
import { buildSceneSet, S6_OUTCOME } from '../../src/logic/scene-set.js';
import { SUBJECT_CENTRE_HEIGHT } from '../../src/logic/constants.js';

const TOLERANCE = 1e-9;
const SHOT_FRAMES = 30;
const COMPONENTS = ['pos.x', 'pos.y', 'pos.z', 'rot.x', 'rot.y', 'rot.z', 'rot.w'] as const;

// Subject moves along +X; the centre targets are hand-chosen lines of their own.
function movingTarget(x0: number, dx: number, y: number, z: number): Target {
  const keyframes: Keyframe[] = [];
  for (let f = 0; f < SHOT_FRAMES; f++) {
    keyframes.push({ frame: f, position: { x: x0 + dx * f, y, z } });
  }
  return { keyframes };
}

const SUBJECT: Target = movingTarget(-7, 0.5, SUBJECT_CENTRE_HEIGHT, 0);
const CENTRE_1: Target = { x: 0, y: 1, z: 0 };
const CENTRE_2: Target = movingTarget(-3, 0.25, 1.5, 2);
const CENTRE_3: Target = movingTarget(2, -0.5, 1, -1);
const ROAD = {
  points: [
    { x: -10, y: 2, z: 5 },
    { x: 10, y: 2, z: 5 },
  ],
  closed: false,
};

const SHOT_TYPES: Record<string, ShotType> = {
  'cam-1': 'orbit',
  'cam-2': 'tracking',
  'cam-3': 'orbit',
  'cam-4': 'push-in',
};
const PLACEMENTS: Record<string, CameraPlacement> = {
  'cam-1': { bearingDeg: 30, heightM: 1.5, horizontalDistanceM: 6, lensMm: 35 },
  'cam-2': { bearingDeg: 120, heightM: 2, horizontalDistanceM: 9, lensMm: 50 },
  'cam-3': { bearingDeg: 250, heightM: 1, horizontalDistanceM: 14, lensMm: 24 },
  'cam-4': { bearingDeg: 0, heightM: 1.2, horizontalDistanceM: 8, lensMm: 85 },
};
const CENTRES = new Map<string, Target>([
  ['cam-1', CENTRE_1],
  ['cam-2', CENTRE_2],
  ['cam-3', CENTRE_3],
]);

function makeCameras(order: string[]): Map<string, { shotType: ShotType; placement: CameraPlacement }> {
  const m = new Map<string, { shotType: ShotType; placement: CameraPlacement }>();
  for (const id of order) m.set(id, { shotType: SHOT_TYPES[id], placement: PLACEMENTS[id] });
  return m;
}

function makeOut(): OutBuffer {
  return { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
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

describe('Scene_Set (S6 regression)', () => {
  it('records Outcome A and builds one scene holding each camera id exactly once', () => {
    const set = buildSceneSet('cam-1', makeCameras(['cam-1', 'cam-2', 'cam-3', 'cam-4']), SHOT_FRAMES, SUBJECT, CENTRES, ROAD);
    expect(S6_OUTCOME).toBe('A');
    expect(set.scenes.length).toBe(1);
    expect(set.mainCameraId).toBe('cam-1');
    for (const id of ['cam-1', 'cam-2', 'cam-3', 'cam-4']) {
      const inIds = set.scenes.flatMap((s) => s.cameraIds).filter((x) => x === id).length;
      const inEntities = set.scenes.flatMap((s) => s.scene.entities).filter((e) => e.id === id).length;
      if (inIds !== 1) throw new Error(`cameraIds: ${id} appears ${inIds} times, expected 1`);
      if (inEntities !== 1) throw new Error(`entities: ${id} appears ${inEntities} times, expected 1`);
    }
    expect(set.scenes[0].cameraIds.length).toBe(4);
    expect(set.scenes[0].scene.entities.length).toBe(4);
  });

  it('puts the Main_Camera first, wherever it sits in the map', () => {
    const set = buildSceneSet('cam-3', makeCameras(['cam-1', 'cam-2', 'cam-3', 'cam-4']), SHOT_FRAMES, SUBJECT, CENTRES, ROAD);
    expect(set.mainCameraId).toBe('cam-3');
    expect(set.scenes[0].cameraIds).toEqual(['cam-3', 'cam-1', 'cam-2', 'cam-4']);
    expect(set.scenes[0].scene.entities.map((e) => e.id)).toEqual(['cam-3', 'cam-1', 'cam-2', 'cam-4']);
  });

  it('every scene passes validateScene', () => {
    const set = buildSceneSet('cam-1', makeCameras(['cam-1', 'cam-2', 'cam-3', 'cam-4']), SHOT_FRAMES, SUBJECT, CENTRES, ROAD);
    for (const s of set.scenes) {
      expect(() => validateScene(s.scene)).not.toThrow();
    }
  });

  it('all 7 baked values per camera and frame equal a solo bake within 1e-9', () => {
    const order = ['cam-1', 'cam-2', 'cam-3', 'cam-4'];
    const set = buildSceneSet('cam-1', makeCameras(order), SHOT_FRAMES, SUBJECT, CENTRES, ROAD);
    const combined = bake(set.scenes[0].scene);
    const outA = makeOut();
    const outB = makeOut();
    const a = new Float64Array(7);
    const b = new Float64Array(7);
    for (const id of order) {
      const solo = bake(
        buildCameraScene(SHOT_TYPES[id], PLACEMENTS[id], SHOT_FRAMES, SUBJECT, CENTRES.get(id) ?? SUBJECT, id, ROAD),
      );
      for (let f = 0; f < SHOT_FRAMES; f++) {
        evaluateEntity(combined, id, f, outA);
        evaluateEntity(solo, id, f, outB);
        readValues(outA, a);
        readValues(outB, b);
        for (let c = 0; c < 7; c++) {
          const diff = Math.abs(a[c] - b[c]);
          if (!(diff <= TOLERANCE)) {
            throw new Error(`solo bake check: ${id}, frame ${f}, ${COMPONENTS[c]}: set ${a[c]}, solo ${b[c]}, difference ${diff}`);
          }
        }
      }
    }
  });

  it('throws naming the id when the main camera is not in the cameras', () => {
    expect(() => buildSceneSet('cam-9', makeCameras(['cam-1', 'cam-2']), SHOT_FRAMES, SUBJECT, CENTRES, ROAD)).toThrow(/cam-9/);
  });
});
