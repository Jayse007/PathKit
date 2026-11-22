import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import { motionLinter } from '../../src/linter.js';
import type { Finding } from '../../src/linter.js';
import type { Constraint, Entity, Scene } from '../../src/scene.js';
import { buildFixture } from '../helpers/baked-builder.js';
import { arbPathEndScene } from '../helpers/scene-generators.js';

// Feature: path-core, Property 42: Rotation conflict is reported on frame 0
// **Validates: Requirements 9.6**

// Part 1 and Part 2 run the whole chain (bake, then linter) and take the expected count from the SCENE ALONE,
// never from baked.rotationDrivers. Part 3 uses hand-built baked data and so tests the linter's use of
// baked.rotationDrivers on its own.

/** Declared rotation drivers: aimAt, or followPath with alignToPath === true. Influence is ignored on purpose. */
function expectedDrivers(entity: Entity): number {
  let count = 0;
  for (const c of entity.constraints) {
    if (c.type === 'aimAt') count++;
    else if (c.type === 'followPath' && c.alignToPath === true) count++;
  }
  return count;
}

function isDriver(c: Constraint): boolean {
  return c.type === 'aimAt' || (c.type === 'followPath' && c.alignToPath === true);
}

function conflicts(findings: readonly Finding[]): Finding[] {
  return findings.filter((f) => f.code === 'rotation-conflict');
}

function describeFindings(list: readonly Finding[]): string {
  return JSON.stringify(list.map((f) => ({ frame: f.frame, severity: f.severity, entityId: f.entityId, code: f.code })));
}

interface Seen {
  conflictWithInfluenceZero: boolean;
  conflictWithInfluenceBetween: boolean;
  threeOrMore: boolean;
  severalAlignedFollows: boolean;
  aimWithNoConflict: boolean;
  aimNextToOmittedAlign: boolean;
  aimNextToFalseAlign: boolean;
}

/** Plain checks for one scene. Updates the regime flags. */
function checkScene(label: string, scene: Scene, seen: Seen): void {
  const baked = bake(scene);
  const all = conflicts(motionLinter(scene, baked));
  let expectedEntities = 0;
  for (const entity of scene.entities) {
    const count = expectedDrivers(entity);
    const mine = all.filter((f) => f.entityId === entity.id);
    const wanted = count >= 2 ? 1 : 0;
    if (count >= 2) expectedEntities++;
    if (mine.length !== wanted) {
      throw new Error(
        `${label}: entity ${entity.id} expected ${count} drivers so ${wanted} rotation-conflict finding(s), got ${mine.length}: ${describeFindings(mine)}`,
      );
    }
    if (wanted === 1) {
      const f = mine[0];
      if (f.frame !== 0) throw new Error(`${label}: entity ${entity.id} rotation-conflict on frame ${f.frame}, expected 0`);
      if (f.severity !== 'warning') throw new Error(`${label}: entity ${entity.id} rotation-conflict severity ${f.severity}, expected warning`);
    }

    // Regime bookkeeping.
    let hasAim = false;
    let alignedFollows = 0;
    let hasOmitted = false;
    let hasFalse = false;
    let zeroDriver = false;
    let betweenDriver = false;
    for (const c of entity.constraints) {
      if (c.type === 'aimAt') hasAim = true;
      else if (c.type === 'followPath' && c.alignToPath === true) alignedFollows++;
      else if (c.type === 'followPath' && c.alignToPath === undefined) hasOmitted = true;
      else if (c.type === 'followPath') hasFalse = true;
      if (isDriver(c)) {
        if (c.influence === 0) zeroDriver = true;
        if (c.influence > 0 && c.influence < 1) betweenDriver = true;
      }
    }
    if (count >= 2 && zeroDriver) seen.conflictWithInfluenceZero = true;
    if (count >= 2 && betweenDriver) seen.conflictWithInfluenceBetween = true;
    if (count >= 3) seen.threeOrMore = true;
    if (alignedFollows >= 2) seen.severalAlignedFollows = true;
    if (hasAim && count === 1) seen.aimWithNoConflict = true;
    if (hasAim && hasOmitted) seen.aimNextToOmittedAlign = true;
    if (hasAim && hasFalse) seen.aimNextToFalseAlign = true;
  }
  if (all.length !== expectedEntities) {
    throw new Error(`${label}: expected ${expectedEntities} rotation-conflict findings in total, got ${all.length}: ${describeFindings(all)}`);
  }
}

describe('Property 42: Rotation conflict is reported on frame 0', () => {
  it('real bake scenes: one frame-0 warning exactly for entities with two or more declared drivers', () => {
    const seen: Seen = {
      conflictWithInfluenceZero: false,
      conflictWithInfluenceBetween: false,
      threeOrMore: false,
      severalAlignedFollows: false,
      aimWithNoConflict: false,
      aimNextToOmittedAlign: false,
      aimNextToFalseAlign: false,
    };
    let runs = 0;
    fc.assert(
      fc.property(arbPathEndScene, (scene) => {
        runs++;
        checkScene(`run ${runs}`, scene, seen);
      }),
      { numRuns: 100 },
    );
    expect(runs).toBeGreaterThanOrEqual(100);
    expect(seen.conflictWithInfluenceZero).toBe(true);
    expect(seen.conflictWithInfluenceBetween).toBe(true);
    expect(seen.threeOrMore).toBe(true);
    expect(seen.severalAlignedFollows).toBe(true);
    expect(seen.aimWithNoConflict).toBe(true);
    expect(seen.aimNextToOmittedAlign).toBe(true);
    expect(seen.aimNextToFalseAlign).toBe(true);
  });

  describe('fixed scenes through bake and linter', () => {
    const sceneWith = (constraints: Constraint[]): Scene => ({
      fps: 30,
      frameCount: 4,
      path: {
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
          { x: 10, y: 0, z: 10 },
        ],
        closed: false,
      },
      targets: { goal: { x: 5, y: 0, z: 5 } },
      entities: [{ id: 'rover', forwardAxis: '+Z', upAxis: '+Y', constraints }],
    });
    const aim = (order: number, influence: number): Constraint => ({ type: 'aimAt', order, influence, target: 'goal' });
    const follow = (order: number, influence: number, alignToPath?: boolean): Constraint => {
      const c: Constraint = { type: 'followPath', order, influence, speed: 0, startOffset: 0 };
      if (alignToPath !== undefined) c.alignToPath = alignToPath;
      return c;
    };
    const run = (constraints: Constraint[]) => {
      const scene = sceneWith(constraints);
      return conflicts(motionLinter(scene, bake(scene))).map((f) => ({
        frame: f.frame,
        entityId: f.entityId,
        severity: f.severity,
        code: f.code,
      }));
    };
    const one = [{ frame: 0, entityId: 'rover', severity: 'warning', code: 'rotation-conflict' }];

    it('1. aligned followPath + aimAt gives a conflict', () => {
      expect(run([follow(0, 1, true), aim(1, 1)])).toEqual(one);
    });
    it('2. followPath with alignToPath false + aimAt gives none', () => {
      expect(run([follow(0, 1, false), aim(1, 1)])).toEqual([]);
    });
    it('3. followPath with alignToPath omitted + aimAt gives none', () => {
      expect(run([follow(0, 1), aim(1, 1)])).toEqual([]);
    });
    it('4. two aimAt, both influence 0, give a conflict', () => {
      expect(run([aim(0, 0), aim(1, 0)])).toEqual(one);
    });
    it('5. aligned followPath with influence 0 + aimAt gives a conflict', () => {
      expect(run([follow(0, 0, true), aim(1, 1)])).toEqual(one);
    });
    it('6. three drivers give exactly one finding', () => {
      expect(run([aim(0, 1), follow(1, 0.5, true), aim(2, 0)])).toEqual(one);
    });
    it('7. a single aimAt gives none', () => {
      expect(run([aim(0, 1)])).toEqual([]);
    });
  });

  describe('hand-built baked data (linter reads baked.rotationDrivers)', () => {
    it('findings only for entities with 2 and 3 drivers, one each, on frame 0, warning', () => {
      const { scene, baked } = buildFixture(4, 30, [
        { id: 'd0', rotationDrivers: 0 },
        { id: 'd1', rotationDrivers: 1 },
        { id: 'd2', rotationDrivers: 2 },
        { id: 'd3', rotationDrivers: 3 },
      ]);
      const found = conflicts(motionLinter(scene, baked)).map((f) => ({
        frame: f.frame,
        entityId: f.entityId,
        severity: f.severity,
        code: f.code,
      }));
      expect(found).toEqual([
        { frame: 0, entityId: 'd2', severity: 'warning', code: 'rotation-conflict' },
        { frame: 0, entityId: 'd3', severity: 'warning', code: 'rotation-conflict' },
      ]);
    });
  });
});
