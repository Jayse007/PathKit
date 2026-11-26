import { describe, expect, it } from 'vitest';
import { buildPumpModel } from '../src/render/pump-model.js';
import { createPartPlacer } from '../src/render/part-placement.js';
import { bakeParts } from '../src/pathkit/part-scenes.js';

// Part placement (Task 17.3). Three.js Group only, no renderer. Expected values written by hand.
const TOL = 1e-6;

const IDS = [
  'pump-motor',
  'pump-bearing-housing',
  'pump-shaft',
  'pump-mechanical-seal',
  'pump-bolts',
  'pump-casing',
  'pump-impeller',
  'pump-flange',
];

// rest position
const REST: readonly (readonly [number, number, number])[] = [
  [-0.75, -0.05, 0],
  [-0.35, -0.02, 0],
  [-0.15, 0, 0],
  [0.02, 0, 0],
  [0.12, 0, 0],
  [0.4, 0, 0],
  [0.38, 0, 0],
  [0.5, 0.28, 0],
];

// rest + explode vector
const END: readonly (readonly [number, number, number])[] = [
  [-0.92, -0.05, 0],
  [-0.41, -0.22, 0],
  [-0.15, 0, 0.36],
  [-0.01, -0.44, 0],
  [0.04, -0.05, 0.04],
  [0.47, -0.13, -0.14],
  [0.58, 0.39, -0.18],
  [0.5, 0.55, 0.19],
];

function setup() {
  const model = buildPumpModel();
  const placer = createPartPlacer(model.partsById, bakeParts());
  return { model, placer };
}

function expectAt(
  model: ReturnType<typeof buildPumpModel>,
  expected: readonly (readonly [number, number, number])[],
): void {
  for (let i = 0; i < 8; i++) {
    const p = model.partObjects[i]!.position;
    expect(Math.abs(p.x - expected[i]![0])).toBeLessThan(TOL);
    expect(Math.abs(p.y - expected[i]![1])).toBeLessThan(TOL);
    expect(Math.abs(p.z - expected[i]![2])).toBeLessThan(TOL);
  }
}

function snapshot(model: ReturnType<typeof buildPumpModel>): number[][] {
  return model.partObjects.map((g) => [g.position.x, g.position.y, g.position.z]);
}

describe('createPartPlacer', () => {
  it('placeAtFrame(59) puts every Part at rest + explode vector', () => {
    const { model, placer } = setup();
    placer.placeAtFrame(59);
    expectAt(model, END);
  });

  it('placeAtFrame(0) puts every Part at rest', () => {
    const { model, placer } = setup();
    placer.placeAtFrame(59);
    placer.placeAtFrame(0);
    expectAt(model, REST);
  });

  // 25% -> smoothstep 0.15625 * 59 = 9.2 -> frame 9. 50% -> 29.5 rounded half up -> frame 30.
  it.each([
    [0, 0],
    [25, 9],
    [50, 30],
    [100, 59],
    [-10, 0],
    [150, 59],
  ])('placeAtAmount(%s) matches placeAtFrame(%s)', (amount, frame) => {
    const a = setup();
    a.placer.placeAtAmount(amount);
    const b = setup();
    b.placer.placeAtFrame(frame);
    const sa = snapshot(a.model);
    const sb = snapshot(b.model);
    for (let i = 0; i < 8; i++) {
      for (let k = 0; k < 3; k++) {
        expect(Math.abs(sa[i]![k]! - sb[i]![k]!)).toBeLessThan(TOL);
      }
    }
  });

  it('throws naming the Part when it has no baked scene', () => {
    const model = buildPumpModel();
    const baked = bakeParts();
    baked.delete('pump-bolts');
    expect(() => createPartPlacer(model.partsById, baked)).toThrow(/pump-bolts/);
  });

  it('never rotates Parts', () => {
    const { model, placer } = setup();
    placer.placeAtFrame(30);
    expect(model.partObjects).toHaveLength(IDS.length);
    for (const g of model.partObjects) {
      expect(g.quaternion.x).toBe(0);
      expect(g.quaternion.y).toBe(0);
      expect(g.quaternion.z).toBe(0);
      expect(g.quaternion.w).toBe(1);
    }
  });
});
