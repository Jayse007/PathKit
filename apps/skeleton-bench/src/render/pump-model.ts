// Pump model (Task 17.3): eight Parts built in code from Three.js shapes, no model file.
// Each Part is a Group named `part:<id>` with `userData.partId`; every Mesh inside also carries
// `userData.partId` so later picking (Task 17.7) can test meshes only.
// Looks (Task 17.5): every mesh gets a cyan edge child (LineSegments from EdgesGeometry). setLook swaps
// the fill material and shows the edges only in X_Ray_Skeleton. Edges are LineSegments, not Mesh, so
// picking (Task 17.7) that tests meshes only never hits them.
// Shapes are written at stage scale around each Part's own centre, within the catalogue extents.
// Units: metres. Y-up. The shaft runs along x.
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  EdgesGeometry,
  ExtrudeGeometry,
  LineSegments,
  Mesh,
  Shape,
  Vector2,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { PUMP_PARTS } from '../data/catalogue.js';
import type { PartEntry } from '../data/catalogue-types.js';
import { IMPELLER_SPIN_RAD_PER_S } from '../constants.js';
import { DEFAULT_LOOK } from '../ui/storage.js';
import type { Look } from '../ui/storage.js';
import { createLookMaterials, disposeLookMaterials } from './looks.js';
import type { LookMaterials } from './looks.js';

/** Facet angle (degrees) above which EdgesGeometry draws a line. Smooth cylinder sides stay unlined. */
const EDGE_THRESHOLD_DEG = 30;

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

interface BuildContext {
  readonly part: PartEntry;
  readonly group: Group;
  readonly geometries: BufferGeometry[];
  readonly meshes: Mesh[];
  readonly edges: LineSegments[];
  readonly materials: Record<Look, LookMaterials>;
  readonly look: Look;
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
  const mesh = new Mesh(geometry, ctx.materials[ctx.look].fill);
  mesh.name = `part:${ctx.part.id}:mesh`;
  mesh.userData.partId = ctx.part.id;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  ctx.meshes.push(mesh);

  // Edge lines as a child of the mesh, so they move and spin with it.
  const edgeGeometry = new EdgesGeometry(geometry, EDGE_THRESHOLD_DEG);
  ctx.geometries.push(edgeGeometry);
  const edgeMaterial = ctx.materials.X_Ray_Skeleton.edge;
  if (edgeMaterial === null) {
    throw new Error('buildPumpModel: the X_Ray_Skeleton Look needs an edge material');
  }
  const edge = new LineSegments(edgeGeometry, edgeMaterial);
  edge.name = `part:${ctx.part.id}:edges`;
  edge.userData.partId = ctx.part.id;
  edge.visible = ctx.look === 'X_Ray_Skeleton';
  mesh.add(edge);
  ctx.edges.push(edge);
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

/** A point of an outline in the y-z plane, metres, local to the Part centre. */
interface YZ {
  readonly y: number;
  readonly z: number;
}

/**
 * Extrudes a closed y-z outline along +x, from x = startX to x = startX + length.
 * The shape is drawn in x-y and extruded along z, then rotateY(+PI/2) maps (x, y, z) to (z, y, -x).
 * So the extrusion z in [0, length] becomes world x in [0, length] (then shifted by startX), and a shape
 * point (sx, sy) lands at world y = sy, z = -sx. The outline is therefore drawn with sx = -z, sy = y.
 */
function extrudeAlongX(outline: readonly YZ[], length: number, startX: number): BufferGeometry {
  const shape = new Shape(outline.map((p) => new Vector2(-p.z, p.y)));
  const g = new ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, steps: 1 });
  g.rotateY(Math.PI / 2);
  g.translate(startX, 0, 0);
  return g;
}

/** Spiral (volute) outline in the y-z plane: a = 0 at the top (+y), turning towards +z. */
function voluteOutline(steps: number): YZ[] {
  const points: YZ[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    const r = 0.17 + 0.06 * (a / (2 * Math.PI));
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
  const root = new Group();
  root.name = 'machine:pump';
  const geometries: BufferGeometry[] = [];
  const meshes: Mesh[] = [];
  const edges: LineSegments[] = [];
  const materials = createLookMaterials();
  let currentLook: Look = initialLook;
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
    const ctx: BuildContext = {
      part,
      group,
      geometries,
      meshes,
      edges,
      materials,
      look: initialLook,
      spinner: null,
    };
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
    get look(): Look {
      return currentLook;
    },
    setLook(look: Look): void {
      currentLook = look;
      const fill = materials[look].fill;
      for (const m of meshes) m.material = fill;
      const showEdges = materials[look].edge !== null;
      for (const e of edges) e.visible = showEdges;
    },
    dispose(): void {
      for (const g of geometries) g.dispose();
      disposeLookMaterials(materials);
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
