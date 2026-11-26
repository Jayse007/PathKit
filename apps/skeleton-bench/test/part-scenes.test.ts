import { describe, expect, it } from 'vitest';
import { evaluateEntity, validateScene, type OutBuffer } from '../src/pathkit-api.js';
import {
  bakeParts,
  buildPartScene,
  partPathLength,
} from '../src/pathkit/part-scenes.js';
import { CATALOGUE } from '../src/data/catalogue.js';
import type { PartEntry } from '../src/data/catalogue-types.js';
import {
  EXPLODED_BOX_HALF_X,
  EXPLODED_BOX_HALF_Y,
  EXPLODED_BOX_HALF_Z,
  EXPLODE_FRAMES,
  END_POSITION_TOLERANCE_M,
  FPS,
} from '../src/constants.js';

// Part scenes. Design Properties 7, 11, 13. Requirements 8.1, 8.2, 13.2, 13.3, 13.4, 35.5, 35.7.
const TOL = 1e-9;
const LAST = 59;

function part(
  id: string,
  rest: readonly [number, number, number],
  v: readonly [number, number, number],
): PartEntry {
  return {
    id,
    name: id,
    job: 'test',
    material: 'test',
    positionText: 'test',
    sourceId: 'fixture',
    restPosition: rest,
    explodeVector: v,
    extents: [0.1, 0.1, 0.1],
  };
}

// Three hand-made Parts. Each row also has typed-in end position, |v| and unit direction n = v / |v|.
interface Fixture {
  readonly part: PartEntry;
  readonly end: readonly [number, number, number];
  readonly vLength: number;
  readonly n: readonly [number, number, number];
}
const FIXTURES: readonly Fixture[] = [
  // along +X
  { part: part('fx-a', [0, 0, 0], [0.6, 0, 0]), end: [0.6, 0, 0], vLength: 0.6, n: [1, 0, 0] },
  // diagonal. |v| = sqrt(1 + 0.16 + 0.04) = sqrt(1.2)
  {
    part: part('fx-b', [-0.6, -0.2, 0.1], [1.0, 0.4, -0.2]),
    end: [0.4, 0.2, -0.1],
    vLength: 1.0954451150103321,
    n: [0.9128709291752769, 0.3651483716701108, -0.18257418583505536],
  },
  // vertical, so the bow goes along Z
  { part: part('fx-c', [0.1, 0, 0], [0, 0.5, 0]), end: [0.1, 0.5, 0], vLength: 0.5, n: [0, 1, 0] },
];

const ALL_PARTS: readonly PartEntry[] = [...FIXTURES.map((f) => f.part), ...CATALOGUE.parts];
const baked = bakeParts(ALL_PARTS);

function newBuffer(): OutBuffer {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };
}

function bakedFor(id: string) {
  const b = baked.get(id);
  if (b === undefined) throw new Error(`baked data missing for part ${id}`);
  return b;
}

function travelledFor(id: string): Float64Array {
  const b = bakedFor(id);
  const index = b.entityIndex.get(id);
  if (index === undefined) throw new Error(`entity index missing for part ${id}`);
  return b.travelled[index];
}

describe('part scenes', () => {
  it('passes validateScene for every Part', () => {
    for (const p of ALL_PARTS) {
      expect(() => validateScene(buildPartScene(p))).not.toThrow();
    }
  });

  it('builds fps 30, 60 frames, one entity with one open followPath and no aimAt or targets', () => {
    for (const f of FIXTURES) {
      const scene = buildPartScene(f.part);
      if (scene.fps !== 30 || FPS !== 30) throw new Error(`fps check: ${f.part.id}, got ${scene.fps}`);
      if (scene.frameCount !== 60 || EXPLODE_FRAMES !== 60) {
        throw new Error(`frame count check: ${f.part.id}, got ${scene.frameCount}`);
      }
      if (scene.path.closed !== false) throw new Error(`open path check: ${f.part.id}`);
      if (scene.path.points.length !== 4) {
        throw new Error(`path point count check: ${f.part.id}, got ${scene.path.points.length}`);
      }
      if (Object.keys(scene.targets).length !== 0) throw new Error(`targets check: ${f.part.id}`);
      if (scene.entities.length !== 1) throw new Error(`entity count check: ${f.part.id}`);
      const entity = scene.entities[0];
      if (entity.id !== f.part.id) throw new Error(`entity id check: ${f.part.id}, got ${entity.id}`);
      if (entity.forwardAxis !== '+Z' || entity.upAxis !== '+Y') {
        throw new Error(`axes check: ${f.part.id}, forward ${entity.forwardAxis}, up ${entity.upAxis}`);
      }
      if (entity.constraints.length !== 1) throw new Error(`constraint count check: ${f.part.id}`);
      const c = entity.constraints[0];
      if (c.type !== 'followPath') throw new Error(`constraint type check: ${f.part.id}, got ${c.type}`);
      if (c.order !== 0 || c.influence !== 1 || c.startOffset !== 0 || c.alignToPath !== false) {
        throw new Error(`followPath fields check: ${f.part.id}`);
      }
      // speed = length * 30 / 59, so length = speed * 59 / 30
      const length = (c.speed * 59) / 30;
      if (Math.abs(length - partPathLength(f.part)) > TOL) {
        throw new Error(`speed check: ${f.part.id}, speed ${c.speed}, length ${partPathLength(f.part)}`);
      }
    }
  });

  it('gives a path length at least |v| and at most 1.1 * |v| for each fixture', () => {
    for (const f of FIXTURES) {
      const length = partPathLength(f.part);
      if (!(length >= f.vLength - TOL && length <= f.vLength * 1.1)) {
        throw new Error(`length check: ${f.part.id}, |v| ${f.vLength}, length ${length}`);
      }
    }
  });

  it('puts frame 0 at the rest position within 1e-9 for every Part', () => {
    const out = newBuffer();
    for (const p of ALL_PARTS) {
      evaluateEntity(bakedFor(p.id), p.id, 0, out);
      const [x, y, z] = p.restPosition;
      if (
        Math.abs(out.position.x - x) > TOL ||
        Math.abs(out.position.y - y) > TOL ||
        Math.abs(out.position.z - z) > TOL
      ) {
        throw new Error(
          `frame 0 check: ${p.id}, expected (${x}, ${y}, ${z}), got (${out.position.x}, ${out.position.y}, ${out.position.z})`,
        );
      }
    }
  });

  it('puts frame 59 at the typed end position for each fixture', () => {
    const out = newBuffer();
    for (const f of FIXTURES) {
      evaluateEntity(bakedFor(f.part.id), f.part.id, LAST, out);
      const [x, y, z] = f.end;
      if (
        Math.abs(out.position.x - x) > END_POSITION_TOLERANCE_M ||
        Math.abs(out.position.y - y) > END_POSITION_TOLERANCE_M ||
        Math.abs(out.position.z - z) > END_POSITION_TOLERANCE_M
      ) {
        throw new Error(
          `end check: ${f.part.id}, expected (${x}, ${y}, ${z}), got (${out.position.x}, ${out.position.y}, ${out.position.z})`,
        );
      }
    }
  });

  it('puts frame 59 at rest + explode vector within 1e-6 for every catalogue Part', () => {
    const out = newBuffer();
    expect(CATALOGUE.parts.length).toBeGreaterThan(0);
    for (const p of CATALOGUE.parts) {
      evaluateEntity(bakedFor(p.id), p.id, LAST, out);
      const ex = p.restPosition[0] + p.explodeVector[0];
      const ey = p.restPosition[1] + p.explodeVector[1];
      const ez = p.restPosition[2] + p.explodeVector[2];
      if (
        Math.abs(out.position.x - ex) > END_POSITION_TOLERANCE_M ||
        Math.abs(out.position.y - ey) > END_POSITION_TOLERANCE_M ||
        Math.abs(out.position.z - ez) > END_POSITION_TOLERANCE_M
      ) {
        throw new Error(
          `end check: ${p.id}, expected (${ex}, ${ey}, ${ez}), got (${out.position.x}, ${out.position.y}, ${out.position.z})`,
        );
      }
    }
  });

  it('never decreases the travelled distance, from 0 at frame 0 to the path length at frame 59', () => {
    for (const p of ALL_PARTS) {
      const t = travelledFor(p.id);
      const length = partPathLength(p);
      if (t.length !== 60) throw new Error(`travelled length check: ${p.id}, got ${t.length}`);
      if (t[0] !== 0) throw new Error(`travelled start check: ${p.id}, got ${t[0]}`);
      for (let f = 1; f < 60; f++) {
        if (!(t[f] >= t[f - 1])) {
          throw new Error(`travelled order check: ${p.id}, frame ${f}, ${t[f - 1]} then ${t[f]}`);
        }
      }
      if (Math.abs(t[LAST] - length) > TOL) {
        throw new Error(`travelled end check: ${p.id}, expected ${length}, got ${t[LAST]}`);
      }
    }
  });

  it('keeps all 60 frames of every Part inside the envelope', () => {
    const out = newBuffer();
    for (const p of ALL_PARTS) {
      for (let f = 0; f < 60; f++) {
        evaluateEntity(bakedFor(p.id), p.id, f, out);
        const { x, y, z } = out.position;
        if (
          Math.abs(x) > EXPLODED_BOX_HALF_X + TOL ||
          Math.abs(y) > EXPLODED_BOX_HALF_Y + TOL ||
          Math.abs(z) > EXPLODED_BOX_HALF_Z + TOL
        ) {
          throw new Error(`envelope check: ${p.id}, frame ${f}, position (${x}, ${y}, ${z})`);
        }
      }
    }
  });

  it('travels 30/59 of the path length by frame 30', () => {
    // 30 / 59 = 0.508474576271186..., typed in.
    const FRACTION = 0.5084745762711864;
    for (const p of ALL_PARTS) {
      const expected = partPathLength(p) * FRACTION;
      const got = travelledFor(p.id)[30];
      if (Math.abs(got - expected) > TOL) {
        throw new Error(`frame 30 check: ${p.id}, expected ${expected}, got ${got}`);
      }
    }
  });

  it('mirrors frames 29 and 30 about the middle of the path (hand-checked symmetry)', () => {
    // The four control points are mirror images about the plane through rest + v/2 with normal n,
    // so the curve is symmetric. Frames 29 and 30 are 29/59 and 30/59 of the length, equally far from the ends.
    // Mirror image means: (pos29 + pos30 - 2 * rest) . n = |v|, and pos30 - pos29 points along n.
    const a = newBuffer();
    const b = newBuffer();
    for (const f of FIXTURES) {
      const id = f.part.id;
      evaluateEntity(bakedFor(id), id, 29, a);
      evaluateEntity(bakedFor(id), id, 30, b);
      const rest = f.part.restPosition;
      const sx = a.position.x + b.position.x - 2 * rest[0];
      const sy = a.position.y + b.position.y - 2 * rest[1];
      const sz = a.position.z + b.position.z - 2 * rest[2];
      const along = sx * f.n[0] + sy * f.n[1] + sz * f.n[2];
      if (Math.abs(along - f.vLength) > 1e-4) {
        throw new Error(`mirror sum check: ${id}, expected ${f.vLength}, got ${along}`);
      }
      const dx = b.position.x - a.position.x;
      const dy = b.position.y - a.position.y;
      const dz = b.position.z - a.position.z;
      const dn = dx * f.n[0] + dy * f.n[1] + dz * f.n[2];
      const px = dx - dn * f.n[0];
      const py = dy - dn * f.n[1];
      const pz = dz - dn * f.n[2];
      const sideways = Math.sqrt(px * px + py * py + pz * pz);
      if (!(dn > 0) || sideways > 1e-4) {
        throw new Error(`mirror step check: ${id}, along ${dn}, sideways ${sideways}`);
      }
    }
  });

  it('uses unique Part ids and one entity per scene named by the Part id', () => {
    const seen = new Set<string>();
    for (const p of ALL_PARTS) {
      if (seen.has(p.id)) throw new Error(`duplicate part id: ${p.id}`);
      seen.add(p.id);
      const ids = bakedFor(p.id).entityIds;
      if (ids.length !== 1 || ids[0] !== p.id) {
        throw new Error(`entity ids check: ${p.id}, got [${ids.join(', ')}]`);
      }
    }
    expect(seen.size).toBe(ALL_PARTS.length);
  });

  it('bakes one scene per Part into a Map keyed by Part id, with 60 frames at fps 30', () => {
    const map = bakeParts(FIXTURES.map((f) => f.part));
    expect(map.size).toBe(3);
    expect(Array.from(map.keys())).toEqual(['fx-a', 'fx-b', 'fx-c']);
    for (const data of map.values()) {
      expect(data.frameCount).toBe(60);
      expect(data.fps).toBe(30);
    }
  });

  it('bakes every catalogue Part when called with no argument', () => {
    const map = bakeParts();
    const expectedIds = CATALOGUE.parts.map((p) => p.id);
    expect(Array.from(map.keys())).toEqual(expectedIds);
  });

  it('returns a new equal scene on each call and leaves the Part unchanged', () => {
    const f = FIXTURES[1].part;
    const first = buildPartScene(f);
    const second = buildPartScene(f);
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(f.restPosition).toEqual([-0.6, -0.2, 0.1]);
    expect(f.explodeVector).toEqual([1.0, 0.4, -0.2]);
  });
});
