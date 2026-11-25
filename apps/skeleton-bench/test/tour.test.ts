import { describe, expect, it } from 'vitest';
import {
  bake,
  createArcLengthTable,
  createCurve,
  evaluateEntity,
  motionLinter,
  validateScene,
  type OutBuffer,
  type Scene,
  type Vec3,
} from '../src/pathkit-api.js';
import {
  buildTourScene,
  tourFrameCount,
  tourRingPoints,
  TOUR_ENTITY_ID,
} from '../src/pathkit/tour.js';
import {
  CAMERA_MIN_CLEARANCE_M,
  EXPLODED_BOX_HALF_X,
  EXPLODED_BOX_HALF_Y,
  EXPLODED_BOX_HALF_Z,
  FPS,
  TOUR_FRAMES_PER_PART,
  TOUR_RING_HEIGHT,
  TOUR_RING_RADIUS,
} from '../src/constants.js';

// Spike S3. Design Properties 7, 10 and 21. Requirements 4.5, 4.6, 16.3, 16.5, 16.7, 16.8, 35.7, 35.8.

function newBuffer(): OutBuffer {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };
}

/** Rest positions (m) spread along x inside the Exploded_Box. */
function fixture(count: number): Vec3[] {
  const list: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    list.push({ x: -1 + 2 * t, y: ((i % 3) - 1) * 0.3, z: ((i % 2) - 0.5) * 0.4 });
  }
  return list;
}

/** Euclidean distance (m) from a point to the nearest point of the Exploded_Box, 0 inside it. */
function boxClearance(p: Vec3): number {
  const dx = Math.max(Math.abs(p.x) - EXPLODED_BOX_HALF_X, 0);
  const dy = Math.max(Math.abs(p.y) - EXPLODED_BOX_HALF_Y, 0);
  const dz = Math.max(Math.abs(p.z) - EXPLODED_BOX_HALF_Z, 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

const COUNTS: readonly number[] = [8, 6];

describe('tour scenes (Spike S3)', () => {
  it('passes validateScene and bakes for 8 and 6 Parts, with the expected frame count', () => {
    for (const count of COUNTS) {
      const scene = buildTourScene(fixture(count));
      expect(() => validateScene(scene)).not.toThrow();
      const baked = bake(scene);
      if (baked.frameCount !== count * TOUR_FRAMES_PER_PART || baked.frameCount !== tourFrameCount(count)) {
        throw new Error(`frame count check: ${count} Parts, got ${baked.frameCount}`);
      }
    }
  });

  it('runs motionLinter without throwing and returns an array', () => {
    for (const count of COUNTS) {
      const scene = buildTourScene(fixture(count));
      const baked = bake(scene);
      let findings: unknown;
      expect(() => {
        findings = motionLinter(scene, baked);
      }).not.toThrow();
      expect(Array.isArray(findings)).toBe(true);
    }
  });

  it('keeps every baked frame outside the Exploded_Box by at least CAMERA_MIN_CLEARANCE_M', () => {
    const out = newBuffer();
    for (const count of COUNTS) {
      const baked = bake(buildTourScene(fixture(count)));
      for (let f = 0; f < baked.frameCount; f++) {
        evaluateEntity(baked, TOUR_ENTITY_ID, f, out);
        const clearance = boxClearance(out.position);
        if (!(clearance >= CAMERA_MIN_CLEARANCE_M)) {
          throw new Error(
            `clearance check: ${count} Parts, frame ${f}, position (${out.position.x}, ${out.position.y}, ${out.position.z}), clearance ${clearance}`,
          );
        }
      }
    }
  });

  it('puts followPath order below aimAt order', () => {
    for (const count of COUNTS) {
      const constraints = buildTourScene(fixture(count)).entities[0].constraints;
      let followOrder = Number.NaN;
      let aimOrder = Number.NaN;
      for (let i = 0; i < constraints.length; i++) {
        if (constraints[i].type === 'followPath') followOrder = constraints[i].order;
        if (constraints[i].type === 'aimAt') aimOrder = constraints[i].order;
      }
      if (!(followOrder < aimOrder)) {
        throw new Error(`order check: ${count} Parts, followPath order ${followOrder}, aimAt order ${aimOrder}`);
      }
    }
  });

  it('takes followPath speed in metres per second (PathKit bake: distance = speed * frame / fps)', () => {
    // Straight 10 m open path along +X, speed 2 m/s at 30 fps: after 30 frames the Entity has moved 2 m.
    const scene: Scene = {
      fps: FPS,
      frameCount: 61,
      path: { points: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }], closed: false },
      targets: {},
      entities: [
        {
          id: 'probe',
          forwardAxis: '+Z',
          upAxis: '+Y',
          constraints: [{ type: 'followPath', order: 0, influence: 1, speed: 2, startOffset: 0 }],
        },
      ],
    };
    const baked = bake(scene);
    const out = newBuffer();
    const expectedX: ReadonlyArray<readonly [number, number]> = [
      [0, 0],
      [15, 1],
      [30, 2],
      [60, 4],
    ];
    for (const [frame, x] of expectedX) {
      evaluateEntity(baked, 'probe', frame, out);
      if (Math.abs(out.position.x - x) > 1e-3) {
        throw new Error(`speed unit check: frame ${frame}, expected x ${x}, got ${out.position.x}`);
      }
    }
  });

  it('travels the whole ring once over the tour (one turn, constant speed)', () => {
    for (const count of COUNTS) {
      const scene = buildTourScene(fixture(count));
      const baked = bake(scene);
      const ringLength = createArcLengthTable(createCurve(tourRingPoints(), true)).length;
      const a = newBuffer();
      const b = newBuffer();
      evaluateEntity(baked, TOUR_ENTITY_ID, 0, a);
      const startX = a.position.x;
      const startY = a.position.y;
      const startZ = a.position.z;
      let total = 0;
      for (let f = 1; f < baked.frameCount; f++) {
        evaluateEntity(baked, TOUR_ENTITY_ID, f, b);
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const dz = b.position.z - a.position.z;
        total += Math.sqrt(dx * dx + dy * dy + dz * dz);
        a.position.x = b.position.x;
        a.position.y = b.position.y;
        a.position.z = b.position.z;
      }
      const cx = startX - b.position.x;
      const cy = startY - b.position.y;
      const cz = startZ - b.position.z;
      total += Math.sqrt(cx * cx + cy * cy + cz * cz); // closing step back to frame 0
      if (Math.abs(total - ringLength) > 0.01 * ringLength) {
        throw new Error(`one-turn check: ${count} Parts, travelled ${total} m, ring length ${ringLength} m`);
      }
    }
  });

  it('builds the aimAt target with one strictly increasing integer keyframe per Part, mid-slot', () => {
    for (const count of COUNTS) {
      const target = buildTourScene(fixture(count)).targets['tourTarget'];
      if (!('keyframes' in target)) throw new Error('tourTarget is not keyframed');
      expect(target.keyframes.length).toBe(count);
      for (let i = 0; i < count; i++) {
        const frame = target.keyframes[i].frame;
        if (frame !== i * TOUR_FRAMES_PER_PART + TOUR_FRAMES_PER_PART / 2 || !Number.isInteger(frame)) {
          throw new Error(`keyframe check: ${count} Parts, keyframe ${i}, frame ${frame}`);
        }
        if (i > 0 && !(frame > target.keyframes[i - 1].frame)) {
          throw new Error(`keyframe order check: ${count} Parts, keyframe ${i}, frame ${frame}`);
        }
      }
    }
  });

  it('would catch a ring radius below 1.5 m (the clearance measure drops under the minimum)', () => {
    expect(TOUR_RING_RADIUS).toBeGreaterThanOrEqual(1.5);
    const tooSmall: Vec3 = { x: 1.4, y: TOUR_RING_HEIGHT, z: 0 }; // a ring of radius 1.4 m
    expect(boxClearance(tooSmall)).toBeLessThan(CAMERA_MIN_CLEARANCE_M);
    const actual = tourRingPoints();
    for (let i = 0; i < actual.length; i++) {
      expect(boxClearance(actual[i])).toBeGreaterThanOrEqual(CAMERA_MIN_CLEARANCE_M);
    }
  });
});
