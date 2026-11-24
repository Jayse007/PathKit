// Default Road points for Shot Rail (data only).
// A closed oval loop, hand-placed on the ground plane (Y-up, metres):
// 12 points, 44 m by 32 m across, about 120 m round, tightest bend radius about 12 m.
// Every point sits at the subject centre height.

import type { Vec3 } from './pathkit.js';
import { SUBJECT_CENTRE_HEIGHT } from './constants.js';

const Y = SUBJECT_CENTRE_HEIGHT;

export const DEFAULT_ROAD_POINTS: readonly Vec3[] = [
  { x: 22, y: Y, z: 0 },
  { x: 19.05, y: Y, z: 8 },
  { x: 11, y: Y, z: 13.86 },
  { x: 0, y: Y, z: 16 },
  { x: -11, y: Y, z: 13.86 },
  { x: -19.05, y: Y, z: 8 },
  { x: -22, y: Y, z: 0 },
  { x: -19.05, y: Y, z: -8 },
  { x: -11, y: Y, z: -13.86 },
  { x: 0, y: Y, z: -16 },
  { x: 11, y: Y, z: -13.86 },
  { x: 19.05, y: Y, z: -8 },
];

export const DEFAULT_ROAD_CLOSED = true;
