import { describe, expect, it } from 'vitest';
import { bake, evaluateEntity, validateScene, type OutBuffer } from '../src/pathkit-api.js';
import { bakeLaps, buildLapScene, LAP_ENTITY_ID } from '../src/pathkit/laps.js';
import { BEARING_TOLERANCE_DEG, LAP_COUNT, ORBIT_LAP_FRAMES } from '../src/constants.js';

// Spike S1. Design Properties 7 and 8. Requirements 4.2, 4.6, 4.10, 5.1, 10.4, 35.7, 35.8.
const TOL = 1e-9;

// Hand-written lap radius r and height h (metres) for d = 6.5, 5.2, 3.9, 2.6 (r = d * 12/13, h = d * 5/13).
const LAP_R_H: ReadonlyArray<readonly [number, number]> = [
  [6, 2.5],
  [4.8, 2],
  [3.6, 1.5],
  [2.4, 1],
];

function newBuffer(): OutBuffer {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };
}

function axisLetter(token: string): string {
  return token.charAt(1);
}

const baked = bakeLaps();

describe('lap scenes (Spike S1)', () => {
  it('builds four laps and validateScene passes for each', () => {
    expect(LAP_COUNT).toBe(4);
    expect(baked.length).toBe(4);
    for (let lap = 0; lap < 4; lap++) {
      expect(() => validateScene(buildLapScene(lap))).not.toThrow();
    }
  });

  it('puts orbitAround before aimAt in order', () => {
    for (let lap = 0; lap < 4; lap++) {
      const constraints = buildLapScene(lap).entities[0].constraints;
      let orbitOrder = Number.NaN;
      let aimOrder = Number.NaN;
      for (let i = 0; i < constraints.length; i++) {
        if (constraints[i].type === 'orbitAround') orbitOrder = constraints[i].order;
        if (constraints[i].type === 'aimAt') aimOrder = constraints[i].order;
      }
      if (!(orbitOrder < aimOrder)) {
        throw new Error(`order check: lap ${lap}, orbitAround order ${orbitOrder}, aimAt order ${aimOrder}`);
      }
    }
  });

  it('puts forward and up on different axes', () => {
    for (let lap = 0; lap < 4; lap++) {
      const entity = buildLapScene(lap).entities[0];
      if (axisLetter(entity.forwardAxis) === axisLetter(entity.upAxis)) {
        throw new Error(`axis check: lap ${lap}, forward ${entity.forwardAxis}, up ${entity.upAxis}`);
      }
    }
  });

  it('reads every frame of every lap with evaluateEntity, finite and with a unit rotation', () => {
    const out = newBuffer();
    for (let lap = 0; lap < 4; lap++) {
      if (baked[lap].frameCount !== ORBIT_LAP_FRAMES) {
        throw new Error(`frame count check: lap ${lap}, got ${baked[lap].frameCount}`);
      }
      for (let f = 0; f < ORBIT_LAP_FRAMES; f++) {
        evaluateEntity(baked[lap], LAP_ENTITY_ID, f, out);
        const p = out.position;
        const q = out.rotation;
        const norm = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
        if (
          !Number.isFinite(p.x + p.y + p.z + q.x + q.y + q.z + q.w) ||
          Math.abs(norm - 1) > 1e-6
        ) {
          throw new Error(`readable check: lap ${lap}, frame ${f}, position (${p.x}, ${p.y}, ${p.z}), rotation norm ${norm}`);
        }
      }
    }
  });

  it('puts the camera at the four compass positions on frames 0, 90, 180, 270', () => {
    const out = newBuffer();
    for (let lap = 0; lap < 4; lap++) {
      const [r, h] = LAP_R_H[lap];
      const table: ReadonlyArray<readonly [number, number, number, number]> = [
        [0, 0, h, r],
        [90, r, h, 0],
        [180, 0, h, -r],
        [270, -r, h, 0],
      ];
      for (let i = 0; i < table.length; i++) {
        const [f, x, y, z] = table[i];
        evaluateEntity(baked[lap], LAP_ENTITY_ID, f, out);
        const p = out.position;
        if (Math.abs(p.x - x) > TOL || Math.abs(p.y - y) > TOL || Math.abs(p.z - z) > TOL) {
          throw new Error(
            `position check: lap ${lap}, frame ${f}, expected (${x}, ${y}, ${z}), got (${p.x}, ${p.y}, ${p.z})`,
          );
        }
      }
    }
  });

  it('gives a Bearing equal to the frame number in degrees on all 360 frames of every lap', () => {
    const out = newBuffer();
    for (let lap = 0; lap < 4; lap++) {
      for (let f = 0; f < ORBIT_LAP_FRAMES; f++) {
        evaluateEntity(baked[lap], LAP_ENTITY_ID, f, out);
        let bearing = (Math.atan2(out.position.x, out.position.z) * 180) / Math.PI;
        if (bearing < 0) bearing += 360;
        let diff = Math.abs(bearing - f);
        if (diff > 180) diff = 360 - diff;
        if (!(diff <= BEARING_TOLERANCE_DEG)) {
          throw new Error(`bearing check: lap ${lap}, frame ${f}, bearing ${bearing}, difference ${diff}`);
        }
      }
    }
  });

  it('reports the bake time per lap (no assertion on time)', () => {
    for (let lap = 0; lap < 4; lap++) {
      const scene = buildLapScene(lap);
      const start = performance.now();
      const result = bake(scene);
      const ms = performance.now() - start;
      console.log(`S1 bake time lap ${lap}: ${ms.toFixed(2)} ms`);
      expect(result.frameCount).toBe(ORBIT_LAP_FRAMES);
    }
  });
});
