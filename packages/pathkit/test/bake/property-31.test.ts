import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { bake } from '../../src/bake.js';
import { cross, dot, length, normalize, rotateVec } from '../../src/math.js';
import type { Quat, Vec3 } from '../../src/math.js';
import { axisVector } from '../../src/scene.js';
import type { AxisToken, Scene } from '../../src/scene.js';
import { VALID_AXIS_PAIRS, arbValidAxisPair } from '../helpers/basic-generators.js';

// Feature: path-core, Property 31: Near-vertical aim uses the projected previous up vector
// **Validates: Requirements 7.4, 7.5, 7.6**

const UP_TOLERANCE = 1e-4;
const FORWARD_TOLERANCE = 1e-4;
const PERP_TOLERANCE = 1e-4;
const UNIT_TOLERANCE = 1e-6;
const PROPER_TOLERANCE = 1e-6;
const SKIP_BELOW = 1e-9;
/** Written here, not taken from src: an aim with |y| at or above this is within 3 degrees of vertical. */
const COS_3_DEG = Math.cos((3 * Math.PI) / 180);
/** World up, defined here. */
const WORLD_UP: Vec3 = { x: 0, y: 1, z: 0 };

// The entity has one aimAt (influence 1) as its only constraint and no followPath, so it stays at the
// origin and the aim direction is the target direction. The target has one keyframe per frame, so the
// target of frame k is exactly keyframe k. The baked rotation of frame k is that frame's aimAt result.

interface Counts {
  inside: number; // frame > 0, aim within 3 degrees of vertical, up checked against the previous baked up
  outside: number; // frame > 0, aim outside the cone, up checked against world up
  frame0: number; // frame 0 (world up rule)
  skips: number; // inside the cone but the projected previous up is shorter than 1e-9: up check skipped
}

function newCounts(): Counts {
  return { inside: 0, outside: 0, frame0: 0, skips: 0 };
}

/** One aim: degrees from straight up, azimuth in degrees around Y, distance in metres. */
interface Aim {
  theta: number;
  azimuth: number;
  distance: number;
}

/** Target position for an aim. Degrees are converted to radians here. */
function targetOf(a: Aim): Vec3 {
  const t = (a.theta * Math.PI) / 180;
  const z = (a.azimuth * Math.PI) / 180;
  return {
    x: a.distance * Math.sin(t) * Math.cos(z),
    y: a.distance * Math.cos(t),
    z: a.distance * Math.sin(t) * Math.sin(z),
  };
}

const PATH_POINTS: Vec3[] = [
  { x: 0, y: 0, z: 0 },
  { x: 8, y: 2, z: 3 },
  { x: 12, y: 5, z: -4 },
];

function sceneOf(targets: readonly Vec3[], forwardAxis: AxisToken, upAxis: AxisToken): Scene {
  return {
    fps: 24,
    frameCount: targets.length,
    path: { points: PATH_POINTS, closed: false },
    targets: { goal: { keyframes: targets.map((position, frame) => ({ frame, position })) } },
    entities: [
      {
        id: 'subject',
        forwardAxis,
        upAxis,
        constraints: [{ type: 'aimAt', order: 0, influence: 1, target: 'goal' }],
      },
    ],
  };
}

function quatAt(transforms: Float64Array, k: number, out: Quat): Quat {
  const i = k * 7;
  out.x = transforms[i + 3];
  out.y = transforms[i + 4];
  out.z = transforms[i + 5];
  out.w = transforms[i + 6];
  return out;
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Removes from v its component along the unit vector dir. */
function perpendicularPart(v: Vec3, dir: Vec3): Vec3 {
  const along = dot(v, dir);
  return { x: v.x - along * dir.x, y: v.y - along * dir.y, z: v.z - along * dir.z };
}

/**
 * Bakes the targets and checks every frame. Each frame uses the rule that matches its own angle:
 * inside the cone and frame > 0 the up is the previous frame's baked up projected perpendicular to the aim,
 * otherwise it is world up projected perpendicular to the aim. Throws on the first miss.
 */
function checkTargets(label: string, targets: readonly Vec3[], forwardAxis: AxisToken, upAxis: AxisToken, counts: Counts): void {
  const transforms = bake(sceneOf(targets, forwardAxis, upAxis)).transforms[0];
  const n = targets.length;
  if (transforms.length !== n * 7) throw new Error(`${label}: transforms length ${transforms.length}, expected ${n * 7}`);

  const f = axisVector(forwardAxis, { x: 0, y: 0, z: 0 });
  const uAxis = axisVector(upAxis, { x: 0, y: 0, z: 0 });
  const third = cross(f, uAxis);
  const q: Quat = { x: 0, y: 0, z: 0, w: 1 };
  const qPrev: Quat = { x: 0, y: 0, z: 0, w: 1 };

  for (let k = 0; k < n; k++) {
    const aim = normalize(targets[k]);
    if (!(Math.abs(length(aim) - 1) <= 1e-9)) throw new Error(`${label}: frame ${k}: test bug, target ${k} has no direction`);
    const where = `${label}: frame ${k} (${forwardAxis}/${upAxis}, aim.y ${aim.y})`;
    quatAt(transforms, k, q);
    const rf = rotateVec(q, f);
    const ru = rotateVec(q, uAxis);
    const rr = rotateVec(q, third);

    // Always: forward along the aim, orthonormal and proper basis.
    const forwardError = dist(rf, aim);
    if (!(forwardError <= FORWARD_TOLERANCE)) throw new Error(`${where}: rotated forward is ${forwardError} from the unit aim`);
    const perp = dot(ru, rf);
    if (!(Math.abs(perp) <= PERP_TOLERANCE)) throw new Error(`${where}: rotated up . rotated forward = ${perp}, expected 0`);
    const upLength = length(ru);
    if (!(Math.abs(upLength - 1) <= UNIT_TOLERANCE)) throw new Error(`${where}: rotated up has length ${upLength}, expected 1`);
    const properError = dist(cross(rf, ru), rr);
    if (!(properError <= PROPER_TOLERANCE)) throw new Error(`${where}: rotated forward x rotated up is ${properError} from the rotated third axis (mirror?)`);

    // The up rule that matches this frame's own angle.
    const inside = Math.abs(aim.y) >= COS_3_DEG;
    if (inside && k > 0) {
      const prevUp = rotateVec(quatAt(transforms, k - 1, qPrev), uAxis);
      const projected = perpendicularPart(prevUp, aim);
      if (length(projected) < SKIP_BELOW) {
        counts.skips++; // the library uses a fallback perpendicular here, which cannot be predicted
        continue;
      }
      const expected = normalize(projected);
      const upError = dist(ru, expected);
      if (!(upError <= UP_TOLERANCE)) {
        throw new Error(`${where}: baked up (${ru.x}, ${ru.y}, ${ru.z}) is ${upError} from the projected previous up (${expected.x}, ${expected.y}, ${expected.z})`);
      }
      counts.inside++;
    } else {
      const projected = perpendicularPart(WORLD_UP, aim);
      if (!(length(projected) >= SKIP_BELOW)) throw new Error(`${where}: test bug, world up has no part perpendicular to the aim`);
      const expected = normalize(projected);
      const upError = dist(ru, expected);
      if (!(upError <= UP_TOLERANCE)) {
        throw new Error(`${where}: baked up (${ru.x}, ${ru.y}, ${ru.z}) is ${upError} from the projected world up (${expected.x}, ${expected.y}, ${expected.z})${inside ? ' [frame 0 inside the cone]' : ''}`);
      }
      if (k === 0) counts.frame0++;
      else counts.outside++;
    }
  }
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Angles from vertical (degrees) for frame f: inside the 3 degree cone, then outside controls. */
const SPECIAL_ANGLES: readonly number[] = [0, 0.5, 1.5, 2.5, 2.9, 3.1, 5];
/** Angles near but never exactly at 3 degrees (nearest are 2.95 and 3.03) and never exactly vertical. */
const NEAR_MIN = 1.03;

interface GenericSpec {
  kind: number; // 0 wide, 1 near up, 2 near down
  i: number; // 0..99
  azimuth: number; // integer degrees 0..359
  distance: number; // integer metres 10..50
}

const arbGeneric: fc.Arbitrary<GenericSpec> = fc.record({
  kind: fc.integer({ min: 0, max: 2 }),
  i: fc.integer({ min: 0, max: 99 }),
  azimuth: fc.integer({ min: 0, max: 359 }),
  distance: fc.integer({ min: 10, max: 50 }),
});

function genericAim(g: GenericSpec): Aim {
  let theta: number;
  if (g.kind === 0) theta = NEAR_MIN + g.i * 1.76; // 1.03 .. 177.25
  else if (g.kind === 1) theta = NEAR_MIN + g.i * 0.08; // 1.03 .. 8.95
  else theta = 180 - (NEAR_MIN + g.i * 0.08);
  return { theta, azimuth: g.azimuth, distance: g.distance };
}

interface CaseSpec {
  frameCount: number;
  axes: readonly [AxisToken, AxisToken];
  fSeed: number;
  mode: number; // r % 8: 0-2 random previous aim, 3-4 jump on same side, 5-6 jump to the other side, 7 horizontal previous aim and vertical aim
  special: number; // index into SPECIAL_ANGLES
  down: boolean;
  prevDown: boolean;
  az0: number;
  distanceA: number;
  distanceB: number;
  generics: GenericSpec[]; // 12 entries, the first frameCount are used
}

const arbCase: fc.Arbitrary<CaseSpec> = fc.record({
  frameCount: fc.integer({ min: 3, max: 12 }),
  axes: arbValidAxisPair,
  fSeed: fc.integer({ min: 0, max: 99 }),
  mode: fc.integer({ min: 0, max: 7 }),
  special: fc.integer({ min: 0, max: SPECIAL_ANGLES.length - 1 }),
  down: fc.boolean(),
  prevDown: fc.boolean(),
  az0: fc.integer({ min: 0, max: 359 }),
  distanceA: fc.integer({ min: 10, max: 50 }),
  distanceB: fc.integer({ min: 10, max: 50 }),
  generics: fc.array(arbGeneric, { minLength: 12, maxLength: 12 }),
});

/** Builds the aims of a case: random frames, with frames f-1 and f set by the mode. */
function aimsOf(c: CaseSpec): Aim[] {
  const aims: Aim[] = [];
  for (let k = 0; k < c.frameCount; k++) aims.push(genericAim(c.generics[k]));
  const f = 1 + (c.fSeed % (c.frameCount - 1)); // 1 .. frameCount - 1
  const a = c.mode === 7 ? 0 : SPECIAL_ANGLES[c.special];
  const down = c.down;
  const fTheta = down ? 180 - a : a;
  if (c.mode <= 2) {
    // Frame f-1 keeps its random aim. Frame f takes the chosen angle on its own random azimuth.
    aims[f] = { theta: fTheta, azimuth: aims[f].azimuth, distance: c.distanceA };
  } else if (c.mode <= 6) {
    // Jump between opposite azimuths: 3.5 degrees from vertical, then the chosen angle on the other side.
    const prevIsDown = c.mode <= 4 ? down : c.prevDown;
    aims[f - 1] = { theta: prevIsDown ? 180 - 3.5 : 3.5, azimuth: c.az0, distance: c.distanceA };
    aims[f] = { theta: fTheta, azimuth: (c.az0 + 180) % 360, distance: c.distanceB };
  } else {
    // Exactly horizontal, then exactly vertical: the previous up is world up, parallel to the new aim.
    aims[f - 1] = { theta: 90, azimuth: c.az0, distance: c.distanceA };
    aims[f] = { theta: fTheta, azimuth: c.az0, distance: c.distanceB };
  }
  return aims;
}

function expectAllCountsPositive(counts: Counts): void {
  expect(counts.inside).toBeGreaterThan(0);
  expect(counts.outside).toBeGreaterThan(0);
  expect(counts.frame0).toBeGreaterThan(0);
  expect(counts.skips).toBeGreaterThan(0);
}

describe('Property 31: Near-vertical aim uses the projected previous up vector', () => {
  it('inside the 3 degree cone the up is the previous baked up projected perpendicular to the aim; outside it is world up; basis stays orthonormal and proper', () => {
    let runs = 0;
    const counts = newCounts();
    fc.assert(
      fc.property(arbCase, (c) => {
        runs++;
        const targets = aimsOf(c).map(targetOf);
        checkTargets(`run ${runs}`, targets, c.axes[0], c.axes[1], counts);
      }),
      { numRuns: 200 },
    );
    expect(runs).toBeGreaterThanOrEqual(200);
    expectAllCountsPositive(counts);
    // Skips (projection shorter than 1e-9) only come from the forced horizontal-then-vertical mode: they must stay rare.
    expect(counts.skips * 4).toBeLessThanOrEqual(counts.inside);
  });

  describe('deterministic cases, all 24 valid axis pairs', () => {
    it('jump between opposite azimuths: 3.5 degrees on azimuth 0, then each inside-cone angle on azimuth 180, up and down', () => {
      expect(VALID_AXIS_PAIRS.length).toBe(24);
      const counts = newCounts();
      for (const [forwardAxis, upAxis] of VALID_AXIS_PAIRS) {
        for (const down of [false, true]) {
          for (const a of [0.5, 1.5, 2.5, 2.9]) {
            const flip = (t: number): number => (down ? 180 - t : t);
            const aims: Aim[] = [
              { theta: 60, azimuth: 10, distance: 20 },
              { theta: flip(3.5), azimuth: 0, distance: 20 },
              { theta: flip(a), azimuth: 180, distance: 20 },
              { theta: flip(3.5), azimuth: 180, distance: 20 },
              { theta: flip(2.9), azimuth: 0, distance: 20 },
            ];
            checkTargets(`jump ${forwardAxis}/${upAxis} ${down ? 'down' : 'up'} ${a}`, aims.map(targetOf), forwardAxis, upAxis, counts);
          }
        }
      }
      expect(counts.inside).toBe(24 * 2 * 4 * 2); // frames 2 and 4 of every case
      expect(counts.outside).toBe(24 * 2 * 4 * 2); // frames 1 and 3
      expect(counts.frame0).toBe(24 * 2 * 4);
      expect(counts.skips).toBe(0);
    });

    it('previous up parallel to the new aim: forward equals the aim and the basis is orthonormal and proper', () => {
      const counts = newCounts();
      const placeholder: Vec3 = { x: 1, y: 1, z: 1 };
      for (const [forwardAxis, upAxis] of VALID_AXIS_PAIRS) {
        const label = `parallel ${forwardAxis}/${upAxis}`;
        const first: Vec3 = { x: 3, y: 10, z: -2 };
        const almostHorizontal: Vec3 = { x: 6, y: -0.15, z: 4 };

        // Step 1: bake with a placeholder last target to read the baked up of frame 1.
        const probe = bake(sceneOf([first, almostHorizontal, placeholder], forwardAxis, upAxis)).transforms[0];
        const q: Quat = { x: 0, y: 0, z: 0, w: 1 };
        const u0 = rotateVec(quatAt(probe, 1, q), axisVector(upAxis, { x: 0, y: 0, z: 0 }));
        const angle = (Math.acos(Math.min(1, Math.abs(u0.y))) * 180) / Math.PI;
        expect(angle, `${label}: angle of U0 from vertical (degrees)`).toBeLessThan(3);

        // Step 2: bake again with frame 2 aimed exactly along U0.
        const before = counts.skips;
        const target: Vec3 = { x: 20 * u0.x, y: 20 * u0.y, z: 20 * u0.z };
        checkTargets(label, [first, almostHorizontal, target], forwardAxis, upAxis, counts);
        expect(counts.skips - before, `${label}: the up check must have been skipped once`).toBe(1);
      }
      expect(counts.skips).toBe(24);
      expect(counts.frame0).toBe(24);
      expect(counts.outside).toBe(24);
      expect(counts.inside).toBe(0);
    });
  });
});
