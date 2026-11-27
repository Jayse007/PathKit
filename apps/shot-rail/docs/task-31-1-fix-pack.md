# Task 31.1 fix pack (Shot Rail)

Save as `apps/shot-rail/docs/task-31-1-fix-pack.md`.

## 1. Why

The last commit adds a push-in camera and a crane camera next to the main camera in `main.ts`. `scene-set.ts` allows a rail shot (push-in or crane) on the main camera only, so the bake fails and the app shows an error with empty views. The fix makes the push-in the main camera, so the overview shows its rail, and keeps the orbit as a second, non-rail camera.

## 2. Edit `apps/shot-rail/src/main.ts`

- Change `const sample = SAMPLE_SHOTS[0];` to `const sample = SAMPLE_SHOTS[1];` (the push-in).
- Replace the comment and the `cameras:` list in `settings` with:

```ts
    // cam-1 is the main camera and is the push-in sample, so the Stage_Overview shows its rail. Only the main
    // camera can be a rail shot (scene-set.ts), so cam-2 is the orbit sample. Remove both when the camera list
    // (task 35) takes over.
    cameras: [
      { id: CAMERA_IDS[0], shotType: sample.shotType, ...sample.placement },
      { id: CAMERA_IDS[1], shotType: SAMPLE_SHOTS[0].shotType, ...SAMPLE_SHOTS[0].placement },
    ],
```

- `CAMERA_ID` must still equal `CAMERA_IDS[0]` (`'cam-1'`). Change nothing else in the file.

## 3. New file `apps/shot-rail/test/view/stage-overview-framing.test.ts` (copy exactly)

```ts
// Stage_Overview framing maths (task 31.1). Node only: stage-overview-framing.ts imports no Three.js and no DOM.
// Expected values are worked out by hand, shown beside each case.
//
// Source lines it should catch:
// - in computeTopDownFraming, leave out the margin, the aspect or the minimum size, or centre on the origin;
// - in extendRailEnd, drop the N / (N - 1) scale, or write a new object instead of `out`;
// - the last test fails if the rail-end formula stops matching the rails the shot builders really make.

import { describe, expect, it } from 'vitest';
import { DEFAULT_ROAD_POINTS } from '../../src/logic/default-road.js';
import { CRANE_RISE_M } from '../../src/logic/constants.js';
import type { OutBuffer, Vec3 } from '../../src/logic/pathkit.js';
import { SAMPLE_SHOTS } from '../../src/logic/samples.js';
import { CameraRig } from '../../src/view/camera-rig.js';
import { computeTopDownFraming, extendRailEnd } from '../../src/view/stage-overview-framing.js';

describe('computeTopDownFraming', () => {
  it('points (0,0) and (10,0), aspect 1, margin 0.1: centre (5,0), half width 5 x 1.1 = 5.5, half height 5.5', () => {
    const f = computeTopDownFraming([{ x: 0, z: 0 }, { x: 10, z: 0 }], 1, 0.1, 1);
    expect(f.centreX).toBeCloseTo(5, 9);
    expect(f.centreZ).toBeCloseTo(0, 9);
    expect(f.halfWidth).toBeCloseTo(5.5, 9);
    expect(f.halfHeight).toBeCloseTo(5.5, 9);
  });

  it('a tall spread with aspect 2 and no margin: z from 0 to 20 needs half height 10, so half width 20', () => {
    const f = computeTopDownFraming([{ x: 0, z: 0 }, { x: 0, z: 20 }], 2, 0, 1);
    expect(f.centreZ).toBeCloseTo(10, 9);
    expect(f.halfWidth).toBeCloseTo(20, 9);
    expect(f.halfHeight).toBeCloseTo(10, 9);
  });

  it('a wide spread with aspect 2 and no margin: x from -10 to 10 needs half width 10, so half height 5', () => {
    const f = computeTopDownFraming([{ x: -10, z: -1 }, { x: 10, z: 1 }], 2, 0, 1);
    expect(f.halfWidth).toBeCloseTo(10, 9);
    expect(f.halfHeight).toBeCloseTo(5, 9);
  });

  it('never goes below the minimum: one point (3,4) with minimum half height 10 gives a 10 x 10 box centred on it', () => {
    const f = computeTopDownFraming([{ x: 3, z: 4 }], 1, 0.1, 10);
    expect(f).toEqual({ centreX: 3, centreZ: 4, halfWidth: 10, halfHeight: 10 });
  });

  it('the minimum is a half height, so with aspect 2 the half width is 20', () => {
    const f = computeTopDownFraming([{ x: 0, z: 0 }], 2, 0, 10);
    expect(f.halfWidth).toBeCloseTo(20, 9);
    expect(f.halfHeight).toBeCloseTo(10, 9);
  });

  it('centres on the middle of the bounding box when coordinates are negative: (-4,-6) and (-2,-2) give (-3,-4)', () => {
    const f = computeTopDownFraming([{ x: -4, z: -6 }, { x: -2, z: -2 }], 1, 0, 0.5);
    expect(f.centreX).toBeCloseTo(-3, 9);
    expect(f.centreZ).toBeCloseTo(-4, 9);
  });

  it('with no points it is centred on the origin and as small as the minimum allows', () => {
    expect(computeTopDownFraming([], 1, 0, 10)).toEqual({ centreX: 0, centreZ: 0, halfWidth: 10, halfHeight: 10 });
  });

  it('throws on a point that is not finite', () => {
    expect(() => computeTopDownFraming([{ x: NaN, z: 0 }], 1, 0, 1)).toThrow(/point 0/);
    expect(() => computeTopDownFraming([{ x: 0, z: 0 }, { x: 0, z: Infinity }], 1, 0, 1)).toThrow(/point 1/);
  });

  it('throws on an aspect, minimum half height or margin that is out of range', () => {
    expect(() => computeTopDownFraming([], 0, 0, 1)).toThrow(/aspect/);
    expect(() => computeTopDownFraming([], NaN, 0, 1)).toThrow(/aspect/);
    expect(() => computeTopDownFraming([], 1, 0, 0)).toThrow(/minHalfHeight/);
    expect(() => computeTopDownFraming([], 1, -0.1, 1)).toThrow(/marginFraction/);
  });
});

describe('extendRailEnd', () => {
  const zero = (): Vec3 => ({ x: 0, y: 0, z: 0 });

  it('N = 100: the camera covers 99 / 100 of the rail, so first (1,2,3) and last (100,2,-195) give an end of (101,2,-197)', () => {
    // scale = 100 / 99. x: 1 + 99 x 100/99 = 101. z: 3 + (-198) x 100/99 = -197.
    const end = extendRailEnd({ x: 1, y: 2, z: 3 }, { x: 100, y: 2, z: -195 }, 100, zero());
    expect(end.x).toBeCloseTo(101, 9);
    expect(end.y).toBeCloseTo(2, 9);
    expect(end.z).toBeCloseTo(-197, 9);
  });

  it('N = 2: the last frame is half way along, so the end is twice as far: (5,0,0) gives (10,0,0)', () => {
    const end = extendRailEnd({ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, 2, zero());
    expect(end).toEqual({ x: 10, y: 0, z: 0 });
  });

  it('N below 2 has no movement to extend, so the last position comes back unchanged', () => {
    expect(extendRailEnd({ x: 0, y: 0, z: 0 }, { x: 5, y: 6, z: 7 }, 1, zero())).toEqual({ x: 5, y: 6, z: 7 });
    expect(extendRailEnd({ x: 0, y: 0, z: 0 }, { x: 5, y: 6, z: 7 }, 0, zero())).toEqual({ x: 5, y: 6, z: 7 });
  });

  it('writes into the object it is given and returns that same object', () => {
    const out = zero();
    expect(extendRailEnd({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, 10, out)).toBe(out);
    expect(out.x).toBeCloseTo(10 / 9, 9);
  });

  // The end of the rail is not stored anywhere, so it is rebuilt from two baked positions. These two cases
  // check that rebuilding against the rails the shot builders make (spec: crane rises CRANE_RISE_M; push-in
  // ends at 0.4 of the start offset from the subject at the last frame).
  const o = (): OutBuffer => ({ position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } });
  const bakeMain = (index: 1 | 2): CameraRig => {
    const sample = SAMPLE_SHOTS[index];
    const rig = new CameraRig();
    rig.setSettings({
      shotLengthFrames: 240,
      mainCameraId: 'cam-1',
      cameras: [{ id: 'cam-1', shotType: sample.shotType, ...sample.placement }],
      road: { points: DEFAULT_ROAD_POINTS.map((p) => ({ x: p.x, y: p.y, z: p.z })), closed: true },
      subjectKind: 'car',
    });
    expect(rig.tick()?.ok).toBe(true);
    return rig;
  };
  const positionAt = (rig: CameraRig, frame: number): Vec3 => {
    const p = rig.evaluate('cam-1', frame, o()).position;
    return { x: p.x, y: p.y, z: p.z };
  };

  it('crane: the rebuilt end is exactly CRANE_RISE_M (6 m) straight above the start', () => {
    const rig = bakeMain(2);
    const start = positionAt(rig, 0);
    const end = extendRailEnd(start, positionAt(rig, 239), 240, zero());
    expect(end.x).toBeCloseTo(start.x, 6);
    expect(end.z).toBeCloseTo(start.z, 6);
    expect(end.y - start.y).toBeCloseTo(CRANE_RISE_M, 6);
  });

  it('push-in (bearing 30, 12 m, height -0.3): the rebuilt end is the subject at the last frame plus (2.4, -0.12, 4.1569)', () => {
    // offset x 0.4 x 12 x sin 30 = 2.4. y 0.4 x -0.3 = -0.12. z 0.4 x 12 x cos 30 = 4.15692.
    const rig = bakeMain(1);
    const end = extendRailEnd(positionAt(rig, 0), positionAt(rig, 239), 240, zero());
    const subject = rig.evaluateSubject(239, o()).position;
    expect(end.x - subject.x).toBeCloseTo(2.4, 6);
    expect(end.y - subject.y).toBeCloseTo(-0.12, 6);
    expect(end.z - subject.z).toBeCloseTo(4.15692, 4);
  });
});
```

## 4. Kiro prompt

> Open `apps/shot-rail/docs/task-31-1-fix-pack.md`. Do not research and do not reword.
> 1. Make the edit in section 2.
> 2. Create the test file in section 3, character for character.
> 3. Change no other file. Add one build-notes entry. Stop and report.

I run `npm.cmd test`. Expected: Shot Rail 28 files, 267 passed, 0 skipped (252 + 15 new). Skeleton Bench unchanged.

## 5. Browser check (task 31.2, after the tests pass)

- No message in the status line.
- Main view: the car seen from low down, at 50 mm (the lens menu shows 50 mm).
- Overview: the road ring, the car on its right side, a teal marker with a blue line running from it toward the car, and a small white marker just below the car, closer to it than the teal one.
- Not tested: dragging, resizing the window, other lenses, a Road that cannot make a curve.
