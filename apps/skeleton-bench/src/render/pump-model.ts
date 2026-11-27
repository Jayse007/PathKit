// Pump model (Task 17.3): eight Parts built in code from Three.js shapes, no model file.
// Each Part is a Group named `part:<id>` with `userData.partId`; every Mesh inside also carries
// `userData.partId` so later picking (Task 17.7) can test meshes only.
// Looks (Task 17.5): every mesh gets a cyan edge child (LineSegments from EdgesGeometry). setLook swaps
// the fill material and shows the edges only in X_Ray_Skeleton. Edges are LineSegments, not Mesh, so
// picking (Task 17.7) that tests meshes only never hits them.
// Shapes are written at stage scale around each Part's own centre, within the catalogue extents.
// Units: metres. Y-up. The shaft runs along x.
import { BoxGeometry, Group, type BufferGeometry } from 'three';
import { PUMP_PARTS } from '../data/catalogue.js';
import type { PartEntry } from '../data/catalogue-types.js';
import { IMPELLER_SPIN_RAD_PER_S } from '../constants.js';
import { DEFAULT_LOOK } from '../ui/storage.js';
import type { Look } from '../ui/storage.js';
import { addMesh, buildMachineModel, cylinderX, cylinderY, extrudeAlongX } from './model-kit.js';
import type { PartBuilder, YZ } from './model-kit.js';

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
  /** The Look the materials currently show. */
  readonly look: Look;
  /** Switch the materials and edges to a Look. Changes existing objects only. Call stage.requestRender() after. */
  setLook(look: Look): void;
  /** Release geometries and materials. */
  dispose(): void;
}

/** Spiral (volute) outline in the y-z plane: a = 0 at the top (+y), turning towards +z. */
function voluteOutline(steps: number): YZ[] {
  const points: YZ[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    const r = 0.165 + 0.085 * (a / (2 * Math.PI));
    points.push({ y: r * Math.cos(a), z: r * Math.sin(a) });
  }
  return points;
}

/**
 * One curved impeller vane: a thin strip along a centre line that sweeps back by 0.9 rad as it runs
 * from radius 0.045 to 0.155. Outline = centre line pushed half the thickness each way along its normal.
 * Extruded along x from -0.054 to +0.020.
 */
function vaneGeometry(): BufferGeometry {
  const steps = 10;
  const half = 0.006;
  const centre: YZ[] = [];
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const r = 0.045 + 0.11 * s;
    const angle = -0.9 * s;
    centre.push({ y: r * Math.cos(angle), z: r * Math.sin(angle) });
  }
  const left: YZ[] = [];
  const right: YZ[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = centre[Math.max(i - 1, 0)]!;
    const b = centre[Math.min(i + 1, steps)]!;
    const ty = b.y - a.y;
    const tz = b.z - a.z;
    const len = Math.hypot(ty, tz);
    const ny = -tz / len;
    const nz = ty / len;
    const c = centre[i]!;
    left.push({ y: c.y + ny * half, z: c.z + nz * half });
    right.push({ y: c.y - ny * half, z: c.z - nz * half });
  }
  return extrudeAlongX([...left, ...right.reverse()], 0.074, -0.054);
}

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
  // extents 0.6 x 0.5 x 0.46: spiral volute body, suction snout and flange ring, discharge neck, foot
  'pump-casing': (ctx) => {
    addMesh(ctx, extrudeAlongX(voluteOutline(48), 0.48, -0.3), 0, 0, 0);
    addMesh(ctx, cylinderX(0.09, 0.12), 0.24, 0, 0);
    addMesh(ctx, cylinderX(0.15, 0.03, 32), 0.285, 0, 0);
    addMesh(ctx, cylinderY(0.07, 0.15), 0.1, 0.175, 0);
    addMesh(ctx, new BoxGeometry(0.3, 0.07, 0.24), -0.05, -0.215, 0);
  },
  // extents 0.34 x 0.34 x 0.34: back plate, hub and six curved vanes, all inside the spinner group
  'pump-impeller': (ctx) => {
    const spinner = new Group();
    spinner.name = `part:${ctx.part.id}:spinner`;
    spinner.userData.partId = ctx.part.id;
    ctx.group.add(spinner);
    ctx.spinner = spinner;
    addMesh(ctx, cylinderX(0.16, 0.012, 40), -0.06, 0, 0, spinner);
    addMesh(ctx, cylinderX(0.045, 0.14, 20), 0, 0, 0, spinner);
    const vaneCount = 6;
    for (let k = 0; k < vaneCount; k++) {
      const pivot = new Group();
      pivot.rotation.x = (k * 2 * Math.PI) / vaneCount;
      spinner.add(pivot);
      addMesh(ctx, vaneGeometry(), 0, 0, 0, pivot);
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
export function buildPumpModel(parts: readonly PartEntry[] = PUMP_PARTS, initialLook: Look = DEFAULT_LOOK): PumpModel {
  if (parts.length !== 8) {
    throw new Error(`buildPumpModel: the Pump has eight Parts, got ${parts.length}`);
  }
  // Wrap the builders so the impeller's spinner group is captured when its builder runs.
  const captured: { spinner: Group | null } = { spinner: null };
  const builders: Record<string, PartBuilder> = { ...BUILDERS };
  const buildImpeller = BUILDERS[IMPELLER_PART_ID];
  if (buildImpeller !== undefined) {
    builders[IMPELLER_PART_ID] = (ctx) => {
      buildImpeller(ctx);
      captured.spinner = ctx.spinner;
    };
  }

  const kit = buildMachineModel(parts, builders, initialLook);
  kit.root.name = 'machine:pump';

  const impellerSpinner = captured.spinner;
  if (impellerSpinner === null) {
    throw new Error(`buildPumpModel: the Part "${IMPELLER_PART_ID}" is missing, so there is nothing to spin`);
  }

  return {
    root: kit.root,
    partObjects: kit.partObjects,
    partsById: kit.partsById,
    impellerSpinner,
    get look(): Look {
      return kit.look;
    },
    setLook(look: Look): void {
      kit.setLook(look);
    },
    dispose(): void {
      kit.dispose();
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
