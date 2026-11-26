import { describe, expect, it } from 'vitest';
import { Box3, type Group } from 'three';
import { buildPumpModel } from '../src/render/pump-model.js';
import { PUMP_PARTS } from '../src/data/catalogue.js';
import type { PartEntry } from '../src/data/catalogue-types.js';

// Fit test (Task 17.3, Requirement 18.6): no shape of a Pump Part reaches outside the Part's extents box,
// at any impeller spin angle. The box is measured exactly (from vertices), not from bounding spheres.
// Edge LineSegments children share their mesh's vertices (EdgesGeometry keeps a subset of them),
// so they cannot change the measured box.
const TOL = 1e-6;
const AXES = ['x', 'y', 'z'] as const;

interface Overshoot {
  readonly amount: number;
  readonly axis: 'x' | 'y' | 'z';
}

/** Largest overshoot (metres) of the Part's exact box over its half-extents, and the axis it is on. Negative means inside. */
function largestOvershoot(group: Group, entry: PartEntry): Overshoot {
  const box = new Box3().setFromObject(group, true);
  let best: Overshoot = { amount: -Infinity, axis: 'x' };
  for (let i = 0; i < 3; i++) {
    const rest = entry.restPosition[i]!;
    const half = entry.extents[i]! / 2;
    const over = Math.max(box.max.getComponent(i) - rest - half, rest - box.min.getComponent(i) - half);
    if (over > best.amount) best = { amount: over, axis: AXES[i]! };
  }
  return best;
}

describe('pump parts fit their extents boxes', () => {
  it('every Part stays inside its extents with the impeller spinner at rotation.x 0, 0.3 and 1', () => {
    const model = buildPumpModel();
    for (const angle of [0, 0.3, 1]) {
      model.impellerSpinner.rotation.x = angle;
      model.root.updateMatrixWorld(true);
      for (const entry of PUMP_PARTS) {
        const group = model.partsById.get(entry.id)!;
        const o = largestOvershoot(group, entry);
        expect(
          o.amount,
          `Part ${entry.id} overshoots its extents on axis ${o.axis} by ${o.amount} m at spin ${angle}`,
        ).toBeLessThanOrEqual(TOL);
      }
    }
    model.dispose();
  });

  it('reports an overshoot above 0.02 for the casing when its x extent is 0.05 smaller', () => {
    // Casing shape reaches x = +0.30 from its centre. Half-extent 0.275 gives 0.30 - 0.275 = 0.025.
    const smaller = PUMP_PARTS.map((p) =>
      p.id === 'pump-casing' ? { ...p, extents: [p.extents[0] - 0.05, p.extents[1], p.extents[2]] as typeof p.extents } : p,
    );
    const model = buildPumpModel(smaller);
    model.root.updateMatrixWorld(true);
    const casing = smaller.find((p) => p.id === 'pump-casing')!;
    const o = largestOvershoot(model.partsById.get('pump-casing')!, casing);
    expect(o.axis).toBe('x');
    expect(o.amount).toBeGreaterThan(0.02);
    model.dispose();
  });
});
