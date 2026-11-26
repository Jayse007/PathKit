// Part scenes: one PathKit scene per Part, baked once at load.
// Each scene has one entity (id = Part id) with a single followPath, no aimAt and no targets.
// The app reads position only. Parts never rotate.
import {
  bake,
  createArcLengthTable,
  createCurve,
  type BakedData,
  type Scene,
  type Vec3,
} from '../pathkit-api.js';
import {
  EXPLODE_FRAMES,
  FPS,
  PART_FORWARD_AXIS,
  PART_UP_AXIS,
} from '../constants.js';
import { CATALOGUE } from '../data/catalogue.js';
import type { PartEntry } from '../data/catalogue-types.js';
import { partPathPoints } from '../logic/part-path.js';

/** Path points of a Part as PathKit vectors. */
function pathPoints(part: PartEntry): Vec3[] {
  return partPathPoints(part.restPosition, part.explodeVector).map(
    (p): Vec3 => ({ x: p[0], y: p[1], z: p[2] }),
  );
}

/** Length in metres of the Part's path, read from PathKit's curve and arc-length table. */
export function partPathLength(part: PartEntry): number {
  return createArcLengthTable(createCurve(pathPoints(part), false)).length;
}

/**
 * Builds the PathKit scene for one Part. Pure: returns a new scene each call.
 * Speed is pathLength * FPS / (EXPLODE_FRAMES - 1), so the last frame (59) reaches the end of the path.
 */
export function buildPartScene(part: PartEntry): Scene {
  const points = pathPoints(part);
  const length = createArcLengthTable(createCurve(points, false)).length;
  return {
    fps: FPS,
    frameCount: EXPLODE_FRAMES,
    path: { points, closed: false },
    targets: {},
    entities: [
      {
        id: part.id,
        forwardAxis: PART_FORWARD_AXIS,
        upAxis: PART_UP_AXIS,
        constraints: [
          {
            type: 'followPath',
            order: 0,
            influence: 1,
            speed: (length * FPS) / (EXPLODE_FRAMES - 1),
            startOffset: 0,
            alignToPath: false,
          },
        ],
      },
    ],
  };
}

/** Builds and bakes one scene per Part, keyed by Part id. Call once at load, never while the slider moves. */
export function bakeParts(parts: readonly PartEntry[] = CATALOGUE.parts): Map<string, BakedData> {
  const baked = new Map<string, BakedData>();
  for (const part of parts) {
    baked.set(part.id, bake(buildPartScene(part)));
  }
  return baked;
}
