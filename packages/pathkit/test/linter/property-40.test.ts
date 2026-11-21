import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { VERTICAL_COS } from '../../src/bake.js';
import { motionLinter } from '../../src/linter.js';
import type { Finding } from '../../src/linter.js';
import type { Quat } from '../../src/math.js';
import type { AxisToken } from '../../src/scene.js';
import { buildFixture, quatAboutAxis, quatMul } from '../helpers/baked-builder.js';
import type { FixtureEntity } from '../helpers/baked-builder.js';
import { arbUnitQuat, arbValidAxisPair } from '../helpers/basic-generators.js';

// Feature: path-core, Property 40: Roll change and aim-vertical findings match their thresholds
// **Validates: Requirements 9.2, 9.5, 9.11**
//
// BakedData is built by hand with buildFixture, so no baking runs and no scene generator is needed.

// ---------------------------------------------------------------------------
// Independent oracle (deliberately different from src/linter.ts: matrix instead of rotateVec,
// local token function instead of axisVector, acos with clamping instead of atan2)
// ---------------------------------------------------------------------------

type V3 = [number, number, number];

function tokenVec(token: AxisToken): V3 {
  const sign = token[0] === '+' ? 1 : -1;
  const letter = token[1];
  if (letter === 'X') return [sign, 0, 0];
  if (letter === 'Y') return [0, sign, 0];
  return [0, 0, sign];
}

/** Rotates v by the unit quaternion q using its 3x3 rotation matrix. */
function matVec(q: Quat, v: V3): V3 {
  const { x, y, z, w } = q;
  const m00 = 1 - 2 * (y * y + z * z);
  const m01 = 2 * (x * y - z * w);
  const m02 = 2 * (x * z + y * w);
  const m10 = 2 * (x * y + z * w);
  const m11 = 1 - 2 * (x * x + z * z);
  const m12 = 2 * (y * z - x * w);
  const m20 = 2 * (x * z - y * w);
  const m21 = 2 * (y * z + x * w);
  const m22 = 1 - 2 * (x * x + y * y);
  return [
    m00 * v[0] + m01 * v[1] + m02 * v[2],
    m10 * v[0] + m11 * v[1] + m12 * v[2],
    m20 * v[0] + m21 * v[1] + m22 * v[2],
  ];
}

const dot3 = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Component of v perpendicular to the unit vector f. */
function perp(v: V3, f: V3): V3 {
  const d = dot3(v, f);
  return [v[0] - d * f[0], v[1] - d * f[1], v[2] - d * f[2]];
}

/**
 * Roll angle in radians between the up axis at the earlier frame (qBefore) and at the later frame
 * (qAfter), measured around the forward axis rotated by qForward. The linter uses the later frame
 * for qForward. Tests may pass the earlier frame to compute the wrong answer on purpose.
 */
function oracleRoll(qForward: Quat, qBefore: Quat, qAfter: Quat, fwd: AxisToken, up: AxisToken): number {
  const f = matVec(qForward, tokenVec(fwd));
  const a = perp(matVec(qBefore, tokenVec(up)), f);
  const b = perp(matVec(qAfter, tokenVec(up)), f);
  const la = Math.hypot(a[0], a[1], a[2]);
  const lb = Math.hypot(b[0], b[1], b[2]);
  if (la < 1e-9 || lb < 1e-9) return 0;
  const d = dot3(a, b) / (la * lb);
  return Math.acos(Math.min(1, Math.max(-1, d)));
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const IDENTITY: Quat = { x: 0, y: 0, z: 0, w: 1 };

function framesOf(findings: readonly Finding[], code: string, entityId: string): number[] {
  const out: number[] = [];
  for (const x of findings) if (x.code === code && x.entityId === entityId) out.push(x.frame);
  return out;
}

// ---------------------------------------------------------------------------
// Roll-change property
// ---------------------------------------------------------------------------

type RollMode = 'random' | 'slight' | 'identical';
interface RollEntitySpec {
  pair: readonly [AxisToken, AxisToken];
  mode: RollMode;
  quats: Quat[];
  deltas: { axis: number; deg: number }[];
}

const arbRollEntity: fc.Arbitrary<RollEntitySpec> = fc.record({
  pair: arbValidAxisPair,
  mode: fc.constantFrom<RollMode>('random', 'slight', 'identical'),
  quats: fc.array(arbUnitQuat, { minLength: 12, maxLength: 12 }),
  deltas: fc.array(
    fc.record({ axis: fc.integer({ min: 0, max: 2 }), deg: fc.integer({ min: -40, max: 40 }) }),
    { minLength: 12, maxLength: 12 },
  ),
});

const arbThreshold: fc.Arbitrary<number> = fc.oneof(
  { weight: 8, arbitrary: fc.integer({ min: 1, max: 90 }) },
  { weight: 1, arbitrary: fc.constantFrom(0.001, 179.9) },
);

const arbRollCase = fc.record({
  frameCount: fc.integer({ min: 3, max: 12 }),
  entities: fc.array(arbRollEntity, { minLength: 1, maxLength: 2 }),
  thresholds: fc.array(arbThreshold, { minLength: 3, maxLength: 3 }),
});

const LETTERS: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];

function rotationsOf(spec: RollEntitySpec, frameCount: number): Quat[] {
  const out: Quat[] = [];
  for (let f = 0; f < frameCount; f++) {
    if (spec.mode === 'random') out.push(spec.quats[f]);
    else if (spec.mode === 'identical') out.push(spec.quats[0]);
    else if (f === 0) out.push(spec.quats[0]);
    else {
      const d = spec.deltas[f];
      out.push(quatMul(out[f - 1], quatAboutAxis(LETTERS[d.axis], d.deg)));
    }
  }
  return out;
}

describe('Property 40: roll change and aim-vertical findings match their thresholds', () => {
  it('roll-change appears exactly on frames whose roll exceeds the threshold', () => {
    let emitted = 0;
    let notEmitted = 0;
    let runs = 0;
    fc.assert(
      fc.property(arbRollCase, (c) => {
        runs++;
        const entities: FixtureEntity[] = c.entities.map((spec, i) => ({
          id: `e${i}`,
          forwardAxis: spec.pair[0],
          upAxis: spec.pair[1],
          rotations: rotationsOf(spec, c.frameCount),
        }));
        const { scene, baked } = buildFixture(c.frameCount, 30, entities);
        for (const thresholdDeg of c.thresholds) {
          const findings = motionLinter(scene, baked, { rollThresholdDegPerFrame: thresholdDeg });
          const thresholdRad = toRad(thresholdDeg);
          for (let i = 0; i < entities.length; i++) {
            const ent = entities[i];
            const rots = ent.rotations as Quat[];
            const actual = framesOf(findings, 'roll-change', ent.id);
            for (const fr of actual) {
              if (fr < 1 || fr >= c.frameCount) {
                throw new Error(`roll-change run ${runs}: entity ${ent.id} finding at out-of-range frame ${fr} (frameCount ${c.frameCount})`);
              }
            }
            for (let f = 1; f < c.frameCount; f++) {
              const angle = oracleRoll(rots[f], rots[f - 1], rots[f], ent.forwardAxis as AxisToken, ent.upAxis as AxisToken);
              if (Math.abs(angle - thresholdRad) <= 1e-6) continue;
              // acos is imprecise near 0 and pi (error about 1e-8 rad). The smallest threshold used is
              // 0.001 degrees (1.7e-5 rad), so the 1e-6 band above already covers that imprecision.
              const expected = angle > thresholdRad;
              const got = actual.includes(f);
              if (expected !== got) {
                throw new Error(
                  `roll-change run ${runs}: entity ${ent.id} (forward ${ent.forwardAxis}, up ${ent.upAxis}) frame ${f}: ` +
                  `expected ${expected ? 'finding' : 'no finding'} but found ${got ? 'finding' : 'none'} ` +
                  `(oracle angle ${angle} rad, threshold ${thresholdRad} rad = ${thresholdDeg} deg)`,
                );
              }
              if (got) emitted++;
              else notEmitted++;
            }
          }
        }
      }),
      { numRuns: 200 },
    );
    expect(runs).toBeGreaterThanOrEqual(200);
    expect(emitted).toBeGreaterThan(0);
    expect(notEmitted).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Aim-vertical property
  // -------------------------------------------------------------------------

  interface AimSpec { kind: number; a: number; b: number }
  const arbAim: fc.Arbitrary<AimSpec> = fc.record({
    kind: fc.integer({ min: 0, max: 3 }),
    a: fc.integer({ min: 0, max: 1000000 }),
    b: fc.integer({ min: 0, max: 1000000 }),
  });
  const arbAimCase = fc.record({
    frameCount: fc.integer({ min: 3, max: 12 }),
    entities: fc.array(fc.array(arbAim, { minLength: 12, maxLength: 12 }), { minLength: 1, maxLength: 2 }),
  });

  function aimVector(s: AimSpec): [number, number, number] {
    const azimuth = (2 * Math.PI * s.b) / 1000000;
    if (s.kind === 0) return [0, 0, 0];
    if (s.kind === 1) {
      const y = -1 + (2 * s.a) / 1000000;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      return [r * Math.cos(azimuth), y, r * Math.sin(azimuth)];
    }
    // Near vertical: 0 to 6 degrees from straight up (kind 2) or down (kind 3).
    const angle = toRad((6 * s.a) / 1000000);
    const sign = s.kind === 2 ? 1 : -1;
    const r = Math.sin(angle);
    return [r * Math.cos(azimuth), sign * Math.cos(angle), r * Math.sin(azimuth)];
  }

  it('aim-vertical appears exactly on frames with a non-zero aim within 3 degrees of vertical', () => {
    const cos3 = Math.cos((3 * Math.PI) / 180);
    let emitted = 0;
    let notEmitted = 0;
    let runs = 0;
    fc.assert(
      fc.property(arbAimCase, (c) => {
        runs++;
        const entities: FixtureEntity[] = c.entities.map((specs, i) => ({
          id: `e${i}`,
          aimDirections: specs.slice(0, c.frameCount).map(aimVector),
        }));
        const { scene, baked } = buildFixture(c.frameCount, 30, entities);
        const findings = motionLinter(scene, baked);
        for (const ent of entities) {
          const aims = ent.aimDirections as [number, number, number][];
          const actual = framesOf(findings, 'aim-vertical', ent.id);
          for (let f = 0; f < c.frameCount; f++) {
            const v = aims[f];
            const nonZero = v[0] !== 0 || v[1] !== 0 || v[2] !== 0;
            if (Math.abs(Math.abs(v[1]) - cos3) <= 1e-9) continue;
            const expected = nonZero && Math.abs(v[1]) >= cos3;
            const got = actual.includes(f);
            if (expected !== got) {
              throw new Error(
                `aim-vertical run ${runs}: entity ${ent.id} frame ${f}: expected ${expected ? 'finding' : 'no finding'} ` +
                `but found ${got ? 'finding' : 'none'} (aim ${v[0]}, ${v[1]}, ${v[2]}; cos 3 degrees ${cos3})`,
              );
            }
            if (got) emitted++;
            else notEmitted++;
          }
        }
      }),
      { numRuns: 200 },
    );
    expect(runs).toBeGreaterThanOrEqual(200);
    expect(emitted).toBeGreaterThan(0);
    expect(notEmitted).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Hand-built fixtures with exact answers
  // -------------------------------------------------------------------------

  /** Roll-change findings of a 2-frame fixture (identity, then q1), as 'entity@frame' strings. */
  function rollFindings(
    q1: Quat, threshold: number | undefined, fwd: AxisToken = '+Z', up: AxisToken = '+Y',
  ): string[] {
    const { scene, baked } = buildFixture(2, 30, [
      { id: 'rover', forwardAxis: fwd, upAxis: up, rotations: [IDENTITY, q1] },
    ]);
    const findings = threshold === undefined
      ? motionLinter(scene, baked)
      : motionLinter(scene, baked, { rollThresholdDegPerFrame: threshold });
    return findings.filter((x) => x.code === 'roll-change').map((x) => `${x.entityId}@${x.frame}`);
  }

  const EMIT = ['rover@1'];
  const NONE: string[] = [];

  it('a: pure roll about forward uses the default threshold of 15 degrees', () => {
    expect(rollFindings(quatAboutAxis('z', 20), undefined)).toEqual(EMIT);
    expect(rollFindings(quatAboutAxis('z', 12), undefined)).toEqual(NONE);
    expect(rollFindings(quatAboutAxis('z', 18), undefined)).toEqual(EMIT);
  });

  it('b: a 20 degree roll emits at 19.999 and not at 20.001', () => {
    const q = quatAboutAxis('z', 20);
    expect(rollFindings(q, 19.999)).toEqual(EMIT);
    expect(rollFindings(q, 20.001)).toEqual(NONE);
  });

  it('c: when forward changes, the roll is measured around the later frame forward axis', () => {
    // Roll 30 degrees about z first, then yaw 40 degrees about y. The true roll is 30 degrees.
    // Using frame f-1's forward axis (+Z, unchanged) instead of frame f's would measure the
    // tilted up vector against the wrong plane and give a different angle (about 24 degrees).
    const q1 = quatMul(quatAboutAxis('y', 40), quatAboutAxis('z', 30));
    const right = (oracleRoll(q1, IDENTITY, q1, '+Z', '+Y') * 180) / Math.PI;
    const wrong = (oracleRoll(IDENTITY, IDENTITY, q1, '+Z', '+Y') * 180) / Math.PI;
    expect(right).toBeCloseTo(30, 6);
    expect(Math.abs(wrong - 30)).toBeGreaterThan(0.5);
    expect(rollFindings(q1, 29.99)).toEqual(EMIT);
    expect(rollFindings(q1, 30.01)).toEqual(NONE);
  });

  it('d: pure pitch and pure yaw are not roll', () => {
    expect(rollFindings(quatAboutAxis('x', 40), 0.001)).toEqual(NONE);
    expect(rollFindings(quatAboutAxis('y', 40), 0.001)).toEqual(NONE);
  });

  it('e: forward +X with up +Z: a 25 degree roll about x emits at 24.99 and not at 25.01', () => {
    const q = quatAboutAxis('x', 25);
    expect(rollFindings(q, 24.99, '+X', '+Z')).toEqual(EMIT);
    expect(rollFindings(q, 25.01, '+X', '+Z')).toEqual(NONE);
  });

  it('f: a 170 degree roll emits at 169.9 and not at 170.1', () => {
    const q = quatAboutAxis('z', 170);
    expect(rollFindings(q, 169.9)).toEqual(EMIT);
    expect(rollFindings(q, 170.1)).toEqual(NONE);
  });

  it('g: a tiny roll of 1e-8 radians emits at half that angle', () => {
    const q = quatAboutAxis('z', (1e-8 * 180) / Math.PI);
    const halfDeg = (0.5e-8 * 180) / Math.PI;
    expect(rollFindings(q, halfDeg)).toEqual(EMIT);
  });

  it('h: aim-vertical at exactly VERTICAL_COS and -VERTICAL_COS emits, just below and zero do not', () => {
    const { scene, baked } = buildFixture(7, 30, [
      {
        id: 'rover',
        aimDirections: [
          [0, VERTICAL_COS, 0], // 0: exactly on the boundary, emits
          [0, -VERTICAL_COS, 0], // 1: exactly on the boundary, emits
          [0, VERTICAL_COS - 1e-12, 0], // 2: just below, no
          [0, 0, 0], // 3: zero vector, no
          [0, -(VERTICAL_COS - 1e-12), 0], // 4: just below, no
          [0, 1, 0], // 5: straight up, emits
          [1, 0, 0], // 6: horizontal, no
        ],
      },
    ]);
    const findings = motionLinter(scene, baked);
    const vertical = findings.filter((x) => x.code === 'aim-vertical').map((x) => `${x.entityId}@${x.frame}`);
    expect(vertical).toEqual(['rover@0', 'rover@1', 'rover@5']);
    expect(findings.filter((x) => x.code === 'roll-change')).toHaveLength(0);
  });
});
