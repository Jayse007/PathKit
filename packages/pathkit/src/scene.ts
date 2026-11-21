import type { Vec3 } from './math.js';

export type AxisToken = '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z';

export interface FollowPathConstraint {
  type: 'followPath';
  order: number;
  influence: number;
  speed: number;
  startOffset: number;
  alignToPath?: boolean; // default false, applied by bake
}

export interface AimAtConstraint {
  type: 'aimAt';
  order: number;
  influence: number;
  target: string;
}

export type Constraint = FollowPathConstraint | AimAtConstraint;

export interface Entity {
  id: string;
  forwardAxis: AxisToken;
  upAxis: AxisToken;
  constraints: Constraint[];
}

export interface Keyframe {
  frame: number;
  position: Vec3;
}

export type Target = Vec3 | { keyframes: Keyframe[] };

export interface Scene {
  fps: number;
  frameCount: number;
  path: { points: Vec3[]; closed: boolean };
  targets: Record<string, Target>;
  entities: Entity[];
}

export class SceneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SceneError';
  }
}

/** Writes the unit vector for an axis token into `out` and returns `out`. */
export function axisVector(token: AxisToken, out: Vec3): Vec3 {
  switch (token) {
    case '+X': out.x = 1; out.y = 0; out.z = 0; return out;
    case '-X': out.x = -1; out.y = 0; out.z = 0; return out;
    case '+Y': out.x = 0; out.y = 1; out.z = 0; return out;
    case '-Y': out.x = 0; out.y = -1; out.z = 0; return out;
    case '+Z': out.x = 0; out.y = 0; out.z = 1; return out;
    case '-Z': out.x = 0; out.y = 0; out.z = -1; return out;
    default:
      throw new SceneError(`"${String(token)}" is not an axis token (use +X, -X, +Y, -Y, +Z or -Z)`);
  }
}

function isAxisToken(value: unknown): boolean {
  return value === '+X' || value === '-X' || value === '+Y' ||
    value === '-Y' || value === '+Z' || value === '-Z';
}

function isFiniteVec3(v: Vec3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

function hasKeyframes(target: Target): target is { keyframes: Keyframe[] } {
  return 'keyframes' in target;
}

/** Throws SceneError for the first defect found. Never mutates the scene. */
export function validateScene(scene: Scene): void {
  const entities = scene.entities;
  const targetNames = Object.keys(scene.targets);

  // 1. fps, then frameCount
  if (!Number.isInteger(scene.fps) || scene.fps <= 0) {
    throw new SceneError(`fps must be a positive integer, got ${scene.fps}`);
  }
  if (!Number.isInteger(scene.frameCount) || scene.frameCount <= 0) {
    throw new SceneError(`frameCount must be a positive integer, got ${scene.frameCount}`);
  }

  // 2. duplicate entity ids
  const seen = new Set<string>();
  for (const entity of entities) {
    if (seen.has(entity.id)) {
      throw new SceneError(`Duplicate entity id "${entity.id}"`);
    }
    seen.add(entity.id);
  }

  // 3. forwardAxis is an axis token
  for (const entity of entities) {
    if (!isAxisToken(entity.forwardAxis)) {
      throw new SceneError(`Entity "${entity.id}": forwardAxis "${entity.forwardAxis}" is not an axis token (use +X, -X, +Y, -Y, +Z or -Z)`);
    }
  }

  // 4. upAxis is an axis token
  for (const entity of entities) {
    if (!isAxisToken(entity.upAxis)) {
      throw new SceneError(`Entity "${entity.id}": upAxis "${entity.upAxis}" is not an axis token (use +X, -X, +Y, -Y, +Z or -Z)`);
    }
  }

  // 5. forward and up on different axes
  for (const entity of entities) {
    if (entity.forwardAxis.charAt(1) === entity.upAxis.charAt(1)) {
      throw new SceneError(`Entity "${entity.id}": forwardAxis ${entity.forwardAxis} and upAxis ${entity.upAxis} must lie on different axes`);
    }
  }

  // 6. per constraint: influence, then order, then aimAt target
  for (const entity of entities) {
    for (const c of entity.constraints) {
      if (!(c.influence >= 0 && c.influence <= 1)) {
        throw new SceneError(`Entity "${entity.id}": influence ${c.influence} is outside [0,1]`);
      }
      if (!Number.isFinite(c.order)) {
        throw new SceneError(`Entity "${entity.id}": order must be a finite number, got ${c.order}`);
      }
      if (c.type === 'aimAt' && !Object.prototype.hasOwnProperty.call(scene.targets, c.target)) {
        throw new SceneError(`Entity "${entity.id}": unknown target "${c.target}"`);
      }
    }
  }

  // 7. keyframe frames are integers
  for (const name of targetNames) {
    const target = scene.targets[name];
    if (!hasKeyframes(target)) continue;
    for (const k of target.keyframes) {
      if (!Number.isInteger(k.frame)) {
        throw new SceneError(`Target "${name}": keyframe frame must be an integer, got ${k.frame}`);
      }
    }
  }

  // 8. keyframed targets are not empty
  for (const name of targetNames) {
    const target = scene.targets[name];
    if (hasKeyframes(target) && target.keyframes.length === 0) {
      throw new SceneError(`Target "${name}": keyframes must not be empty`);
    }
  }

  // 9. keyframe frames strictly increasing
  for (const name of targetNames) {
    const target = scene.targets[name];
    if (!hasKeyframes(target)) continue;
    const ks = target.keyframes;
    for (let i = 1; i < ks.length; i++) {
      if (!(ks[i].frame > ks[i - 1].frame)) {
        throw new SceneError(`Target "${name}": keyframe frames must be strictly increasing, got ${ks[i - 1].frame} then ${ks[i].frame}`);
      }
    }
  }

  // 10. followPath speed finite
  for (const entity of entities) {
    for (const c of entity.constraints) {
      if (c.type === 'followPath' && !Number.isFinite(c.speed)) {
        throw new SceneError(`Entity "${entity.id}": speed must be a finite number, got ${c.speed}`);
      }
    }
  }

  // 11. followPath startOffset finite
  for (const entity of entities) {
    for (const c of entity.constraints) {
      if (c.type === 'followPath' && !Number.isFinite(c.startOffset)) {
        throw new SceneError(`Entity "${entity.id}": startOffset must be a finite number, got ${c.startOffset}`);
      }
    }
  }

  // 12. path points finite
  const points = scene.path.points;
  for (let i = 0; i < points.length; i++) {
    if (!isFiniteVec3(points[i])) {
      throw new SceneError(`Path point ${i} must have finite coordinates`);
    }
  }

  // 13. static target positions finite
  for (const name of targetNames) {
    const target = scene.targets[name];
    if (!hasKeyframes(target) && !isFiniteVec3(target)) {
      throw new SceneError(`Target "${name}": position must have finite coordinates`);
    }
  }

  // 14. keyframe positions finite
  for (const name of targetNames) {
    const target = scene.targets[name];
    if (!hasKeyframes(target)) continue;
    const ks = target.keyframes;
    for (let i = 0; i < ks.length; i++) {
      if (!isFiniteVec3(ks[i].position)) {
        throw new SceneError(`Target "${name}": keyframe ${i} position must have finite coordinates`);
      }
    }
  }
}
