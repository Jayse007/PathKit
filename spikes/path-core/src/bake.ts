// Baking: validates a scene, then computes position and rotation for every
// entity on every frame. Rules that depend on history live here only.
import type { ArcLengthTable } from './arclength.js';
import { createArcLengthTable } from './arclength.js';
import type { Curve } from './curve.js';
import { createCurve } from './curve.js';
import type { Frame } from './frames.js';
import { rotationMinimizingFrames } from './frames.js';
import type { Quat, Vec3 } from './math.js';
import { cross, dot, length, lerp, normalize, quatFromBasis, rotateVec, scale, slerp, sub } from './math.js';
import type { AimAtConstraint, Constraint, Entity, FollowPathConstraint, Scene, Target } from './scene.js';
import { SceneError, axisVector, validateScene } from './scene.js';

export interface BakedData {
  readonly fps: number;
  readonly frameCount: number;
  readonly entityIds: readonly string[];
  readonly entityIndex: ReadonlyMap<string, number>;
  readonly transforms: readonly Float64Array[]; // [entity][frame * 7 + k]
  readonly heldFromFrame: readonly number[]; // first held frame per entity (first followPath in order), or -1
  readonly travelled: readonly Float64Array[]; // unclamped Travelled_Distance per frame, from the first followPath in order
  readonly rotationDrivers: readonly number[]; // declared rotation-driving constraints per entity, regardless of influence
  readonly aimDirections: readonly Float64Array[]; // x,y,z per frame: last aimAt direction; zero when none or coincident
}

const RMF_SAMPLE_COUNT = 1024;
const PERPENDICULAR_EPS = 1e-9;
const TRANSFORM_STRIDE = 7;
const AIM_STRIDE = 3;
/** An aim whose |y| is at least this is within 3 degrees of straight up or down. */
const VERTICAL_COS = Math.cos((3 * Math.PI) / 180);
/** World up. A world convention, not an entity axis. */
const WORLD_UP: Vec3 = { x: 0, y: 1, z: 0 };

// ---------------------------------------------------------------------------
// Small constraint helpers
// ---------------------------------------------------------------------------

/** Returns a copy of the constraints sorted by `order`. The input is not changed. */
function sortedCopy(constraints: readonly Constraint[]): Constraint[] {
  const copy = constraints.slice();
  copy.sort((a, b) => a.order - b.order); // Array.prototype.sort is stable
  return copy;
}

function isFollowPath(c: Constraint): c is FollowPathConstraint {
  return c.type === 'followPath';
}

function isAimAt(c: Constraint): c is AimAtConstraint {
  return c.type === 'aimAt';
}

/** True when a followPath constraint drives rotation (alignToPath defaults to false). */
function alignsToPath(c: FollowPathConstraint): boolean {
  return c.alignToPath ?? false;
}

/** True when the constraint drives rotation, whatever its influence. */
function drivesRotation(c: Constraint): boolean {
  if (isAimAt(c)) return true;
  return alignsToPath(c);
}

/** Counts the rotation-driving constraints. */
function countRotationDrivers(constraints: readonly Constraint[]): number {
  let count = 0;
  for (const c of constraints) {
    if (drivesRotation(c)) count++;
  }
  return count;
}

/** True when any entity has a followPath that aligns to the path. */
function sceneNeedsFrames(entities: readonly Entity[]): boolean {
  for (const entity of entities) {
    for (const c of entity.constraints) {
      if (isFollowPath(c) && alignsToPath(c)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Path distance and normal
// ---------------------------------------------------------------------------

/** Throws a SceneError when the travelled distance is not a finite number. */
function checkTravelled(entityId: string, frame: number, travelled: number): void {
  if (!Number.isFinite(travelled)) {
    throw new SceneError(
      `Entity "${entityId}": travelled distance at frame ${frame} must be a finite number, got ${travelled}`,
    );
  }
}

/**
 * Distance handed to the arc-length table. Open paths clamp to [0, length].
 * Closed paths pass the raw value, because the table wraps it itself.
 */
function tableDistance(travelled: number, pathLength: number, closed: boolean): number {
  if (closed) return travelled;
  // Redundant guard: the arc-length table clamps open distances itself.
  return Math.min(Math.max(travelled, 0), pathLength);
}

/** Writes into `out` a unit vector perpendicular to the unit tangent. */
function anyPerpendicular(tangent: Vec3, out: Vec3): Vec3 {
  const ax = Math.abs(tangent.x);
  const ay = Math.abs(tangent.y);
  const az = Math.abs(tangent.z);
  let axis: Vec3;
  if (ax <= ay && ax <= az) axis = { x: 1, y: 0, z: 0 };
  else if (ay <= az) axis = { x: 0, y: 1, z: 0 };
  else axis = { x: 0, y: 0, z: 1 };
  cross(axis, tangent, out);
  cross(out, tangent, out);
  return normalize(out, out);
}

/** Everything pathNormalAt needs. Built once per bake. */
interface PathFrameContext {
  readonly table: ArcLengthTable;
  readonly samples: readonly Frame[];
  readonly scratch: Vec3;
}

function createPathFrameContext(curve: Curve, table: ArcLengthTable): PathFrameContext {
  return {
    table,
    samples: rotationMinimizingFrames(curve, RMF_SAMPLE_COUNT),
    scratch: { x: 0, y: 0, z: 0 },
  };
}

/**
 * The single place that chooses the up normal at a distance (a closing-twist
 * correction for closed paths, KI-11, would go here). Interpolates the two
 * nearest RMF samples, then re-orthogonalises against the exact `tangent`.
 * The result is written into `out`.
 */
function pathNormalAt(ctx: PathFrameContext, distance: number, tangent: Vec3, out: Vec3): Vec3 {
  const lastIndex = RMF_SAMPLE_COUNT - 1;
  const t = ctx.table.parameterAtDistance(distance);
  const position = Math.min(Math.max(t * lastIndex, 0), lastIndex);
  const lowIndex = Math.min(Math.floor(position), lastIndex);
  const highIndex = Math.min(lowIndex + 1, lastIndex);
  const fraction = position - lowIndex;

  lerp(ctx.samples[lowIndex].normal, ctx.samples[highIndex].normal, fraction, out);

  // Remove the tangent component, then normalise.
  scale(tangent, dot(out, tangent), ctx.scratch);
  sub(out, ctx.scratch, out);
  if (length(out) < PERPENDICULAR_EPS) {
    return anyPerpendicular(tangent, out);
  }
  return normalize(out, out);
}

// ---------------------------------------------------------------------------
// Rotation from an axis pair
// ---------------------------------------------------------------------------

/** An entity's local axes: forward f, up u and the third axis r = f x u. */
interface LocalAxes {
  readonly f: Vec3;
  readonly u: Vec3;
  readonly r: Vec3;
}

/** Reads the axes from the entity (no defaults). */
function localAxesOf(entity: Entity): LocalAxes {
  const f = axisVector(entity.forwardAxis, { x: 0, y: 0, z: 0 });
  const u = axisVector(entity.upAxis, { x: 0, y: 0, z: 0 });
  return { f, u, r: cross(f, u) };
}

/** out = cf * d + cu * up + cr * third. */
function combine(cf: number, cu: number, cr: number, d: Vec3, up: Vec3, third: Vec3, out: Vec3): Vec3 {
  out.x = cf * d.x + cu * up.x + cr * third.x;
  out.y = cf * d.y + cu * up.y + cr * third.y;
  out.z = cf * d.z + cu * up.z + cr * third.z;
  return out;
}

/** Scratch vectors for rotationFromAxes. */
interface BasisScratch {
  readonly third: Vec3;
  readonly imageX: Vec3;
  readonly imageY: Vec3;
  readonly imageZ: Vec3;
}

function createBasisScratch(): BasisScratch {
  return {
    third: { x: 0, y: 0, z: 0 },
    imageX: { x: 0, y: 0, z: 0 },
    imageY: { x: 0, y: 0, z: 0 },
    imageZ: { x: 0, y: 0, z: 0 },
  };
}

/**
 * Writes into `out` the rotation that maps the local forward axis to the world
 * `forward` and the local up axis to the world `up`. Both must be orthonormal.
 * Each local axis e = a*f + b*u + c*r maps to a*forward + b*up + c*third,
 * where both third axes are cross products, so the result is never a mirror.
 */
function rotationFromAxes(axes: LocalAxes, forward: Vec3, up: Vec3, scratch: BasisScratch, out: Quat): Quat {
  const { f, u, r } = axes;
  cross(forward, up, scratch.third);
  combine(f.x, u.x, r.x, forward, up, scratch.third, scratch.imageX);
  combine(f.y, u.y, r.y, forward, up, scratch.third, scratch.imageY);
  combine(f.z, u.z, r.z, forward, up, scratch.third, scratch.imageZ);
  return quatFromBasis(scratch.imageX, scratch.imageY, scratch.imageZ, out);
}

// ---------------------------------------------------------------------------
// Per-entity baking
// ---------------------------------------------------------------------------

/** Working values for one entity. Reused for every frame. */
interface EntityWork {
  readonly position: Vec3;
  readonly rotation: Quat;
  readonly candidatePosition: Vec3;
  readonly candidateRotation: Quat;
  readonly tangent: Vec3;
  readonly normal: Vec3;
  readonly targetPosition: Vec3;
  readonly aim: Vec3;
  readonly aimUp: Vec3;
  readonly basis: BasisScratch;
}

function createEntityWork(): EntityWork {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    candidatePosition: { x: 0, y: 0, z: 0 },
    candidateRotation: { x: 0, y: 0, z: 0, w: 1 },
    tangent: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 0 },
    targetPosition: { x: 0, y: 0, z: 0 },
    aim: { x: 0, y: 0, z: 0 },
    aimUp: { x: 0, y: 0, z: 0 },
    basis: createBasisScratch(),
  };
}

/** Resets the stack to the Rest_Pose: origin and identity rotation. */
function resetToRestPose(work: EntityWork): void {
  work.position.x = 0; work.position.y = 0; work.position.z = 0;
  work.rotation.x = 0; work.rotation.y = 0; work.rotation.z = 0; work.rotation.w = 1;
}

/** Blends the candidate into the stack by the constraint's influence. */
function blendCandidate(work: EntityWork, influence: number, withRotation: boolean): void {
  lerp(work.position, work.candidatePosition, influence, work.position);
  if (withRotation) {
    slerp(work.rotation, work.candidateRotation, influence, work.rotation);
  }
}

/** Blends only the rotation by influence. The position is left untouched. */
function blendRotation(work: EntityWork, influence: number): void {
  slerp(work.rotation, work.candidateRotation, influence, work.rotation);
}

/** Writes position and rotation into the flat transforms array. */
function writeTransform(transforms: Float64Array, frame: number, work: EntityWork): void {
  const i = frame * TRANSFORM_STRIDE;
  transforms[i] = work.position.x;
  transforms[i + 1] = work.position.y;
  transforms[i + 2] = work.position.z;
  transforms[i + 3] = work.rotation.x;
  transforms[i + 4] = work.rotation.y;
  transforms[i + 5] = work.rotation.z;
  transforms[i + 6] = work.rotation.w;
}

/** Everything the followPath step needs that does not change per frame. */
interface PathInfo {
  readonly table: ArcLengthTable;
  readonly closed: boolean;
  readonly frames: PathFrameContext | null; // null when no entity aligns to the path
  readonly fps: number;
}

/** Output arrays for one entity. */
interface EntityOutput {
  readonly transforms: Float64Array;
  readonly travelled: Float64Array;
  readonly aimDirections: Float64Array;
  heldFromFrame: number;
}

// ---------------------------------------------------------------------------
// aimAt
// ---------------------------------------------------------------------------

/** Copies a vector into `out`. */
function copyVec(a: Vec3, out: Vec3): Vec3 {
  out.x = a.x; out.y = a.y; out.z = a.z;
  return out;
}

/** Copies a quaternion into `out`. */
function copyQuat(a: Quat, out: Quat): Quat {
  out.x = a.x; out.y = a.y; out.z = a.z; out.w = a.w;
  return out;
}

/**
 * Writes the target position at a frame into `out`. A static target is
 * returned as is. A keyframed target holds its first position before the
 * first keyframe and its last after the last, and lerps in between.
 * validateScene guarantees non-empty keyframes with increasing frames.
 */
function targetPositionAt(target: Target, frame: number, out: Vec3): Vec3 {
  if (!('keyframes' in target)) return copyVec(target, out);

  const keys = target.keyframes;
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (frame <= first.frame) return copyVec(first.position, out);
  if (frame >= last.frame) return copyVec(last.position, out);

  // First keyframe at or after this frame. It exists and is not the first key.
  let next = 1;
  while (keys[next].frame < frame) next++;
  const k1 = keys[next];
  if (k1.frame === frame) return copyVec(k1.position, out);

  const k0 = keys[next - 1];
  const t = (frame - k0.frame) / (k1.frame - k0.frame);
  return lerp(k0.position, k1.position, t, out);
}

/** Writes into `out` the part of `v` that is perpendicular to the unit vector `dir`. */
function removeComponent(v: Vec3, dir: Vec3, out: Vec3): Vec3 {
  const along = dot(v, dir);
  out.x = v.x - dir.x * along;
  out.y = v.y - dir.y * along;
  out.z = v.z - dir.z * along;
  return out;
}

/**
 * Writes into `out` the unit up vector for an aim. The reference is world up,
 * or the previous baked up when the aim is near vertical after frame 0.
 * The reference is made perpendicular to the aim. A too-short remainder
 * falls back to any perpendicular unit vector.
 */
function aimUpVector(aim: Vec3, frame: number, prevUp: Vec3, out: Vec3): Vec3 {
  const nearVertical = Math.abs(aim.y) >= VERTICAL_COS;
  const reference = nearVertical && frame > 0 ? prevUp : WORLD_UP;
  removeComponent(reference, aim, out);
  if (length(out) < PERPENDICULAR_EPS) {
    return anyPerpendicular(aim, out);
  }
  return normalize(out, out);
}

/**
 * Applies one aimAt constraint at one frame. Only the rotation is blended.
 * `prevRotation` holds this constraint's candidate from the previous frame
 * (identity before frame 0) and is updated here. The unit aim direction is
 * left in work.aim (zero when coincident). Returns true when coincident.
 */
function applyAimAt(
  c: AimAtConstraint,
  target: Target,
  frame: number,
  axes: LocalAxes,
  prevUp: Vec3,
  prevRotation: Quat,
  work: EntityWork,
): boolean {
  targetPositionAt(target, frame, work.targetPosition);
  sub(work.targetPosition, work.position, work.aim);
  normalize(work.aim, work.aim);

  const coincident = length(work.aim) === 0;
  if (coincident) {
    copyQuat(prevRotation, work.candidateRotation);
  } else {
    aimUpVector(work.aim, frame, prevUp, work.aimUp);
    rotationFromAxes(axes, work.aim, work.aimUp, work.basis, work.candidateRotation);
    copyQuat(work.candidateRotation, prevRotation);
  }
  blendRotation(work, c.influence);
  return coincident;
}

/** Writes the aim direction of this frame into the flat aim array. */
function writeAimDirection(aimDirections: Float64Array, frame: number, aim: Vec3): void {
  const i = frame * AIM_STRIDE;
  aimDirections[i] = aim.x;
  aimDirections[i + 1] = aim.y;
  aimDirections[i + 2] = aim.z;
}

/** Index of the last aimAt in the sorted constraints, or -1. */
function lastAimIndexOf(constraints: readonly Constraint[]): number {
  for (let i = constraints.length - 1; i >= 0; i--) {
    if (isAimAt(constraints[i])) return i;
  }
  return -1;
}

/**
 * Applies one followPath constraint at one frame. Returns the unclamped
 * travelled distance.
 */
function applyFollowPath(
  entity: Entity,
  c: FollowPathConstraint,
  frame: number,
  axes: LocalAxes,
  path: PathInfo,
  work: EntityWork,
): number {
  const travelled = c.startOffset + (c.speed * frame) / path.fps;
  checkTravelled(entity.id, frame, travelled);

  const distance = tableDistance(travelled, path.table.length, path.closed);
  path.table.pointAtDistance(distance, work.candidatePosition);

  const aligns = alignsToPath(c);
  if (aligns && path.frames !== null) {
    path.table.tangentAtDistance(distance, work.tangent);
    normalize(work.tangent, work.tangent);
    pathNormalAt(path.frames, distance, work.tangent, work.normal);
    rotationFromAxes(axes, work.tangent, work.normal, work.basis, work.candidateRotation);
  }
  blendCandidate(work, c.influence, aligns);
  return travelled;
}

/** True when the open path has been reached (inclusive) by this unclamped distance. */
function isHeld(travelled: number, path: PathInfo): boolean {
  return !path.closed && travelled >= path.table.length;
}

/** Bakes one entity over all frames. */
function bakeEntity(
  entity: Entity,
  frameCount: number,
  path: PathInfo,
  targets: Readonly<Record<string, Target>>,
): EntityOutput {
  const constraints = sortedCopy(entity.constraints);
  const lastAimIndex = lastAimIndexOf(constraints);

  let firstFollowIndex = -1;
  for (let i = 0; i < constraints.length; i++) {
    if (isFollowPath(constraints[i])) {
      firstFollowIndex = i;
      break;
    }
  }

  const output: EntityOutput = {
    transforms: new Float64Array(frameCount * TRANSFORM_STRIDE),
    travelled: new Float64Array(frameCount), // stays zero-filled when there is no followPath
    aimDirections: new Float64Array(frameCount * AIM_STRIDE), // stays zero-filled when there is no aimAt
    heldFromFrame: -1,
  };
  const axes = localAxesOf(entity);
  const work = createEntityWork();

  // Carried state. Neither value ever starts a frame's stack.
  // Each aimAt's candidate rotation from the previous frame, indexed like
  // `constraints` (identity until first written, which is the frame 0 rule).
  const prevAimRotations: Quat[] = constraints.map(() => ({ x: 0, y: 0, z: 0, w: 1 }));
  // The previous frame's final baked up direction (unused on frame 0).
  const prevUp: Vec3 = { x: 0, y: 0, z: 0 };

  for (let frame = 0; frame < frameCount; frame++) {
    resetToRestPose(work);
    for (let i = 0; i < constraints.length; i++) {
      const c = constraints[i];
      if (isAimAt(c)) {
        applyAimAt(c, targets[c.target], frame, axes, prevUp, prevAimRotations[i], work);
        if (i === lastAimIndex) writeAimDirection(output.aimDirections, frame, work.aim);
        continue;
      }
      const travelled = applyFollowPath(entity, c, frame, axes, path, work);
      if (i === firstFollowIndex) {
        output.travelled[frame] = travelled;
        if (output.heldFromFrame < 0 && isHeld(travelled, path)) {
          output.heldFromFrame = frame;
        }
      }
    }
    writeTransform(output.transforms, frame, work);
    // After the whole stack: this frame's baked up direction, for the next frame.
    rotateVec(work.rotation, axes.u, prevUp);
  }
  return output;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/** Validates the scene and bakes every entity. The scene is never modified. */
export function bake(scene: Scene): BakedData {
  validateScene(scene);

  const curve = createCurve(scene.path.points, scene.path.closed);
  const table = createArcLengthTable(curve);
  const frames = sceneNeedsFrames(scene.entities) ? createPathFrameContext(curve, table) : null;
  const path: PathInfo = { table, closed: scene.path.closed, frames, fps: scene.fps };

  const entityIds: string[] = [];
  const entityIndex = new Map<string, number>();
  const transforms: Float64Array[] = [];
  const travelled: Float64Array[] = [];
  const heldFromFrame: number[] = [];
  const rotationDrivers: number[] = [];
  const aimDirections: Float64Array[] = [];

  for (let e = 0; e < scene.entities.length; e++) {
    const entity = scene.entities[e];
    const output = bakeEntity(entity, scene.frameCount, path, scene.targets);
    entityIds.push(entity.id);
    entityIndex.set(entity.id, e);
    transforms.push(output.transforms);
    travelled.push(output.travelled);
    heldFromFrame.push(output.heldFromFrame);
    rotationDrivers.push(countRotationDrivers(entity.constraints));
    aimDirections.push(output.aimDirections);
  }

  return {
    fps: scene.fps,
    frameCount: scene.frameCount,
    entityIds,
    entityIndex,
    transforms,
    heldFromFrame,
    travelled,
    rotationDrivers,
    aimDirections,
  };
}
