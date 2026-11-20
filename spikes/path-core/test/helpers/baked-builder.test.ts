import { describe, expect, it } from 'vitest';
import { evaluateEntity } from '../../src/evaluate.js';
import type { OutBuffer } from '../../src/evaluate.js';
import { quatMul as srcQuatMul, rotateVec } from '../../src/math.js';
import type { Quat } from '../../src/math.js';
import { validateScene } from '../../src/scene.js';
import { buildFixture, quatAboutAxis, quatMul } from './baked-builder.js';

const IDENTITY: Quat = { x: 0, y: 0, z: 0, w: 1 };

function fail(check: string, detail: string): never {
  throw new Error(`${check}: ${detail}`);
}

describe('baked-builder', () => {
  it('stores what it is given, fills defaults, and copies its inputs', () => {
    const yaw = quatAboutAxis('y', 40);
    const roll = quatAboutAxis('z', 30);
    const positions: [number, number, number][] = [[1, 2, 3], [4, 5, 6]]; // frames 0 and 1 only
    const rotations: Quat[] = [{ ...yaw }, { ...roll }];
    const aim: [number, number, number][] = [[0, 0, 0], [0, 1, 0], [1, 0, 0]];
    const bRotations: Quat[] = [IDENTITY, IDENTITY, IDENTITY, { ...yaw }];

    const { scene, baked } = buildFixture(4, 24, [
      { id: 'a', positions, rotations, aimDirections: aim, heldFromFrame: 2, rotationDrivers: 1 },
      { id: 'b', forwardAxis: '-X', upAxis: '+Z', rotations: bRotations },
    ]);

    // Expected values per entity and frame.
    const expected: Record<string, { p: number[][]; q: Quat[] }> = {
      a: {
        p: [[1, 2, 3], [4, 5, 6], [0, 0, 0], [0, 0, 0]],
        q: [yaw, roll, IDENTITY, IDENTITY],
      },
      b: {
        p: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
        q: [IDENTITY, IDENTITY, IDENTITY, yaw],
      },
    };
    const out: OutBuffer = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
    for (const id of ['a', 'b']) {
      for (let f = 0; f < 4; f++) {
        evaluateEntity(baked, id, f, out);
        const p = expected[id].p[f];
        const q = expected[id].q[f];
        const got = [out.position.x, out.position.y, out.position.z, out.rotation.x, out.rotation.y, out.rotation.z, out.rotation.w];
        const want = [p[0], p[1], p[2], q.x, q.y, q.z, q.w];
        for (let k = 0; k < 7; k++) {
          if (got[k] !== want[k]) fail('transform', `entity ${id} frame ${f} value ${k}: got ${got[k]}, want ${want[k]}`);
        }
      }
    }

    // Scalars, ids and per-entity arrays.
    expect(baked.fps).toBe(24);
    expect(baked.frameCount).toBe(4);
    expect(baked.entityIds).toEqual(['a', 'b']);
    expect(baked.entityIndex.get('a')).toBe(0);
    expect(baked.entityIndex.get('b')).toBe(1);
    expect(baked.heldFromFrame).toEqual([2, -1]);
    expect(baked.rotationDrivers).toEqual([1, 0]);
    const wantAim = [[0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 0]]; // frame 3 defaults to zero
    for (let f = 0; f < 4; f++) {
      for (let k = 0; k < 3; k++) {
        const got = baked.aimDirections[0][f * 3 + k];
        if (got !== wantAim[f][k]) fail('aim', `entity a frame ${f} component ${k}: got ${got}, want ${wantAim[f][k]}`);
      }
    }
    for (let i = 0; i < 12; i++) {
      if (baked.aimDirections[1][i] !== 0) fail('aim default', `entity b index ${i} is ${baked.aimDirections[1][i]}`);
    }
    for (let e = 0; e < 2; e++) {
      for (let f = 0; f < 4; f++) {
        if (baked.travelled[e][f] !== 0) fail('travelled', `entity ${e} frame ${f} is ${baked.travelled[e][f]}`);
      }
    }

    // The scene is valid and carries the ids and axes.
    expect(() => validateScene(scene)).not.toThrow();
    expect(scene.entities.map((e) => [e.id, e.forwardAxis, e.upAxis])).toEqual([
      ['a', '+Z', '+Y'],
      ['b', '-X', '+Z'],
    ]);

    // Mutating the caller's data afterwards changes nothing in the fixture.
    positions[0][0] = 99;
    rotations[0].w = 99;
    aim[1][1] = 99;
    bRotations[3].x = 99;
    evaluateEntity(baked, 'a', 0, out);
    expect(out.position.x).toBe(1);
    expect(out.rotation.w).toBe(yaw.w);
    expect(baked.aimDirections[0][4]).toBe(1);
    evaluateEntity(baked, 'b', 3, out);
    expect(out.rotation.x).toBe(yaw.x);
  });

  it('quatAboutAxis and quatMul behave as documented', () => {
    // 90 degrees about z turns +x into +y.
    const v = rotateVec(quatAboutAxis('z', 90), { x: 1, y: 0, z: 0 });
    expect(Math.abs(v.x)).toBeLessThan(1e-12);
    expect(Math.abs(v.y - 1)).toBeLessThan(1e-12);
    expect(Math.abs(v.z)).toBeLessThan(1e-12);

    // The helper product matches src/math.ts on three fixed pairs.
    const pairs: [Quat, Quat][] = [
      [quatAboutAxis('x', 20), quatAboutAxis('y', 70)],
      [quatAboutAxis('z', -35), quatAboutAxis('x', 110)],
      [{ x: 0.1, y: -0.2, z: 0.3, w: 0.4 }, { x: -0.5, y: 0.6, z: 0.1, w: 0.7 }],
    ];
    for (let i = 0; i < pairs.length; i++) {
      const mine = quatMul(pairs[i][0], pairs[i][1]);
      const theirs = srcQuatMul(pairs[i][0], pairs[i][1]);
      const d = Math.max(
        Math.abs(mine.x - theirs.x), Math.abs(mine.y - theirs.y),
        Math.abs(mine.z - theirs.z), Math.abs(mine.w - theirs.w),
      );
      if (d > 1e-12) fail('quatMul vs src', `pair ${i} differs by ${d}`);
    }

    // quatMul(yaw, roll) rolls first (about z), then yaws (about y).
    // +x rolled 30 degrees about z is (cos30, sin30, 0). Yawing 40 degrees about y then
    // gives (cos30*cos40, sin30, -cos30*sin40).
    const c30 = Math.cos(Math.PI / 6);
    const s30 = Math.sin(Math.PI / 6);
    const c40 = Math.cos((40 * Math.PI) / 180);
    const s40 = Math.sin((40 * Math.PI) / 180);
    const r = rotateVec(quatMul(quatAboutAxis('y', 40), quatAboutAxis('z', 30)), { x: 1, y: 0, z: 0 });
    expect(Math.abs(r.x - c30 * c40)).toBeLessThan(1e-12);
    expect(Math.abs(r.y - s30)).toBeLessThan(1e-12);
    expect(Math.abs(r.z + c30 * s40)).toBeLessThan(1e-12);
  });
});
