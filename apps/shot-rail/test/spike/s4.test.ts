// Spike S4: two targets, height and aim.
// `subject` is keyframed on a straight line. `centre` is the subject shifted by (0, h, 0).
// The camera orbits `centre` (speed 0), then aims at `subject`.
// Expected: camera y = subject y + h, horizontal distance to subject = r, elevation = atan2(h, r),
// and the forward vector points at the true subject position.

import { describe, expect, it } from 'vitest';
import { bake, evaluateEntity, rotateVec, validateScene } from '../../src/logic/pathkit.js';
import type { Keyframe, OutBuffer, Scene } from '../../src/logic/pathkit.js';
import { CAMERA_FORWARD_AXIS, CAMERA_UP_AXIS } from '../../src/logic/constants.js';

const FRAMES = 60;
const TOLERANCE = 1e-9;
const ELEVATION_TOLERANCE_DEGREES = 1e-3;
const CAMERA_ID = 'cam-1';
const SUBJECT = 'subject';
const CENTRE = 'centre';

interface Case {
  h: number;
  r: number;
  elevationDegrees: number; // hand-written
}

const CASES: Case[] = [
  { h: 1.5, r: 8, elevationDegrees: 10.6197 },
  { h: -0.3, r: 12, elevationDegrees: -1.4321 },
  { h: 0, r: 5, elevationDegrees: 0 },
  { h: 40, r: 60, elevationDegrees: 33.6901 },
  { h: -0.5, r: 3, elevationDegrees: -9.4623 },
];

function makeOut(): OutBuffer {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };
}

// Straight line: x = 2 f - 10, y = 1 + 0.1 f, z = 3 - 0.5 f.
function subjectX(f: number): number {
  return 2 * f - 10;
}
function subjectY(f: number): number {
  return 1 + 0.1 * f;
}
function subjectZ(f: number): number {
  return 3 - 0.5 * f;
}

function makeScene(h: number, r: number, aimTarget: string): Scene {
  const subjectKeys: Keyframe[] = [];
  const centreKeys: Keyframe[] = [];
  for (let f = 0; f < FRAMES; f++) {
    subjectKeys.push({ frame: f, position: { x: subjectX(f), y: subjectY(f), z: subjectZ(f) } });
    centreKeys.push({ frame: f, position: { x: subjectX(f), y: subjectY(f) + h, z: subjectZ(f) } });
  }
  return {
    fps: 24,
    frameCount: FRAMES,
    path: {
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 5, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
      ],
      closed: false,
    },
    targets: {
      [SUBJECT]: { keyframes: subjectKeys },
      [CENTRE]: { keyframes: centreKeys },
    },
    entities: [
      {
        id: CAMERA_ID,
        forwardAxis: CAMERA_FORWARD_AXIS,
        upAxis: CAMERA_UP_AXIS,
        constraints: [
          {
            type: 'orbitAround',
            order: 0,
            influence: 1,
            target: CENTRE,
            radius: r,
            axis: '+Y',
            speed: 0,
            startAngle: 0,
          },
          { type: 'aimAt', order: 1, influence: 1, target: aimTarget },
        ],
      },
    ],
  };
}

// Forward vector for CAMERA_FORWARD_AXIS = -Z.
const LOCAL_FORWARD = { x: 0, y: 0, z: -1 };

describe('S4: two targets, height and aim', () => {
  it('the camera forward axis is -Z (the local forward used below)', () => {
    expect(CAMERA_FORWARD_AXIS).toBe('-Z');
  });

  for (const c of CASES) {
    it(`h=${c.h}, r=${c.r}: scene is valid and bakes`, () => {
      const scene = makeScene(c.h, c.r, SUBJECT);
      expect(() => validateScene(scene)).not.toThrow();
      expect(() => bake(scene)).not.toThrow();
    });

    it(`h=${c.h}, r=${c.r}: height, distance, elevation and aim on every frame`, () => {
      const baked = bake(makeScene(c.h, c.r, SUBJECT));
      const out = makeOut();
      let maxError = 0;

      for (let f = 0; f < FRAMES; f++) {
        evaluateEntity(baked, CAMERA_ID, f, out);
        const sx = subjectX(f);
        const sy = subjectY(f);
        const sz = subjectZ(f);

        const heightError = Math.abs(out.position.y - (sy + c.h));
        if (!(heightError <= TOLERANCE)) {
          throw new Error(`S4 height: h=${c.h} r=${c.r} frame ${f} camera y ${out.position.y}, expected ${sy + c.h}`);
        }

        const dx = out.position.x - sx;
        const dz = out.position.z - sz;
        const horizontal = Math.sqrt(dx * dx + dz * dz);
        if (!(Math.abs(horizontal - c.r) <= TOLERANCE)) {
          throw new Error(`S4 distance: h=${c.h} r=${c.r} frame ${f} horizontal distance ${horizontal}, expected ${c.r}`);
        }

        const elevation = (Math.atan2(out.position.y - sy, horizontal) * 180) / Math.PI;
        if (!(Math.abs(elevation - c.elevationDegrees) <= ELEVATION_TOLERANCE_DEGREES)) {
          throw new Error(
            `S4 elevation: h=${c.h} r=${c.r} frame ${f} elevation ${elevation} degrees, expected ${c.elevationDegrees}`,
          );
        }

        const ax = sx - out.position.x;
        const ay = sy - out.position.y;
        const az = sz - out.position.z;
        const len = Math.sqrt(ax * ax + ay * ay + az * az);
        if (!(len > 0)) throw new Error(`S4 aim: h=${c.h} r=${c.r} frame ${f} camera and subject coincide`);
        const got = rotateVec(out.rotation, LOCAL_FORWARD);
        const e = Math.max(
          Math.abs(got.x - ax / len),
          Math.abs(got.y - ay / len),
          Math.abs(got.z - az / len),
        );
        if (e > maxError) maxError = e;
        if (!(e <= TOLERANCE)) {
          throw new Error(
            `S4 aim: h=${c.h} r=${c.r} frame ${f} forward (${got.x}, ${got.y}, ${got.z}), expected (${ax / len}, ${ay / len}, ${az / len}), largest difference ${e}`,
          );
        }
      }
      console.log(`S4 h=${c.h} r=${c.r} largest forward-vector component error: ${maxError}`);
    });
  }

  it('wrong target: aimAt on centre gives a level forward vector that differs from the correct one (h=1.5)', () => {
    const h = 1.5;
    const r = 8;
    const wrong = bake(makeScene(h, r, CENTRE));
    const right = bake(makeScene(h, r, SUBJECT));
    const outWrong = makeOut();
    const outRight = makeOut();
    for (let f = 0; f < FRAMES; f++) {
      evaluateEntity(wrong, CAMERA_ID, f, outWrong);
      evaluateEntity(right, CAMERA_ID, f, outRight);
      const fw = rotateVec(outWrong.rotation, LOCAL_FORWARD);
      const fr = rotateVec(outRight.rotation, LOCAL_FORWARD);
      if (!(Math.abs(fw.y) <= TOLERANCE)) {
        throw new Error(`S4 wrong target: frame ${f} forward y ${fw.y}, expected 0`);
      }
      // The correct forward looks down at the subject: y = -h / sqrt(h^2 + r^2).
      const expectedY = -h / Math.sqrt(h * h + r * r);
      if (!(Math.abs(fr.y - expectedY) <= TOLERANCE)) {
        throw new Error(`S4 correct target: frame ${f} forward y ${fr.y}, expected ${expectedY}`);
      }
      if (!(Math.abs(fw.y - fr.y) > 0.1)) {
        throw new Error(`S4 teeth: frame ${f} wrong and correct forward y are too close (${fw.y}, ${fr.y})`);
      }
    }
  });
});
