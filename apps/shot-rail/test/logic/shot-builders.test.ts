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
import { PLACEHOLDER_PATH } from '../../src/logic/constants.js';
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
    // 8.7 - 2.7 is 5.999999999999999 in floating point, so the speed is compared with a tolerance.
    const scene = build('crane', 240);
    const speed = speedOf(scene, 0);
    expect(Math.abs(speed - 0.75)).toBeLessThan(1e-12);
    const constraints = scene.entities[0].constraints.map((c) =>
      c.type === 'followPath' ? { ...c, speed: 0.75 } : c,
    );
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

// Hand-written expectations: camera cam-1, distance 10, height 2, push-in end ratio 0.4, crane rise 6.
const TOL = 1e-9;
const RAIL_PLACEMENT = (bearingDeg: number): CameraPlacement => ({
  bearingDeg,
  heightM: 2,
  horizontalDistanceM: 10,
  lensMm: 35,
});
const STILL: Vec3 = { x: 1, y: 0.7, z: 2 };
const PLACEHOLDER = PLACEHOLDER_PATH;

function expectPoint(actual: Vec3, x: number, y: number, z: number): void {
  expect(Math.abs(actual.x - x)).toBeLessThan(TOL);
  expect(Math.abs(actual.y - y)).toBeLessThan(TOL);
  expect(Math.abs(actual.z - z)).toBeLessThan(TOL);
}

describe('buildCameraScene rail geometry, paths, targets and errors', () => {
  const stillCases: Array<['crane' | 'push-in', number, Vec3, Vec3]> = [
    ['crane', 0, { x: 1, y: 2.7, z: 12 }, { x: 1, y: 8.7, z: 12 }],
    ['crane', 90, { x: 11, y: 2.7, z: 2 }, { x: 11, y: 8.7, z: 2 }],
    ['push-in', 0, { x: 1, y: 2.7, z: 12 }, { x: 1, y: 1.5, z: 6 }],
    ['push-in', 90, { x: 11, y: 2.7, z: 2 }, { x: 5, y: 1.5, z: 2 }],
  ];

  it.each(stillCases)('still subject: %s at bearing %i has the expected 2-point open rail', (type, bearing, start, end) => {
    const scene = buildCameraScene(type, RAIL_PLACEMENT(bearing), 240, STILL, STILL, CAMERA_ID, null);
    expect(scene.path.points.length).toBe(2);
    expect(scene.path.closed).toBe(false);
    expectPoint(scene.path.points[0], start.x, start.y, start.z);
    expectPoint(scene.path.points[1], end.x, end.y, end.z);
  });

  it('moving subject: push-in ends at the last keyframe offset, crane rises from the first', () => {
    const subject = {
      keyframes: [
        { frame: 0, position: { x: 0, y: 0.7, z: 0 } },
        { frame: 1, position: { x: 3, y: 0.7, z: 1 } },
        { frame: 2, position: { x: 10, y: 1.7, z: -6 } },
      ],
    };
    const push = buildCameraScene('push-in', RAIL_PLACEMENT(0), 240, subject, subject, CAMERA_ID, null);
    expectPoint(push.path.points[0], 0, 2.7, 10);
    expectPoint(push.path.points[1], 10, 2.5, -2);
    const crane = buildCameraScene('crane', RAIL_PLACEMENT(0), 240, subject, subject, CAMERA_ID, null);
    expectPoint(crane.path.points[0], 0, 2.7, 10);
    expectPoint(crane.path.points[1], 0, 8.7, 10);
  });

  it('supplied path: push-in and crane use it and speed is 5 * 30 / 240 = 0.625', () => {
    const supplied = {
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 3, z: 4 },
      ],
      closed: false,
    };
    for (const type of ['push-in', 'crane'] as const) {
      const scene = buildCameraScene(type, RAIL_PLACEMENT(0), 240, STILL, STILL, CAMERA_ID, supplied);
      expect(scene.path).toEqual(supplied);
      expect(Math.abs(speedOf(scene, 0) - 0.625)).toBeLessThan(1e-12);
    }
  });

  it('orbit and tracking: scene.path is the supplied path, or PLACEHOLDER_PATH when null', () => {
    const supplied = {
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 3, z: 4 },
      ],
      closed: false,
    };
    for (const type of ['orbit', 'tracking'] as const) {
      const withPath = buildCameraScene(type, ORBIT_PLACEMENT, 240, STILL, STILL, CAMERA_ID, supplied);
      expect(withPath.path).toEqual(supplied);
      const without = buildCameraScene(type, ORBIT_PLACEMENT, 240, STILL, STILL, CAMERA_ID, null);
      expect(without.path).toEqual(PLACEHOLDER);
    }
  });

  it('orbit and tracking: targets hold the centre under centre-cam-1 and the subject under subject', () => {
    const centre: Vec3 = { x: 5, y: 0, z: 7 };
    for (const type of ['orbit', 'tracking'] as const) {
      const scene = buildCameraScene(type, ORBIT_PLACEMENT, 240, STILL, centre, CAMERA_ID, null);
      expect(scene.targets['centre-cam-1']).toEqual(centre);
      expect(scene.targets.subject).toEqual(STILL);
    }
  });

  it('rejects a shot length that is not a whole number above 0, for all 4 types', () => {
    for (const type of ALL_TYPES) {
      for (const bad of [0, -1, 1.5, NaN]) {
        expect(() =>
          buildCameraScene(type, placementFor(type), bad, STILL, STILL, CAMERA_ID, null),
        ).toThrow(/whole number above 0/);
      }
    }
  });

  it('push-in and crane reject a subject target with no keyframes', () => {
    const empty = { keyframes: [] };
    for (const type of ['push-in', 'crane'] as const) {
      expect(() =>
        buildCameraScene(type, RAIL_PLACEMENT(0), 240, empty, empty, CAMERA_ID, null),
      ).toThrow(/no keyframes/);
    }
  });
});
