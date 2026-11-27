// Shared model kit (Task 18.3): the helpers every machine model uses. A model is a list of Parts, each
// built by a builder function from Three.js shapes. The kit makes the Part groups, the meshes, their
// cyan edge children, and handles Looks and disposal.
// Each Part is a Group named `part:<id>` with `userData.partId`; every Mesh inside also carries
// `userData.partId`. Edges are LineSegments, not Mesh, so picking that tests meshes only never hits them.
// Units: metres. Y-up.
import {
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
import type { PartEntry } from '../data/catalogue-types.js';
import type { Look } from '../ui/storage.js';
import { cleanFillIndex, createLookMaterials, disposeLookMaterials } from './looks.js';
import type { LookMaterials } from './looks.js';

/** Facet angle (degrees) above which EdgesGeometry draws a line. Smooth cylinder sides stay unlined. */
const EDGE_THRESHOLD_DEG = 30;

export interface BuildContext {
  readonly part: PartEntry;
  /** Position of the Part in its own Machine's Part list. Picks the Clean_Engineering grey. */
  readonly partIndex: number;
  readonly group: Group;
  readonly geometries: BufferGeometry[];
  readonly meshes: Mesh[];
  readonly edges: LineSegments[];
  readonly materials: Record<Look, LookMaterials>;
  readonly look: Look;
  spinner: Group | null;
}

export type PartBuilder = (ctx: BuildContext) => void;

export interface MachineModel {
  /** Parent of the Part groups. Add this to the stage's machineGroup. */
  readonly root: Group;
  /** The Part groups in list order. Placement moves these. */
  readonly partObjects: readonly Group[];
  /** Part id to Part group. */
  readonly partsById: ReadonlyMap<string, Group>;
  /** The Look the materials currently show. */
  readonly look: Look;
  /** Switch the materials and edges to a Look. Changes existing objects only. Call stage.requestRender() after. */
  setLook(look: Look): void;
  /** Release geometries and materials. */
  dispose(): void;
}

export function addMesh(
  ctx: BuildContext,
  geometry: BufferGeometry,
  x: number,
  y: number,
  z: number,
  parent: Object3D = ctx.group,
): Mesh {
  ctx.geometries.push(geometry);
  const fillIndex = cleanFillIndex(ctx.partIndex);
  const mesh = new Mesh(geometry, ctx.materials[ctx.look].fills[fillIndex]);
  mesh.name = `part:${ctx.part.id}:mesh`;
  mesh.userData.partId = ctx.part.id;
  mesh.userData.fillIndex = fillIndex;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  ctx.meshes.push(mesh);

  // Edge lines as a child of the mesh, so they move and spin with it.
  const edgeGeometry = new EdgesGeometry(geometry, EDGE_THRESHOLD_DEG);
  ctx.geometries.push(edgeGeometry);
  const edgeMaterial = ctx.materials.X_Ray_Skeleton.edge;
  if (edgeMaterial === null) {
    throw new Error('addMesh: the X_Ray_Skeleton Look needs an edge material');
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
export function cylinderX(radius: number, length: number, segments = 24): BufferGeometry {
  const g = new CylinderGeometry(radius, radius, length, segments);
  g.rotateZ(Math.PI / 2);
  return g;
}

/** Cylinder whose axis is y. */
export function cylinderY(radius: number, length: number, segments = 24): BufferGeometry {
  return new CylinderGeometry(radius, radius, length, segments);
}

/** A point of an outline in the y-z plane, metres, local to the Part centre. */
export interface YZ {
  readonly y: number;
  readonly z: number;
}

/**
 * Extrudes a closed y-z outline along +x, from x = startX to x = startX + length.
 * The shape is drawn in x-y and extruded along z, then rotateY(+PI/2) maps (x, y, z) to (z, y, -x).
 * So the extrusion z in [0, length] becomes world x in [0, length] (then shifted by startX), and a shape
 * point (sx, sy) lands at world y = sy, z = -sx. The outline is therefore drawn with sx = -z, sy = y.
 */
export function extrudeAlongX(outline: readonly YZ[], length: number, startX: number): BufferGeometry {
  const shape = new Shape(outline.map((p) => new Vector2(-p.z, p.y)));
  const g = new ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, steps: 1 });
  g.rotateY(Math.PI / 2);
  g.translate(startX, 0, 0);
  return g;
}

/**
 * Builds a Machine: one Group per Part, at its rest position, each made by the builder for its id.
 * Throws if a Part has no builder. Allocates freely. Call once at setup.
 */
export function buildMachineModel(
  parts: readonly PartEntry[],
  builders: Readonly<Record<string, PartBuilder>>,
  initialLook: Look,
): MachineModel {
  const root = new Group();
  const geometries: BufferGeometry[] = [];
  const meshes: Mesh[] = [];
  const edges: LineSegments[] = [];
  const materials = createLookMaterials();
  let currentLook: Look = initialLook;
  const partObjects: Group[] = [];
  const partsById = new Map<string, Group>();

  for (const [partIndex, part] of parts.entries()) {
    const build = builders[part.id];
    if (build === undefined) {
      throw new Error(`buildMachineModel: no shape for Part "${part.id}"`);
    }
    const group = new Group();
    group.name = `part:${part.id}`;
    group.userData.partId = part.id;
    group.position.set(part.restPosition[0], part.restPosition[1], part.restPosition[2]);
    const ctx: BuildContext = {
      part,
      partIndex,
      group,
      geometries,
      meshes,
      edges,
      materials,
      look: initialLook,
      spinner: null,
    };
    build(ctx);
    root.add(group);
    partObjects.push(group);
    partsById.set(part.id, group);
  }

  return {
    root,
    partObjects,
    partsById,
    get look(): Look {
      return currentLook;
    },
    setLook(look: Look): void {
      currentLook = look;
      const fills = materials[look].fills;
      for (const m of meshes) m.material = fills[m.userData.fillIndex as number]!;
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
