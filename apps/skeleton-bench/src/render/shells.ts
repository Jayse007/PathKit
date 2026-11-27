// Selection shell and focus shell (Task 17.7, Requirements 14.7 and 14.9, decision 18).
// An inverted hull: for each mesh of a Part, a back-face copy that shares the geometry, scaled about the
// geometry's own centre (SELECT_SHELL_SCALE 1.05 for selection, FOCUS_SHELL_SCALE 1.03 for focus) and drawn in
// the accent colour of the Look. Only its rim shows around the Part, so the cue is a thicker outline, not a
// colour change alone. The shells are children of the meshes, so they move, explode and spin with them.
// Shells carry userData.isShell and no partId, and are never in the picking list.
// Setup allocates; setSelected, setFocused and setLook only toggle `visible` and set a colour.
import { BackSide, Color, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import type { Object3D } from 'three';
import { FOCUS_SHELL_SCALE, SELECT_SHELL_SCALE } from '../constants.js';
import type { Look } from '../ui/storage.js';
import { LOOK_PALETTES } from './looks.js';
import { collectPartMeshes } from './picking.js';

export interface Shells {
  /** Show the selection shell on one Part, or on none (null). */
  setSelected(partId: string | null): void;
  /** Show the focus shell on one Part, or on none (null). Hidden for the selected Part, which has the larger shell. */
  setFocused(partId: string | null): void;
  /** Recolour both shells with the accent of the Look. */
  setLook(look: Look): void;
  /** Number of shell meshes created (two per Part mesh). */
  readonly shellCount: number;
  /** Remove the shells and release their materials. The geometries belong to the Part meshes. */
  dispose(): void;
}

interface ShellPair {
  readonly partId: string;
  readonly select: Mesh;
  readonly focus: Mesh;
}

function makeShell(source: Mesh, scale: number, material: MeshBasicMaterial, centre: Vector3): Mesh {
  const shell = new Mesh(source.geometry, material);
  shell.name = `${source.name}:shell`;
  shell.userData.isShell = true;
  shell.scale.setScalar(scale);
  // Scaling about the geometry centre c: p -> c + s * (p - c) = s * p + c * (1 - s).
  shell.position.copy(centre).multiplyScalar(1 - scale);
  shell.visible = false;
  source.add(shell);
  return shell;
}

/** Builds the shells for every Part mesh under `root`. Call once at setup, after the model is complete. */
export function createShells(root: Object3D, initialLook: Look): Shells {
  const selectMaterial = new MeshBasicMaterial({ side: BackSide });
  const focusMaterial = new MeshBasicMaterial({ side: BackSide });
  const accent = new Color();
  const pairs: ShellPair[] = [];
  const centre = new Vector3();

  for (const mesh of collectPartMeshes(root)) {
    const geometry = mesh.geometry;
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    geometry.boundingBox!.getCenter(centre);
    pairs.push({
      partId: mesh.userData.partId as string,
      select: makeShell(mesh, SELECT_SHELL_SCALE, selectMaterial, centre),
      focus: makeShell(mesh, FOCUS_SHELL_SCALE, focusMaterial, centre),
    });
  }

  let selectedId: string | null = null;
  let focusedId: string | null = null;

  function refresh(): void {
    for (const pair of pairs) {
      const isSelected = pair.partId === selectedId;
      pair.select.visible = isSelected;
      pair.focus.visible = !isSelected && pair.partId === focusedId;
    }
  }

  function setLook(look: Look): void {
    accent.set(LOOK_PALETTES[look].accent);
    selectMaterial.color.copy(accent);
    focusMaterial.color.copy(accent);
  }

  setLook(initialLook);

  return {
    setSelected(partId: string | null): void {
      selectedId = partId;
      refresh();
    },
    setFocused(partId: string | null): void {
      focusedId = partId;
      refresh();
    },
    setLook,
    shellCount: pairs.length * 2,
    dispose(): void {
      for (const pair of pairs) {
        pair.select.removeFromParent();
        pair.focus.removeFromParent();
      }
      pairs.length = 0;
      selectMaterial.dispose();
      focusMaterial.dispose();
    },
  };
}
