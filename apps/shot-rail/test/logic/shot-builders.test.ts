// Task 21.2: Shot_Builder tests.
// Expected values are written by hand:
//   crane rail length = CRANE_RISE_M = 6 m.
//   push-in rail (subject at (0, 0.7, 0), bearing 90 degrees, distance 10 m, height 2 m):
//     start (10, 2.7, 0); end (10 * 0.4, 0.7 + 2 * 0.4, 0) = (4, 1.5, 0); length = sqrt(6^2 + 1.2^2) = sqrt(37.44).
//   rail travelled at the last frame = length * (N - 1) / N.
//   orbit angle at the last frame minus the start = 180 degrees * (N - 1) / N.

import { describe, expect, it } from 'vitest';
import { bake, motionLinter, validateScene } from '../../src/logic/pathkit.js';
import type { Scene, Vec3 } from '../../src/logic/pathkit.js';
import { buildCameraScene } from '../../src/logic/shot-builders.js';
import type { CameraPlacement, ShotType } from '../../src/logic/shot-builders.js';

const SUBJECT: Vec3 = { x: 0, y: 0.7, z: 0 };
const CENTRE: Vec3 = { x: 0, y: 0.7, z: 0 };
const CAMERA_ID = 'cam-1';
const ALL_TYPES: ShotType[] = ['tracking', 'orbit', 'push-in', 'crane'];
const LENGTHS = [60, 240, 600];

const PLACEMENT: CameraPlacement = {
  bearingDeg: 90,
  heightM: 2,
  horizontalDistanceM: 10,
  lensMm: 35,
};
const ORBIT_PLACEMENT: CameraPlacement = {
  bearingDeg: 20,
  heightM: 0,
  horizontalDistanceM: 10,
  lensMm: 35,
};

function placementFor(type: ShotType): CameraPlacement {
  return type === 'orbit' || type === 'tracking' ? ORBIT_PLACEMENT : PLACEMENT;
}

function build(type: ShotType, frames: number): Scene {
  return buildCameraScene(type, placementFor(type), frames, SUBJECT, CENTRE, CAMERA_ID, null);
}

function speedOf(scene: Scene, index: number): number {
  return (scene.entities[0].constraints[index] as unknown as { speed: number }).speed;
}

// Hand-written rail lengths (see the header).
function railLengthFor(type: 'push-in' | 'crane'): number {
  return type === 'crane' ? 6 : Math.sqrt(37.44);
}

describe('buildCameraScene', () => {
  it('builds a scene that validateScene accepts, for each of the 4 shot types', () => {
    for (const type of ALL_TYPES) {
      expect(() => validateScene(build(type, 240))).not.toThrow();
    }
  });

  it('gives one entity with the given id and camera axes (-Z forward, +Y up) for each type', () => {
    for (const type of ALL_TYPES) {
      const scene = build(type, 240);
      if (scene.entities.length !== 1) {
        throw new Error(`entities: ${type} has ${scene.entities.length} entities, expected 1`);
      }
      const entity = scene.entities[0];
      if (entity.id !== CAMERA_ID) throw new Error(`entity id: ${type} has "${entity.id}"`);
      if (entity.forwardAxis !== '-Z') throw new Error(`forwardAxis: ${type} has ${entity.forwardAxis}`);
      if (entity.upAxis !== '+Y') throw new Error(`upAxis: ${type} has ${entity.upAxis}`);
    }
  });

  it('tracking: orbitAround (order 0, speed 0) then aimAt (order 1)', () => {
    const constraints = build('tracking', 240).entities[0].constraints;
    expect(constraints).toEqual([
      {
        type: 'orbitAround',
        order: 0,
        influence: 1,
        target: 'centre-cam-1',
        radius: 10,
        axis: '+Y',
        speed: 0,
        startAngle: 20,
      },
      { type: 'aimAt', order: 1, influence: 1, target: 'subject' },
    ]);
  });

  it('orbit: orbitAround (order 0, speed 180 / (240 / 30) = 22.5) then aimAt (order 1)', () => {
    const constraints = build('orbit', 240).entities[0].constraints;
    expect(constraints).toEqual([
      {
        type: 'orbitAround',
        order: 0,
        influence: 1,
        target: 'centre-cam-1',
        radius: 10,
        axis: '+Y',
        speed: 22.5,
        startAngle: 20,
      },
      { type: 'aimAt', order: 1, influence: 1, target: 'subject' },
    ]);
  });

  it('crane: followPath (order 0, speed 6 * 30 / 240 = 0.75) then aimAt (order 1)', () => {
    const constraints = build('crane', 240).entities[0].constraints;
    expect(constraints).toEqual([
      { type: 'followPath', order: 0, influence: 1, speed: 0.75, startOffset: 0, alignToPath: false },
      { type: 'aimAt', order: 1, influence: 1, target: 'subject' },
    ]);
  });

  it('push-in: followPath (order 0, speed sqrt(37.44) * 30 / 240) then aimAt (order 1)', () => {
    const constraints = build('push-in', 240).entities[0].constraints;
    const expectedSpeed = (Math.sqrt(37.44) * 30) / 240;
    const speed = speedOf(build('push-in', 240), 0);
    expect(Math.abs(speed - expectedSpeed)).toBeLessThan(1e-12);
    expect(constraints).toEqual([
      { type: 'followPath', order: 0, influence: 1, speed, startOffset: 0, alignToPath: false },
      { type: 'aimAt', order: 1, influence: 1, target: 'subject' },
    ]);
  });

  it('rails: travelled distance at the last frame is length * (N - 1) / N, below the length', () => {
    for (const type of ['push-in', 'crane'] as const) {
      for (const n of LENGTHS) {
        const baked = bake(build(type, n));
        const index = baked.entityIndex.get(CAMERA_ID);
        if (index === undefined) throw new Error(`travelled: ${type} N=${n} has no entity index`);
        const length = railLengthFor(type);
        const expected = (length * (n - 1)) / n;
        const actual = baked.travelled[index][n - 1];
        if (!(Math.abs(actual - expected) <= 1e-9)) {
          throw new Error(`travelled: ${type} N=${n} last frame ${actual}, expected ${expected}`);
        }
        if (!(actual < length)) {
          throw new Error(`travelled: ${type} N=${n} last frame ${actual} is not below length ${length}`);
        }
      }
    }
  });

  it('rails: motionLinter reports no path-end-reached finding at 60, 240 and 600 frames', () => {
    for (const type of ['push-in', 'crane'] as const) {
      for (const n of LENGTHS) {
        const scene = build(type, n);
        const findings = motionLinter(scene, bake(scene));
        for (let i = 0; i < findings.length; i++) {
          if (findings[i].code === 'path-end-reached') {
            throw new Error(`linter: ${type} N=${n} finding ${i} is path-end-reached at frame ${findings[i].frame}`);
          }
        }
      }
    }
  });

  it('orbit: angle at the last frame minus the start is 180 * (N - 1) / N degrees', () => {
    // Axis +Y: position - centre = r * (sin a, 0, cos a), so a = atan2(dx, dz).
    for (const n of LENGTHS) {
      const baked = bake(build('orbit', n));
      const index = baked.entityIndex.get(CAMERA_ID);
      if (index === undefined) throw new Error(`orbit: N=${n} has no entity index`);
      const t = baked.transforms[index];
      const first = Math.atan2(t[0] - CENTRE.x, t[2] - CENTRE.z);
      const last = Math.atan2(t[(n - 1) * 7] - CENTRE.x, t[(n - 1) * 7 + 2] - CENTRE.z);
      const diffDeg = ((((last - first) * 180) / Math.PI) + 360) % 360;
      const expected = (180 * (n - 1)) / n;
      if (!(Math.abs(diffDeg - expected) <= 1e-9)) {
        throw new Error(`orbit: N=${n} swept ${diffDeg} degrees, expected ${expected}`);
      }
    }
  });
});
