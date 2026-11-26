// Fill_Fraction: how much of the frame a subject's oriented box covers.
// Pure. Every function writes into caller-supplied buffers or module-level scratch
// storage allocated once at load, so a call allocates nothing.
// Camera space: the camera looks down -Z, with +Y up.

import { quatInverse, rotateVec } from './pathkit.js';
import type { Quat, Vec3 } from './pathkit.js';
import { NEAR_EPSILON } from './constants.js';

// Preallocated scratch, reused by every call (single-threaded, no re-entrancy).
const scratchLocal: Vec3 = { x: 0, y: 0, z: 0 };
const scratchWorld: Vec3 = { x: 0, y: 0, z: 0 };
const scratchInvRot: Quat = { x: 0, y: 0, z: 0, w: 1 };

function checkFinite(fn: string, label: string, index: number, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${fn}: ${label}[${index}] must be a finite number, got ${value}`);
  }
}

function checkVec3(fn: string, label: string, v: Vec3): void {
  checkFinite(fn, label, 0, v.x);
  checkFinite(fn, label, 1, v.y);
  checkFinite(fn, label, 2, v.z);
}

function checkQuat(fn: string, label: string, q: Quat): void {
  checkFinite(fn, label, 0, q.x);
  checkFinite(fn, label, 1, q.y);
  checkFinite(fn, label, 2, q.z);
  checkFinite(fn, label, 3, q.w);
}

function checkCount(fn: string, label: string, count: number): void {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`${fn}: ${label} must be a whole number of at least 1, got ${count}`);
  }
}

function checkLength(fn: string, label: string, buffer: Float64Array, needed: number): void {
  if (buffer.length < needed) {
    throw new Error(`${fn}: ${label} needs length ${needed} or more, got ${buffer.length}`);
  }
}

// Writes the 8 world-space corners of the oriented box into `out` (length 24, x,y,z per corner).
// Local corner i has sign bits: bit 0 = x, bit 1 = y, bit 2 = z (set means positive).
export function subjectBoxCorners(
  position: Vec3,
  rotation: Quat,
  halfExtents: Vec3,
  out: Float64Array,
): Float64Array {
  const fn = 'subjectBoxCorners';
  checkVec3(fn, 'position', position);
  checkQuat(fn, 'rotation', rotation);
  checkVec3(fn, 'halfExtents', halfExtents);
  checkLength(fn, 'out', out, 24);
  for (let i = 0; i < 8; i++) {
    scratchLocal.x = (i & 1) !== 0 ? halfExtents.x : -halfExtents.x;
    scratchLocal.y = (i & 2) !== 0 ? halfExtents.y : -halfExtents.y;
    scratchLocal.z = (i & 4) !== 0 ? halfExtents.z : -halfExtents.z;
    rotateVec(rotation, scratchLocal, scratchWorld);
    out[i * 3] = scratchWorld.x + position.x;
    out[i * 3 + 1] = scratchWorld.y + position.y;
    out[i * 3 + 2] = scratchWorld.z + position.z;
  }
  return out;
}

// Projects `count` world points (x,y,z interleaved) into NDC (x,y interleaved in outNdc).
// Returns false if any point is behind the camera (depth > -NEAR_EPSILON). Such a point
// gets NDC (0, 0); the other points are still written.
export function projectToNdc(
  worldPoints: Float64Array,
  count: number,
  cameraPosition: Vec3,
  cameraRotation: Quat,
  verticalFovRad: number,
  aspect: number,
  outNdc: Float64Array,
): boolean {
  const fn = 'projectToNdc';
  checkCount(fn, 'count', count);
  checkLength(fn, 'worldPoints', worldPoints, count * 3);
  checkLength(fn, 'outNdc', outNdc, count * 2);
  checkVec3(fn, 'cameraPosition', cameraPosition);
  checkQuat(fn, 'cameraRotation', cameraRotation);
  checkFinite(fn, 'verticalFovRad', 0, verticalFovRad);
  checkFinite(fn, 'aspect', 0, aspect);
  if (verticalFovRad <= 0 || verticalFovRad >= Math.PI) {
    throw new Error(`${fn}: verticalFovRad must be between 0 and pi, got ${verticalFovRad}`);
  }
  if (aspect <= 0) {
    throw new Error(`${fn}: aspect must be above 0, got ${aspect}`);
  }
  for (let i = 0; i < count * 3; i++) {
    checkFinite(fn, 'worldPoints', i, worldPoints[i]);
  }

  quatInverse(cameraRotation, scratchInvRot);
  const tanHalf = Math.tan(verticalFovRad / 2);
  const tanHalfX = tanHalf * aspect;
  let allInFront = true;
  for (let i = 0; i < count; i++) {
    scratchWorld.x = worldPoints[i * 3] - cameraPosition.x;
    scratchWorld.y = worldPoints[i * 3 + 1] - cameraPosition.y;
    scratchWorld.z = worldPoints[i * 3 + 2] - cameraPosition.z;
    rotateVec(scratchInvRot, scratchWorld, scratchLocal);
    const depth = scratchLocal.z;
    if (depth <= -NEAR_EPSILON) {
      const d = -depth;
      outNdc[i * 2] = scratchLocal.x / d / tanHalfX;
      outNdc[i * 2 + 1] = scratchLocal.y / d / tanHalf;
    } else {
      outNdc[i * 2] = 0;
      outNdc[i * 2 + 1] = 0;
      allInFront = false;
    }
  }
  return allInFront;
}

// Percent of the frame covered by the NDC bounding box, clipped to the frame:
// 100 * max(width fraction, height fraction). Always in [0, 100].
export function fillFractionPercent(ndc: Float64Array, pointCount: number): number {
  const fn = 'fillFractionPercent';
  checkCount(fn, 'pointCount', pointCount);
  checkLength(fn, 'ndc', ndc, pointCount * 2);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pointCount; i++) {
    const x = ndc[i * 2];
    const y = ndc[i * 2 + 1];
    checkFinite(fn, 'ndc', i * 2, x);
    checkFinite(fn, 'ndc', i * 2 + 1, y);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const w = Math.max(0, Math.min(maxX, 1) - Math.max(minX, -1)) / 2;
  const h = Math.max(0, Math.min(maxY, 1) - Math.max(minY, -1)) / 2;
  return 100 * Math.max(w, h);
}

// Composes the three functions. Returns 100 when any box corner is behind the camera.
// scratchCorners has length 24 or more; scratchNdc has length 16 or more.
export function framingPercent(
  position: Vec3,
  rotation: Quat,
  halfExtents: Vec3,
  cameraPosition: Vec3,
  cameraRotation: Quat,
  verticalFovRad: number,
  aspect: number,
  scratchCorners: Float64Array,
  scratchNdc: Float64Array,
): number {
  subjectBoxCorners(position, rotation, halfExtents, scratchCorners);
  const inFront = projectToNdc(
    scratchCorners, 8, cameraPosition, cameraRotation, verticalFovRad, aspect, scratchNdc,
  );
  if (!inFront) return 100;
  return fillFractionPercent(scratchNdc, 8);
}
