// Subject view (task 30.1): the car and the road, drawn with Three.js. Loads Three.js, so no test imports this file.
//
// The car is boxes and cylinders only (no brand, logo or plate text). Its parts sit inside an inner group
// that is lowered by SUBJECT_CENTRE_HEIGHT, so the outer group's origin is the centre of the car's box and
// the baked pose can be copied onto the outer group as it is.
//
// The road is a flat ribbon plus a centre line. Both are built from ROAD_DRAW_SAMPLES samples along the
// curve, once at setup and again only when the Road points change.
//
// Per-frame path (showFrame): no objects, arrays or closures are created. The OutBuffer is made once.

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import type { Object3D } from 'three';
import { createArcLengthTable, createCurve } from '../logic/pathkit.js';
import type { OutBuffer, Vec3 } from '../logic/pathkit.js';
import {
  CAR_HALF_EXTENT_X,
  CAR_HALF_EXTENT_Y,
  CAR_HALF_EXTENT_Z,
  ROAD_DRAW_SAMPLES,
  SUBJECT_CENTRE_HEIGHT,
} from '../logic/constants.js';
import type { CameraRig } from './camera-rig.js';

// View-only values (not in the design's Named constants table).
const ROAD_WIDTH_M = 6;
/** The road mesh sits this far above the ground grid, so the two do not flicker (z-fighting). */
const ROAD_LIFT_M = 0.02;
/** The centre line sits this far above the road mesh, for the same reason. */
const ROAD_LINE_LIFT_M = 0.02;
const ROAD_COLOUR = 0x3a3f47;
const ROAD_LINE_COLOUR = 0xd8d8d8;
const CAR_BODY_COLOUR = 0xc0392b;
const CAR_CABIN_COLOUR = 0x34495e;
const CAR_WHEEL_COLOUR = 0x111111;
const CAR_FRONT_COLOUR = 0xf1c40f; // a plain yellow bar: shows which end is the front

// Car parts, in metres, in the inner group where y = 0 is the ground under the car.
const WHEEL_RADIUS_M = 0.35;
const WHEEL_WIDTH_M = 0.25;
const WHEEL_X_M = CAR_HALF_EXTENT_X - WHEEL_WIDTH_M / 2;
const WHEEL_Z_M = 1.4;
const BODY_BOTTOM_M = 0.3;
const BODY_HEIGHT_M = 0.6;
const CABIN_HEIGHT_M = 2 * CAR_HALF_EXTENT_Y - BODY_BOTTOM_M - BODY_HEIGHT_M; // the roof is the top of the box
const CABIN_WIDTH_M = 1.5;
const CABIN_LENGTH_M = 2.2;
const CABIN_Z_M = -0.2;
const FRONT_BAR_WIDTH_M = 1.4;
const FRONT_BAR_HEIGHT_M = 0.15;
const FRONT_BAR_DEPTH_M = 0.1;
const FRONT_BAR_Y_M = 0.55;

export interface SubjectView {
  /** Add this to the stage scene. It holds the car and the road. */
  readonly object: Object3D;
  /**
   * Draw the road through `points` (a closed loop). Does nothing when the points are the same as the
   * last call. Throws (and keeps the old road) when the points cannot make a curve.
   */
  setRoad(points: readonly Vec3[]): void;
  /** Place the car at a displayed frame through the rig. Does not ask for a render. */
  showFrame(rig: CameraRig, displayedFrame: number): void;
  /** Release the geometries and materials. */
  dispose(): void;
}

function addBox(
  parent: Group,
  colour: number,
  size: Vec3,
  centre: Vec3,
  geometries: BufferGeometry[],
  materials: MeshBasicMaterial[],
): void {
  const geometry = new BoxGeometry(size.x, size.y, size.z);
  const material = new MeshBasicMaterial({ color: colour });
  const mesh = new Mesh(geometry, material);
  mesh.position.set(centre.x, centre.y, centre.z);
  parent.add(mesh);
  geometries.push(geometry);
  materials.push(material);
}

/** The car parts in a group lowered by SUBJECT_CENTRE_HEIGHT. Front is +Z, up is +Y. */
function buildCar(geometries: BufferGeometry[], materials: MeshBasicMaterial[]): Group {
  const parts = new Group();
  parts.position.y = -SUBJECT_CENTRE_HEIGHT;

  addBox(
    parts,
    CAR_BODY_COLOUR,
    { x: 2 * CAR_HALF_EXTENT_X, y: BODY_HEIGHT_M, z: 2 * CAR_HALF_EXTENT_Z },
    { x: 0, y: BODY_BOTTOM_M + BODY_HEIGHT_M / 2, z: 0 },
    geometries,
    materials,
  );
  addBox(
    parts,
    CAR_CABIN_COLOUR,
    { x: CABIN_WIDTH_M, y: CABIN_HEIGHT_M, z: CABIN_LENGTH_M },
    { x: 0, y: BODY_BOTTOM_M + BODY_HEIGHT_M + CABIN_HEIGHT_M / 2, z: CABIN_Z_M },
    geometries,
    materials,
  );
  addBox(
    parts,
    CAR_FRONT_COLOUR,
    { x: FRONT_BAR_WIDTH_M, y: FRONT_BAR_HEIGHT_M, z: FRONT_BAR_DEPTH_M },
    { x: 0, y: FRONT_BAR_Y_M, z: CAR_HALF_EXTENT_Z + FRONT_BAR_DEPTH_M / 2 },
    geometries,
    materials,
  );

  const wheelGeometry = new CylinderGeometry(WHEEL_RADIUS_M, WHEEL_RADIUS_M, WHEEL_WIDTH_M, 16);
  const wheelMaterial = new MeshBasicMaterial({ color: CAR_WHEEL_COLOUR });
  geometries.push(wheelGeometry);
  materials.push(wheelMaterial);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2; // a cylinder stands along Y; turn it to lie along X
      wheel.position.set(sx * WHEEL_X_M, WHEEL_RADIUS_M, sz * WHEEL_Z_M);
      parts.add(wheel);
    }
  }
  return parts;
}

interface RoadGeometry {
  ribbon: BufferGeometry;
  line: BufferGeometry;
}

/**
 * Samples the closed curve at ROAD_DRAW_SAMPLES equal arc-length steps and builds the ribbon and the
 * centre line. The ground level is the curve height minus SUBJECT_CENTRE_HEIGHT, plus the small lifts.
 */
function buildRoadGeometry(points: readonly Vec3[]): RoadGeometry {
  const copy = points.map((p) => ({ x: p.x, y: p.y, z: p.z }));
  const table = createArcLengthTable(createCurve(copy, true));
  const n = ROAD_DRAW_SAMPLES;
  const centre = new Float32Array(n * 3);
  const ribbon = new Float32Array(n * 2 * 3);
  const p: Vec3 = { x: 0, y: 0, z: 0 };
  const t: Vec3 = { x: 0, y: 0, z: 0 };
  const half = ROAD_WIDTH_M / 2;

  for (let i = 0; i < n; i++) {
    const d = (table.length * i) / n;
    table.pointAtDistance(d, p);
    table.tangentAtDistance(d, t);
    // Sideways direction on the ground: the tangent turned 90 degrees about Y, made unit length.
    let sx = -t.z;
    let sz = t.x;
    const sideLength = Math.sqrt(sx * sx + sz * sz);
    if (sideLength > 0) {
      sx /= sideLength;
      sz /= sideLength;
    } else {
      sx = 1;
      sz = 0;
    }
    const ground = p.y - SUBJECT_CENTRE_HEIGHT + ROAD_LIFT_M;
    ribbon.set([p.x + sx * half, ground, p.z + sz * half, p.x - sx * half, ground, p.z - sz * half], i * 6);
    centre.set([p.x, ground + ROAD_LINE_LIFT_M, p.z], i * 3);
  }

  // Two triangles per step; the last step wraps to sample 0.
  const indices = new Uint32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const a = 2 * i;
    const b = 2 * i + 1;
    const c = 2 * ((i + 1) % n);
    const d = 2 * ((i + 1) % n) + 1;
    indices.set([a, b, c, b, d, c], i * 6);
  }

  const ribbonGeometry = new BufferGeometry();
  ribbonGeometry.setAttribute('position', new BufferAttribute(ribbon, 3));
  ribbonGeometry.setIndex(new BufferAttribute(indices, 1));
  const lineGeometry = new BufferGeometry();
  lineGeometry.setAttribute('position', new BufferAttribute(centre, 3));
  return { ribbon: ribbonGeometry, line: lineGeometry };
}

/** Builds the car and the road for `roadPoints`. Throws when the points cannot make a curve. */
export function createSubjectView(roadPoints: readonly Vec3[]): SubjectView {
  const root = new Group();

  const carGeometries: BufferGeometry[] = [];
  const carMaterials: MeshBasicMaterial[] = [];
  const car = new Group(); // origin = centre of the car's box; the baked pose goes here
  car.add(buildCar(carGeometries, carMaterials));
  root.add(car);

  const ribbonMaterial = new MeshBasicMaterial({ color: ROAD_COLOUR, side: DoubleSide });
  const lineMaterial = new LineBasicMaterial({ color: ROAD_LINE_COLOUR });
  const road = buildRoadGeometry(roadPoints);
  const ribbonMesh = new Mesh(road.ribbon, ribbonMaterial);
  const centreLine = new LineLoop(road.line, lineMaterial);
  root.add(ribbonMesh);
  root.add(centreLine);

  let roadKey = JSON.stringify(roadPoints);
  const out: OutBuffer = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };

  return {
    object: root,
    setRoad(points: readonly Vec3[]): void {
      const key = JSON.stringify(points);
      if (key === roadKey) return;
      const next = buildRoadGeometry(points); // throws before anything is swapped
      ribbonMesh.geometry.dispose();
      centreLine.geometry.dispose();
      ribbonMesh.geometry = next.ribbon;
      centreLine.geometry = next.line;
      roadKey = key;
    },
    showFrame(rig: CameraRig, displayedFrame: number): void {
      rig.evaluateSubject(displayedFrame, out);
      car.position.set(out.position.x, out.position.y, out.position.z);
      car.quaternion.set(out.rotation.x, out.rotation.y, out.rotation.z, out.rotation.w);
    },
    dispose(): void {
      for (const g of carGeometries) g.dispose();
      for (const m of carMaterials) m.dispose();
      ribbonMesh.geometry.dispose();
      centreLine.geometry.dispose();
      ribbonMaterial.dispose();
      lineMaterial.dispose();
    },
  };
}
