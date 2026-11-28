// CameraRig tests (task 28.2). Node only: camera-rig.ts imports no Three.js and touches no DOM.
// Expected values are written by hand, or come from a solo bake through the logic modules
// (subject bake -> buildKeyframedTarget -> buildSceneSet -> bake -> motionLinter), not from CameraRig.
//
// Source line it should catch: call this.bake(this.pending) inside markDirty() instead of at tick()
// (the "five markDirty calls" test fails: bakeCount is 5 or 1 before the tick), or return a new object
// from evaluate() instead of `out` (the "same buffer for 1000 calls" test fails).

import { describe, expect, it } from 'vitest';
import { bake, createArcLengthTable, createCurve, evaluateEntity, motionLinter, rotateVec } from '../../src/logic/pathkit.js';
import type { BakedData, Finding, OutBuffer, Scene, Vec3 } from '../../src/logic/pathkit.js';
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
import { buildSceneSet } from '../../src/logic/scene-set.js';
import { buildKeyframedTarget } from '../../src/logic/target-converter.js';
import { CameraRig, RebakeScheduler } from '../../src/view/camera-rig.js';
import type { CameraSetting, RigSettings } from '../../src/view/camera-rig.js';

const SHOT_FRAMES = 240;
const TOLERANCE = 1e-6;

const ORBIT_CAM: CameraSetting = {
  id: 'cam-1',
  shotType: 'orbit',
  bearingDeg: 0,
  heightM: 1.5,
  horizontalDistanceM: 8,
  lensMm: 35,
};

// Radius 3 m and height 100 m: the aim from this camera to the subject is within 3 degrees of straight
// down (3/100 = 0.03 < tan 3 deg = 0.0524), so motionLinter reports 'aim-vertical' on every frame.
const OVERHEAD_CAM: CameraSetting = {
  id: 'cam-2',
  shotType: 'tracking',
  bearingDeg: 90,
  heightM: 100,
  horizontalDistanceM: 3,
  lensMm: 24,
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

// Independent subject bake: one lap at 240 fps along the default road (same recipe as the spikes).
function soloSubject(): BakedData {
  const roadLength = createArcLengthTable(createCurve(roadCopy(), true)).length;
  const scene: Scene = {
    fps: BAKE_FPS,
    frameCount: BAKED_LAP_FRAMES,
    path: { points: roadCopy(), closed: true },
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

// All findings of one camera baked ALONE (a scene with only that camera), through the logic modules.
function soloFindings(cam: CameraSetting): Finding[] {
  const subject = soloSubject();
  const subjectTarget = buildKeyframedTarget(subject, SUBJECT_ENTITY_ID, SHOT_FRAMES, remap, 0);
  const centre = buildKeyframedTarget(subject, SUBJECT_ENTITY_ID, SHOT_FRAMES, remap, cam.heightM);
  const set = buildSceneSet(
    cam.id,
    new Map([
      [
        cam.id,
        {
          shotType: cam.shotType,
          placement: {
            bearingDeg: cam.bearingDeg,
            heightM: cam.heightM,
            horizontalDistanceM: cam.horizontalDistanceM,
            lensMm: cam.lensMm,
          },
        },
      ],
    ]),
    SHOT_FRAMES,
    subjectTarget,
    new Map([[cam.id, centre]]),
    null,
  );
  const scene = set.scenes[0].scene;
  return motionLinter(scene, bake(scene)).filter((f) => f.entityId === cam.id);
}

// Subject position at a displayed frame, read from an independent solo bake with the same remap as camera-rig.ts.
function subjectAtDisplayed(subject: BakedData, f: number): Vec3 {
  const out = evaluateEntity(subject, SUBJECT_ENTITY_ID, remap(f), makeOut());
  return { x: out.position.x, y: out.position.y, z: out.position.z };
}

// Runs setSettings and tick; throws unless the bake worked. Returns the rig.
function bakedRig(cameras: CameraSetting[], mainId: string): CameraRig {
  const rig = new CameraRig();
  rig.setSettings(makeSettings({ mainCameraId: mainId, cameras }));
  const outcome = rig.tick();
  if (outcome === null || !outcome.ok) {
    throw new Error(`bakedRig: the bake did not work: ${outcome === null ? 'tick returned null' : String(outcome.message)}`);
  }
  return rig;
}

function expectNear(actual: number, expected: number, label: string): void {
  if (!(Math.abs(actual - expected) < TOLERANCE)) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

describe('RebakeScheduler', () => {
  it('starts clean, and five markDirty calls give exactly one consume() that returns true', () => {
    const s = new RebakeScheduler();
    expect(s.isDirty()).toBe(false);
    expect(s.consume()).toBe(false);
    for (let i = 0; i < 5; i++) s.markDirty();
    expect(s.isDirty()).toBe(true);
    expect(s.consume()).toBe(true);
    expect(s.consume()).toBe(false);
    expect(s.isDirty()).toBe(false);
  });
});

describe('CameraRig scheduling', () => {
  it('five markDirty calls in one frame give one bake, at the tick', () => {
    const rig = new CameraRig();
    rig.setSettings(makeSettings());
    for (let i = 0; i < 5; i++) rig.markDirty();
    expect(rig.bakeCount).toBe(0); // nothing baked by setSettings or markDirty
    const first = rig.tick();
    expect(first).not.toBeNull();
    expect(first?.ok).toBe(true);
    expect(rig.bakeCount).toBe(1);
    expect(rig.tick()).toBeNull(); // the next frame has nothing to do
    expect(rig.bakeCount).toBe(1);
  });

  it('a camera-only change does not rebake the subject', () => {
    const rig = new CameraRig();
    rig.setSettings(makeSettings());
    const first = rig.tick();
    expect(first?.subjectRebaked).toBe(true);
    expect(rig.subjectBakeCount).toBe(1);

    rig.setSettings(makeSettings({ cameras: [{ ...ORBIT_CAM, bearingDeg: 90, lensMm: 50 }] }));
    const second = rig.tick();
    expect(second?.ok).toBe(true);
    expect(second?.subjectRebaked).toBe(false);
    expect(rig.bakeCount).toBe(2);
    expect(rig.subjectBakeCount).toBe(1);
  });

  it('a Road change rebakes the subject', () => {
    const rig = new CameraRig();
    rig.setSettings(makeSettings());
    rig.tick();
    expect(rig.subjectBakeCount).toBe(1);

    const moved = roadCopy();
    moved[0] = { x: 23, y: moved[0].y, z: moved[0].z }; // first point 1 m further out, still flat
    rig.setSettings(makeSettings({ road: { points: moved, closed: true } }));
    const second = rig.tick();
    expect(second?.ok).toBe(true);
    expect(second?.subjectRebaked).toBe(true);
    expect(rig.subjectBakeCount).toBe(2);
    expect(rig.bakeCount).toBe(2);
  });

  it('after a bake the play state is paused and the displayed frame is unchanged', () => {
    const rig = new CameraRig();
    rig.setSettings(makeSettings());
    rig.tick();
    rig.setPlaying(true);
    rig.setDisplayedFrame(37);
    expect(rig.isPlaying()).toBe(true);

    rig.setSettings(makeSettings({ cameras: [{ ...ORBIT_CAM, heightM: 3 }] }));
    const outcome = rig.tick();
    expect(outcome?.ok).toBe(true);
    expect(outcome?.playing).toBe(false);
    expect(outcome?.displayedFrame).toBe(37);
    expect(rig.isPlaying()).toBe(false);
    expect(rig.displayedFrame()).toBe(37);
  });
});

describe('CameraRig evaluate', () => {
  it('returns the buffer it was given, and keeps its inner objects, for 1000 calls', () => {
    const rig = new CameraRig();
    rig.setSettings(makeSettings());
    rig.tick();
    const out = makeOut();
    const position = out.position;
    const rotation = out.rotation;
    for (let i = 0; i < 1000; i++) {
      const frame = i % SHOT_FRAMES;
      const returned = rig.evaluate('cam-1', frame, out);
      if (returned !== out) throw new Error(`evaluate call ${i} (frame ${frame}) returned a different object`);
      if (out.position !== position || out.rotation !== rotation) {
        throw new Error(`evaluate call ${i} (frame ${frame}) replaced the position or rotation object`);
      }
    }
  });

  it('writes the orbit camera at frame 0 to (22, 2.2, 8): subject (22, 0.7, 0), raised 1.5, 8 m along +Z', () => {
    const rig = new CameraRig();
    rig.setSettings(makeSettings());
    rig.tick();
    const out = rig.evaluate('cam-1', 0, makeOut());
    expect(Math.abs(out.position.x - 22)).toBeLessThan(TOLERANCE);
    expect(Math.abs(out.position.y - 2.2)).toBeLessThan(TOLERANCE);
    expect(Math.abs(out.position.z - 8)).toBeLessThan(TOLERANCE);
  });

  it('throws an error naming a camera that was never baked', () => {
    const rig = new CameraRig();
    rig.setSettings(makeSettings());
    rig.tick();
    expect(() => rig.evaluate('cam-9', 0, makeOut())).toThrow(/cam-9/);
  });
});

describe('CameraRig errors', () => {
  it.each([0, 10.5, -5])(
    'shot length %s: the error comes back as a message and the last good bake stays',
    (badLength) => {
      const rig = new CameraRig();
      rig.setSettings(makeSettings());
      rig.tick();
      const before = rig.evaluate('cam-1', 0, makeOut());
      const x = before.position.x;
      const y = before.position.y;
      const z = before.position.z;

      rig.setSettings(makeSettings({ shotLengthFrames: badLength }));
      const outcome = rig.tick(); // must not throw
      expect(outcome).not.toBeNull();
      expect(outcome?.ok).toBe(false);
      const message = outcome?.message ?? '';
      expect(message).toContain('the camera move could not be built'); // what failed
      expect(message).toContain(`got ${badLength}`); // the bad value
      expect(message).toContain('Try a different setting'); // what to do next

      expect(rig.bakeCount).toBe(1);
      expect(rig.subjectBakeCount).toBe(1);
      const after = rig.evaluate('cam-1', 0, makeOut());
      expect(after.position.x).toBe(x);
      expect(after.position.y).toBe(y);
      expect(after.position.z).toBe(z);
    },
  );

  it('a main camera that is not in the cameras comes back as a message naming it', () => {
    const rig = new CameraRig();
    rig.setSettings(makeSettings({ mainCameraId: 'cam-9' }));
    const outcome = rig.tick();
    expect(outcome?.ok).toBe(false);
    expect(outcome?.message).toContain('cam-9');
    expect(outcome?.message).toContain('Try a different setting');
    expect(rig.bakeCount).toBe(0);
  });

  it('a Road with 2 points comes back as the Road message and nothing is baked', () => {
    const rig = new CameraRig();
    rig.setSettings(makeSettings({ road: { points: roadCopy().slice(0, 2), closed: true } }));
    const outcome = rig.tick();
    expect(outcome?.ok).toBe(false);
    expect(outcome?.message).toBe('The road has 2 points. It needs 3 to 100 points.');
    expect(rig.bakeCount).toBe(0);
    expect(rig.subjectBakeCount).toBe(0);
  });
});

describe('CameraRig findings', () => {
  it('keeps only the main camera findings: other cameras are dropped (main cam-1)', () => {
    // Precondition from a solo bake: the overhead camera really has findings, so dropping them means something.
    const overheadSolo = soloFindings(OVERHEAD_CAM);
    expect(overheadSolo.length).toBeGreaterThan(0);
    expect(overheadSolo.some((f) => f.code === 'aim-vertical')).toBe(true);

    const rig = new CameraRig();
    rig.setSettings(makeSettings({ cameras: [{ ...ORBIT_CAM }, { ...OVERHEAD_CAM }] }));
    expect(rig.tick()?.ok).toBe(true);
    const found = rig.findingsForMain();
    for (let i = 0; i < found.length; i++) {
      if (found[i].entityId !== 'cam-1') {
        throw new Error(`finding ${i} is for "${found[i].entityId}" (${found[i].code}), not the main camera`);
      }
    }
    expect(found).toEqual(soloFindings(ORBIT_CAM));
  });

  it('keeps the findings of whichever camera is main (main cam-2)', () => {
    const expected = soloFindings(OVERHEAD_CAM);
    expect(expected.length).toBeGreaterThan(0);

    const rig = new CameraRig();
    rig.setSettings(
      makeSettings({ mainCameraId: 'cam-2', cameras: [{ ...ORBIT_CAM }, { ...OVERHEAD_CAM }] }),
    );
    expect(rig.tick()?.ok).toBe(true);
    const found = rig.findingsForMain();
    for (let i = 0; i < found.length; i++) {
      if (found[i].entityId !== 'cam-2') {
        throw new Error(`finding ${i} is for "${found[i].entityId}" (${found[i].code}), not the main camera`);
      }
    }
    expect(found).toEqual(expected);
  });
});

describe('CameraRig extra checks (task 28.2 extension)', () => {
  it('markDirty on a new rig with no settings: tick() returns null and nothing is baked', () => {
    const rig = new CameraRig();
    rig.markDirty();
    expect(rig.tick()).toBeNull();
    expect(rig.bakeCount).toBe(0);
  });

  it('orbit with bearing 90: the camera sits 8 m from the subject at (90 + 0.75 f) degrees, 1.5 m up (frames 0, 120, 239)', () => {
    const subject = soloSubject();
    const rig = bakedRig([{ ...ORBIT_CAM, bearingDeg: 90 }], 'cam-1');
    for (const f of [0, 120, 239]) {
      const a = ((90 + 0.75 * f) * Math.PI) / 180;
      const s = subjectAtDisplayed(subject, f);
      const c = rig.evaluate('cam-1', f, makeOut()).position;
      expectNear(c.x - s.x, 8 * Math.sin(a), `frame ${f} x offset`);
      expectNear(c.y - s.y, 1.5, `frame ${f} y offset`);
      expectNear(c.z - s.z, 8 * Math.cos(a), `frame ${f} z offset`);
    }
  });

  it('orbit aim at frame 0: the camera forward (0, 0, -1) rotates to point at the subject', () => {
    const rig = bakedRig([{ ...ORBIT_CAM }], 'cam-1');
    const out = rig.evaluate('cam-1', 0, makeOut());
    expectNear(out.position.x, 22, 'camera x');
    expectNear(out.position.y, 2.2, 'camera y');
    expectNear(out.position.z, 8, 'camera z');
    const forward = rotateVec(out.rotation, { x: 0, y: 0, z: -1 });
    const norm = Math.sqrt(1.5 * 1.5 + 8 * 8);
    expectNear(forward.x, 0, 'forward x');
    expectNear(forward.y, -1.5 / norm, 'forward y');
    expectNear(forward.z, -8 / norm, 'forward z');
  });

  it('crane (bearing 90, distance 10, height 2): x = 32, z = 0, y = 2.7 + 6 f / 240 (frames 0, 120, 239)', () => {
    const rig = bakedRig([{ ...ORBIT_CAM, shotType: 'crane', bearingDeg: 90, horizontalDistanceM: 10, heightM: 2 }], 'cam-1');
    for (const f of [0, 120, 239]) {
      const p = rig.evaluate('cam-1', f, makeOut()).position;
      expectNear(p.x, 32, `frame ${f} x`);
      expectNear(p.y, 2.7 + (6 * f) / 240, `frame ${f} y`);
      expectNear(p.z, 0, `frame ${f} z`);
    }
  });

  it('push-in with the same placement starts at (32, 2.7, 0) at frame 0', () => {
    const rig = bakedRig([{ ...ORBIT_CAM, shotType: 'push-in', bearingDeg: 90, horizontalDistanceM: 10, heightM: 2 }], 'cam-1');
    const p = rig.evaluate('cam-1', 0, makeOut()).position;
    expectNear(p.x, 32, 'x');
    expectNear(p.y, 2.7, 'y');
    expectNear(p.z, 0, 'z');
  });

  it('placementOf: a baked camera is in scene 0 of a 240-frame bake, and an unknown camera throws naming it', () => {
    const rig = bakedRig([{ ...ORBIT_CAM }], 'cam-1');
    const placement = rig.placementOf('cam-1');
    expect(placement.sceneIndexInSet).toBe(0);
    expect(placement.bakedScene.frameCount).toBe(240);
    expect(() => rig.placementOf('cam-9')).toThrow(/cam-9/);
  });
});
