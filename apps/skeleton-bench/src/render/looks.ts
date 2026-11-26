// The two Looks (Task 17.5): palette objects and two material sets. App code, no PathKit.
// X_Ray_Skeleton: near-black background, bone-ivory translucent fills, thin cyan EdgesGeometry edges,
//   one orange accent (for the selected Part, used by Task 17.7).
// Clean_Engineering: light neutral background, solid matte Parts, one blue accent.
// Everything here allocates at setup or when the Look changes, never in the per-frame draw.
import {
  AmbientLight,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  LineBasicMaterial,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Material,
  type Scene,
} from 'three';
import type { Look } from '../ui/storage.js';

/** Colours are "#rrggbb" strings so the Contrast_Function can read them later. */
export interface LookPalette {
  readonly background: string;
  readonly fill: string;
  /** 1 means solid. Below 1 the fill is translucent. */
  readonly fillOpacity: number;
  /** Edge line colour, or null when the Look draws no edges. */
  readonly edge: string | null;
  /** The one accent colour of the Look (selected Part). */
  readonly accent: string;
}

/** The three Clean_Engineering greys A, B, C, all against the #eceff1 background at contrast 3 or more. */
export const CLEAN_FILLS: readonly [string, string, string] = ['#7d8793', '#5f6974', '#444e59'];

/** Which of the three greys (0 = A, 1 = B, 2 = C) the Part at this catalogue index gets: index mod 3. */
export function cleanFillIndex(partIndex: number): number {
  return partIndex % CLEAN_FILLS.length;
}

export const LOOK_PALETTES: Readonly<Record<Look, LookPalette>> = {
  X_Ray_Skeleton: {
    background: '#05080c',
    fill: '#e8e0c8',
    fillOpacity: 0.22,
    edge: '#22d3ee',
    accent: '#ff8a1f',
  },
  Clean_Engineering: {
    background: '#eceff1',
    fill: CLEAN_FILLS[0],
    fillOpacity: 1,
    edge: null,
    accent: '#1f6feb',
  },
};

export const ALL_LOOKS: readonly Look[] = ['X_Ray_Skeleton', 'Clean_Engineering'];

/** The materials one model uses for one Look. */
export interface LookMaterials {
  readonly fill: Material;
  /** Three fills, indexed by cleanFillIndex. X_Ray_Skeleton uses the same material three times. */
  readonly fills: readonly [Material, Material, Material];
  /** Null when the Look draws no edges. */
  readonly edge: LineBasicMaterial | null;
}

/** Builds both material sets for one model. The caller disposes them with disposeLookMaterials. */
export function createLookMaterials(): Record<Look, LookMaterials> {
  const xray = LOOK_PALETTES.X_Ray_Skeleton;
  // Unlit and translucent. depthWrite is off so inner Parts and their edges show through.
  const xrayFill = new MeshBasicMaterial({
    color: new Color(xray.fill),
    transparent: true,
    opacity: xray.fillOpacity,
    depthWrite: false,
    side: DoubleSide,
  });
  // Matte: no metal, full roughness. Needs the lights from createLookLights.
  const cleanMat = (hex: string): MeshStandardMaterial =>
    new MeshStandardMaterial({ color: new Color(hex), roughness: 1, metalness: 0 });
  const cleanA = cleanMat(CLEAN_FILLS[0]);
  const cleanB = cleanMat(CLEAN_FILLS[1]);
  const cleanC = cleanMat(CLEAN_FILLS[2]);
  return {
    X_Ray_Skeleton: {
      fill: xrayFill,
      fills: [xrayFill, xrayFill, xrayFill],
      edge: new LineBasicMaterial({ color: new Color(xray.edge as string) }),
    },
    Clean_Engineering: {
      fill: cleanA,
      fills: [cleanA, cleanB, cleanC],
      edge: null,
    },
  };
}

export function disposeLookMaterials(sets: Record<Look, LookMaterials>): void {
  for (const look of ALL_LOOKS) {
    for (const m of new Set(sets[look].fills)) m.dispose();
    sets[look].edge?.dispose();
  }
}

/**
 * Lights for the lit Look. They stay in the scene for both Looks because the X-ray materials ignore lights.
 * Add the returned group to the scene once.
 */
export function createLookLights(): Group {
  const group = new Group();
  group.name = 'look-lights';
  group.add(new AmbientLight(0xffffff, 1.1));
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 4, 3);
  group.add(key);
  const fill = new DirectionalLight(0xffffff, 0.8);
  fill.position.set(-3, 1, -2);
  group.add(fill);
  return group;
}

/** Sets the scene background to the Look's colour. Call when the Look changes, then request a render. */
export function applySceneBackground(scene: Scene, look: Look): void {
  const bg = LOOK_PALETTES[look].background;
  if (scene.background instanceof Color) {
    scene.background.set(bg);
  } else {
    scene.background = new Color(bg);
  }
}
