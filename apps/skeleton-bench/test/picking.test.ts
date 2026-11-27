import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
} from 'three';
import type { Object3D } from 'three';
import { createClickTracker } from '../src/logic/click-tracker.js';
import { clientToNdc } from '../src/logic/pick-math.js';
import { collectPartMeshes, createPicker } from '../src/render/picking.js';
import { createShells } from '../src/render/shells.js';

// Task 17.7. Three.js runs in Node here; no WebGL, no browser. Expected values are written by hand.

describe('clientToNdc', () => {
  it('maps the corners, the centre and one inner point of a 400 x 200 canvas at (100, 50)', () => {
    // [clientX, clientY, expected x, expected y]
    const rows: number[][] = [
      [300, 150, 0, 0],
      [100, 50, -1, 1],
      [500, 250, 1, -1],
      [200, 100, -0.5, 0.5],
    ];
    const out = { x: 99, y: 99 };
    rows.forEach((row, i) => {
      clientToNdc(row[0]!, row[1]!, 100, 50, 400, 200, out);
      if (Math.abs(out.x - row[2]!) > 1e-12 || Math.abs(out.y - row[3]!) > 1e-12) {
        throw new Error(`clientToNdc row ${i}: expected (${row[2]}, ${row[3]}), got (${out.x}, ${out.y})`);
      }
    });
  });

  it('throws for a non-finite input and names the value', () => {
    expect(() => clientToNdc(Number.NaN, 0, 0, 0, 10, 10, { x: 0, y: 0 })).toThrow(/NaN/);
  });

  it('throws for a rectangle with no area', () => {
    expect(() => clientToNdc(0, 0, 0, 0, 0, 10, { x: 0, y: 0 })).toThrow(/above 0/);
  });
});

describe('click tracker (5 px rule)', () => {
  it('5 px from the press is a click', () => {
    const t = createClickTracker();
    t.press(10, 10);
    expect(t.release(13, 14)).toBe('click'); // distance exactly 5
  });

  it('6 px from the press is a drag', () => {
    const t = createClickTracker();
    t.press(0, 0);
    expect(t.release(6, 0)).toBe('drag');
  });

  it('a gesture that went out to 6 px and came back to 2 px is a drag', () => {
    const t = createClickTracker();
    t.press(0, 0);
    t.move(6, 0);
    t.move(2, 0);
    expect(t.release(2, 0)).toBe('drag');
  });

  it('release without a press, after a release, or after cancel gives null', () => {
    const t = createClickTracker();
    expect(t.release(0, 0)).toBeNull();
    t.move(50, 50);
    expect(t.active).toBe(false);
    t.press(0, 0);
    expect(t.release(0, 0)).toBe('click');
    expect(t.release(0, 0)).toBeNull();
    t.press(0, 0);
    t.cancel();
    expect(t.release(0, 0)).toBeNull();
  });

  it('a new press starts a fresh gesture: an earlier drag does not leak into the next click', () => {
    const t = createClickTracker();
    t.press(0, 0);
    t.move(10, 0);
    expect(t.release(0, 0)).toBe('drag');
    t.press(0, 0);
    expect(t.release(1, 1)).toBe('click'); // distance 1.414, under 5
  });

  it('active is true only between press and release', () => {
    const t = createClickTracker();
    expect(t.active).toBe(false);
    t.press(1, 1);
    expect(t.active).toBe(true);
    t.release(1, 1);
    expect(t.active).toBe(false);
  });
});

/** Three unit boxes: a at the origin, b behind it at z = -3, c to the right at x = 3. a has an edge child. */
function buildScene(): { root: Group; a: Mesh; b: Mesh; c: Mesh } {
  const root = new Group();
  const make = (id: string, x: number, z: number): Mesh => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    mesh.name = `part:${id}:mesh`;
    mesh.userData.partId = id;
    mesh.position.set(x, 0, z);
    root.add(mesh);
    return mesh;
  };
  const a = make('a', 0, 0);
  const b = make('b', 0, -3);
  const c = make('c', 3, 0);
  const edge = new LineSegments(new EdgesGeometry(a.geometry), new LineBasicMaterial());
  edge.userData.partId = 'a';
  a.add(edge);
  const floor = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()); // a mesh without a partId
  floor.position.set(0, -5, 0);
  root.add(floor);
  return { root, a, b, c };
}

function makeCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

describe('picking', () => {
  it('collectPartMeshes returns the three Part meshes in order, not the edge lines or the mesh without a partId', () => {
    const { root } = buildScene();
    const ids = collectPartMeshes(root).map((m) => m.userData.partId as string);
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('the nearest mesh on the ray wins: a is in front of b at the screen centre', () => {
    const { root } = buildScene();
    const picker = createPicker(makeCamera(), root, collectPartMeshes(root));
    expect(picker.pickNdc(0, 0)).toBe('a');
  });

  it('pickClient on a canvas with a 0 x 0 rectangle returns null and does not throw', () => {
    const { root } = buildScene();
    const picker = createPicker(makeCamera(), root, collectPartMeshes(root));
    const canvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    } as unknown as HTMLElement;
    expect(picker.pickClient(5, 5, canvas)).toBeNull();
  });

  it('with only b in the list, the same ray gives b', () => {
    const { root, b } = buildScene();
    const picker = createPicker(makeCamera(), root, [b]);
    expect(picker.pickNdc(0, 0)).toBe('b');
  });

  it('a point right of centre reaches c (x about 2.88 at its front face)', () => {
    const { root } = buildScene();
    const picker = createPicker(makeCamera(), root, collectPartMeshes(root));
    expect(picker.pickNdc(0.65, 0)).toBe('c');
  });

  it('a point near the top right corner hits nothing', () => {
    const { root } = buildScene();
    const picker = createPicker(makeCamera(), root, collectPartMeshes(root));
    expect(picker.pickNdc(0.9, 0.9)).toBeNull();
  });
});

function shellsIn(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((o) => {
    if (o.userData.isShell === true) found.push(o as Mesh);
  });
  return found;
}

function visibleShells(root: Object3D): Mesh[] {
  return shellsIn(root).filter((s) => s.visible);
}

describe('selection shell and focus shell', () => {
  it('creates two hidden shells per Part mesh (6 for 3 meshes), each a child of its mesh', () => {
    const { root, a } = buildScene();
    const shells = createShells(root, 'X_Ray_Skeleton');
    expect(shells.shellCount).toBe(6);
    expect(shellsIn(root).length).toBe(6);
    expect(visibleShells(root).length).toBe(0);
    expect(a.children.filter((c) => c.userData.isShell === true).length).toBe(2);
  });

  it('selecting a shows exactly one shell, scale 1.05, on a', () => {
    const { root, a } = buildScene();
    const shells = createShells(root, 'X_Ray_Skeleton');
    shells.setSelected('a');
    const visible = visibleShells(root);
    expect(visible.length).toBe(1);
    expect(visible[0]!.scale.x).toBe(1.05);
    expect(visible[0]!.parent).toBe(a);
  });

  it('focus uses scale 1.03 and gives way to the selection shell on the same Part', () => {
    const { root } = buildScene();
    const shells = createShells(root, 'X_Ray_Skeleton');
    shells.setSelected('a');
    shells.setFocused('b');
    expect(
      visibleShells(root)
        .map((s) => s.scale.x)
        .sort(),
    ).toEqual([1.03, 1.05]);
    shells.setFocused('a');
    const onlySelect = visibleShells(root);
    expect(onlySelect.length).toBe(1);
    expect(onlySelect[0]!.scale.x).toBe(1.05);
    shells.setSelected(null);
    const onlyFocus = visibleShells(root);
    expect(onlyFocus.length).toBe(1);
    expect(onlyFocus[0]!.scale.x).toBe(1.03);
    shells.setFocused(null);
    expect(visibleShells(root).length).toBe(0);
  });

  it('shell colour is the accent of the Look: orange ff8a1f in X-ray, blue 1f6feb in Clean_Engineering', () => {
    const { root } = buildScene();
    const shells = createShells(root, 'X_Ray_Skeleton');
    const first = shellsIn(root)[0]!;
    const hex = (): string => (first.material as MeshBasicMaterial).color.getHexString();
    expect(hex()).toBe('ff8a1f');
    shells.setLook('Clean_Engineering');
    expect(hex()).toBe('1f6feb');
  });

  it('scales about the geometry centre: a box centred at x = 2 gets a shell offset of 2 * (1 - 1.05) = -0.1', () => {
    const root = new Group();
    const geometry = new BoxGeometry(1, 1, 1);
    geometry.translate(2, 0, 0);
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    mesh.userData.partId = 'off';
    root.add(mesh);
    const shells = createShells(root, 'Clean_Engineering');
    shells.setSelected('off');
    const shell = visibleShells(root)[0]!;
    expect(Math.abs(shell.position.x - -0.1)).toBeLessThan(1e-9);
    expect(Math.abs(shell.position.y)).toBeLessThan(1e-12);
  });

  it('both visible shells (selection and focus) take the accent of the Look, and follow a Look change', () => {
    const { root } = buildScene();
    const shells = createShells(root, 'X_Ray_Skeleton');
    shells.setFocused('b');
    shells.setSelected('a');
    const visible = visibleShells(root);
    expect(visible.length).toBe(2);
    const hexes = (): string[] => visible.map((s) => (s.material as MeshBasicMaterial).color.getHexString());
    shells.setLook('Clean_Engineering');
    expect(hexes()).toEqual(['1f6feb', '1f6feb']);
    shells.setLook('X_Ray_Skeleton');
    expect(hexes()).toEqual(['ff8a1f', 'ff8a1f']);
  });

  it('shells are never picked: the same ray still gives a with a selected, and only 3 meshes are collected', () => {
    const { root } = buildScene();
    const shells = createShells(root, 'X_Ray_Skeleton');
    shells.setSelected('a');
    const list = collectPartMeshes(root);
    expect(list.length).toBe(3);
    const picker = createPicker(makeCamera(), root, list);
    expect(picker.pickNdc(0, 0)).toBe('a');
  });
});
