// Heat_Exchanger model (Task 18.3): a U-tube shell-and-tube exchanger (TEMA BEU), six Parts built in code
// from Three.js shapes, no model file. Shapes and numbers come from docs/design-pack-18-3.md, section 4.
// Each Part is a Group named `part:<id>` (made by buildMachineModel) with `userData.partId`.
// Units: metres. Y-up. The shell axis runs along x. Each shape is written around its Part's own centre.
import { ExtrudeGeometry, LatheGeometry, Path, Shape, TorusGeometry, Vector2, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HEAT_EXCHANGER_PARTS } from '../data/catalogue.js';
import type { PartEntry } from '../data/catalogue-types.js';
import { DEFAULT_LOOK } from '../ui/storage.js';
import type { Look } from '../ui/storage.js';
import { addMesh, buildMachineModel, cylinderX, cylinderY } from './model-kit.js';
import type { MachineModel, PartBuilder } from './model-kit.js';

/** Tube radius. */
export const TUBE_R = 0.012;
/** x of the centre of every U-bend, in the tube bundle's frame. */
export const BEND_X = 0.53;
/** x of the left (tube sheet) end of every tube leg, in the tube bundle's frame. */
export const LEG_START_X = -0.65;

/** One U-tube: bend radius R and the z of its two legs (the legs sit at y = +R and y = -R). */
export interface UTube {
  readonly r: number;
  readonly z: number;
}

/** The 17 U-tubes. The one shared list: the tube sheet, the baffles and the bundle all use it. */
export const U_TUBES: readonly UTube[] = [
  ...[-0.12, -0.08, -0.04, 0, 0.04, 0.08, 0.12].map((z) => ({ r: 0.02, z })),
  ...[-0.08, -0.04, 0, 0.04, 0.08].map((z) => ({ r: 0.06, z })),
  ...[-0.08, -0.04, 0, 0.04, 0.08].map((z) => ({ r: 0.1, z })),
];

/** A tube leg position in the y-z plane. */
export interface Leg {
  readonly y: number;
  readonly z: number;
}

/** The 34 leg positions, derived from U_TUBES: (+R, z) then (-R, z) for each U-tube. */
export const LEGS: readonly Leg[] = U_TUBES.flatMap((u) => [
  { y: u.r, z: u.z },
  { y: -u.r, z: u.z },
]);

const TUBE_SHEET_R = 0.21;
const TUBE_SHEET_THICKNESS = 0.05;
const BAFFLE_R = 0.16;
const BAFFLE_CUT_Y = 0.08;
const BAFFLE_THICKNESS = 0.012;
const BAFFLE_HOLE_R = 0.014;
const BAFFLE_XS: readonly number[] = [-0.43, -0.215, 0, 0.215, 0.43];

// Shapes are drawn in the extrudeAlongX convention: shape point (sx, sy) lands at world y = sy, z = -sx.
// So a leg at (y, z) is drawn at (sx, sy) = (-z, y).

/** The tube sheet outline: a disc of radius 0.21 with one hole of radius 0.012 per leg. */
export function tubeSheetShape(): Shape {
  const shape = new Shape();
  shape.absarc(0, 0, TUBE_SHEET_R, 0, 2 * Math.PI, false);
  for (const leg of LEGS) {
    const hole = new Path();
    hole.absarc(-leg.z, leg.y, TUBE_R, 0, 2 * Math.PI, true);
    shape.holes.push(hole);
  }
  return shape;
}

/**
 * A baffle outline: a circle of radius 0.16 with a flat cut at |y| = 0.08. topCut true removes the top
 * (y above 0.08), false removes the bottom. A hole of radius 0.014 is drawn for each leg whose hole lies
 * fully on the plate; the legs in the window pass through with no hole.
 */
export function baffleShape(topCut: boolean): Shape {
  const half = Math.sqrt(BAFFLE_R * BAFFLE_R - BAFFLE_CUT_Y * BAFFLE_CUT_Y);
  const shape = new Shape();
  if (topCut) {
    shape.moveTo(-half, BAFFLE_CUT_Y);
    shape.lineTo(half, BAFFLE_CUT_Y);
    shape.absarc(0, 0, BAFFLE_R, Math.PI / 6, (-7 * Math.PI) / 6, true);
  } else {
    shape.moveTo(-half, -BAFFLE_CUT_Y);
    shape.lineTo(half, -BAFFLE_CUT_Y);
    shape.absarc(0, 0, BAFFLE_R, -Math.PI / 6, (7 * Math.PI) / 6, false);
  }
  for (const leg of LEGS) {
    const onPlate = topCut ? leg.y <= BAFFLE_CUT_Y - BAFFLE_HOLE_R : leg.y >= -BAFFLE_CUT_Y + BAFFLE_HOLE_R;
    if (!onPlate) continue;
    const hole = new Path();
    hole.absarc(-leg.z, leg.y, BAFFLE_HOLE_R, 0, 2 * Math.PI, true);
    shape.holes.push(hole);
  }
  return shape;
}

/** A plate of the given thickness along x, centred on x = centreX. */
function plateGeometry(shape: Shape, thickness: number, centreX: number): BufferGeometry {
  const g = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1, curveSegments: 32 });
  g.rotateY(Math.PI / 2);
  g.translate(centreX - thickness / 2, 0, 0);
  return g;
}

/** Solid of revolution about x from a (radius, axial) profile. */
function revolveAlongX(profile: readonly Vector2[], segments: number): BufferGeometry {
  const g = new LatheGeometry([...profile], segments);
  g.rotateZ(-Math.PI / 2);
  return g;
}

function bonnetProfile(): Vector2[] {
  const points: Vector2[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = ((Math.PI / 2) * i) / steps;
    points.push(new Vector2(0.19 * Math.sin(t), -0.05 - 0.1 * Math.cos(t)));
  }
  points.push(new Vector2(0.19, 0.12), new Vector2(0.21, 0.12), new Vector2(0.21, 0.15), new Vector2(0, 0.15));
  return points;
}

function shellProfile(): Vector2[] {
  const points: Vector2[] = [
    new Vector2(0, -0.7),
    new Vector2(0.2, -0.7),
    new Vector2(0.2, -0.67),
    new Vector2(0.19, -0.67),
  ];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = ((Math.PI / 2) * i) / steps;
    points.push(new Vector2(0.19 * Math.cos(t), 0.6 + 0.1 * Math.sin(t)));
  }
  return points;
}

/** All 17 U-tubes (34 legs and 17 half-torus bends, 51 pieces) merged into one geometry. */
function tubeBundleGeometry(): BufferGeometry {
  const pieces: BufferGeometry[] = [];
  for (const u of U_TUBES) {
    for (const y of [u.r, -u.r]) {
      // The leg runs from LEG_START_X to the bend centre, so the legs and the bends always meet.
      const leg = cylinderX(TUBE_R, BEND_X - LEG_START_X, 10);
      leg.translate((BEND_X + LEG_START_X) / 2, y, u.z);
      pieces.push(leg);
    }
    const bend = new TorusGeometry(u.r, TUBE_R, 8, 16, Math.PI);
    bend.rotateZ(-Math.PI / 2);
    bend.translate(BEND_X, 0, u.z);
    pieces.push(bend);
  }
  const merged = mergeGeometries(pieces, false);
  for (const p of pieces) p.dispose();
  if (merged === null) {
    throw new Error('buildHeatExchangerModel: the tube pieces could not be merged into one geometry');
  }
  return merged;
}

const BUILDERS: Readonly<Record<string, PartBuilder>> = {
  // extents 0.3 x 0.66 x 0.42: domed cap and two tube-side nozzles (top and bottom), 5 meshes
  'hx-bonnet': (ctx) => {
    addMesh(ctx, revolveAlongX(bonnetProfile(), 40), 0, 0, 0);
    for (const s of [1, -1]) {
      addMesh(ctx, cylinderY(0.05, 0.14, 24), 0.03, s * 0.23, 0);
      addMesh(ctx, cylinderY(0.07, 0.03, 28), 0.03, s * 0.315, 0);
    }
  },
  // extents 0.05 x 0.42 x 0.42: a disc with 34 holes, 1 mesh
  'hx-tube-sheet': (ctx) => {
    addMesh(ctx, plateGeometry(tubeSheetShape(), TUBE_SHEET_THICKNESS, 0), 0, 0, 0);
  },
  // extents 1.4 x 0.4 x 0.4: closed shell with a thin front flange and a rounded rear end, 1 mesh
  'hx-shell': (ctx) => {
    addMesh(ctx, revolveAlongX(shellProfile(), 48), 0, 0, 0);
  },
  // extents 1.3 x 0.24 x 0.28: 17 U-tubes merged into ONE mesh (not an InstancedMesh)
  'hx-tube-bundle': (ctx) => {
    addMesh(ctx, tubeBundleGeometry(), 0, 0, 0);
  },
  // extents 0.9 x 0.32 x 0.32: five segmental plates (window top, bottom, top, bottom, top) and four tie rods, 9 meshes
  'hx-baffles': (ctx) => {
    BAFFLE_XS.forEach((x, i) => {
      addMesh(ctx, plateGeometry(baffleShape(i % 2 === 0), BAFFLE_THICKNESS, x), 0, 0, 0);
    });
    for (const y of [-0.05, 0.05]) {
      for (const z of [-0.14, 0.14]) {
        addMesh(ctx, cylinderX(0.008, 0.89, 10), 0, y, z);
      }
    }
  },
  // extents 0.8 x 0.14 x 0.12: two nozzles on top of the shell, each a pipe and a flange ring, 4 meshes
  'hx-shell-nozzles': (ctx) => {
    for (const x of [-0.34, 0.34]) {
      addMesh(ctx, cylinderY(0.04, 0.11, 20), x, -0.015, 0);
      addMesh(ctx, cylinderY(0.06, 0.03, 24), x, 0.055, 0);
    }
  },
};

/**
 * Builds the Heat_Exchanger: one Group per catalogue Part, at its rest position.
 * Throws if a Part has no shape. Allocates freely. Call once at setup.
 */
export function buildHeatExchangerModel(
  parts: readonly PartEntry[] = HEAT_EXCHANGER_PARTS,
  initialLook: Look = DEFAULT_LOOK,
): MachineModel {
  const model = buildMachineModel(parts, BUILDERS, initialLook);
  model.root.name = 'machine:heat-exchanger';
  return model;
}
