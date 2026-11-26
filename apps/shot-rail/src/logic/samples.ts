// The three sample shots (values from the design's Samples table, starting values to be tuned).
// Data only. Each sample is a RigSettings-shaped value for one main camera, with shot length 240.

import { SHOT_LENGTH_DEFAULT } from './constants.js';
import type { CameraPlacement, ShotType } from './shot-builders.js';

export interface SampleShot {
  name: string;
  shotType: ShotType;
  placement: CameraPlacement;
  shotLengthFrames: number;
}

export const SAMPLE_SHOTS: readonly SampleShot[] = [
  {
    name: 'Orbit around the car',
    shotType: 'orbit',
    placement: { bearingDeg: 0, heightM: 1.5, horizontalDistanceM: 8, lensMm: 35 },
    shotLengthFrames: SHOT_LENGTH_DEFAULT,
  },
  {
    name: 'Push-in from a low camera',
    shotType: 'push-in',
    placement: { bearingDeg: 30, heightM: -0.3, horizontalDistanceM: 12, lensMm: 50 },
    shotLengthFrames: SHOT_LENGTH_DEFAULT,
  },
  {
    name: 'Crane up',
    shotType: 'crane',
    placement: { bearingDeg: 180, heightM: 0.5, horizontalDistanceM: 10, lensMm: 35 },
    shotLengthFrames: SHOT_LENGTH_DEFAULT,
  },
];
