import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createArcLengthTable } from '../../src/arclength.js';
import { bake } from '../../src/bake.js';
import type { BakedData } from '../../src/bake.js';
import { createCurve } from '../../src/curve.js';
import { motionLinter } from '../../src/linter.js';
import type { Finding } from '../../src/linter.js';
import type { Vec3 } from '../../src/math.js';
import type { Scene } from '../../src/scene.js';
import { arbPathEndScene } from '../helpers/scene-generators.js';

// Feature: path-core, Property 38: path-end-reached is emitted exactly once on open paths, inclusively
// **Validates: Requirements 8.3, 8.4, 8.6**

/** Path length built separately from bake: its own curve and arc-length table. */
function pathLength(scene: Scene): number {
  return createArcLengthTable(createCurve(scene.path.points, scene.path.closed)).length;
}

/**
 * Independent oracle. First frame whose unclamped travelled distance (baked.travelled, from the first
 * followPath in constraint order) is at or beyond the length, or -1. Does not read baked.heldFromFrame.
 */
function expectedEndFrame(baked: BakedData, entityId: string, length: number): number {
  const e = baked.entityIndex.get(entityId);
  if (e === undefined) throw new Error(`entity ${entityId} missing from baked data`);
  const travelled = baked.travelled[e];
  for (let f = 0; f < baked.frameCount; f++) {
    if (travelled[f] >= length) return f;
  }
  return -1;
}

function endFindings(findings: readonly Finding[], entityId: string): Finding[] {
  return findings.filter((x) => x.code === 'path-end-reached' && x.entityId === entityId);
}

function describeFindings(list: readonly Finding[]): string {
  return JSON.stringify(list.map((x) => ({ frame: x.frame, severity: x.severity, entityId: x.entityId })));
}

/** Checks one entity. Returns the expected end frame. Throws a descriptive Error on a miss. */
function checkEntity(label: string, scene: Scene, baked: BakedData, findings: readonly Finding[], entityId: string): number {
  const expected = expectedEndFrame(baked, entityId, pathLength(scene));
  const found = endFindings(findings, entityId);
  if (expected < 0) {
    if (found.length !== 0) {
      throw new Error(`${label}: entity ${entityId} never reaches the end but findings found ${describeFindings(found)}`);
    }
    return expected;
  }
  if (found.length !== 1) {
    throw new Error(`${label}: entity ${entityId} expected exactly 1 path-end-reached at frame ${expected}, findings found ${describeFindings(found)}`);
  }
  if (found[0].frame !== expected || found[0].severity !== 'info') {
    throw new Error(`${label}: entity ${entityId} expected frame ${expected} severity info, findings found ${describeFindings(found)}`);
  }
  return expected;
}

function followCount(scene: Scene, entityId: string): number {
  const entity = scene.entities.find((x) => x.id === entityId);
  if (entity === undefined) throw new Error(`entity ${entityId} missing from scene`);
  let n = 0;
  for (const c of entity.constraints) if (c.type === 'followPath') n++;
  return n;
}

describe('Property 38: path-end-reached is emitted exactly once on open paths, inclusively', () => {
  it('emits one info finding at the first frame where travelled reaches the length, none otherwise', () => {
    let runs = 0;
    let atFrameZero = 0;
    let atLaterFrame = 0;
    let never = 0;
    let severalFollows = 0;
    fc.assert(
      fc.property(arbPathEndScene, (scene) => {
        runs++;
        const baked = bake(scene);
        const findings = motionLinter(scene, baked);
        for (const entity of scene.entities) {
          const expected = checkEntity(`run ${runs}`, scene, baked, findings, entity.id);
          if (expected === 0) atFrameZero++;
          else if (expected > 0) atLaterFrame++;
          else never++;
          if (followCount(scene, entity.id) >= 2) severalFollows++;
        }
      }),
      { numRuns: 100 },
    );
    expect(runs).toBeGreaterThanOrEqual(100);
    expect(atFrameZero).toBeGreaterThan(0);
    expect(atLaterFrame).toBeGreaterThan(0);
    expect(never).toBeGreaterThan(0);
    expect(severalFollows).toBeGreaterThan(0);
  });

  describe('deterministic special cases', () => {
    const points: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 10, y: 5, z: 0 },
      { x: 4, y: 5, z: 3 },
    ];
    const sceneOf = (speed: number, startOffset: number, frameCount: number, fps: number): Scene => ({
      fps,
      frameCount,
      path: { points, closed: false },
      targets: {},
      entities: [
        {
          id: 'subject',
          forwardAxis: '+Z',
          upAxis: '+Y',
          constraints: [{ type: 'followPath', order: 0, influence: 1, speed, startOffset }],
        },
      ],
    });
    const length = pathLength(sceneOf(0, 0, 1, 32));

    function run(scene: Scene): { baked: BakedData; findings: Finding[] } {
      const baked = bake(scene);
      return { baked, findings: motionLinter(scene, baked) };
    }

    it('speed 0 with startOffset exactly the length is found at frame 0', () => {
      const scene = sceneOf(0, length, 5, 32);
      const { baked, findings } = run(scene);
      expect(baked.travelled[0][0]).toBe(length);
      expect(checkEntity('speed 0, offset = length', scene, baked, findings, 'subject')).toBe(0);
      const found = endFindings(findings, 'subject');
      expect(found).toHaveLength(1);
      expect(found[0].frame).toBe(0);
      expect(found[0].severity).toBe('info');
    });

    it('the end reached exactly on the last frame is found on the last frame', () => {
      // fps 32 is a power of two, so (length * 32) / 32 equals length exactly on frame 32.
      const scene = sceneOf(length, 0, 33, 32);
      const { baked, findings } = run(scene);
      expect(baked.travelled[0][32]).toBe(length);
      expect(baked.travelled[0][31]).toBeLessThan(length);
      const found = endFindings(findings, 'subject');
      expect(found).toHaveLength(1);
      expect(found[0].frame).toBe(32);
      expect(found[0].severity).toBe('info');
    });

    it('one frame fewer never reaches the end and gives no finding', () => {
      const scene = sceneOf(length, 0, 32, 32);
      const { baked, findings } = run(scene);
      expect(baked.travelled[0][31]).toBeLessThan(length);
      expect(endFindings(findings, 'subject')).toHaveLength(0);
    });
  });
});
