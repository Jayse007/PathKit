import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { validateScene } from '../../src/scene.js';
import type { AxisToken } from '../../src/scene.js';
import type { BakedData } from '../../src/bake.js';
import {
  AXIS_UNIT,
  FORCED_ORBIT_CASES,
  ORBIT_AXES,
  arbOrbitCase,
  bakedPosition,
  buildOrbitScene,
  centreAt,
  cross3,
  dot3,
  len3,
  scaleOf,
  sub3,
} from './orbit-generators.js';
import type { OrbitCase } from './orbit-generators.js';

// Self-check of the orbit test helper. The side-vector table is written out here from the
// Glossary of requirements.md, independently of the helper and of src.
const X = [1, 0, 0];
const Y = [0, 1, 0];
const Z = [0, 0, 1];
const SIDES: Record<AxisToken, [number[], number[]]> = {
  '+X': [Y, Z],
  '-X': [Z, Y],
  '+Y': [Z, X],
  '-Y': [X, Z],
  '+Z': [X, Y],
  '-Z': [Y, X],
};

describe('orbit generators (self-check)', () => {
  it('the six unit vectors have length 1 and side1 x side2 equals the axis', () => {
    for (const axis of ORBIT_AXES) {
      const unit = AXIS_UNIT[axis];
      expect(len3(unit)).toBe(1);
      const [side1, side2] = SIDES[axis];
      const product = cross3(side1, side2);
      for (let k = 0; k < 3; k++) {
        expect(Math.abs(product[k] - unit[k])).toBeLessThan(1e-12);
      }
      expect(dot3(side1, unit)).toBe(0);
      expect(dot3(side2, unit)).toBe(0);
    }
  });

  it('dot3, cross3, sub3 and len3 give hand-checked values', () => {
    expect(dot3([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(cross3([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(sub3([5, 5, 5], [1, 2, 3])).toEqual([4, 3, 2]);
    expect(len3([3, 4, 0])).toBe(5);
  });

  it('centreAt returns the static centre at every frame', () => {
    const c: OrbitCase = { ...FORCED_ORBIT_CASES[0], centre: { kind: 'static', c: [1, 2, 3] } };
    expect(centreAt(c, 0)).toEqual([1, 2, 3]);
    expect(centreAt(c, 7)).toEqual([1, 2, 3]);
  });

  it('centreAt of a linear case is c0 + frame * step', () => {
    const c: OrbitCase = {
      ...FORCED_ORBIT_CASES[0],
      centre: { kind: 'linear', c0: [1, -2, 3], step: [0.5, 1, -2] },
    };
    expect(centreAt(c, 0)).toEqual([1, -2, 3]);
    expect(centreAt(c, 4)).toEqual([3, 2, -5]);
  });

  it('scaleOf is 1 + radius + the largest centre coordinate magnitude', () => {
    const base = FORCED_ORBIT_CASES[0];
    const staticCase: OrbitCase = { ...base, radius: 5, centre: { kind: 'static', c: [1, -7, 3] } };
    expect(scaleOf(staticCase)).toBe(13);
    const linear: OrbitCase = {
      ...base,
      radius: 2,
      frameCount: 10,
      centre: { kind: 'linear', c0: [1, 0, 0], step: [0, -3, 0] },
    };
    // centre at frame 10 is (1, -30, 0), so the largest magnitude is 30
    expect(scaleOf(linear)).toBe(33);
  });

  it('buildOrbitScene makes a valid scene with the orbit constraint and the centre target', () => {
    for (const c of FORCED_ORBIT_CASES) {
      const scene = buildOrbitScene(c);
      expect(() => validateScene(scene)).not.toThrow();
      expect(scene.entities.length).toBe(1);
      expect(scene.entities[0].id).toBe('orbiter');
      expect(scene.entities[0].constraints.length).toBe(1);
    }
    const linear: OrbitCase = {
      ...FORCED_ORBIT_CASES[0],
      frameCount: 6,
      centre: { kind: 'linear', c0: [1, 2, 3], step: [1, 0, -1] },
    };
    const target = buildOrbitScene(linear).targets['centre'];
    expect(target).toEqual({
      keyframes: [
        { frame: 0, position: { x: 1, y: 2, z: 3 } },
        { frame: 6, position: { x: 7, y: 2, z: -3 } },
      ],
    });
  });

  it('buildOrbitScene applies the extras', () => {
    const scene = buildOrbitScene(FORCED_ORBIT_CASES[0], {
      orbitOrder: 3,
      orbitInfluence: 0.5,
      targets: { anchor: { x: 0, y: 0, z: 0 } },
      constraints: [{ type: 'aimAt', order: 4, influence: 1, target: 'anchor' }],
    });
    const [orbit, aim] = scene.entities[0].constraints;
    expect(orbit.order).toBe(3);
    expect(orbit.influence).toBe(0.5);
    expect(aim.type).toBe('aimAt');
    expect(Object.keys(scene.targets)).toEqual(['centre', 'anchor']);
    expect(() => validateScene(scene)).not.toThrow();
  });

  it('bakedPosition reads the first three numbers of the 7-number block', () => {
    const t = new Float64Array(14);
    t.set([1, 2, 3, 0, 0, 0, 1, 4, 5, 6, 0, 0, 0, 1]);
    const baked = { transforms: [t] } as unknown as BakedData;
    expect(bakedPosition(baked, 0, 0, [0, 0, 0])).toEqual([1, 2, 3]);
    expect(bakedPosition(baked, 0, 1, [0, 0, 0])).toEqual([4, 5, 6]);
  });

  it('forced cases cover radius 0, startAngle 0, 90 and 360 degree turns, frameCount 1 and all six axes', () => {
    const cases = FORCED_ORBIT_CASES;
    expect(cases.some((c) => c.radius === 0)).toBe(true);
    expect(cases.some((c) => c.startAngle === 0)).toBe(true);
    expect(cases.some((c) => c.speed === 90 * c.fps)).toBe(true);
    expect(cases.some((c) => c.speed === 360 * c.fps)).toBe(true);
    expect(cases.some((c) => c.frameCount === 1)).toBe(true);
    for (const axis of ORBIT_AXES) {
      expect(cases.some((c) => c.axis === axis)).toBe(true);
    }
  });

  it('arbOrbitCase stays inside its ranges and its scenes validate (500 samples)', () => {
    const samples = fc.sample(arbOrbitCase(), { numRuns: 500, seed: 7 });
    const seenAxes = new Set<string>();
    let linear = 0;
    for (const c of samples) {
      if (![24, 30, 60].includes(c.fps)) throw new Error(`fps out of range: ${c.fps}`);
      if (c.frameCount < 1 || c.frameCount > 120) throw new Error(`frameCount out of range: ${c.frameCount}`);
      if (c.radius < 0 || c.radius > 30) throw new Error(`radius out of range: ${c.radius}`);
      if (Math.abs(c.speed) > 720 * c.fps) throw new Error(`speed out of range: ${c.speed}`);
      if (c.startAngle < -720 || c.startAngle > 720) throw new Error(`startAngle out of range: ${c.startAngle}`);
      seenAxes.add(c.axis);
      if (c.centre.kind === 'linear') linear++;
      validateScene(buildOrbitScene(c));
    }
    expect(seenAxes.size).toBe(6);
    expect(linear).toBeGreaterThan(0);
    expect(linear).toBeLessThan(samples.length);
  });

  it('arbOrbitCase options: minimum radius, speed cap and static-only centre', () => {
    const samples = fc.sample(
      arbOrbitCase({ minRadius: 0.1, maxDegreesPerFrame: 179, allowMovingCentre: false }),
      { numRuns: 300, seed: 11 },
    );
    for (const c of samples) {
      if (c.radius < 0.1) throw new Error(`radius below minimum: ${c.radius}`);
      if (Math.abs(c.speed / c.fps) > 179) throw new Error(`degrees per frame above cap: ${c.speed / c.fps}`);
      if (c.centre.kind !== 'static') throw new Error('centre is not static');
    }
    expect(samples.length).toBe(300);
  });
});
