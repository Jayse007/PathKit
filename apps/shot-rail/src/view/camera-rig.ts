// CameraRig: orchestrates the subject bake, the camera bake, the motion check and the per-frame evaluate.
// No DOM and no Three.js, so it runs in Node.
//
// Bake work (subject bake, Target_Converter, buildSceneSet, bake, motionLinter) allocates and runs only
// when the dirty flag is consumed (at most once per animation frame). `evaluate` and `tick` without a
// pending change allocate nothing.

import { bake, createArcLengthTable, createCurve, evaluateEntity, motionLinter } from '../logic/pathkit.js';
import type { BakedData, Finding, OutBuffer, Scene, Target, Vec3 } from '../logic/pathkit.js';
import {
  BAKE_FPS,
  BAKED_LAP_FRAMES,
  CAR_FORWARD_AXIS,
  CAR_UP_AXIS,
  EASE_AMPLITUDE,
  LAP_FRAMES,
  LAP_SECONDS,
  SUBJECT_ENTITY_ID,
} from '../logic/constants.js';
import { remapDisplayedFrame } from '../logic/frame-remap.js';
import { validateRoad } from '../logic/road-validation.js';
import { buildSceneSet } from '../logic/scene-set.js';
import type { SceneSet } from '../logic/scene-set.js';
import { buildKeyframedTarget } from '../logic/target-converter.js';
import type { CameraPlacement, ShotType } from '../logic/shot-builders.js';

export type SubjectKind = 'car' | 'figure' | 'abstract';

export interface CameraSetting {
  id: string;
  shotType: ShotType;
  bearingDeg: number;
  heightM: number;
  horizontalDistanceM: number;
  lensMm: number;
}

export interface RigSettings {
  shotLengthFrames: number;
  mainCameraId: string;
  cameras: CameraSetting[];
  road: { points: Vec3[]; closed: true };
  subjectKind: SubjectKind;
}

/** What one re-bake produced. A new object per re-bake (not per frame). */
export interface BakeOutcome {
  /** false when the camera move could not be built. The last good bake stays in use. */
  ok: boolean;
  /** Plain message for the User, or null. Set when ok is false, or when only the motion check failed. */
  message: string | null;
  /** true when the subject was baked again in this re-bake (kind or Road changed). */
  subjectRebaked: boolean;
  /** Always false: a re-bake never starts playback. */
  playing: boolean;
  /** The displayed frame, unchanged by the re-bake. */
  displayedFrame: number;
}

// ---------------------------------------------------------------------------------------------
// Scheduler: pure, no DOM. Changes within one animation frame coalesce into one re-bake.
// ---------------------------------------------------------------------------------------------

export class RebakeScheduler {
  private dirty = false;

  /** Record that something changed. Never bakes. */
  markDirty(): void {
    this.dirty = true;
  }

  isDirty(): boolean {
    return this.dirty;
  }

  /** Called once per animation frame. Returns true (and clears the flag) when a re-bake is due. No allocation. */
  consume(): boolean {
    if (!this.dirty) return false;
    this.dirty = false;
    return true;
  }
}

// ---------------------------------------------------------------------------------------------
// Rig
// ---------------------------------------------------------------------------------------------

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function subjectKey(settings: RigSettings): string {
  return `${settings.subjectKind}|${JSON.stringify(settings.road.points)}`;
}

function bakeSubject(points: readonly Vec3[]): BakedData {
  const roadPoints = points.map((p) => ({ x: p.x, y: p.y, z: p.z }));
  const length = createArcLengthTable(createCurve(roadPoints, true)).length;
  const scene: Scene = {
    fps: BAKE_FPS,
    frameCount: BAKED_LAP_FRAMES,
    path: { points: roadPoints, closed: true },
    targets: {},
    entities: [
      {
        id: SUBJECT_ENTITY_ID,
        forwardAxis: CAR_FORWARD_AXIS,
        upAxis: CAR_UP_AXIS,
        constraints: [
          { type: 'followPath', order: 0, influence: 1, speed: length / LAP_SECONDS, startOffset: 0, alignToPath: true },
        ],
      },
    ],
  };
  return bake(scene);
}

function remap(displayedFrame: number): number {
  return remapDisplayedFrame(displayedFrame, LAP_FRAMES, BAKED_LAP_FRAMES, EASE_AMPLITUDE);
}

export class CameraRig {
  private readonly scheduler = new RebakeScheduler();
  private pending: RigSettings | null = null;

  // Subject cache.
  private cachedSubjectKey: string | null = null;
  private subjectBaked: BakedData | null = null;
  private subjectBakeTotal = 0;

  // Last good camera bake.
  private bakedByCamera = new Map<string, BakedData>();
  private placements = new Map<string, { bakedScene: BakedData; sceneIndexInSet: number }>();
  private mainFindings: Finding[] = [];
  private bakeTotal = 0;
  private bakedShotLength = 0; // shot length of the last good bake; evaluateSubject range-checks against it

  // Transport state. The rig holds it only so that a re-bake can leave it alone.
  private playing = false;
  private frame = 0;

  // --- scheduling -------------------------------------------------------------------------

  /** Store the latest settings and mark the rig dirty. Does not bake. Later calls replace earlier ones. */
  setSettings(settings: RigSettings): void {
    this.pending = settings;
    this.scheduler.markDirty();
  }

  /** Mark the rig dirty without new settings (for example, the same settings object was edited). Does not bake. */
  markDirty(): void {
    this.scheduler.markDirty();
  }

  /**
   * Call once per animation frame. Re-bakes when the rig is dirty and settings exist, otherwise does
   * nothing and allocates nothing. Returns the outcome of the re-bake, or null when none ran.
   */
  tick(): BakeOutcome | null {
    if (!this.scheduler.consume()) return null;
    const settings = this.pending;
    if (settings === null) return null;
    return this.bake(settings);
  }

  // --- baking -----------------------------------------------------------------------------

  /**
   * Re-bakes now. Never starts playback and leaves the displayed frame alone.
   * Errors are caught and returned as plain messages; the last good bake stays in use.
   */
  bake(settings: RigSettings): BakeOutcome {
    this.playing = false;
    let subjectRebaked = false;

    // Road check first: a bad Road is not baked and the previous bake stays.
    const road = validateRoad(settings.road.points);
    if (!road.ok) return this.outcome(false, road.message, false);

    let set: SceneSet;
    let bakedScenes: BakedData[];
    let subject: BakedData;
    let key: string;
    try {
      key = subjectKey(settings);
      if (this.subjectBaked !== null && key === this.cachedSubjectKey) {
        subject = this.subjectBaked;
      } else {
        subject = bakeSubject(settings.road.points);
        subjectRebaked = true;
      }

      const n = settings.shotLengthFrames;
      const subjectTarget: Target = buildKeyframedTarget(subject, SUBJECT_ENTITY_ID, n, remap, 0);
      const cameras = new Map<string, { shotType: ShotType; placement: CameraPlacement }>();
      const centres = new Map<string, Target>();
      for (const c of settings.cameras) {
        cameras.set(c.id, {
          shotType: c.shotType,
          placement: {
            bearingDeg: c.bearingDeg,
            heightM: c.heightM,
            horizontalDistanceM: c.horizontalDistanceM,
            lensMm: c.lensMm,
          },
        });
        if (c.shotType !== 'push-in' && c.shotType !== 'crane') {
          // The orbit centre target is the subject raised by the placement height.
          centres.set(c.id, buildKeyframedTarget(subject, SUBJECT_ENTITY_ID, n, remap, c.heightM));
        }
      }
      set = buildSceneSet(settings.mainCameraId, cameras, n, subjectTarget, centres, null);
      bakedScenes = set.scenes.map((s) => bake(s.scene)); // bake validates the scene first
    } catch (e) {
      return this.outcome(
        false,
        `the camera move could not be built: ${messageOf(e)}. Try a different setting.`,
        false,
      );
    }

    // The camera bake worked: commit it.
    if (subjectRebaked) this.subjectBakeTotal++;
    this.subjectBaked = subject;
    this.cachedSubjectKey = key;
    this.bakeTotal++;
    this.bakedShotLength = settings.shotLengthFrames;

    const byCamera = new Map<string, BakedData>();
    const placements = new Map<string, { bakedScene: BakedData; sceneIndexInSet: number }>();
    for (let i = 0; i < set.scenes.length; i++) {
      for (const id of set.scenes[i].cameraIds) {
        byCamera.set(id, bakedScenes[i]);
        placements.set(id, { bakedScene: bakedScenes[i], sceneIndexInSet: i });
      }
    }
    this.bakedByCamera = byCamera;
    this.placements = placements;

    // Motion check: keep only the findings for the main camera.
    let message: string | null = null;
    const mainFindings: Finding[] = [];
    try {
      for (let i = 0; i < set.scenes.length; i++) {
        if (!set.scenes[i].cameraIds.includes(settings.mainCameraId)) continue;
        const found = motionLinter(set.scenes[i].scene, bakedScenes[i]);
        for (const f of found) {
          if (f.entityId === settings.mainCameraId) mainFindings.push(f);
        }
      }
    } catch (e) {
      mainFindings.length = 0;
      message = `the motion check could not run: ${messageOf(e)}.`;
    }
    this.mainFindings = mainFindings;

    return this.outcome(true, message, subjectRebaked);
  }

  private outcome(ok: boolean, message: string | null, subjectRebaked: boolean): BakeOutcome {
    return { ok, message, subjectRebaked, playing: false, displayedFrame: this.frame };
  }

  // --- reading ----------------------------------------------------------------------------

  /**
   * Writes the camera's baked position and rotation at `displayedFrame` into `out` and returns `out`.
   * Calls evaluateEntity only. Throws when the camera has not been baked or the frame is out of range
   * (a caller defect: frames are clamped first).
   */
  evaluate(cameraId: string, displayedFrame: number, out: OutBuffer): OutBuffer {
    const baked = this.bakedByCamera.get(cameraId);
    if (baked === undefined) {
      throw new Error(`CameraRig.evaluate: camera "${cameraId}" has no baked data`);
    }
    return evaluateEntity(baked, cameraId, displayedFrame, out);
  }

  /**
   * Writes the subject's baked position and rotation at `displayedFrame` into `out` and returns `out`.
   * Uses the same remap as the camera targets, then calls evaluateEntity on the subject bake only.
   * Throws when no bake has run yet. Then it checks the frame against the shot length of the last good
   * bake: a frame that is not a whole number in [0, shot length - 1] throws the same Error, with the same
   * message, as evaluate() does for that frame (a caller defect: frames are clamped first). `out` is not
   * touched when it throws. No allocation on the success path.
   */
  evaluateSubject(displayedFrame: number, out: OutBuffer): OutBuffer {
    const baked = this.subjectBaked;
    if (baked === null) {
      throw new Error('CameraRig.evaluateSubject: the subject has not been baked yet');
    }
    if (!(Number.isInteger(displayedFrame) && displayedFrame >= 0 && displayedFrame < this.bakedShotLength)) {
      throw new Error(`Frame ${displayedFrame} is outside the valid range [0, ${this.bakedShotLength - 1}]`);
    }
    return evaluateEntity(baked, SUBJECT_ENTITY_ID, remap(displayedFrame), out);
  }

  /** The main camera's findings from the last good bake. Findings for other cameras are dropped. */
  findingsForMain(): Finding[] {
    return this.mainFindings;
  }

  placementOf(cameraId: string): { bakedScene: BakedData; sceneIndexInSet: number } {
    const p = this.placements.get(cameraId);
    if (p === undefined) {
      throw new Error(`CameraRig.placementOf: camera "${cameraId}" has no baked data`);
    }
    return p;
  }

  /** How many camera bakes succeeded. */
  get bakeCount(): number {
    return this.bakeTotal;
  }

  /** How many subject bakes ran. Stays the same on a camera-only change. */
  get subjectBakeCount(): number {
    return this.subjectBakeTotal;
  }

  // --- transport (owned by the Timeline; the rig never changes it except to pause on a re-bake) ---

  setDisplayedFrame(frame: number): void {
    this.frame = frame;
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  displayedFrame(): number {
    return this.frame;
  }
}
