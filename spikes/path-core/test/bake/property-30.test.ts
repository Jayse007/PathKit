import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import type { Vec3 } from '../../src/math.js';
import { VALID_AXIS_PAIRS } from '../helpers/basic-generators.js';
import { arbCoincidentAimCase, buildCoincidentAimCase } from '../helpers/scene-generators.js';
import type { CoincidentAimCase, CoincidentAimMode } from '../helpers/scene-generators.js';
import type { Keyframe } from '../../src/scene.js';

// Feature: path-core, Property 30: Coincident aim keeps previous rotation
// **Validates: Requirements 6.9**

const DIRECTION_TOLERANCE = 1e-9;

// The entity has one aimAt (influence 1) as its last constraint, so nothing later drives rotation
// and the baked rotation of a frame is that aimAt's own candidate rotation.
// aimOnly: the position is the origin. afterFollow: a followPath (speed 0, startOffset 0,
// alignToPath false) gives the position table.pointAtDistance(0), the same call bake makes.
// The target has one keyframe per frame, so every frame is exactly on a keyframe: the coincident
// frames copy the position exactly, the other frames are a far point (>= 5 m, >= 10 degrees from vertical).

interface Features {
  first: number; // coincident on frame 0
  run: number; // 3 or more consecutive coincident frames
  afterNon: number; // coincident frame right after a non-coincident frame
}

function newFeatures(): Features {
  return { first: 0, run: 0, afterNon: 0 };
}

/** Adds this pattern's special cases to the counts. Returns the number of coincident frames. */
function countFeatures(pattern: readonly boolean[], features: Features): number {
  let coincidentFrames = 0;
  let runLength = 0;
  let hasRun = false;
  let hasAfterNon = false;
  for (let f = 0; f < pattern.length; f++) {
    if (pattern[f]) {
      coincidentFrames++;
      runLength++;
      if (runLength >= 3) hasRun = true;
      if (f > 0 && !pattern[f - 1]) hasAfterNon = true;
    } else {
      runLength = 0;
    }
  }
  if (pattern[0]) features.first++;
  if (hasRun) features.run++;
  if (hasAfterNon) features.afterNon++;
  return coincidentFrames;
}

/** Bakes the case and checks every frame. Throws on the first miss. */
function checkCase(label: string, c: CoincidentAimCase): void {
  const baked = bake(c.scene);
  const tr = baked.transforms[0];
  const dirs = baked.aimDirections[0];
  const n = c.coincident.length;
  if (tr.length !== n * 7) throw new Error(`${label}: transforms length ${tr.length}, expected ${n * 7}`);
  if (dirs.length !== n * 3) throw new Error(`${label}: aimDirections length ${dirs.length}, expected ${n * 3}`);
  const keys = (c.scene.targets['goal'] as { keyframes: Keyframe[] }).keyframes;

  for (let f = 0; f < n; f++) {
    const t = f * 7;
    const a = f * 3;

    // The baked position is the position the case promised, bit for bit.
    if (tr[t] !== c.position.x || tr[t + 1] !== c.position.y || tr[t + 2] !== c.position.z) {
      throw new Error(
        `${label}: frame ${f}: baked position (${tr[t]}, ${tr[t + 1]}, ${tr[t + 2]}) differs from (${c.position.x}, ${c.position.y}, ${c.position.z}) [${c.mode}]`,
      );
    }

    if (c.coincident[f]) {
      if (dirs[a] !== 0 || dirs[a + 1] !== 0 || dirs[a + 2] !== 0) {
        throw new Error(`${label}: frame ${f}: coincident aim direction (${dirs[a]}, ${dirs[a + 1]}, ${dirs[a + 2]}) is not the zero vector`);
      }
      for (let k = 3; k < 7; k++) {
        const expected = f === 0 ? (k === 6 ? 1 : 0) : tr[(f - 1) * 7 + k];
        if (tr[t + k] !== expected) {
          throw new Error(
            `${label}: frame ${f}: coincident rotation component ${k - 3} is ${tr[t + k]}, expected ${expected} (${f === 0 ? 'identity on frame 0' : 'rotation of frame ' + (f - 1)}) [${c.mode}]`,
          );
        }
      }
    } else {
      const p = keys[f].position;
      const vx = p.x - c.position.x;
      const vy = p.y - c.position.y;
      const vz = p.z - c.position.z;
      const len = Math.hypot(vx, vy, vz);
      if (!(len >= 4.9)) throw new Error(`${label}: frame ${f}: test bug, non-coincident frame has distance ${len}`);
      const ex = vx / len;
      const ey = vy / len;
      const ez = vz / len;
      if (
        !(Math.abs(dirs[a] - ex) <= DIRECTION_TOLERANCE) ||
        !(Math.abs(dirs[a + 1] - ey) <= DIRECTION_TOLERANCE) ||
        !(Math.abs(dirs[a + 2] - ez) <= DIRECTION_TOLERANCE)
      ) {
        throw new Error(
          `${label}: frame ${f}: aim direction (${dirs[a]}, ${dirs[a + 1]}, ${dirs[a + 2]}), expected (${ex}, ${ey}, ${ez}) [${c.mode}]`,
        );
      }
      const unit = Math.hypot(dirs[a], dirs[a + 1], dirs[a + 2]);
      if (!(Math.abs(unit - 1) <= DIRECTION_TOLERANCE)) {
        throw new Error(`${label}: frame ${f}: aim direction length ${unit} is not 1`);
      }
    }
  }
}

describe('Property 30: Coincident aim keeps previous rotation', () => {
  it('a coincident frame keeps the previous frame rotation (identity on frame 0) and has a zero aim direction', () => {
    let runs = 0;
    const byMode: Record<CoincidentAimMode, Features> = { aimOnly: newFeatures(), afterFollow: newFeatures() };
    let coincidentFrames = 0;
    fc.assert(
      fc.property(arbCoincidentAimCase, (c) => {
        runs++;
        coincidentFrames += countFeatures(c.coincident, byMode[c.mode]);
        checkCase(`run ${runs}`, c);
      }),
      { numRuns: 200 },
    );
    expect(runs).toBeGreaterThanOrEqual(200);
    expect(coincidentFrames).toBeGreaterThan(0);
    for (const mode of ['aimOnly', 'afterFollow'] as const) {
      expect(byMode[mode].first).toBeGreaterThan(0);
      expect(byMode[mode].run).toBeGreaterThan(0);
      expect(byMode[mode].afterNon).toBeGreaterThan(0);
    }
  });

  describe('deterministic patterns, all 24 valid axis pairs', () => {
    const POINTS: Vec3[] = [
      { x: 1, y: 2, z: 3 },
      { x: 6, y: 4, z: -2 },
      { x: 9, y: -3, z: 5 },
    ];
    const T = true;
    const F = false;
    const PATTERNS: Record<string, boolean[]> = {
      'frame 0 coincident': [T, F, F, T, T, F],
      'run of 3 after a non-coincident frame': [F, T, T, T, F, T],
      'N C C N C': [F, T, T, F, T],
    };

    for (const mode of ['aimOnly', 'afterFollow'] as const) {
      for (const [name, pattern] of Object.entries(PATTERNS)) {
        it(`${mode}: ${name}`, () => {
          const features = newFeatures();
          const coincidentFrames = countFeatures(pattern, features);
          expect(coincidentFrames).toBeGreaterThan(0);
          if (name === 'frame 0 coincident') expect(features.first).toBe(1);
          if (name === 'run of 3 after a non-coincident frame') {
            expect(features.run).toBe(1);
            expect(features.afterNon).toBe(1);
          }
          const far = pattern.map((_, i) => ({ theta: 20 + ((i * 37) % 140), azimuth: (i * 53) % 360, distance: 8 + i }));
          for (const axes of VALID_AXIS_PAIRS) {
            const c = buildCoincidentAimCase({
              mode,
              coincident: pattern,
              points: POINTS,
              closed: false,
              axes,
              fps: 24,
              far,
            });
            checkCase(`${mode} ${name} ${axes[0]}/${axes[1]}`, c);
          }
        });
      }

      it(`${mode}: N C C N C keeps the rotation of the nearest earlier frame and moves on after a non-coincident frame`, () => {
        const pattern = [false, true, true, false, true];
        const far = pattern.map((_, i) => ({ theta: 30 + i * 25, azimuth: 40 + i * 70, distance: 10 + i }));
        const c = buildCoincidentAimCase({
          mode,
          coincident: pattern,
          points: POINTS,
          closed: false,
          axes: ['+Z', '+Y'],
          fps: 24,
          far,
        });
        checkCase(`${mode} NCCNC`, c);
        const tr = bake(c.scene).transforms[0];
        const rot = (f: number): number[] => [tr[f * 7 + 3], tr[f * 7 + 4], tr[f * 7 + 5], tr[f * 7 + 6]];
        expect(rot(1)).toEqual(rot(0));
        expect(rot(2)).toEqual(rot(0));
        expect(rot(4)).toEqual(rot(3));
        // The two non-coincident aims differ, so frame 3 really is a new rotation and not frame 0's.
        expect(rot(3)).not.toEqual(rot(0));
      });
    }
  });
});
