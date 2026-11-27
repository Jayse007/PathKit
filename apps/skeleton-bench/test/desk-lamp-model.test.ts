import { describe, expect, it } from 'vitest';
import { Box3, Mesh, type Group, type Object3D } from 'three';
import { buildDeskLampModel } from '../src/render/desk-lamp-model.js';
import { DESK_LAMP_MACHINE, DESK_LAMP_PARTS } from '../src/data/catalogue.js';
import type { PartEntry } from '../src/data/catalogue-types.js';

// Desk_Lamp model tests (Task 18.3). Expected values are typed in by hand from docs/design-pack-18-3.md.
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

describe('desk lamp catalogue entries', () => {
  it('lists the seven Parts from the base up', () => {
    expect(DESK_LAMP_MACHINE.partIds).toEqual([
      'lamp-base',
      'lamp-upper-arm',
      'lamp-spring',
      'lamp-elbow',
      'lamp-forearm',
      'lamp-shade',
      'lamp-bulb-holder',
    ]);
  });
});

describe('desk lamp model', () => {
  it('every Part stays inside its extents box', () => {
    const model = buildDeskLampModel();
    model.root.updateMatrixWorld(true);
    for (const entry of DESK_LAMP_PARTS) {
      const o = largestOvershoot(model.partsById.get(entry.id)!, entry);
      expect(o.amount, `Part ${entry.id} overshoots its extents on axis ${o.axis} by ${o.amount} m`).toBeLessThanOrEqual(TOL);
    }
    model.dispose();
  });

  it('each Part has the expected mesh count, 18 in total', () => {
    const model = buildDeskLampModel();
    const counts = DESK_LAMP_PARTS.map((p) => meshesOf(model.partsById.get(p.id)!).length);
    expect(counts).toEqual([2, 2, 3, 3, 2, 3, 3]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(18);
    model.dispose();
  });

  it('every mesh has partId and fillIndex, and each Part group is named part:<id>', () => {
    const model = buildDeskLampModel();
    const expectedFill = [0, 1, 2, 0, 1, 2, 0];
    DESK_LAMP_PARTS.forEach((entry, i) => {
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
    const extra: PartEntry = { ...DESK_LAMP_PARTS[0]!, id: 'lamp-unknown' };
    expect(() => buildDeskLampModel([...DESK_LAMP_PARTS, extra])).toThrow(/lamp-unknown/);
  });
});
