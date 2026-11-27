// CameraRig.evaluateSubject tests (task 30.1). Node only: camera-rig.ts imports no Three.js and touches no DOM.
//
// Expected values are worked out by hand in the comments, or come from a solo bake through the logic
// modules (createCurve, createArcLengthTable, bake, evaluateEntity, buildKeyframedTarget), never from
// evaluateSubject itself.
//
// Frame remap by hand (LAP_FRAMES 240, BAKED_LAP_FRAMES 1920, EASE_AMPLITUDE 0.5):
//   u = f / 240, s = u + 0.5 sin(2 pi u) / (2 pi), baked = min(round(1920 s), 1919)
//   f = 0:   u = 0, sin 0 = 0, s = 0, baked 0.
//   f = 120: u = 0.5, sin pi = 0, s = 0.5, 1920 * 0.5 = 960, baked 960.
//   f = 239: u = 239/240, 2 pi u = 2 pi - 2 pi/240, sin = -sin(0.0261799) = -0.0261769.
//            0.5 * (-0.0261769) / (2 pi) = -0.0020831, s = 0.9958333 - 0.0020831 = 0.9937502.
//            1920 * 0.9937502 = 1908.0004, rounds to 1908.
//
// Source line it should catch (one per test, in order):
//   1. delete the `baked === null` check in evaluateSubject (a TypeError is thrown, not the clear message).
//   2. and 3. call evaluateEntity(baked, SUBJECT_ENTITY_ID, displayedFrame, out) without remap(...)
//      (frame 239 reads baked frame 239 and frame 120 reads 120, not 1908 and 960).
//   4. use a different ease amplitude than the camera targets use (the keyframe comparison differs).
//   5. leave this.subjectBaked unchanged when the Road changes (frame 0 stays at (22, 0.7, 0)).
//   6. make subjectKey include the lens, or rebake the subject on every bake (subjectBakeCount becomes 2).
//   7. delete the Number.isInteger part of the range check, or round the frame first (1.5 no longer throws).
//      Delete `displayedFrame >= 0` (-1 no longer throws, or throws a different message).
//      Delete the `< this.bakedShotLength` part, or use a hard-coded 240 (frame 240 wraps and does not
//      throw; the 120-frame case fails). Use `<=` (frame = shot length does not throw).
//   8. change the message text or the "- 1" in the upper limit (message differs from evaluate()).
//   9. write into `out` before the check (the buffer no longer matches the sentinel copy).
//  10. use `> 239`-style off-by-one on the limit (frame 239 or 119 would throw).

import { describe, expect, it } from 'vitest';
import { bake, createArcLengthTable, createCurve, evaluateEntity, rotateVec } from '../../src/logic/pathkit.js';
import type { BakedData, OutBuffer, Scene, Vec3 } from '../../src/logic/pathkit.js';
import {
  BAKE_FPS,
  BAKED_LAP_FRAMES,
  CAR_FORWARD_AXIS,
  CAR_UP_AXIS,
  EASE_AMPLITUDE,
  LAP_FRAMES,
  LAP_SECONDS,
  SUBJECT_ENTITY_ID,
} from '../../src/logic/constants.js';
import { DEFAULT_ROAD_POINTS } from '../../src/logic/default-road.js';
import { remapDisplayedFrame } from '../../src/logic/frame-remap.js';
import { buildKeyframedTarget } from '../../src/logic/target-converter.js';
import { CameraRig } from '../../src/view/camera-rig.js';
import type { CameraSetting, RigSettings } from '../../src/view/camera-rig.js';

const SHOT_FRAMES = 240;
const TOLERANCE = 1e-6;
const EXACT = 1e-9;

const ORBIT_CAM: CameraSetting = {
  id: 'cam-1',
  shotType: 'orbit',
  bearingDeg: 0,
  heightM: 1.5,
  horizontalDistanceM: 8,
  lensMm: 35,
};

function roadCopy(): Vec3[] {
  return DEFAULT_ROAD_POINTS.map((p) => ({ x: p.x, y: p.y, z: p.z }));
}

function makeSettings(overrides: Partial<RigSettings> = {}): RigSettings {
  return {
    shotLengthFrames: SHOT_FRAMES,
    mainCameraId: 'cam-1',
    cameras: [{ ...ORBIT_CAM }],
    road: { points: roadCopy(), closed: true },
    subjectKind: 'car',
    ...overrides,
  };
}

function makeOut(): OutBuffer {
  return { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
}

function remap(displayedFrame: number): number {
  return remapDisplayedFrame(displayedFrame, LAP_FRAMES, BAKED_LAP_FRAMES, EASE_AMPLITUDE);
}

// Independent subject bake: one lap at 240 fps along the given road (same recipe as the spikes).
function soloSubject(points: Vec3[]): BakedData {
  const roadLength = createArcLengthTable(createCurve(points, true)).length;
  const scene: Scene = {
    fps: BAKE_FPS,
    frameCount: BAKED_LAP_FRAMES,
    path: { points, closed: true },
    targets: {},
    entities: [
      {
        id: SUBJECT_ENTITY_ID,
        forwardAxis: CAR_FORWARD_AXIS,
        upAxis: CAR_UP_AXIS,
        constraints: [
          { type: 'followPath', order: 0, influence: 1, speed: roadLength / LAP_SECONDS, startOffset: 0, alignToPath: true },
        ],
      },
    ],
  };
  return bake(scene);
}

function bakedRig(settings: RigSettings): CameraRig {
  const rig = new CameraRig();
  rig.setSettings(settings);
  const outcome = rig.tick();
  if (outcome === null || !outcome.ok) {
    throw new Error(`bakedRig: the bake did not work: ${outcome === null ? 'tick returned null' : String(outcome.message)}`);
  }
  return rig;
}

function expectNear(actual: number, expected: number, tolerance: number, label: string): void {
  if (!(Math.abs(actual - expected) < tolerance)) {
    throw new Error(`${label}: expected ${expected} (within ${tolerance}), got ${actual}`);
  }
}

function expectInside(actual: number, low: number, high: number, label: string): void {
  if (!(actual > low && actual < high)) {
    throw new Error(`${label}: expected a value between ${low} and ${high}, got ${actual}`);
  }
}

describe('CameraRig evaluateSubject', () => {
  it('throws a clear error before the first bake, and after a bake that failed', () => {
    const fresh = new CameraRig();
    expect(() => fresh.evaluateSubject(0, makeOut())).toThrow(/subject has not been baked yet/);

    // A Road with 2 points is refused, so nothing is ever baked and the rig still has no subject.
    const refused = new CameraRig();
    refused.setSettings(makeSettings({ road: { points: roadCopy().slice(0, 2), closed: true } }));
    expect(refused.tick()?.ok).toBe(false);
    expect(() => refused.evaluateSubject(0, makeOut())).toThrow(/subject has not been baked yet/);
  });

  it('first and last displayed frames: frame 0 is the Road first point, frame 239 is baked frame 1908', () => {
    const rig = bakedRig(makeSettings());
    const out = makeOut();

    // Frame 0 -> baked frame 0 -> distance 0 -> the Road's first point (22, 0.7, 0), heading +Z.
    // Heading: the Catmull-Rom tangent at point 0 is parallel to (point 1 - point 11)
    // = (19.05 - 19.05, 8 - (-8)) = (0, 16) in x, z, so the unit tangent is (0, 0, 1) and the car
    // forward (+Z) already points that way.
    expect(remap(0)).toBe(0);
    const returned = rig.evaluateSubject(0, out);
    expect(returned).toBe(out); // the same buffer, like evaluate()
    expectNear(out.position.x, 22, EXACT, 'frame 0 x');
    expectNear(out.position.y, 0.7, EXACT, 'frame 0 y');
    expectNear(out.position.z, 0, EXACT, 'frame 0 z');
    const heading0 = rotateVec(out.rotation, { x: 0, y: 0, z: 1 });
    expectNear(heading0.x, 0, TOLERANCE, 'frame 0 heading x');
    expectNear(heading0.y, 0, TOLERANCE, 'frame 0 heading y');
    expectNear(heading0.z, 1, TOLERANCE, 'frame 0 heading z');

    // Frame 239 -> baked frame 1908 (working in the header). The position needs the exact arc length of
    // the Catmull-Rom curve, which is not worked out by hand, so the exact comparison is with a solo bake
    // read at the hand-derived baked frame 1908 (does not call evaluateSubject).
    // Hand sanity: 1908 is 12 baked frames before the lap end, 12/240 s * (L / 8 s) = 0.00625 L before
    // point 0, about 0.75 m for L about 120 m, along the +Z-heading tangent: x just under 22, z about -0.75.
    expect(remap(239)).toBe(1908);
    rig.evaluateSubject(239, out);
    const solo = evaluateEntity(soloSubject(roadCopy()), SUBJECT_ENTITY_ID, 1908, makeOut());
    expectNear(out.position.x, solo.position.x, EXACT, 'frame 239 x vs solo');
    expectNear(out.position.y, solo.position.y, EXACT, 'frame 239 y vs solo');
    expectNear(out.position.z, solo.position.z, EXACT, 'frame 239 z vs solo');
    expectInside(out.position.x, 21.9, 22.0001, 'frame 239 x (hand sanity)');
    expectNear(out.position.y, 0.7, TOLERANCE, 'frame 239 y (flat road)');
    expectInside(out.position.z, -1, -0.5, 'frame 239 z (hand sanity)');
  });

  it('a middle frame: frame 120 is baked frame 960, half way round, at the Road point opposite the start', () => {
    const rig = bakedRig(makeSettings());
    const out = rig.evaluateSubject(120, makeOut());

    // Baked frame 960 (header) is half the lap: distance L/2. The default Road has 12 points and point 6
    // = (-22, 0.7, 0) = minus point 0 in x and z, and every point i + 6 is minus point i, so the loop is
    // symmetric through the origin and point 6 is exactly half way round. Heading there: the tangent at
    // point 6 is parallel to (point 7 - point 5) = (-19.05 - (-19.05), -8 - 8) = (0, -16): unit (0, 0, -1).
    // The arc-length table has 1023 chord steps and t = 0.5 falls inside one step, so the hand value is
    // only good to a few millimetres: bound 0.01 m for position and 0.001 for heading.
    expect(remap(120)).toBe(960);
    expectNear(out.position.x, -22, 0.01, 'frame 120 x (hand)');
    expectNear(out.position.y, 0.7, TOLERANCE, 'frame 120 y (hand)');
    expectNear(out.position.z, 0, 0.01, 'frame 120 z (hand)');
    const heading = rotateVec(out.rotation, { x: 0, y: 0, z: 1 });
    expectNear(heading.x, 0, 0.001, 'frame 120 heading x (hand)');
    expectNear(heading.z, -1, 0.001, 'frame 120 heading z (hand)');

    // Exact comparison with a solo bake at the hand-derived baked frame 960.
    const solo = evaluateEntity(soloSubject(roadCopy()), SUBJECT_ENTITY_ID, 960, makeOut());
    expectNear(out.position.x, solo.position.x, EXACT, 'frame 120 x vs solo');
    expectNear(out.position.y, solo.position.y, EXACT, 'frame 120 y vs solo');
    expectNear(out.position.z, solo.position.z, EXACT, 'frame 120 z vs solo');
  });

  it('gives the same position as the subject keyframes the camera targets use, for every shot frame', () => {
    const rig = bakedRig(makeSettings());
    // Independent route: the keyframed target the camera aims at, built from a solo bake and the same remap.
    const target = buildKeyframedTarget(soloSubject(roadCopy()), SUBJECT_ENTITY_ID, SHOT_FRAMES, remap, 0);
    if (target.keyframes.length !== SHOT_FRAMES) {
      throw new Error(`expected ${SHOT_FRAMES} keyframes, got ${target.keyframes.length}`);
    }
    const out = makeOut();
    for (let f = 0; f < SHOT_FRAMES; f++) {
      rig.evaluateSubject(f, out);
      const k = target.keyframes[f];
      expectNear(out.position.x, k.position.x, EXACT, `frame ${f} x`);
      expectNear(out.position.y, k.position.y, EXACT, `frame ${f} y`);
      expectNear(out.position.z, k.position.z, EXACT, `frame ${f} z`);
    }
  });

  it('follows a new Road after an edit: frame 0 is the new first point', () => {
    const rig = bakedRig(makeSettings());
    const before = rig.evaluateSubject(0, makeOut());
    expectNear(before.position.x, 22, EXACT, 'before the edit x');

    // A hand-made flat Road of 4 points. At frame 0 the baked frame is 0, distance 0, so the car is at
    // the first point (-7, 0.7, 3) exactly.
    const edited: Vec3[] = [
      { x: -7, y: 0.7, z: 3 },
      { x: 5, y: 0.7, z: -4 },
      { x: 9, y: 0.7, z: 6 },
      { x: -2, y: 0.7, z: 9 },
    ];
    rig.setSettings(makeSettings({ road: { points: edited, closed: true } }));
    const outcome = rig.tick();
    expect(outcome?.ok).toBe(true);
    expect(outcome?.subjectRebaked).toBe(true);
    expect(rig.subjectBakeCount).toBe(2);

    const out = rig.evaluateSubject(0, makeOut());
    expectNear(out.position.x, -7, EXACT, 'after the edit x');
    expectNear(out.position.y, 0.7, EXACT, 'after the edit y');
    expectNear(out.position.z, 3, EXACT, 'after the edit z');
  });

  it('a lens-only change does not bake the subject again, and the car pose is identical', () => {
    // The lens is part of the rig settings (CameraSetting.lensMm), so change only that.
    const rig = bakedRig(makeSettings());
    expect(rig.subjectBakeCount).toBe(1);
    const a = rig.evaluateSubject(77, makeOut());
    const ax = a.position.x;
    const ay = a.position.y;
    const az = a.position.z;
    const aq = [a.rotation.x, a.rotation.y, a.rotation.z, a.rotation.w];

    rig.setSettings(makeSettings({ cameras: [{ ...ORBIT_CAM, lensMm: 85 }] }));
    const outcome = rig.tick();
    expect(outcome?.ok).toBe(true);
    expect(outcome?.subjectRebaked).toBe(false);
    expect(rig.bakeCount).toBe(2); // the camera was baked again
    expect(rig.subjectBakeCount).toBe(1); // the subject was not

    const b = rig.evaluateSubject(77, makeOut());
    expect(b.position.x).toBe(ax);
    expect(b.position.y).toBe(ay);
    expect(b.position.z).toBe(az);
    expect([b.rotation.x, b.rotation.y, b.rotation.z, b.rotation.w]).toEqual(aq);
  });

  function thrownMessage(fn: () => unknown, label: string): string {
    try {
      fn();
    } catch (e) {
      if (!(e instanceof Error)) throw new Error(`${label}: threw a non-Error`);
      return e.message;
    }
    throw new Error(`${label}: did not throw`);
  }

  function sentinelOut(): OutBuffer {
    return { position: { x: 11, y: 12, z: 13 }, rotation: { x: 0.1, y: 0.2, z: 0.3, w: 0.4 } };
  }

  function values(o: OutBuffer): number[] {
    return [o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.rotation.w];
  }

  it('a bad frame (-1, 1.5, NaN, Infinity, the shot length) throws the same message as evaluate() and leaves the buffer alone', () => {
    const rig = bakedRig(makeSettings());
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, SHOT_FRAMES]) {
      const expected = thrownMessage(() => rig.evaluate('cam-1', bad, makeOut()), `evaluate(${bad})`);
      const out = sentinelOut();
      const before = values(out);
      const actual = thrownMessage(() => rig.evaluateSubject(bad, out), `evaluateSubject(${bad})`);
      expect(actual, `message for ${bad}`).toBe(expected);
      expect(values(out), `buffer after ${bad}`).toEqual(before);
    }
  });

  it('the last frame, 239, still works with a 240-frame shot', () => {
    const rig = bakedRig(makeSettings());
    const out = sentinelOut();
    expect(() => rig.evaluateSubject(SHOT_FRAMES - 1, out)).not.toThrow();
    expectNear(out.position.y, 0.7, TOLERANCE, 'frame 239 y');
  });

  it('with a 120-frame shot, frame 120 throws the same message as evaluate() and frame 119 works', () => {
    const rig = bakedRig(makeSettings());
    rig.setSettings(makeSettings({ shotLengthFrames: 120 }));
    expect(rig.tick()?.ok).toBe(true);
    const expected = thrownMessage(() => rig.evaluate('cam-1', 120, makeOut()), 'evaluate(120)');
    const out = sentinelOut();
    const before = values(out);
    expect(thrownMessage(() => rig.evaluateSubject(120, out), 'evaluateSubject(120)')).toBe(expected);
    expect(values(out)).toEqual(before);
    expect(() => rig.evaluateSubject(119, out)).not.toThrow();
    expectNear(out.position.y, 0.7, TOLERANCE, 'frame 119 y');
  });
});
