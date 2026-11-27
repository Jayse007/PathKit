// Desk_Lamp model (Task 18.3): a spring-balanced arm lamp, seven Parts built in code from Three.js shapes,
// no model file. Shapes and numbers come from docs/design-pack-18-3.md, section 4.
// Each Part is a Group named `part:<id>` (made by buildMachineModel) with `userData.partId`.
// Units: metres. Y-up. The arms lean towards +x. Each shape is written around its Part's own centre.
import { CylinderGeometry, Curve, LatheGeometry, TubeGeometry, Vector2, Vector3, type BufferGeometry } from 'three';
import { DESK_LAMP_PARTS } from '../data/catalogue.js';
import type { PartEntry } from '../data/catalogue-types.js';
import { DEFAULT_LOOK } from '../ui/storage.js';
import type { Look } from '../ui/storage.js';
import { addMesh, buildMachineModel, cylinderX, cylinderY } from './model-kit.js';
import type { BuildContext, MachineModel, PartBuilder } from './model-kit.js';

/** Radius of each arm bar. */
const BAR_R = 0.016;
/** z of the two parallel bars of an arm. */
const BAR_Z = 0.032;
/** Spring end points (x, y) of the line between the upper arm bars. */
const SPRING_HALF_X = 0.0798;
const SPRING_HALF_Y = 0.2419;

/** Cylinder whose axis is z. */
function cylinderZ(radius: number, length: number, segments: number): BufferGeometry {
  const g = new CylinderGeometry(radius, radius, length, segments);
  g.rotateX(Math.PI / 2);
  return g;
}

/** A round bar from (x1, y1) to (x2, y2) in the x-y plane, at depth z. */
function addBar(ctx: BuildContext, x1: number, y1: number, x2: number, y2: number, z: number): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const g = cylinderY(BAR_R, Math.hypot(dx, dy), 16);
  // rotateZ(a) turns +y into (-sin a, cos a); we want (dx, dy) / length.
  g.rotateZ(Math.atan2(-dx, dy));
  addMesh(ctx, g, (x1 + x2) / 2, (y1 + y2) / 2, z);
}

/** A close-coiled helix about the y axis, from y = -length / 2 to y = +length / 2. */
class HelixCurve extends Curve<Vector3> {
  constructor(
    private readonly radius: number,
    private readonly turns: number,
    private readonly length: number,
  ) {
    super();
  }

  override getPoint(t: number, optionalTarget: Vector3 = new Vector3()): Vector3 {
    const a = 2 * Math.PI * this.turns * t;
    return optionalTarget.set(this.radius * Math.cos(a), (t - 0.5) * this.length, this.radius * Math.sin(a));
  }
}

function springGeometry(): BufferGeometry {
  const length = Math.hypot(2 * SPRING_HALF_X, 2 * SPRING_HALF_Y);
  const g = new TubeGeometry(new HelixCurve(0.009, 40, length), 480, 0.004, 6, false);
  g.rotateZ(-Math.atan2(2 * SPRING_HALF_X, 2 * SPRING_HALF_Y));
  return g;
}

function shadeProfile(): Vector2[] {
  return [
    new Vector2(0, 0.125),
    new Vector2(0.05, 0.125),
    new Vector2(0.05, 0.12),
    new Vector2(0.15, -0.125),
    new Vector2(0.142, -0.125),
    new Vector2(0.042, 0.112),
    new Vector2(0, 0.112),
  ];
}

const BUILDERS: Readonly<Record<string, PartBuilder>> = {
  // extents 0.5 x 0.1 x 0.5: a weighted disc and a short post, 2 meshes
  'lamp-base': (ctx) => {
    addMesh(ctx, cylinderY(0.25, 0.05, 48), 0, -0.025, 0);
    addMesh(ctx, cylinderY(0.06, 0.05, 32), 0, 0.025, 0);
  },
  // extents 0.3 x 0.6 x 0.1: two parallel round bars, 2 meshes
  'lamp-upper-arm': (ctx) => {
    for (const z of [-BAR_Z, BAR_Z]) addBar(ctx, -0.095, -0.288, 0.095, 0.288, z);
  },
  // extents 0.2 x 0.52 x 0.06: a close-coiled helix and two end pins, 3 meshes
  'lamp-spring': (ctx) => {
    addMesh(ctx, springGeometry(), 0, 0, 0);
    addMesh(ctx, cylinderZ(0.006, 0.05, 12), SPRING_HALF_X, SPRING_HALF_Y, 0);
    addMesh(ctx, cylinderZ(0.006, 0.05, 12), -SPRING_HALF_X, -SPRING_HALF_Y, 0);
  },
  // extents 0.12 x 0.12 x 0.16: a barrel and two end caps, 3 meshes
  'lamp-elbow': (ctx) => {
    addMesh(ctx, cylinderZ(0.06, 0.14, 32), 0, 0, 0);
    addMesh(ctx, cylinderZ(0.035, 0.02, 20), 0, 0, -0.07);
    addMesh(ctx, cylinderZ(0.035, 0.02, 20), 0, 0, 0.07);
  },
  // extents 0.8 x 0.3 x 0.1: two parallel round bars, 2 meshes
  'lamp-forearm': (ctx) => {
    for (const z of [-BAR_Z, BAR_Z]) addBar(ctx, -0.39, -0.02, 0.39, 0.025, z);
  },
  // extents 0.3 x 0.25 x 0.3: a closed metal cone, a bracket and a pivot (the yoke), 3 meshes
  'lamp-shade': (ctx) => {
    addMesh(ctx, new LatheGeometry(shadeProfile(), 48), 0, 0, 0);
    addMesh(ctx, cylinderX(0.016, 0.12, 16), -0.09, 0.095, 0);
    addMesh(ctx, cylinderZ(0.03, 0.1, 24), -0.12, 0.095, 0);
  },
  // extents 0.1 x 0.14 x 0.1: three stacked cylinders, 3 meshes
  'lamp-bulb-holder': (ctx) => {
    addMesh(ctx, cylinderY(0.03, 0.06, 20), 0, 0.04, 0);
    addMesh(ctx, cylinderY(0.04, 0.03, 20), 0, -0.005, 0);
    addMesh(ctx, cylinderY(0.035, 0.05, 20), 0, -0.045, 0);
  },
};

/**
 * Builds the Desk_Lamp: one Group per catalogue Part, at its rest position.
 * Throws if a Part has no shape. Allocates freely. Call once at setup.
 */
export function buildDeskLampModel(
  parts: readonly PartEntry[] = DESK_LAMP_PARTS,
  initialLook: Look = DEFAULT_LOOK,
): MachineModel {
  const model = buildMachineModel(parts, BUILDERS, initialLook);
  model.root.name = 'machine:desk-lamp';
  return model;
}
