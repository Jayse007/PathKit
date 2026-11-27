import { describe, expect, it } from 'vitest';
import { evaluateEntity, motionLinter, type OutBuffer, type Vec3 } from '../src/pathkit-api.js';
import { bakeAll, bakeTour, type BakeAllSuccess } from '../src/pathkit/bake-all.js';
import { TOUR_ENTITY_ID, TOUR_TARGET_NAME } from '../src/pathkit/tour.js';
import { CATALOGUE } from '../src/data/catalogue.js';
import type { MachineId } from '../src/data/catalogue-types.js';
import {
  CAMERA_MIN_CLEARANCE_M,
  EXPLODED_BOX_HALF_X,
  EXPLODED_BOX_HALF_Y,
  EXPLODED_BOX_HALF_Z,
  TOUR_FRAMES_PER_PART,
} from '../src/constants.js';

// Task 19.2. The three real Tours. Design Properties 10 and 19 (tour part). Requirements 16.2, 16.5, 16.7, 35.7.

// Hand-written expected tour order (= keyboard order) per Machine.
const EXPECTED_ORDER: Readonly<Record<MachineId, readonly string[]>> = {
  pump: [
    'pump-motor',
    'pump-bearing-housing',
    'pump-shaft',
    'pump-mechanical-seal',
    'pump-bolts',
    'pump-casing',
    'pump-impeller',
    'pump-flange',
  ],
  'heat-exchanger': [
    'hx-bonnet',
    'hx-tube-sheet',
    'hx-shell',
    'hx-tube-bundle',
    'hx-baffles',
    'hx-shell-nozzles',
  ],
  'desk-lamp': [
    'lamp-base',
    'lamp-upper-arm',
    'lamp-spring',
    'lamp-elbow',
    'lamp-forearm',
    'lamp-shade',
    'lamp-bulb-holder',
  ],
};

// Hand-written frame counts: 8, 6 and 7 Parts at 90 frames each.
const EXPECTED_FRAMES: Readonly<Record<MachineId, number>> = {
  pump: 720,
  'heat-exchanger': 540,
  'desk-lamp': 630,
};

const MACHINES: readonly MachineId[] = ['pump', 'heat-exchanger', 'desk-lamp'];

function newBuffer(): OutBuffer {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };
}

/** Distance (m) from a point to the nearest point of the Exploded_Box, 0 inside it. */
function boxClearance(p: Vec3): number {
  const dx = Math.max(Math.abs(p.x) - EXPLODED_BOX_HALF_X, 0);
  const dy = Math.max(Math.abs(p.y) - EXPLODED_BOX_HALF_Y, 0);
  const dz = Math.max(Math.abs(p.z) - EXPLODED_BOX_HALF_Z, 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function bakedOk(): BakeAllSuccess {
  const result = bakeAll();
  if (!result.ok) throw new Error(`bakeAll check: failed with "${result.message}"`);
  return result;
}

describe('real catalogue Tours (task 19.2)', () => {
  it('bakes all three Tours with bakeAll', () => {
    const result = bakedOk();
    expect(result.tours.size).toBe(3);
    for (const id of MACHINES) {
      if (!result.tours.has(id)) throw new Error(`tour presence check: no Tour for ${id}`);
    }
  });

  it('has the hand-written frame counts 720, 540 and 630', () => {
    const result = bakedOk();
    for (const id of MACHINES) {
      const tour = result.tours.get(id);
      if (tour === undefined) throw new Error(`frame count check: no Tour for ${id}`);
      if (tour.baked.frameCount !== EXPECTED_FRAMES[id] || tour.scene.frameCount !== EXPECTED_FRAMES[id]) {
        throw new Error(
          `frame count check: ${id}, baked ${tour.baked.frameCount}, scene ${tour.scene.frameCount}, expected ${EXPECTED_FRAMES[id]}`,
        );
      }
    }
  });

  it('runs motionLinter without throwing and returns a list for every Tour', () => {
    const result = bakedOk();
    for (const id of MACHINES) {
      const tour = result.tours.get(id);
      if (tour === undefined) throw new Error(`linter check: no Tour for ${id}`);
      expect(Array.isArray(tour.findings)).toBe(true);
      let again: unknown;
      expect(() => {
        again = motionLinter(tour.scene, tour.baked);
      }).not.toThrow();
      expect(Array.isArray(again)).toBe(true);
      expect(tour.findingLines.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps the camera outside the Exploded_Box by CAMERA_MIN_CLEARANCE_M on every frame of every Tour', () => {
    const result = bakedOk();
    const out = newBuffer();
    for (const id of MACHINES) {
      const tour = result.tours.get(id);
      if (tour === undefined) throw new Error(`clearance check: no Tour for ${id}`);
      for (let f = 0; f < tour.baked.frameCount; f++) {
        evaluateEntity(tour.baked, TOUR_ENTITY_ID, f, out);
        const clearance = boxClearance(out.position);
        if (!(clearance >= CAMERA_MIN_CLEARANCE_M)) {
          throw new Error(
            `clearance check: ${id}, frame ${f}, position (${out.position.x}, ${out.position.y}, ${out.position.z}), clearance ${clearance}`,
          );
        }
      }
    }
  });

  it('lists the Parts of each Machine in the hand-written keyboard order', () => {
    for (const id of MACHINES) {
      const machine = CATALOGUE.machines.find((m) => m.id === id);
      if (machine === undefined) throw new Error(`order check: no Machine ${id}`);
      const expected = EXPECTED_ORDER[id];
      if (machine.partIds.length !== expected.length) {
        throw new Error(`order check: ${id}, ${machine.partIds.length} Parts, expected ${expected.length}`);
      }
      for (let i = 0; i < expected.length; i++) {
        if (machine.partIds[i] !== expected[i]) {
          throw new Error(`order check: ${id}, index ${i}, got ${machine.partIds[i]}, expected ${expected[i]}`);
        }
      }
    }
  });

  it('visits the Parts in keyboard order: slot keyframe i holds the rest position of Part i, mid-slot', () => {
    const result = bakedOk();
    for (const id of MACHINES) {
      const tour = result.tours.get(id);
      if (tour === undefined) throw new Error(`keyframe order check: no Tour for ${id}`);
      const expected = EXPECTED_ORDER[id];
      const target = tour.scene.targets[TOUR_TARGET_NAME];
      if (target === undefined || !('keyframes' in target)) {
        throw new Error(`keyframe order check: ${id} has no keyframed ${TOUR_TARGET_NAME}`);
      }
      if (target.keyframes.length !== expected.length) {
        throw new Error(`keyframe order check: ${id}, ${target.keyframes.length} keyframes, expected ${expected.length}`);
      }
      if (tour.partIds.length !== expected.length) {
        throw new Error(`keyframe order check: ${id}, tour lists ${tour.partIds.length} Parts, expected ${expected.length}`);
      }
      for (let i = 0; i < expected.length; i++) {
        const part = CATALOGUE.parts.find((p) => p.id === expected[i]);
        if (part === undefined) throw new Error(`keyframe order check: ${id}, unknown Part ${expected[i]}`);
        const key = target.keyframes[i];
        const wantFrame = i * TOUR_FRAMES_PER_PART + TOUR_FRAMES_PER_PART / 2;
        if (key.frame !== wantFrame) {
          throw new Error(`keyframe order check: ${id}, slot ${i}, frame ${key.frame}, expected ${wantFrame}`);
        }
        if (
          key.position.x !== part.restPosition[0] ||
          key.position.y !== part.restPosition[1] ||
          key.position.z !== part.restPosition[2]
        ) {
          throw new Error(
            `keyframe order check: ${id}, slot ${i}, position (${key.position.x}, ${key.position.y}, ${key.position.z}), expected ${expected[i]} at (${part.restPosition[0]}, ${part.restPosition[1]}, ${part.restPosition[2]})`,
          );
        }
        if (tour.partIds[i] !== expected[i]) {
          throw new Error(`keyframe order check: ${id}, slot ${i}, tour Part ${tour.partIds[i]}, expected ${expected[i]}`);
        }
      }
    }
  });

  it('rejects an unknown Machine in bakeTour', () => {
    expect(() => bakeTour('nope' as MachineId)).toThrow(Error);
  });
});
