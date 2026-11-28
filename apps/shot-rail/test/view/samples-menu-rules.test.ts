// Sample loading tests (task 40.2). Node only: samples-menu-rules.ts and camera-rig.ts import no DOM and no Three.js.
// Expected values are hand-written literals from the design's Samples table, not read from SAMPLE_SHOTS.
//
// Not covered here (needs main.ts and the Timeline, which need the DOM): "timeline.seekTo(0) puts the frame at 0"
// and "the app starts at frame 0". The pure module only guarantees the settings; the rig guarantees playing is
// false after a re-bake and leaves the frame alone. Frame 0 after a load is left to the 40.3 browser checkpoint.
//
// Source line it should catch:
//  - in sampleToSettings, add `railShotWhenMain: 'push-in'` (or spread a camera) to the camera: "no railShotWhenMain" fails.
//  - replace `roadPoints.map(...)` with `roadPoints as Vec3[]`: "copies the road points" fails.
//  - set mainCameraId to something other than SAMPLE_CAMERA_ID: "one main camera" fails.
//  - in CameraRig.bake, remove `this.playing = false;`: "a load from a playing state" fails.

import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../src/logic/pathkit.js';
import { SAMPLE_SHOTS } from '../../src/logic/samples.js';
import type { SampleShot } from '../../src/logic/samples.js';
import { DEFAULT_ROAD_POINTS } from '../../src/logic/default-road.js';
import { CameraRig } from '../../src/view/camera-rig.js';
import type { RigSettings, SubjectKind } from '../../src/view/camera-rig.js';
import {
  SAMPLE_CAMERA_ID,
  STARTUP_SAMPLE_INDEX,
  sampleLoadedMessage,
  sampleToSettings,
} from '../../src/view/samples-menu-rules.js';

interface Expected {
  index: number;
  shotType: string;
  bearingDeg: number;
  heightM: number;
  horizontalDistanceM: number;
  lensMm: number;
  shotLengthFrames: number;
}

// Hand-written from the design's Samples table. Shot length is 240 for all three.
const EXPECTED: readonly Expected[] = [
  { index: 0, shotType: 'orbit', bearingDeg: 0, heightM: 1.5, horizontalDistanceM: 8, lensMm: 35, shotLengthFrames: 240 },
  { index: 1, shotType: 'push-in', bearingDeg: 30, heightM: -0.3, horizontalDistanceM: 12, lensMm: 50, shotLengthFrames: 240 },
  { index: 2, shotType: 'crane', bearingDeg: 180, heightM: 0.5, horizontalDistanceM: 10, lensMm: 35, shotLengthFrames: 240 },
];

const TABLE = EXPECTED.map((e) => [e.index, e] as const);

// A small hand-written road with distinct values, for the copy checks.
function smallRoad(): Vec3[] {
  return [
    { x: 1, y: 0.5, z: 2 },
    { x: 3, y: 0.5, z: 4 },
    { x: 5, y: 0.5, z: 6 },
    { x: 7, y: 0.5, z: 8 },
  ];
}

function defaultRoadCopy(): Vec3[] {
  return DEFAULT_ROAD_POINTS.map((p) => ({ x: p.x, y: p.y, z: p.z }));
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
}

describe('sampleToSettings', () => {
  it.each(TABLE)('sample %i gives one main camera cam-1 with its shot type, placement, lens and shot length', (index, e) => {
    const settings = sampleToSettings(SAMPLE_SHOTS[index], smallRoad(), 'car');
    expect(settings.shotLengthFrames).toBe(e.shotLengthFrames);
    expect(settings.mainCameraId).toBe('cam-1');
    expect(settings.cameras.length).toBe(1);
    const cam = settings.cameras[0];
    expect(cam.id).toBe('cam-1');
    expect(cam.id).toBe(settings.mainCameraId);
    expect(cam.shotType).toBe(e.shotType);
    expect(cam.bearingDeg).toBe(e.bearingDeg);
    expect(cam.heightM).toBe(e.heightM);
    expect(cam.horizontalDistanceM).toBe(e.horizontalDistanceM);
    expect(cam.lensMm).toBe(e.lensMm);
    expect(settings.road.closed).toBe(true);
  });

  it.each(TABLE)('sample %i camera has exactly the six named keys and no railShotWhenMain', (index) => {
    const cam = sampleToSettings(SAMPLE_SHOTS[index], smallRoad(), 'car').cameras[0];
    expect('railShotWhenMain' in cam).toBe(false);
    expect(Object.keys(cam).sort()).toEqual(
      ['bearingDeg', 'heightM', 'horizontalDistanceM', 'id', 'lensMm', 'shotType'],
    );
  });

  it('copies the road points: new array, new objects, equal values, and editing the result leaves the input alone', () => {
    const input = smallRoad();
    const settings = sampleToSettings(SAMPLE_SHOTS[0], input, 'car');
    const out = settings.road.points;
    expect(out).not.toBe(input);
    expect(out.length).toBe(4);
    expect(out[0]).toEqual({ x: 1, y: 0.5, z: 2 });
    expect(out[3]).toEqual({ x: 7, y: 0.5, z: 8 });
    for (let i = 0; i < input.length; i++) {
      if (out[i] === input[i]) throw new Error(`road point ${i} is the same object as the input point`);
      if (out[i].x !== input[i].x || out[i].y !== input[i].y || out[i].z !== input[i].z) {
        throw new Error(`road point ${i} differs from the input`);
      }
    }
    out[0].x = 99;
    out.push({ x: 0, y: 0, z: 0 });
    expect(input.length).toBe(4);
    expect(input[0]).toEqual({ x: 1, y: 0.5, z: 2 });
  });

  it('passes subjectKind car through unchanged', () => {
    const kind: SubjectKind = 'car';
    expect(sampleToSettings(SAMPLE_SHOTS[0], smallRoad(), kind).subjectKind).toBe(kind);
  });

  it('does not mutate the sample or the road (both deep-frozen, so a write would throw)', () => {
    const sample: SampleShot = deepFreeze({
      name: 'Frozen sample',
      shotType: 'push-in',
      placement: { bearingDeg: 30, heightM: -0.3, horizontalDistanceM: 12, lensMm: 50 },
      shotLengthFrames: 240,
    });
    const road = deepFreeze(smallRoad());
    const settings = sampleToSettings(sample, road, 'car');
    expect(settings.cameras[0].shotType).toBe('push-in');
    expect(settings.cameras[0].bearingDeg).toBe(30);
    expect(road.length).toBe(4);
    expect(road[2]).toEqual({ x: 5, y: 0.5, z: 6 });
    expect(sample.placement).toEqual({ bearingDeg: 30, heightM: -0.3, horizontalDistanceM: 12, lensMm: 50 });
  });
});

describe('loading a sample through CameraRig', () => {
  it.each(TABLE)('sample %i validates and bakes with the default road (tick ok, cam-1 evaluates)', (index) => {
    const rig = new CameraRig();
    rig.setSettings(sampleToSettings(SAMPLE_SHOTS[index], defaultRoadCopy(), 'car'));
    const outcome = rig.tick();
    expect(outcome).not.toBeNull();
    expect(outcome?.ok).toBe(true);
    expect(rig.bakeCount).toBe(1);
    const out = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
    rig.evaluate('cam-1', 0, out);
    rig.evaluate('cam-1', 239, out);
    expect(Number.isFinite(out.position.x) && Number.isFinite(out.position.y) && Number.isFinite(out.position.z)).toBe(true);
  });

  it.each(TABLE)('a load from a playing state (playing, frame 100) leaves sample %i paused after the re-bake', (index) => {
    const rig = new CameraRig();
    const first: RigSettings = sampleToSettings(SAMPLE_SHOTS[0], defaultRoadCopy(), 'car');
    rig.setSettings(first);
    rig.tick();
    rig.setPlaying(true);
    rig.setDisplayedFrame(100);
    expect(rig.isPlaying()).toBe(true);

    rig.setSettings(sampleToSettings(SAMPLE_SHOTS[index], defaultRoadCopy(), 'car'));
    const outcome = rig.tick();
    expect(outcome?.ok).toBe(true);
    expect(outcome?.playing).toBe(false);
    expect(rig.isPlaying()).toBe(false);
  });
});

describe('sample loading text and constants', () => {
  it('sampleLoadedMessage gives the exact status line for the orbit sample', () => {
    const sample: SampleShot = {
      name: 'Orbit around the car',
      shotType: 'orbit',
      placement: { bearingDeg: 0, heightM: 1.5, horizontalDistanceM: 8, lensMm: 35 },
      shotLengthFrames: 240,
    };
    expect(sampleLoadedMessage(sample)).toBe(
      'Loaded the sample shot "Orbit around the car". The timeline is paused at frame 0.',
    );
  });

  it('the startup sample is the first one and the sample camera id is cam-1', () => {
    expect(STARTUP_SAMPLE_INDEX).toBe(0);
    expect(SAMPLE_CAMERA_ID).toBe('cam-1');
  });
});
