import { describe, expect, it } from 'vitest';
import { Group, LineSegments, Mesh, type MeshBasicMaterial, type MeshStandardMaterial, type Object3D } from 'three';
import { buildPumpModel, spinImpeller } from '../src/render/pump-model.js';
import { CLEAN_FILLS } from '../src/render/looks.js';
import { PUMP_PARTS } from '../src/data/catalogue.js';

// Pump model (Task 17.3). Three.js Group and Mesh only: no renderer, no WebGL, runs in Node.
// Expected values are written by hand.
const TOL = 1e-6;

const IDS = [
  'pump-motor',
  'pump-bearing-housing',
  'pump-shaft',
  'pump-mechanical-seal',
  'pump-bolts',
  'pump-casing',
  'pump-impeller',
  'pump-flange',
];

const REST: readonly (readonly [number, number, number])[] = [
  [-0.75, -0.05, 0],
  [-0.35, -0.02, 0],
  [-0.15, 0, 0],
  [0.02, 0, 0],
  [0.12, 0, 0],
  [0.4, 0, 0],
  [0.38, 0, 0],
  [0.5, 0.28, 0],
];

function meshesOf(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) found.push(o);
  });
  return found;
}

describe('buildPumpModel', () => {
  it('builds eight named groups in catalogue order under root at rest positions', () => {
    const model = buildPumpModel();
    expect(model.partObjects).toHaveLength(8);
    for (let i = 0; i < 8; i++) {
      const g = model.partObjects[i]!;
      expect(g.name).toBe(`part:${IDS[i]}`);
      expect(g.userData.partId).toBe(IDS[i]);
      expect(g.parent).toBe(model.root);
      expect(model.partsById.get(IDS[i]!)).toBe(g);
      expect(Math.abs(g.position.x - REST[i]![0])).toBeLessThan(TOL);
      expect(Math.abs(g.position.y - REST[i]![1])).toBeLessThan(TOL);
      expect(Math.abs(g.position.z - REST[i]![2])).toBeLessThan(TOL);
    }
    model.dispose();
  });

  it('gives every Part at least one mesh and tags every mesh with its partId', () => {
    const model = buildPumpModel();
    for (let i = 0; i < 8; i++) {
      const meshes = meshesOf(model.partObjects[i]!);
      expect(meshes.length).toBeGreaterThanOrEqual(1);
      for (const m of meshes) expect(m.userData.partId).toBe(IDS[i]);
    }
    model.dispose();
  });

  it('gives the bolts 4 meshes and the impeller 8', () => {
    const model = buildPumpModel();
    expect(meshesOf(model.partsById.get('pump-bolts')!)).toHaveLength(4);
    expect(meshesOf(model.partsById.get('pump-impeller')!)).toHaveLength(8);
    model.dispose();
  });

  it('puts all 8 impeller meshes inside the spinner, a child of the impeller group', () => {
    const model = buildPumpModel();
    const impeller = model.partsById.get('pump-impeller')!;
    expect(model.impellerSpinner.parent).toBe(impeller);
    expect(meshesOf(model.impellerSpinner)).toHaveLength(8);
    model.dispose();
  });

  it('throws when given 7 Parts', () => {
    expect(() => buildPumpModel(PUMP_PARTS.slice(0, 7))).toThrow(/eight Parts/);
  });

  it('throws naming a Part id that has no shape', () => {
    const parts = PUMP_PARTS.map((p, i) => (i === 3 ? { ...p, id: 'pump-mystery' } : p));
    expect(() => buildPumpModel(parts)).toThrow(/pump-mystery/);
  });

  it('dispose removes the root from its parent', () => {
    const model = buildPumpModel();
    const stage = new Group();
    stage.add(model.root);
    expect(model.root.parent).toBe(stage);
    model.dispose();
    expect(model.root.parent).toBeNull();
    expect(stage.children).toHaveLength(0);
  });
});

// Looks on the Pump (Task 17.6 follow-up). Part order A, B, C, A, B, C, A, B, written by hand.
const CLEAN_HEX = ['7d8793', '5f6974', '444e59', '7d8793', '5f6974', '444e59', '7d8793', '5f6974'];

function edgesOf(mesh: Mesh): LineSegments[] {
  return mesh.children.filter((c): c is LineSegments => c instanceof LineSegments);
}

function expectCleanColours(model: ReturnType<typeof buildPumpModel>): void {
  for (let i = 0; i < 8; i++) {
    const meshes = meshesOf(model.partObjects[i]!);
    expect(meshes.length).toBeGreaterThanOrEqual(1);
    for (const m of meshes) {
      const mat = m.material as MeshStandardMaterial;
      expect(mat.color.getHexString()).toBe(CLEAN_HEX[i]);
      expect(mat.color.getHexString()).toBe(CLEAN_FILLS[i % 3]!.replace('#', ''));
    }
  }
}

describe('pump Looks', () => {
  it('Clean_Engineering gives each Part its grey by catalogue index', () => {
    const model = buildPumpModel(PUMP_PARTS, 'Clean_Engineering');
    expectCleanColours(model);
    model.dispose();
  });

  it('switching X_Ray_Skeleton to Clean_Engineering applies the same greys', () => {
    const model = buildPumpModel(PUMP_PARTS, 'X_Ray_Skeleton');
    model.setLook('Clean_Engineering');
    expectCleanColours(model);
    model.dispose();
  });

  it('X_Ray_Skeleton is translucent with visible edges, Clean_Engineering hides the edges', () => {
    const model = buildPumpModel(PUMP_PARTS, 'X_Ray_Skeleton');
    model.setLook('Clean_Engineering');
    model.setLook('X_Ray_Skeleton');
    for (const part of model.partObjects) {
      for (const m of meshesOf(part)) {
        const mat = m.material as MeshBasicMaterial;
        expect(mat.opacity).toBeCloseTo(0.22, 6);
        expect(mat.transparent).toBe(true);
        const edges = edgesOf(m);
        expect(edges).toHaveLength(1);
        expect(edges[0]!.visible).toBe(true);
      }
    }
    model.setLook('Clean_Engineering');
    for (const part of model.partObjects) {
      for (const m of meshesOf(part)) {
        for (const e of edgesOf(m)) expect(e.visible).toBe(false);
      }
    }
    model.dispose();
  });
});

describe('spinImpeller', () => {
  it('turns the spinner by pi/2 for dt 0.5, then pi after a second 0.5, returning true', () => {
    const model = buildPumpModel();
    expect(spinImpeller(model, 0.5, false)).toBe(true);
    expect(Math.abs(model.impellerSpinner.rotation.x - Math.PI / 2)).toBeLessThan(TOL);
    expect(spinImpeller(model, 0.5, false)).toBe(true);
    expect(Math.abs(model.impellerSpinner.rotation.x - Math.PI)).toBeLessThan(TOL);
    model.dispose();
  });

  it('returns false and changes nothing under reduced motion', () => {
    const model = buildPumpModel();
    expect(spinImpeller(model, 0.5, true)).toBe(false);
    expect(model.impellerSpinner.rotation.x).toBe(0);
    model.dispose();
  });

  it.each([0, -1, NaN, Infinity])('returns false and changes nothing for dt %s', (dt) => {
    const model = buildPumpModel();
    expect(spinImpeller(model, dt, false)).toBe(false);
    expect(model.impellerSpinner.rotation.x).toBe(0);
    model.dispose();
  });
});
