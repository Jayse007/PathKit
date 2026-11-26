// Pump model (Task 17.3): eight Parts built in code from Three.js shapes, no model file.
// Each Part is a Group named `part:<id>` with `userData.partId`; every Mesh inside also carries
// `userData.partId` so later picking (Task 17.7) can test meshes only.
// Materials here are a temporary placeholder (MeshNormalMaterial, needs no lights). The two Looks
// replace them in Task 17.5.
// Shapes are written at stage scale around each Part's own centre, within the catalogue extents.
// Units: metres. Y-up. The shaft runs along x.
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshNormalMaterial,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { PUMP_PARTS } from '../data/catalogue.js';
import type { PartEntry } from '../data/catalogue-types.js';
import { IMPELLER_SPIN_RAD_PER_S } from '../constants.js';

/** Id of the Part that spins. */
export const IMPELLER_PART_ID = 'pump-impeller';

export interface PumpModel {
  /** Parent of the eight Part groups. Add this to the stage's machineGroup. */
  readonly root: Group;
  /** The Part groups in catalogue order. Placement moves these. */
  readonly partObjects: readonly Group[];
  /** Part id to Part group. */
  readonly partsById: ReadonlyMap<string, Group>;
  /** The inner group of the impeller that turns. The Part group itself only moves. */
  readonly impellerSpinner: Group;
  /** Release geometries and materials. */
  dispose(): void;
}

interface BuildContext {
  readonly part: PartEntry;
  readonly group: Group;
  readonly geometries: BufferGeometry[];
  readonly material: Material;
  spinner: Group | null;
}

function addMesh(
  ctx: BuildContext,
  geometry: BufferGeometry,
  x: number,
  y: number,
  z: number,
  parent: Object3D = ctx.group,
): Mesh {
  ctx.geometries.push(geometry);
  const mesh = new Mesh(geometry, ctx.material);
  mesh.name = `part:${ctx.part.id}:mesh`;
  mesh.userData.partId = ctx.part.id;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** Cylinder whose axis is x. */
function cylinderX(radius: number, length: number, segments = 24): BufferGeometry {
  const g = new CylinderGeometry(radius, radius, length, segments);
  g.rotateZ(Math.PI / 2);
  return g;
}

/** Cylinder whose axis is y. */
function cylinderY(radius: number, length: number, segments = 24): BufferGeometry {
  return new CylinderGeometry(radius, radius, length, segments);
}

type PartBuilder = (ctx: BuildContext) => void;

const BUILDERS: Readonly<Record<string, PartBuilder>> = {
  // extents 0.5 x 0.4 x 0.4
  'pump-motor': (ctx) => {
    addMesh(ctx, cylinderX(0.2, 0.5), 0, 0, 0);
  },
  // extents 0.3 x 0.3 x 0.3
  'pump-bearing-housing': (ctx) => {
    addMesh(ctx, cylinderX(0.15, 0.3), 0, 0, 0);
  },
  // extents 0.7 x 0.06 x 0.06
  'pump-shaft': (ctx) => {
    addMesh(ctx, cylinderX(0.03, 0.7, 16), 0, 0, 0);
  },
  // extents 0.12 x 0.16 x 0.16
  'pump-mechanical-seal': (ctx) => {
    addMesh(ctx, cylinderX(0.08, 0.12), 0, 0, 0);
  },
  // extents 0.08 x 0.44 x 0.4: four short bolts at the corners of the casing joint (one group)
  'pump-bolts': (ctx) => {
    for (const y of [-0.2, 0.2]) {
      for (const z of [-0.18, 0.18]) {
        addMesh(ctx, cylinderX(0.02, 0.08, 12), 0, y, z);
      }
    }
  },
  // extents 0.6 x 0.5 x 0.46: a plain barrel stands in for the volute
  'pump-casing': (ctx) => {
    addMesh(ctx, cylinderX(0.23, 0.6, 32), 0, 0, 0);
  },
  // extents 0.34 x 0.34 x 0.34: hub plus six radial vanes, all inside the spinner group
  'pump-impeller': (ctx) => {
    const spinner = new Group();
    spinner.name = `part:${ctx.part.id}:spinner`;
    spinner.userData.partId = ctx.part.id;
    ctx.group.add(spinner);
    ctx.spinner = spinner;
    addMesh(ctx, cylinderX(0.05, 0.12, 20), 0, 0, 0, spinner);
    const vaneCount = 6;
    for (let k = 0; k < vaneCount; k++) {
      const pivot = new Group();
      pivot.rotation.x = (k * 2 * Math.PI) / vaneCount;
      spinner.add(pivot);
      addMesh(ctx, new BoxGeometry(0.08, 0.16, 0.02), 0, 0.09, 0, pivot);
    }
  },
  // extents 0.2 x 0.06 x 0.2: a flat disc on top of the casing
  'pump-flange': (ctx) => {
    addMesh(ctx, cylinderY(0.1, 0.06), 0, 0, 0);
  },
};

/**
 * Builds the Pump: one Group per catalogue Part, at its rest position.
 * Throws if a catalogue Part has no shape or if the Pump does not have exactly eight Parts.
 * Allocates freely. Call once at setup.
 */
export function buildPumpModel(parts: readonly PartEntry[] = PUMP_PARTS): PumpModel {
  if (parts.length !== 8) {
    throw new Error(`buildPumpModel: the Pump has eight Parts, got ${parts.length}`);
  }
  const root = new Group();
  root.name = 'machine:pump';
  const geometries: BufferGeometry[] = [];
  const material = new MeshNormalMaterial();
  const partObjects: Group[] = [];
  const partsById = new Map<string, Group>();
  let impellerSpinner: Group | null = null;

  for (const part of parts) {
    const build = BUILDERS[part.id];
    if (build === undefined) {
      throw new Error(`buildPumpModel: no shape for Part "${part.id}"`);
    }
    const group = new Group();
    group.name = `part:${part.id}`;
    group.userData.partId = part.id;
    group.position.set(part.restPosition[0], part.restPosition[1], part.restPosition[2]);
    const ctx: BuildContext = { part, group, geometries, material, spinner: null };
    build(ctx);
    if (part.id === IMPELLER_PART_ID) {
      impellerSpinner = ctx.spinner;
    }
    root.add(group);
    partObjects.push(group);
    partsById.set(part.id, group);
  }

  if (impellerSpinner === null) {
    throw new Error(`buildPumpModel: the Part "${IMPELLER_PART_ID}" is missing, so there is nothing to spin`);
  }

  return {
    root,
    partObjects,
    partsById,
    impellerSpinner,
    dispose(): void {
      for (const g of geometries) g.dispose();
      material.dispose();
      root.removeFromParent();
    },
  };
}

/**
 * Turns the impeller by IMPELLER_SPIN_RAD_PER_S * dtSeconds about x. Plain Three.js, no PathKit.
 * Does nothing under reduced motion. Allocates nothing.
 * Returns true when the impeller turned (so the caller knows a redraw is needed).
 */
export function spinImpeller(model: PumpModel, dtSeconds: number, reducedMotion: boolean): boolean {
  if (reducedMotion) return false;
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return false;
  model.impellerSpinner.rotation.x += IMPELLER_SPIN_RAD_PER_S * dtSeconds;
  return true;
}
