// Picking (Task 17.7). A Raycaster tests meshes only. Edge LineSegments (children of the meshes) and the
// selection and focus shells are never in the tested list, so they cannot be hit.
// The raycaster, the pointer vector and the hit array are created once; a pick reuses them.
// A pick runs on a click, not per frame, but Three.js still allocates inside intersectObjects (its own
// vectors), so "no allocation" is true only for the objects this file owns.
import { Raycaster, Vector2 } from 'three';
import type { Camera, Intersection, Mesh, Object3D } from 'three';
import { clientToNdc } from '../logic/pick-math.js';

/** The meshes under `root` that carry userData.partId and are not shells. Collect before adding shells. */
export function collectPartMeshes(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.isMesh === true && typeof mesh.userData.partId === 'string' && mesh.userData.isShell !== true) {
      found.push(mesh);
    }
  });
  return found;
}

export interface Picker {
  /** Part id of the nearest mesh under a point given in NDC, or null for empty space. */
  pickNdc(ndcX: number, ndcY: number): string | null;
  /** Same, from a pointer position and the canvas rectangle (CSS pixels). */
  pickClient(clientX: number, clientY: number, canvas: HTMLElement): string | null;
}

/**
 * `root` is the object whose world matrices are refreshed before each pick (the stage scene or machine group).
 * `meshes` is the list to test, normally from collectPartMeshes.
 */
export function createPicker(camera: Camera, root: Object3D, meshes: readonly Mesh[]): Picker {
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const hits: Intersection[] = [];

  function pickNdc(ndcX: number, ndcY: number): string | null {
    // Parts move with the Explode_Amount; a pending draw may not have refreshed the matrices yet.
    root.updateMatrixWorld(true);
    pointer.set(ndcX, ndcY);
    raycaster.setFromCamera(pointer, camera);
    hits.length = 0;
    raycaster.intersectObjects(meshes as Mesh[], false, hits);
    // Results are sorted nearest first. Every tested mesh has a partId.
    const first = hits[0];
    const id = first === undefined ? null : (first.object.userData.partId as string);
    hits.length = 0;
    return id;
  }

  return {
    pickNdc,
    pickClient(clientX: number, clientY: number, canvas: HTMLElement): string | null {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      clientToNdc(clientX, clientY, rect.left, rect.top, rect.width, rect.height, pointer);
      return pickNdc(pointer.x, pointer.y);
    },
  };
}
