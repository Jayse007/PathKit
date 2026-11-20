import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import type { BakedData } from '../../src/bake.js';
import { motionLinter } from '../../src/linter.js';
import type { Finding } from '../../src/linter.js';
import type { Scene } from '../../src/scene.js';
import { buildFixture, quatAboutAxis } from '../helpers/baked-builder.js';
import type { FixtureEntity } from '../helpers/baked-builder.js';
import { arbPathEndScene, arbValidScene } from '../helpers/scene-generators.js';

// Feature: path-core, Property 43: Findings are well-formed, ordered and non-mutating
// **Validates: Requirements 9.1, 9.7, 9.8, 9.10**
//
// Part 1: shape of every finding. Part 2: order by frame, entity position in scene.entities, then code
// (plain < and >). Part 3: the scene and baked data are not changed, and no finding is an object that
// is reachable from them.
//
// Combinations that cannot occur and are not tested: path-end-reached and speed-spike on the same frame
// for one entity. The path-end finding sits on the first held frame, and held frames never emit speed-spike.
//
// Collection order in motionLinter, per entity and entity by entity: path-end-reached, rotation-conflict,
// aim-vertical, speed-spike, roll-change. Each hand-built fixture below has an expected order that differs
// from that collection order, so a motionLinter without its final sort fails them.

const KNOWN_CODES = ['path-end-reached', 'roll-change', 'speed-spike', 'aim-vertical', 'rotation-conflict'];
const FINDING_KEYS = ['code', 'entityId', 'frame', 'message', 'severity'];

type Triple = [number, string, string];
type V3 = [number, number, number];

// ---------------------------------------------------------------------------
// Part 1: well-formed
// ---------------------------------------------------------------------------

function checkWellFormed(findings: readonly Finding[], scene: Scene, frameCount: number, label: string): void {
  if (!Array.isArray(findings)) throw new Error(`${label}: result is not a plain array`);
  const ids = new Set<string>();
  for (const e of scene.entities) ids.add(e.id);
  const seen = new Set<Finding>();
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    if (typeof f !== 'object' || f === null) throw new Error(`${label}: finding ${i} is not an object`);
    if (seen.has(f)) throw new Error(`${label}: finding ${i} is the same object as an earlier finding`);
    seen.add(f);
    const keys = Object.keys(f).sort();
    if (keys.length !== FINDING_KEYS.length || keys.some((k, j) => k !== FINDING_KEYS[j])) {
      throw new Error(`${label}: finding ${i} has keys [${keys.join(',')}], expected [${FINDING_KEYS.join(',')}]`);
    }
    if (!Number.isInteger(f.frame) || f.frame < 0 || f.frame > frameCount - 1) {
      throw new Error(`${label}: finding ${i} frame ${f.frame} is not an integer in [0, ${frameCount - 1}]`);
    }
    if (!ids.has(f.entityId)) throw new Error(`${label}: finding ${i} entityId "${f.entityId}" is not in the scene`);
    if (!KNOWN_CODES.includes(f.code)) throw new Error(`${label}: finding ${i} has unknown code "${f.code}"`);
    const wantSeverity = f.code === 'path-end-reached' ? 'info' : 'warning';
    if (f.severity !== wantSeverity) {
      throw new Error(`${label}: finding ${i} code ${f.code} has severity "${f.severity}", expected "${wantSeverity}"`);
    }
    if (typeof f.message !== 'string' || f.message.length === 0) {
      throw new Error(`${label}: finding ${i} (${f.code}) has an empty or non-string message`);
    }
  }
}

// ---------------------------------------------------------------------------
// Part 2: order, with a comparator written here
// ---------------------------------------------------------------------------

function indexById(scene: Scene): Map<string, number> {
  const m = new Map<string, number>();
  scene.entities.forEach((e, i) => m.set(e.id, i));
  return m;
}

/** Frame, then the entity's index in scene.entities, then code with plain < and >. */
function compareIndependent(p: Finding, q: Finding, index: Map<string, number>): number {
  if (p.frame < q.frame) return -1;
  if (p.frame > q.frame) return 1;
  const pi = index.get(p.entityId) as number;
  const qi = index.get(q.entityId) as number;
  if (pi < qi) return -1;
  if (pi > qi) return 1;
  if (p.code < q.code) return -1;
  if (p.code > q.code) return 1;
  return 0;
}

function checkOrdered(findings: readonly Finding[], scene: Scene, label: string): void {
  const index = indexById(scene);
  const triples = new Set<string>();
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    const key = `${f.frame}|${index.get(f.entityId)}|${f.code}`;
    if (triples.has(key)) throw new Error(`${label}: duplicate (frame, entity, code) at finding ${i}: ${key}`);
    triples.add(key);
    if (i === 0) continue;
    const prev = findings[i - 1];
    if (compareIndependent(prev, f, index) > 0) {
      throw new Error(
        `${label}: finding ${i - 1} (${prev.frame}, ${prev.entityId}, ${prev.code}) comes before ` +
        `finding ${i} (${f.frame}, ${f.entityId}, ${f.code}) but sorts after it`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Part 3: non-mutation
// ---------------------------------------------------------------------------

/** Freezes plain objects and arrays only. Typed arrays and Maps are left alone. */
function deepFreezePlain(value: unknown): void {
  if (typeof value !== 'object' || value === null) return;
  if (ArrayBuffer.isView(value) || value instanceof Map) return;
  for (const v of Object.values(value)) deepFreezePlain(v);
  Object.freeze(value);
}

/** Every object reachable from the value, including typed arrays and Maps and their contents. */
function collectObjects(value: unknown, seen: Set<object>): void {
  if (typeof value !== 'object' || value === null) return;
  if (seen.has(value)) return;
  seen.add(value);
  if (ArrayBuffer.isView(value)) return;
  if (value instanceof Map) {
    for (const [k, v] of value.entries()) {
      collectObjects(k, seen);
      collectObjects(v, seen);
    }
    return;
  }
  for (const v of Object.values(value)) collectObjects(v, seen);
}

interface TypedCopy {
  field: string;
  entity: number;
  live: Float64Array;
  copy: Float64Array;
}

function checkNumberList(name: string, live: readonly number[], copy: readonly number[], label: string): void {
  if (live.length !== copy.length) throw new Error(`${label}: ${name} length changed from ${copy.length} to ${live.length}`);
  for (let i = 0; i < copy.length; i++) {
    if (live[i] !== copy[i]) throw new Error(`${label}: ${name}[${i}] changed from ${copy[i]} to ${live[i]}`);
  }
}

/**
 * Freezes the scene and baked data (plain parts only), copies everything, calls motionLinter and compares.
 * Takes ownership of `scene` and `baked`: the caller must not pass objects it still needs unfrozen.
 */
function lintChecked(scene: Scene, baked: BakedData, label: string): Finding[] {
  const sceneCopy = structuredClone(scene);
  const typed: TypedCopy[] = [];
  const fields: [string, readonly Float64Array[]][] = [
    ['transforms', baked.transforms], ['travelled', baked.travelled], ['aimDirections', baked.aimDirections],
  ];
  for (const [field, list] of fields) {
    list.forEach((live, entity) => typed.push({ field, entity, live, copy: live.slice() }));
  }
  const fpsCopy = baked.fps;
  const frameCountCopy = baked.frameCount;
  const idsCopy = baked.entityIds.slice();
  const heldCopy = baked.heldFromFrame.slice();
  const driversCopy = baked.rotationDrivers.slice();
  const mapCopy = Array.from(baked.entityIndex.entries());
  const reachable = new Set<object>();
  collectObjects(scene, reachable);
  collectObjects(baked, reachable);

  deepFreezePlain(scene);
  deepFreezePlain(baked);

  const findings = motionLinter(scene, baked);

  for (const t of typed) {
    if (t.live.length !== t.copy.length) {
      throw new Error(`${label}: ${t.field}[${t.entity}] length changed from ${t.copy.length} to ${t.live.length}`);
    }
    for (let i = 0; i < t.copy.length; i++) {
      const a = t.live[i];
      const b = t.copy[i];
      if (a !== b && !(a !== a && b !== b)) {
        throw new Error(`${label}: ${t.field}[${t.entity}][${i}] changed from ${b} to ${a}`);
      }
    }
  }
  if (baked.fps !== fpsCopy) throw new Error(`${label}: baked.fps changed`);
  if (baked.frameCount !== frameCountCopy) throw new Error(`${label}: baked.frameCount changed`);
  if (baked.entityIds.length !== idsCopy.length || baked.entityIds.some((id, i) => id !== idsCopy[i])) {
    throw new Error(`${label}: baked.entityIds changed`);
  }
  checkNumberList('heldFromFrame', baked.heldFromFrame, heldCopy, label);
  checkNumberList('rotationDrivers', baked.rotationDrivers, driversCopy, label);
  const mapNow = Array.from(baked.entityIndex.entries());
  if (mapNow.length !== mapCopy.length || mapNow.some(([k, v], i) => k !== mapCopy[i][0] || v !== mapCopy[i][1])) {
    throw new Error(`${label}: baked.entityIndex entries changed`);
  }
  expect(scene).toEqual(sceneCopy);

  if (reachable.has(findings)) throw new Error(`${label}: the result array is an object of the scene or baked data`);
  findings.forEach((f, i) => {
    if (reachable.has(f)) throw new Error(`${label}: finding ${i} is an object of the scene or baked data`);
    for (const v of Object.values(f)) {
      if (typeof v === 'object' && v !== null && reachable.has(v)) {
        throw new Error(`${label}: a field of finding ${i} is an object of the scene or baked data`);
      }
    }
  });
  return findings;
}

// ---------------------------------------------------------------------------
// Generated scenes
// ---------------------------------------------------------------------------

/** Copy of the scene with ids 'z', 'y', 'x', ... so that id order is the reverse of scene order. */
function withDescendingIds(scene: Scene): Scene {
  return {
    ...scene,
    entities: scene.entities.map((e, i) => ({ ...e, id: String.fromCharCode(122 - i) })),
  };
}

const arbAnyScene: fc.Arbitrary<Scene> = fc.oneof(arbPathEndScene, arbValidScene);

describe('Property 43: findings are well-formed, ordered and non-mutating', () => {
  it('generated scenes: findings are well-formed and ordered by frame, entity position, code', () => {
    let runs = 0;
    let total = 0;
    let entityChanges = 0;
    fc.assert(
      fc.property(arbAnyScene, (generated) => {
        runs++;
        const scene = withDescendingIds(generated);
        const baked = bake(scene);
        const findings = motionLinter(scene, baked);
        const label = `generated run ${runs}`;
        checkWellFormed(findings, scene, scene.frameCount, label);
        checkOrdered(findings, scene, label);
        total += findings.length;
        for (let i = 1; i < findings.length; i++) {
          if (findings[i].entityId !== findings[i - 1].entityId) entityChanges++;
        }
      }),
      { numRuns: 100 },
    );
    expect(runs).toBeGreaterThanOrEqual(100);
    expect(total).toBeGreaterThan(0);
    expect(entityChanges).toBeGreaterThan(0);
  });

  it('generated scenes: the scene and baked data are not changed and no finding aliases them', () => {
    let runs = 0;
    fc.assert(
      fc.property(arbAnyScene, (generated) => {
        runs++;
        const renamed = withDescendingIds(generated);
        const baked = bake(renamed);
        // A separate copy is frozen, so the generated value itself stays untouched.
        const scene = structuredClone(renamed);
        lintChecked(scene, baked, `generated non-mutation run ${runs}`);
      }),
      { numRuns: 100 },
    );
    expect(runs).toBeGreaterThanOrEqual(100);
  });

  // -------------------------------------------------------------------------
  // Hand-built fixtures with exact ordered answers
  // -------------------------------------------------------------------------

  /** Runs the linter with the non-mutation checks and the shape and order checks, returns the triples. */
  function run(frameCount: number, fps: number, entities: FixtureEntity[], label: string): Triple[] {
    const { scene, baked } = buildFixture(frameCount, fps, entities);
    const findings = lintChecked(scene, baked, label);
    checkWellFormed(findings, scene, frameCount, label);
    checkOrdered(findings, scene, label);
    return findings.map((f): Triple => [f.frame, f.entityId, f.code]);
  }

  const UP: V3 = [0, 1, 0];
  const ROLL_40 = quatAboutAxis('z', 40);

  /** Positions along x from the cumulative sum of the speeds (fps 1). */
  function alongX(speeds: readonly number[]): V3[] {
    const out: V3[] = [[0, 0, 0]];
    let total = 0;
    for (const s of speeds) {
      total += s;
      out.push([total, 0, 0]);
    }
    return out;
  }

  /** Aim directions: vertical on the listed frames, zero elsewhere. */
  function verticalAimOn(frameCount: number, frames: readonly number[]): V3[] {
    const out: V3[] = [];
    for (let f = 0; f < frameCount; f++) out.push(frames.includes(f) ? UP : [0, 0, 0]);
    return out;
  }

  it('a: frame 0 gives aim-vertical, path-end-reached, rotation-conflict in that order', () => {
    const got = run(3, 1, [
      { id: 'rover', heldFromFrame: 0, rotationDrivers: 2, aimDirections: verticalAimOn(3, [0]) },
    ], 'fixture a');
    expect(got).toEqual([
      [0, 'rover', 'aim-vertical'],
      [0, 'rover', 'path-end-reached'],
      [0, 'rover', 'rotation-conflict'],
    ]);
  });

  it('b: a later frame gives aim-vertical, path-end-reached, roll-change in that order', () => {
    const got = run(4, 1, [
      {
        id: 'rover',
        heldFromFrame: 3,
        aimDirections: verticalAimOn(4, [3]),
        rotations: [quatAboutAxis('z', 0), quatAboutAxis('z', 0), quatAboutAxis('z', 0), ROLL_40],
      },
    ], 'fixture b');
    expect(got).toEqual([
      [3, 'rover', 'aim-vertical'],
      [3, 'rover', 'path-end-reached'],
      [3, 'rover', 'roll-change'],
    ]);
  });

  it('c: one frame gives aim-vertical, roll-change, speed-spike in that order', () => {
    const rotations = [0, 1, 2, 3, 4].map(() => quatAboutAxis('z', 0));
    rotations.push(ROLL_40);
    const got = run(6, 1, [
      {
        id: 'rover',
        positions: alongX([1, 1, 1, 1, 10]),
        rotations,
        aimDirections: verticalAimOn(6, [5]),
      },
    ], 'fixture c');
    expect(got).toEqual([
      [5, 'rover', 'aim-vertical'],
      [5, 'rover', 'roll-change'],
      [5, 'rover', 'speed-spike'],
    ]);
  });

  it('d1: same frame and same code on entities z then a keeps scene order, not id order', () => {
    const got = run(4, 1, [
      { id: 'z', aimDirections: verticalAimOn(4, [2]) },
      { id: 'a', aimDirections: verticalAimOn(4, [2]) },
    ], 'fixture d1');
    expect(got).toEqual([
      [2, 'z', 'aim-vertical'],
      [2, 'a', 'aim-vertical'],
    ]);
  });

  it('d2: same frame and different codes: scene order wins over code order', () => {
    // z has speed-spike (code sorts later), a has aim-vertical (code sorts earlier), both on frame 4.
    const got = run(5, 1, [
      { id: 'z', positions: alongX([1, 1, 1, 10]) },
      { id: 'a', aimDirections: verticalAimOn(5, [4]) },
    ], 'fixture d2');
    expect(got).toEqual([
      [4, 'z', 'speed-spike'],
      [4, 'a', 'aim-vertical'],
    ]);
  });

  it('d3: an earlier frame of a later entity comes first; frame beats entity position', () => {
    const got = run(5, 1, [
      { id: 'z', positions: alongX([1, 1, 1, 10]) },
      { id: 'a', aimDirections: verticalAimOn(5, [2, 4]) },
    ], 'fixture d3');
    expect(got).toEqual([
      [2, 'a', 'aim-vertical'],
      [4, 'z', 'speed-spike'],
      [4, 'a', 'aim-vertical'],
    ]);
  });
});
