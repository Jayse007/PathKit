import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import { createArcLengthTable } from '../../src/arclength.js';
import { createCurve } from '../../src/curve.js';
import { cross, dot, rotateVec } from '../../src/math.js';
import type { Quat, Vec3 } from '../../src/math.js';
import { axisVector } from '../../src/scene.js';
import type { AxisToken, Constraint, Scene, Target } from '../../src/scene.js';
import { VALID_AXIS_PAIRS } from '../helpers/basic-generators.js';
import { arbAimAtScene } from '../helpers/scene-generators.js';

// Feature: path-core, Property 27: aimAt points the forward axis at the target
// **Validates: Requirements 6.4, 6.5**

const DIRECTION_TOLERANCE = 1e-4;
const PERP_TOLERANCE = 1e-4;
const UP_DOT_MIN = -1e-9;
const PROPER_TOLERANCE = 1e-6;
const MIN_DISTANCE = 0.5 - 1e-9;

/** Counts of what a checked scene contained, so the tests can assert the inputs were varied. */
interface Stats {
  frames: number;
  nearVerticalFrames: number; // aim within 10 degrees of straight up or down
  downFrames: number; // aim below the horizon
}

function distOf(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Target position at a frame, written here: hold before the first and after the last keyframe, lerp between. */
function targetAt(target: Target, frame: number, out: Vec3): void {
  if (!('keyframes' in target)) {
    out.x = target.x; out.y = target.y; out.z = target.z;
    return;
  }
  const keys = target.keyframes;
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (frame <= first.frame) {
    out.x = first.position.x; out.y = first.position.y; out.z = first.position.z;
    return;
  }
  if (frame >= last.frame) {
    out.x = last.position.x; out.y = last.position.y; out.z = last.position.z;
    return;
  }
  let i = 1;
  while (keys[i].frame <= frame) i++; // keys[i - 1].frame <= frame < keys[i].frame
  const k0 = keys[i - 1];
  const k1 = keys[i];
  const t = (frame - k0.frame) / (k1.frame - k0.frame);
  out.x = k0.position.x + (k1.position.x - k0.position.x) * t;
  out.y = k0.position.y + (k1.position.y - k0.position.y) * t;
  out.z = k0.position.z + (k1.position.z - k0.position.z) * t;
}

/**
 * Bakes the scene and checks every frame of the single entity "subject".
 * The aimAt is the last constraint with influence 1 and the constraints are in ascending order,
 * so the entity position at the aimAt is the origin blended with each earlier followPath in turn.
 * Throws on the first miss.
 */
function checkScene(label: string, scene: Scene): Stats {
  const entity = scene.entities[0];
  const closed = scene.path.closed;
  const table = createArcLengthTable(createCurve(scene.path.points, closed));
  const target = scene.targets['goal'];
  const transforms = bake(scene).transforms[0];
  if (transforms.length !== scene.frameCount * 7) {
    throw new Error(`${label}: transforms length ${transforms.length}, expected ${scene.frameCount * 7}`);
  }

  const f = axisVector(entity.forwardAxis, { x: 0, y: 0, z: 0 });
  const u = axisVector(entity.upAxis, { x: 0, y: 0, z: 0 });
  const r = cross(f, u);
  const pos: Vec3 = { x: 0, y: 0, z: 0 };
  const p: Vec3 = { x: 0, y: 0, z: 0 };
  const tp: Vec3 = { x: 0, y: 0, z: 0 };
  const dir: Vec3 = { x: 0, y: 0, z: 0 };
  const q: Quat = { x: 0, y: 0, z: 0, w: 1 };
  const rf: Vec3 = { x: 0, y: 0, z: 0 };
  const ru: Vec3 = { x: 0, y: 0, z: 0 };
  const rr: Vec3 = { x: 0, y: 0, z: 0 };
  const stats: Stats = { frames: 0, nearVerticalFrames: 0, downFrames: 0 };

  for (let frame = 0; frame < scene.frameCount; frame++) {
    // Position at the aimAt: earlier followPaths, in order, each blended by its influence.
    pos.x = 0; pos.y = 0; pos.z = 0;
    for (const c of entity.constraints as Constraint[]) {
      if (c.type !== 'followPath') continue;
      const d = c.startOffset + (c.speed * frame) / scene.fps;
      const len = table.length;
      const dist = closed ? d - len * Math.floor(d / len) : Math.min(Math.max(d, 0), len);
      table.pointAtDistance(dist, p);
      pos.x += (p.x - pos.x) * c.influence;
      pos.y += (p.y - pos.y) * c.influence;
      pos.z += (p.z - pos.z) * c.influence;
    }

    targetAt(target, frame, tp);
    const dx = tp.x - pos.x;
    const dy = tp.y - pos.y;
    const dz = tp.z - pos.z;
    const dlen = Math.hypot(dx, dy, dz);
    if (!(dlen >= MIN_DISTANCE)) {
      throw new Error(`${label}: frame ${frame}: scene is not valid for the property, target is ${dlen} m from the entity`);
    }
    dir.x = dx / dlen; dir.y = dy / dlen; dir.z = dz / dlen;
    if (!(Math.abs(dir.y) < Math.cos((3 * Math.PI) / 180))) {
      throw new Error(`${label}: frame ${frame}: scene is not valid for the property, aim.y = ${dir.y} is within 3 degrees of vertical`);
    }
    if (Math.abs(dir.y) > Math.cos((10 * Math.PI) / 180)) stats.nearVerticalFrames++;
    if (dir.y < 0) stats.downFrames++;
    stats.frames++;

    const i = frame * 7;
    q.x = transforms[i + 3];
    q.y = transforms[i + 4];
    q.z = transforms[i + 5];
    q.w = transforms[i + 6];
    rotateVec(q, f, rf);
    rotateVec(q, u, ru);
    rotateVec(q, r, rr);

    const where = `${label}: frame ${frame} (${entity.forwardAxis}/${entity.upAxis})`;
    const forwardError = distOf(rf, dir);
    if (!(forwardError <= DIRECTION_TOLERANCE)) {
      throw new Error(`${where}: rotated forward is ${forwardError} from the unit direction to the target`);
    }
    const perp = dot(ru, dir);
    if (!(Math.abs(perp) <= PERP_TOLERANCE)) {
      throw new Error(`${where}: rotated up . direction = ${perp}, expected 0`);
    }
    if (!(ru.y >= UP_DOT_MIN)) {
      throw new Error(`${where}: rotated up . +Y = ${ru.y}, expected >= 0`);
    }
    const third = cross(rf, ru);
    const properError = distOf(third, rr);
    if (!(properError <= PROPER_TOLERANCE)) {
      throw new Error(`${where}: rotated forward x rotated up is ${properError} from the rotated third axis (mirror?)`);
    }
  }
  return stats;
}

/** Unit direction at `theta` degrees from +Y and `azimuth` degrees around Y. */
function dirOf(theta: number, azimuth: number, distance: number): Vec3 {
  const t = (theta * Math.PI) / 180;
  const a = (azimuth * Math.PI) / 180;
  return {
    x: distance * Math.sin(t) * Math.cos(a),
    y: distance * Math.cos(t),
    z: distance * Math.sin(t) * Math.sin(a),
  };
}

function sceneOf(forwardAxis: AxisToken, upAxis: AxisToken, target: Target, frameCount: number, withFollow: boolean): Scene {
  const constraints: Constraint[] = [];
  if (withFollow) {
    constraints.push({ type: 'followPath', order: 0, influence: 1, speed: 2, startOffset: 0, alignToPath: true });
  }
  constraints.push({ type: 'aimAt', order: 1, influence: 1, target: 'goal' });
  return {
    fps: 24,
    frameCount,
    path: {
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 8, y: 2, z: 0 },
        { x: 16, y: 0, z: 4 },
      ],
      closed: false,
    },
    targets: { goal: target },
    entities: [{ id: 'subject', forwardAxis, upAxis, constraints }],
  };
}

describe('Property 27: aimAt points the forward axis at the target', () => {
  it('points forward at the target with a perpendicular, upward-leaning up for any valid axis pair, with and without followPaths', () => {
    let runs = 0;
    let frames = 0;
    let nearVertical = 0;
    let down = 0;
    let withFollow = 0;
    let withAlign = 0;
    let keyed = 0;
    fc.assert(
      fc.property(arbAimAtScene, (scene) => {
        runs++;
        const entity = scene.entities[0];
        if (entity.constraints.length > 1) withFollow++;
        if (entity.constraints.some((c) => c.type === 'followPath' && c.alignToPath === true)) withAlign++;
        if ('keyframes' in scene.targets['goal']) keyed++;
        const stats = checkScene(`run ${runs}`, scene);
        frames += stats.frames;
        nearVertical += stats.nearVerticalFrames;
        down += stats.downFrames;
      }),
      { numRuns: 100 },
    );
    expect(runs).toBeGreaterThanOrEqual(100);
    expect(frames).toBeGreaterThan(0);
    expect(nearVertical).toBeGreaterThan(0);
    expect(down).toBeGreaterThan(0);
    expect(withFollow).toBeGreaterThan(0);
    expect(withAlign).toBeGreaterThan(0);
    expect(keyed).toBeGreaterThan(0);
  });

  it('holds for all 24 valid axis pairs with fixed targets near vertical, below the horizon and jumping across frames', () => {
    expect(VALID_AXIS_PAIRS.length).toBe(24);
    const D = 10;
    const cases: [string, Target, number][] = [
      ['3.5 deg from up', dirOf(3.5, 30, D), 3],
      ['5 deg from up', dirOf(5, 100, D), 3],
      ['8 deg from up', dirOf(8, 200, D), 3],
      ['3.5 deg from down', dirOf(176.5, 300, D), 3],
      ['5 deg from down', dirOf(175, 40, D), 3],
      ['8 deg from down', dirOf(172, 250, D), 3],
      ['below the horizon', { x: 3, y: -4, z: 2 }, 3],
      ['horizontal', { x: 0, y: 0, z: 7 }, 3],
      [
        'jump from 10 deg to 3.5 deg on the other side (up)',
        {
          keyframes: [
            { frame: 0, position: dirOf(10, 0, D) },
            { frame: 1, position: dirOf(3.5, 180, D) },
            { frame: 2, position: dirOf(10, 0, D) },
            { frame: 3, position: dirOf(3.5, 180, D) },
          ],
        },
        4,
      ],
      [
        'jump from 10 deg to 3.5 deg on the other side (down)',
        {
          keyframes: [
            { frame: 0, position: dirOf(170, 0, D) },
            { frame: 1, position: dirOf(176.5, 180, D) },
            { frame: 2, position: dirOf(170, 0, D) },
            { frame: 3, position: dirOf(176.5, 180, D) },
          ],
        },
        4,
      ],
    ];
    let checked = 0;
    for (const [forwardAxis, upAxis] of VALID_AXIS_PAIRS) {
      for (const [name, target, frameCount] of cases) {
        checkScene(`${name}`, sceneOf(forwardAxis, upAxis, target, frameCount, false));
        checked++;
      }
      // Entity position from an earlier followPath that aligns to the path (its rotation is replaced).
      checkScene('after followPath', sceneOf(forwardAxis, upAxis, { x: 5, y: 30, z: 5 }, 12, true));
      checked++;
    }
    expect(checked).toBe(24 * (cases.length + 1));
  });
});
