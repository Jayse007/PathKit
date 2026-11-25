// Lap scenes (Spike S1): four circular laps around the machine, baked once at load.
// Each lap is one entity "cam" that orbits a static point above the machine centre and aims at the centre.
import {
  bake,
  type BakedData,
  type Scene,
} from '../pathkit-api.js';
import {
  CAMERA_ELEVATION_COS,
  CAMERA_ELEVATION_SIN,
  CAMERA_FORWARD_AXIS,
  CAMERA_UP_AXIS,
  FPS,
  LAP_COUNT,
  LAP_DISTANCES,
  MACHINE_CENTRE,
  ORBIT_AXIS,
  ORBIT_LAP_FRAMES,
  ORBIT_SPEED_DEG_PER_S,
  ORBIT_START_ANGLE_DEG,
} from '../constants.js';

export const LAP_ENTITY_ID = 'cam';

/** Horizontal radius r of a lap, in metres. Derived from the lap distance d. */
export function lapRadius(lap: number): number {
  return checkedDistance(lap) * CAMERA_ELEVATION_COS;
}

/** Height h of a lap above the machine centre, in metres. Derived from the lap distance d. */
export function lapHeight(lap: number): number {
  return checkedDistance(lap) * CAMERA_ELEVATION_SIN;
}

function checkedDistance(lap: number): number {
  if (!Number.isInteger(lap) || lap < 0 || lap >= LAP_COUNT) {
    throw new RangeError(`lap index must be an integer from 0 to ${LAP_COUNT - 1}, got ${lap}`);
  }
  return LAP_DISTANCES[lap];
}

/** Builds the PathKit scene for one lap. Pure: returns a new scene each call. */
export function buildLapScene(lap: number): Scene {
  const r = lapRadius(lap);
  const h = lapHeight(lap);
  return {
    fps: FPS,
    frameCount: ORBIT_LAP_FRAMES,
    // PathKit needs a path of 2 distinct points even though no lap uses followPath.
    path: {
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      closed: false,
    },
    targets: {
      orbitCentre: { x: MACHINE_CENTRE[0], y: MACHINE_CENTRE[1] + h, z: MACHINE_CENTRE[2] },
      machineCentre: { x: MACHINE_CENTRE[0], y: MACHINE_CENTRE[1], z: MACHINE_CENTRE[2] },
    },
    entities: [
      {
        id: LAP_ENTITY_ID,
        forwardAxis: CAMERA_FORWARD_AXIS,
        upAxis: CAMERA_UP_AXIS,
        constraints: [
          {
            type: 'orbitAround',
            order: 0,
            influence: 1,
            target: 'orbitCentre',
            radius: r,
            axis: ORBIT_AXIS,
            speed: ORBIT_SPEED_DEG_PER_S,
            startAngle: ORBIT_START_ANGLE_DEG,
          },
          {
            type: 'aimAt',
            order: 1,
            influence: 1,
            target: 'machineCentre',
          },
        ],
      },
    ],
  };
}

/** Builds and bakes all four lap scenes. Call once at load, never during interaction. */
export function bakeLaps(): BakedData[] {
  const baked: BakedData[] = [];
  for (let lap = 0; lap < LAP_COUNT; lap++) {
    baked.push(bake(buildLapScene(lap)));
  }
  return baked;
}
