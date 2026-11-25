// Tour scene (Spike S3): a closed camera ring with a keyframed aim target.
// Generic: it takes a list of rest positions and knows nothing about which machine they come from.
import {
  createArcLengthTable,
  createCurve,
  type Scene,
  type Vec3,
} from '../pathkit-api.js';
import {
  CAMERA_FORWARD_AXIS,
  CAMERA_UP_AXIS,
  FPS,
  TOUR_FRAMES_PER_PART,
  TOUR_RING_HEIGHT,
  TOUR_RING_POINTS,
  TOUR_RING_RADIUS,
} from '../constants.js';

export const TOUR_ENTITY_ID = 'cam';
export const TOUR_TARGET_NAME = 'tourTarget';

/** Total frames of a tour over `partCount` Parts. */
export function tourFrameCount(partCount: number): number {
  return partCount * TOUR_FRAMES_PER_PART;
}

/** Middle frame of the slot of Part `index` (0-based). */
export function tourSlotMiddleFrame(index: number): number {
  return index * TOUR_FRAMES_PER_PART + TOUR_FRAMES_PER_PART / 2;
}

/** The 12 ring points at bearings 0, 30, ..., 330 degrees. Bearing 0 is +Z, as in the laps. */
export function tourRingPoints(): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i < TOUR_RING_POINTS; i++) {
    const bearing = (i * 2 * Math.PI) / TOUR_RING_POINTS; // radians
    points.push({
      x: TOUR_RING_RADIUS * Math.sin(bearing),
      y: TOUR_RING_HEIGHT,
      z: TOUR_RING_RADIUS * Math.cos(bearing),
    });
  }
  return points;
}

/**
 * Builds the PathKit scene for a tour. Pure: returns a new scene each call.
 * `restPositions` holds one position per Part, in tour order.
 */
export function buildTourScene(restPositions: readonly Vec3[]): Scene {
  if (restPositions.length === 0) {
    throw new RangeError('a tour needs at least one rest position');
  }
  const frameCount = tourFrameCount(restPositions.length);
  const points = tourRingPoints();
  const ringLength = createArcLengthTable(createCurve(points, true)).length; // metres
  // One full turn over the whole tour. followPath speed is metres per second.
  const speed = (ringLength * FPS) / frameCount;

  const keyframes = restPositions.map((p, i) => ({
    frame: tourSlotMiddleFrame(i),
    position: { x: p.x, y: p.y, z: p.z },
  }));

  return {
    fps: FPS,
    frameCount,
    path: { points, closed: true },
    targets: {
      [TOUR_TARGET_NAME]: { keyframes },
    },
    entities: [
      {
        id: TOUR_ENTITY_ID,
        forwardAxis: CAMERA_FORWARD_AXIS,
        upAxis: CAMERA_UP_AXIS,
        constraints: [
          {
            type: 'followPath',
            order: 0,
            influence: 1,
            speed,
            startOffset: 0,
          },
          {
            type: 'aimAt',
            order: 1,
            influence: 1,
            target: TOUR_TARGET_NAME,
          },
        ],
      },
    ],
  };
}
