// Motion linter: a pure, read-only pass over a scene and its baked data.
// It returns a list of findings. It never changes its inputs.
import type { BakedData } from './bake.js';
import { VERTICAL_COS } from './bake.js';
import type { Quat, Vec3 } from './math.js';
import { cross, dot, length, normalize, rotateVec } from './math.js';
import type { Entity, Scene } from './scene.js';
import { axisVector } from './scene.js';

export type Severity = 'info' | 'warning';

export interface Finding {
  frame: number;
  entityId: string;
  severity: Severity;
  code: string;
  message: string;
}

export interface LinterOptions {
  /** Roll change threshold in degrees per frame. Default 15. */
  rollThresholdDegPerFrame?: number;
}

const DEFAULT_ROLL_THRESHOLD_DEG = 15;
const SPEED_SPIKE_MULTIPLIER = 3;
const PROJECTION_EPS = 1e-9;
const TRANSFORM_STRIDE = 7;
const AIM_STRIDE = 3;

/** A finding plus the entity's position in the scene, used only for sorting. */
interface SortableFinding {
  entityIndex: number;
  finding: Finding;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function makeFinding(
  frame: number, entityId: string, severity: Severity, code: string, message: string,
): Finding {
  return { frame, entityId, severity, code, message };
}

/** True when the frame is a held frame for an entity with this heldFromFrame. */
function isHeldFrame(frame: number, heldFromFrame: number): boolean {
  if (heldFromFrame < 0) return false;
  return frame >= heldFromFrame;
}

/** Reads the baked rotation of one frame into `out`. */
function readRotation(transforms: Float64Array, frame: number, out: Quat): Quat {
  const base = frame * TRANSFORM_STRIDE;
  out.x = transforms[base + 3];
  out.y = transforms[base + 4];
  out.z = transforms[base + 5];
  out.w = transforms[base + 6];
  return out;
}

/** Reads the baked position of one frame into `out`. */
function readPosition(transforms: Float64Array, frame: number, out: Vec3): Vec3 {
  const base = frame * TRANSFORM_STRIDE;
  out.x = transforms[base];
  out.y = transforms[base + 1];
  out.z = transforms[base + 2];
  return out;
}

/** Median of an ascending-sorted list. The list must not be empty. */
function medianOfSorted(sorted: readonly number[]): number {
  const count = sorted.length;
  const middle = Math.floor(count / 2);
  if (count % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

// ---------------------------------------------------------------------------
// path-end-reached
// ---------------------------------------------------------------------------

/** One info finding at the first frame where the entity reaches the path end. */
function checkPathEnd(
  entity: Entity, entityIndex: number, baked: BakedData, out: SortableFinding[],
): void {
  const heldFrom = baked.heldFromFrame[entityIndex];
  if (heldFrom < 0) return;
  const message = `Entity "${entity.id}" reaches the end of the path at frame ${heldFrom}`;
  out.push({
    entityIndex,
    finding: makeFinding(heldFrom, entity.id, 'info', 'path-end-reached', message),
  });
}

// ---------------------------------------------------------------------------
// rotation-conflict
// ---------------------------------------------------------------------------

/** One warning on frame 0 when two or more rotation drivers are declared. */
function checkRotationConflict(
  entity: Entity, entityIndex: number, baked: BakedData, out: SortableFinding[],
): void {
  const drivers = baked.rotationDrivers[entityIndex];
  if (drivers < 2) return;
  const message = `Entity "${entity.id}" has ${drivers} rotation-driving constraints that compete`;
  out.push({
    entityIndex,
    finding: makeFinding(0, entity.id, 'warning', 'rotation-conflict', message),
  });
}

// ---------------------------------------------------------------------------
// aim-vertical
// ---------------------------------------------------------------------------

/** A warning for each frame whose stored aim direction is non-zero and near vertical. */
function checkAimVertical(
  entity: Entity, entityIndex: number, baked: BakedData, out: SortableFinding[],
): void {
  const aims = baked.aimDirections[entityIndex];
  const aim: Vec3 = { x: 0, y: 0, z: 0 };
  for (let frame = 0; frame < baked.frameCount; frame++) {
    const base = frame * AIM_STRIDE;
    aim.x = aims[base];
    aim.y = aims[base + 1];
    aim.z = aims[base + 2];
    if (length(aim) <= 0) continue;
    if (Math.abs(aim.y) < VERTICAL_COS) continue;
    const message = `Entity "${entity.id}" aims almost straight up or down at frame ${frame}`;
    out.push({
      entityIndex,
      finding: makeFinding(frame, entity.id, 'warning', 'aim-vertical', message),
    });
  }
}

// ---------------------------------------------------------------------------
// speed-spike
// ---------------------------------------------------------------------------

/** Speed at `frame` (f >= 1): distance between frames f-1 and f, times fps. */
function speedAt(transforms: Float64Array, frame: number, fps: number, a: Vec3, b: Vec3): number {
  readPosition(transforms, frame - 1, a);
  readPosition(transforms, frame, b);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) * fps;
}

/** Warnings for frames whose speed is more than 3 times the median speed. */
function checkSpeedSpikes(
  entity: Entity, entityIndex: number, baked: BakedData, out: SortableFinding[],
): void {
  const transforms = baked.transforms[entityIndex];
  const heldFrom = baked.heldFromFrame[entityIndex];
  const a: Vec3 = { x: 0, y: 0, z: 0 };
  const b: Vec3 = { x: 0, y: 0, z: 0 };

  // Speeds of the non-held frames, indexed by frame. Held frames are left out.
  const speeds: number[] = [];
  const speedFrames: number[] = [];
  for (let frame = 1; frame < baked.frameCount; frame++) {
    if (isHeldFrame(frame, heldFrom)) continue;
    speeds.push(speedAt(transforms, frame, baked.fps, a, b));
    speedFrames.push(frame);
  }
  if (speeds.length === 0) return;

  const sorted = speeds.slice();
  sorted.sort((x, y) => {
    if (x < y) return -1;
    if (x > y) return 1;
    return 0;
  });
  const median = medianOfSorted(sorted);
  if (!(median > 0)) return;

  const limit = SPEED_SPIKE_MULTIPLIER * median;
  for (let i = 0; i < speeds.length; i++) {
    if (!(speeds[i] > limit)) continue;
    const frame = speedFrames[i];
    const message = `Entity "${entity.id}" speed at frame ${frame} is ${speeds[i]} m/s, ` +
      `more than ${SPEED_SPIKE_MULTIPLIER} times its median speed of ${median} m/s`;
    out.push({
      entityIndex,
      finding: makeFinding(frame, entity.id, 'warning', 'speed-spike', message),
    });
  }
}

// ---------------------------------------------------------------------------
// roll-change
// ---------------------------------------------------------------------------

/**
 * Writes into `out` the normalised part of `up` that is perpendicular to the
 * unit vector `forward`. Writes the zero vector when that part is too short.
 */
function projectPerpendicular(up: Vec3, forward: Vec3, out: Vec3): Vec3 {
  const along = dot(up, forward);
  out.x = up.x - forward.x * along;
  out.y = up.y - forward.y * along;
  out.z = up.z - forward.z * along;
  if (length(out) < PROJECTION_EPS) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return out;
  }
  return normalize(out, out);
}

/** Scratch vectors for the roll calculation, made once per entity. */
interface RollScratch {
  quat: Quat;
  forwardLocal: Vec3;
  upLocal: Vec3;
  forward: Vec3;
  upBefore: Vec3;
  upAfter: Vec3;
  a: Vec3;
  b: Vec3;
  c: Vec3;
}

function makeRollScratch(): RollScratch {
  return {
    quat: { x: 0, y: 0, z: 0, w: 1 },
    forwardLocal: { x: 0, y: 0, z: 0 },
    upLocal: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: 0 },
    upBefore: { x: 0, y: 0, z: 0 },
    upAfter: { x: 0, y: 0, z: 0 },
    a: { x: 0, y: 0, z: 0 },
    b: { x: 0, y: 0, z: 0 },
    c: { x: 0, y: 0, z: 0 },
  };
}

/** Roll change in radians, in [0, pi], between frames f-1 and f (f >= 1). */
function rollChange(transforms: Float64Array, frame: number, s: RollScratch): number {
  // F is the rotated forward axis at the later frame f.
  readRotation(transforms, frame, s.quat);
  rotateVec(s.quat, s.forwardLocal, s.forward);
  rotateVec(s.quat, s.upLocal, s.upAfter);
  // Rotated up axis of the earlier frame f-1.
  readRotation(transforms, frame - 1, s.quat);
  rotateVec(s.quat, s.upLocal, s.upBefore);

  projectPerpendicular(s.upBefore, s.forward, s.a);
  projectPerpendicular(s.upAfter, s.forward, s.b);
  // A zero projection means the angle is 0.
  if (length(s.a) === 0 || length(s.b) === 0) return 0;
  cross(s.a, s.b, s.c);
  return Math.atan2(length(s.c), dot(s.a, s.b));
}

/** Warnings for frames whose roll change is strictly above the threshold. */
function checkRollChange(
  entity: Entity, entityIndex: number, baked: BakedData, thresholdRad: number,
  out: SortableFinding[],
): void {
  const transforms = baked.transforms[entityIndex];
  const scratch = makeRollScratch();
  axisVector(entity.forwardAxis, scratch.forwardLocal);
  axisVector(entity.upAxis, scratch.upLocal);
  for (let frame = 1; frame < baked.frameCount; frame++) {
    const angle = rollChange(transforms, frame, scratch);
    if (!(angle > thresholdRad)) continue;
    const degrees = (angle * 180) / Math.PI;
    const message = `Entity "${entity.id}" rolls ${degrees} degrees between frames ` +
      `${frame - 1} and ${frame}`;
    out.push({
      entityIndex,
      finding: makeFinding(frame, entity.id, 'warning', 'roll-change', message),
    });
  }
}

// ---------------------------------------------------------------------------
// Sorting and entry point
// ---------------------------------------------------------------------------

/** Orders by frame, then entity index in the scene, then code. Returns -1, 1 or 0. */
function compareFindings(p: SortableFinding, q: SortableFinding): number {
  if (p.finding.frame < q.finding.frame) return -1;
  if (p.finding.frame > q.finding.frame) return 1;
  if (p.entityIndex < q.entityIndex) return -1;
  if (p.entityIndex > q.entityIndex) return 1;
  if (p.finding.code < q.finding.code) return -1;
  if (p.finding.code > q.finding.code) return 1;
  return 0;
}

/** Converts the roll threshold from degrees per frame to radians, once. */
function thresholdInRadians(options: LinterOptions | undefined): number {
  const degrees = options?.rollThresholdDegPerFrame ?? DEFAULT_ROLL_THRESHOLD_DEG;
  return (degrees * Math.PI) / 180;
}

/**
 * Looks for problematic motion in baked data. Reads its inputs only and
 * returns a new array of new Finding objects, sorted by frame, entity order
 * in the scene, then code.
 */
export function motionLinter(
  scene: Scene, baked: BakedData, options?: LinterOptions,
): Finding[] {
  const thresholdRad = thresholdInRadians(options);
  const collected: SortableFinding[] = [];

  for (let i = 0; i < scene.entities.length; i++) {
    const entity = scene.entities[i];
    const e = baked.entityIndex.get(entity.id);
    if (e === undefined) continue;
    // `i` is the scene order used for sorting; `e` indexes the baked arrays.
    const before = collected.length;
    checkPathEnd(entity, e, baked, collected);
    checkRotationConflict(entity, e, baked, collected);
    checkAimVertical(entity, e, baked, collected);
    checkSpeedSpikes(entity, e, baked, collected);
    checkRollChange(entity, e, baked, thresholdRad, collected);
    for (let k = before; k < collected.length; k++) collected[k].entityIndex = i;
  }

  const sorted = collected.slice();
  sorted.sort(compareFindings);
  const result: Finding[] = [];
  for (const item of sorted) result.push(item.finding);
  return result;
}
