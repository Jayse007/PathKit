// CameraRig: when motionLinter throws, the bake still counts and the camera still evaluates (task 28.2 extension).
// motionLinter is replaced by a function that throws; everything else in pathkit.js is the real module.
// camera-rig.ts imports '../logic/pathkit.js', the same file as '../../src/logic/pathkit.js' from here.
//
// Mutation it catches: remove the try/catch around motionLinter in CameraRig.bake (tick() then throws),
// or set ok to false / return before committing when the linter fails.

import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ROAD_POINTS } from '../../src/logic/default-road.js';
import type { Vec3 } from '../../src/logic/pathkit.js';
import { CameraRig } from '../../src/view/camera-rig.js';

vi.mock('../../src/logic/pathkit.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/logic/pathkit.js')>();
  return {
    ...original,
    motionLinter: () => {
      throw new Error('linter exploded');
    },
  };
});

describe('CameraRig when the motion check throws', () => {
  it('the bake still works: ok, a message naming the failure, no findings, one bake, camera z = 8 at frame 0', () => {
    const road: Vec3[] = DEFAULT_ROAD_POINTS.map((p) => ({ x: p.x, y: p.y, z: p.z }));
    const rig = new CameraRig();
    rig.setSettings({
      shotLengthFrames: 240,
      mainCameraId: 'cam-1',
      cameras: [{ id: 'cam-1', shotType: 'orbit', bearingDeg: 0, heightM: 1.5, horizontalDistanceM: 8, lensMm: 35 }],
      road: { points: road, closed: true },
      subjectKind: 'car',
    });
    const outcome = rig.tick();
    expect(outcome).not.toBeNull();
    expect(outcome?.ok).toBe(true);
    expect(outcome?.message).toContain('the motion check could not run');
    expect(outcome?.message).toContain('linter exploded');
    expect(rig.findingsForMain()).toEqual([]);
    expect(rig.bakeCount).toBe(1);
    const out = rig.evaluate('cam-1', 0, { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } });
    expect(Math.abs(out.position.z - 8)).toBeLessThan(1e-6);
  });
});
