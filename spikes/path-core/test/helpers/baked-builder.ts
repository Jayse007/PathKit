// Hand-built fixtures: a Scene and a matching BakedData made without running bake().
// Tests use this to feed the linter exact positions, rotations and aim directions.
// The axis defaults ('+Z' forward, '+Y' up) are test-fixture defaults and live in test code only.
import type { BakedData } from '../../src/bake.js';
import type { Quat } from '../../src/math.js';
import type { AxisToken, Scene } from '../../src/scene.js';

export interface FixtureEntity {
  id: string;
  forwardAxis?: AxisToken; // default '+Z'
  upAxis?: AxisToken; // default '+Y'
  positions?: [number, number, number][]; // one per frame; missing frames are (0,0,0)
  rotations?: Quat[]; // one per frame; missing frames are identity
  heldFromFrame?: number; // default -1
  rotationDrivers?: number; // default 0
  aimDirections?: [number, number, number][]; // one per frame; missing frames are zero
}

const TRANSFORM_STRIDE = 7; // px py pz qx qy qz qw
const AIM_STRIDE = 3; // x y z

/** Writes the position and rotation of one frame into a transforms array. */
function writeTransform(
  transforms: Float64Array,
  frame: number,
  position: readonly number[] | undefined,
  rotation: Quat | undefined,
): void {
  const i = frame * TRANSFORM_STRIDE;
  transforms[i] = position ? position[0] : 0;
  transforms[i + 1] = position ? position[1] : 0;
  transforms[i + 2] = position ? position[2] : 0;
  transforms[i + 3] = rotation ? rotation.x : 0;
  transforms[i + 4] = rotation ? rotation.y : 0;
  transforms[i + 5] = rotation ? rotation.z : 0;
  transforms[i + 6] = rotation ? rotation.w : 1;
}

/** Builds the transforms array of one entity. Values are copied. */
function buildTransforms(frameCount: number, entity: FixtureEntity): Float64Array {
  const transforms = new Float64Array(frameCount * TRANSFORM_STRIDE);
  for (let f = 0; f < frameCount; f++) {
    writeTransform(transforms, f, entity.positions?.[f], entity.rotations?.[f]);
  }
  return transforms;
}

/** Builds the aim direction array of one entity. Values are copied. */
function buildAimDirections(frameCount: number, entity: FixtureEntity): Float64Array {
  const aim = new Float64Array(frameCount * AIM_STRIDE);
  for (let f = 0; f < frameCount; f++) {
    const d = entity.aimDirections?.[f];
    if (!d) continue;
    aim[f * AIM_STRIDE] = d[0];
    aim[f * AIM_STRIDE + 1] = d[1];
    aim[f * AIM_STRIDE + 2] = d[2];
  }
  return aim;
}

/** Builds a small valid scene: an open straight path, no targets, no constraints. */
function buildScene(frameCount: number, fps: number, entities: readonly FixtureEntity[]): Scene {
  return {
    fps,
    frameCount,
    path: {
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
      ],
      closed: false,
    },
    targets: {},
    entities: entities.map((e) => ({
      id: e.id,
      forwardAxis: e.forwardAxis ?? '+Z',
      upAxis: e.upAxis ?? '+Y',
      constraints: [],
    })),
  };
}

/** Builds a scene and baked data that agree with each other. Nothing is shared with the caller. */
export function buildFixture(
  frameCount: number,
  fps: number,
  entities: FixtureEntity[],
): { scene: Scene; baked: BakedData } {
  const entityIndex = new Map<string, number>();
  entities.forEach((e, i) => entityIndex.set(e.id, i));

  const baked: BakedData = {
    fps,
    frameCount,
    entityIds: entities.map((e) => e.id),
    entityIndex,
    transforms: entities.map((e) => buildTransforms(frameCount, e)),
    travelled: entities.map(() => new Float64Array(frameCount)),
    heldFromFrame: entities.map((e) => e.heldFromFrame ?? -1),
    rotationDrivers: entities.map((e) => e.rotationDrivers ?? 0),
    aimDirections: entities.map((e) => buildAimDirections(frameCount, e)),
  };
  return { scene: buildScene(frameCount, fps, entities), baked };
}

/** Rotation of `degrees` about the x, y or z axis. */
export function quatAboutAxis(axis: 'x' | 'y' | 'z', degrees: number): Quat {
  const half = (degrees * Math.PI) / 180 / 2;
  const s = Math.sin(half);
  return {
    x: axis === 'x' ? s : 0,
    y: axis === 'y' ? s : 0,
    z: axis === 'z' ? s : 0,
    w: Math.cos(half),
  };
}

/**
 * Hamilton product a * b. Same convention as quatMul in src/math.ts:
 * quatMul(a, b) rotates by b first, then by a. Written by hand so it is independent of src.
 */
export function quatMul(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}
