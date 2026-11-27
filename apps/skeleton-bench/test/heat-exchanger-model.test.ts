import { describe, expect, it } from 'vitest';
import { Box3, InstancedMesh, Mesh, type Group, type Object3D } from 'three';
import { baffleShape, buildHeatExchangerModel, LEGS, tubeSheetShape, U_TUBES } from '../src/render/heat-exchanger-model.js';
import { HEAT_EXCHANGER_MACHINE, HEAT_EXCHANGER_PARTS } from '../src/data/catalogue.js';
import type { PartEntry } from '../src/data/catalogue-types.js';

// Heat_Exchanger model tests (Task 18.3). Expected values are typed in by hand from docs/design-pack-18-3.md.
const TOL = 1e-6;
const AXES = ['x', 'y', 'z'] as const;

function meshesOf(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) found.push(o);
  });
  return found;
}

/** Largest overshoot (metres) of the Part's exact box over its half-extents, and the axis it is on. Negative means inside. */
function largestOvershoot(group: Group, entry: PartEntry): { amount: number; axis: string } {
  const box = new Box3().setFromObject(group, true);
  let best = { amount: -Infinity, axis: 'x' };
  for (let i = 0; i < 3; i++) {
    const rest = entry.restPosition[i]!;
    const half = entry.extents[i]! / 2;
    const over = Math.max(box.max.getComponent(i) - rest - half, rest - box.min.getComponent(i) - half);
    if (over > best.amount) best = { amount: over, axis: AXES[i]! };
  }
  return best;
}

describe('heat exchanger catalogue entries', () => {
  it('lists the six Parts in front-to-rear order', () => {
    expect(HEAT_EXCHANGER_MACHINE.partIds).toEqual([
      'hx-bonnet',
      'hx-tube-sheet',
      'hx-shell',
      'hx-tube-bundle',
      'hx-baffles',
      'hx-shell-nozzles',
    ]);
  });
});

describe('heat exchanger model', () => {
  it('every Part stays inside its extents box', () => {
    const model = buildHeatExchangerModel();
    model.root.updateMatrixWorld(true);
    for (const entry of HEAT_EXCHANGER_PARTS) {
      const o = largestOvershoot(model.partsById.get(entry.id)!, entry);
      expect(o.amount, `Part ${entry.id} overshoots its extents on axis ${o.axis} by ${o.amount} m`).toBeLessThanOrEqual(TOL);
    }
    model.dispose();
  });

  it('each Part has the expected mesh count, 21 in total', () => {
    const model = buildHeatExchangerModel();
    const counts = HEAT_EXCHANGER_PARTS.map((p) => meshesOf(model.partsById.get(p.id)!).length);
    expect(counts).toEqual([5, 1, 1, 1, 9, 4]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(21);
    model.dispose();
  });

  it('has 17 U-tubes and 34 legs, closest legs 0.04 apart, farthest leg 0.12806 from the axis', () => {
    expect(U_TUBES.length).toBe(17);
    expect(LEGS.length).toBe(34);
    let closest = Infinity;
    for (let i = 0; i < LEGS.length; i++) {
      for (let j = i + 1; j < LEGS.length; j++) {
        closest = Math.min(closest, Math.hypot(LEGS[i]!.y - LEGS[j]!.y, LEGS[i]!.z - LEGS[j]!.z));
      }
    }
    expect(Math.abs(closest - 0.04)).toBeLessThan(1e-6);
    const farthest = Math.max(...LEGS.map((l) => Math.hypot(l.y, l.z)));
    expect(Math.abs(farthest - 0.12806)).toBeLessThan(1e-4);
    for (const leg of LEGS) {
      expect(leg.y).toBeGreaterThanOrEqual(-0.1 - 1e-9);
      expect(leg.y).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });

  it('the tube sheet has 34 holes, and each baffle has 29 with none reaching its cut line', () => {
    expect(tubeSheetShape().holes.length).toBe(34);
    const top = baffleShape(true);
    const bottom = baffleShape(false);
    expect(top.holes.length).toBe(29);
    expect(bottom.holes.length).toBe(29);
    for (const hole of top.holes) {
      for (const p of hole.getPoints(16)) expect(p.y).toBeLessThan(0.08);
    }
    for (const hole of bottom.holes) {
      for (const p of hole.getPoints(16)) expect(p.y).toBeGreaterThan(-0.08);
    }
  });

  it('every mesh has partId and fillIndex, and each Part group is named part:<id>', () => {
    const model = buildHeatExchangerModel();
    const expectedFill = [0, 1, 2, 0, 1, 2];
    HEAT_EXCHANGER_PARTS.forEach((entry, i) => {
      const group = model.partsById.get(entry.id)!;
      expect(group.name).toBe(`part:${entry.id}`);
      for (const mesh of meshesOf(group)) {
        expect(mesh.userData.partId).toBe(entry.id);
        expect(mesh.userData.fillIndex).toBe(expectedFill[i]);
      }
    });
    model.dispose();
  });

  it('throws for a Part with no builder', () => {
    const extra: PartEntry = { ...HEAT_EXCHANGER_PARTS[0]!, id: 'hx-unknown' };
    expect(() => buildHeatExchangerModel([...HEAT_EXCHANGER_PARTS, extra])).toThrow(/hx-unknown/);
  });

  it('the tube bundle is exactly one Mesh and not an InstancedMesh', () => {
    const model = buildHeatExchangerModel();
    const meshes = meshesOf(model.partsById.get('hx-tube-bundle')!);
    expect(meshes.length).toBe(1);
    expect(meshes[0] instanceof InstancedMesh).toBe(false);
    model.dispose();
  });

  it('the baffle windows are cut at y = 0.08: the top-cut plate spans y -0.16 to 0.08, the bottom-cut plate -0.08 to 0.16', () => {
    // Plate radius 0.16, window cut at 25 percent of the diameter (0.08 from the axis).
    const ys = (topCut: boolean): number[] => baffleShape(topCut).getPoints(12).map((p) => p.y);
    expect(Math.max(...ys(true))).toBeCloseTo(0.08, 6);
    expect(Math.min(...ys(true))).toBeCloseTo(-0.16, 6);
    expect(Math.max(...ys(false))).toBeCloseTo(0.16, 6);
    expect(Math.min(...ys(false))).toBeCloseTo(-0.08, 6);
  });

  it('the tube bundle runs from x -0.65 to x 0.642 (bend centre 0.53 + largest bend radius 0.1 + tube radius 0.012)', () => {
    const model = buildHeatExchangerModel();
    const geometry = meshesOf(model.partsById.get('hx-tube-bundle')!)[0]!.geometry;
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.min.x).toBeCloseTo(-0.65, 6);
    expect(geometry.boundingBox!.max.x).toBeCloseTo(0.642, 6);
    model.dispose();
  });

  it('the merged tube bundle holds all 17 U-tubes: 4,777 vertices (each U-tube is 2 legs of 64 and 1 bend of 153 = 281)', () => {
    // Leg: cylinder with 10 sides = 11 x 2 side vertices + 2 caps of 21 = 64. Bend: torus 8 x 16 = 9 x 17 = 153.
    const model = buildHeatExchangerModel();
    const geometry = meshesOf(model.partsById.get('hx-tube-bundle')!)[0]!.geometry;
    expect(geometry.getAttribute('position').count).toBe(17 * 281);
    model.dispose();
  });
});
