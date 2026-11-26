// Part placement (Task 17.3): puts each Part group where its baked Part scene says it is at the
// frame that Explode_Easing returns. Reads only baked data (evaluateEntity), never bakes.
// place() allocates nothing: it loops over a fixed array and writes through one preallocated OutBuffer.
import { evaluateEntity, type BakedData, type OutBuffer } from '../pathkit-api.js';
import { explodeFrame } from '../logic/explode-easing.js';
import type { Group } from 'three';

export interface PartPlacer {
  /** Place every Part at a whole Part-scene frame (0 to 59). */
  placeAtFrame(frame: number): void;
  /** Place every Part for an Explode_Amount in percent, through Explode_Easing. */
  placeAtAmount(amountPercent: number): void;
}

interface Entry {
  readonly id: string;
  readonly object: Group;
  readonly baked: BakedData;
}

/**
 * Create a placer. `parts` pairs each Part id with its group; `baked` comes from bakeParts().
 * Throws if a Part has no baked scene. Allocates freely. Call once at setup.
 */
export function createPartPlacer(
  parts: ReadonlyMap<string, Group>,
  baked: ReadonlyMap<string, BakedData>,
): PartPlacer {
  const entries: Entry[] = [];
  for (const [id, object] of parts) {
    const data = baked.get(id);
    if (data === undefined) {
      throw new Error(`createPartPlacer: no baked Part scene for "${id}"`);
    }
    entries.push({ id, object, baked: data });
  }
  const out: OutBuffer = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  function placeAtFrame(frame: number): void {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry === undefined) continue;
      evaluateEntity(entry.baked, entry.id, frame, out);
      // Position only. Parts never rotate.
      entry.object.position.set(out.position.x, out.position.y, out.position.z);
    }
  }

  function placeAtAmount(amountPercent: number): void {
    placeAtFrame(explodeFrame(amountPercent));
  }

  return { placeAtFrame, placeAtAmount };
}
