import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createArcLengthTable } from '../../src/arclength.js';
import { bake } from '../../src/bake.js';
import { createCurve } from '../../src/curve.js';
import { motionLinter } from '../../src/linter.js';
import type { Finding } from '../../src/linter.js';
import type { Vec3 } from '../../src/math.js';
import type { Entity, FollowPathConstraint, Scene } from '../../src/scene.js';
import { arbPathEndScene } from '../helpers/scene-generators.js';

// Feature: path-core, Property 38: path-end-reached is emitted exactly once on open paths, inclusively
// **Validates: Requirements 8.3, 8.4, 8.6**

// The expectation comes from the scene (constraints sorted by order, first followPath, travelled = startOffset + speed * f / fps),
// not from baked.travelled or baked.heldFromFrame, so a bake that used the wrong followPath would fail.

/** Path length built separately from bake: its own curve and arc-length table. */
function pathLength(scene: Scene): number {
  return createArcLengthTable(createCurve(scene.path.points, scene.path.closed)).length;
}

/**
 * First followPath in ascending `order`, ties broken by list position (stable sort written here:
 * decorate with the list index and compare (order, index)). Undefined when there is none.
 */
function firstFollowByOrder(entity: Entity): FollowPathConstraint | undefined {
  let best: FollowPathConstraint | undefined;
  let bestIndex = -1;
  for (let i = 0; i < entity.constraints.length; i++) {
    const c = entity.constraints[i];
    if (c.type !== 'followPath') continue;
    if (best === undefined || c.order < best.order || (c.order === best.order && i < bestIndex)) {
      best = c;
      bestIndex = i;
    }
  }
  return best;
}

/** First followPath in plain list order, used only to count scenes where the two choices differ. */
function firstFollowByList(entity: Entity): FollowPathConstraint | undefined {
  for (const c of entity.constraints) if (c.type === 'followPath') return c;
  return undefined;
}

/** First frame f in [0, frameCount - 1] with startOffset + speed * f / fps >= length, or -1. */
function endFrameOf(follow: FollowPathConstraint | undefined, scene: Scene, length: number): number {
  if (follow === undefined) return -1;
  for (let f = 0; f < scene.frameCount; f++) {
    if (follow.startOffset + (follow.speed * f) / scene.fps >= length) return f;
  }
  return -1;
}

/** Independent oracle, computed from the scene alone. */
function expectedEndFrame(scene: Scene, entity: Entity, length: number): number {
  return endFrameOf(firstFollowByOrder(entity), scene, length);
}

function endFindings(findings: readonly Finding[], entityId: string): Finding[] {
  return findings.filter((x) => x.code === 'path-end-reached' && x.entityId === entityId);
}

function describeFindings(list: readonly Finding[]): string {
  return JSON.stringify(list.map((x) => ({ frame: x.frame, severity: x.severity, entityId: x.entityId })));
}

/** Checks one entity. Returns the expected end frame. Throws a descriptive Error on a miss. */
function checkEntity(label: string, scene: Scene, findings: readonly Finding[], entity: Entity, length: number): number {
  const expected = expectedEndFrame(scene, entity, length);
  const found = endFindings(findings, entity.id);
  if (expected < 0) {
    if (found.length !== 0) {
      throw new Error(`${label}: entity ${entity.id} never reaches the end but findings found ${describeFindings(found)}`);
    }
    return expected;
  }
  if (found.length !== 1) {
    throw new Error(`${label}: entity ${entity.id} expected exactly 1 path-end-reached at frame ${expected}, findings found ${describeFindings(found)}`);
  }
  if (found[0].frame !== expected || found[0].severity !== 'info') {
    throw new Error(`${label}: entity ${entity.id} expected frame ${expected} severity info, findings found ${describeFindings(found)}`);
  }
  return expected;
}

function followCount(entity: Entity): number {
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
    let orderMatters = 0;
    fc.assert(
      fc.property(arbPathEndScene, (scene) => {
        runs++;
        const baked = bake(scene);
        const findings = motionLinter(scene, baked);
        const length = pathLength(scene);
        for (const entity of scene.entities) {
          const expected = checkEntity(`run ${runs}`, scene, findings, entity, length);
          if (expected === 0) atFrameZero++;
          else if (expected > 0) atLaterFrame++;
          else never++;
          if (followCount(entity) >= 2) severalFollows++;
          const byList = firstFollowByList(entity);
          if (byList !== firstFollowByOrder(entity) && endFrameOf(byList, scene, length) !== expected) orderMatters++;
        }
      }),
      { numRuns: 100 },
    );
    expect(runs).toBeGreaterThanOrEqual(100);
    expect(atFrameZero).toBeGreaterThan(0);
    expect(atLaterFrame).toBeGreaterThan(0);
    expect(never).toBeGreaterThan(0);
    expect(severalFollows).toBeGreaterThan(0);
    expect(orderMatters).toBeGreaterThan(0);
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

    function run(scene: Scene): Finding[] {
      return motionLinter(scene, bake(scene));
    }

    it('speed 0 with startOffset exactly the length is found at frame 0', () => {
      const scene = sceneOf(0, length, 5, 32);
      const findings = run(scene);
      expect(checkEntity('speed 0, offset = length', scene, findings, scene.entities[0], length)).toBe(0);
      const found = endFindings(findings, 'subject');
      expect(found).toHaveLength(1);
      expect(found[0].frame).toBe(0);
      expect(found[0].severity).toBe('info');
    });

    it('the end reached exactly on the last frame is found on the last frame', () => {
      // fps 32 is a power of two, so (length * 32) / 32 equals length exactly on frame 32.
      const scene = sceneOf(length, 0, 33, 32);
      const findings = run(scene);
      expect(checkEntity('equality on last frame', scene, findings, scene.entities[0], length)).toBe(32);
      const found = endFindings(findings, 'subject');
      expect(found).toHaveLength(1);
      expect(found[0].frame).toBe(32);
      expect(found[0].severity).toBe('info');
    });

    it('one frame fewer never reaches the end and gives no finding', () => {
      const scene = sceneOf(length, 0, 32, 32);
      const findings = run(scene);
      expect(checkEntity('one frame short', scene, findings, scene.entities[0], length)).toBe(-1);
      expect(endFindings(findings, 'subject')).toHaveLength(0);
    });
  });
});
