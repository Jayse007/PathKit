import { describe, expect, it } from 'vitest';
import type { ActiveElementKind } from '../src/logic/shortcut-guard.js';
import {
  keyToAction,
  moveKeyStep,
  orbitAngleFromDrag,
  orbitKeyStep,
  stepZoom,
  zoomKeyStep,
  zoomWheelStep,
} from '../src/ui/input.js';
import type { KeyAction } from '../src/ui/input.js';

// Requirements 10.3, 11.1, 12.1, 12.3, 12.5, 12.9, 13.1. Expected values are typed in by hand.

const TOL = 1e-9;

function near(check: string, index: number, actual: number, expected: number): void {
  if (!(Math.abs(actual - expected) <= TOL)) {
    throw new Error(`${check}: row ${index}: expected ${expected}, got ${actual}`);
  }
}

const KEY_TABLE: ReadonlyArray<readonly [string, KeyAction]> = [
  ['m', 'toggle-mode'],
  ['M', 'toggle-mode'],
  ['e', 'toggle-explode'],
  ['E', 'toggle-explode'],
  ['r', 'reset-position'],
  ['R', 'reset-position'],
  ['+', 'zoom-in'],
  ['=', 'zoom-in'],
  ['-', 'zoom-out'],
  ['ArrowLeft', 'arrow-left'],
  ['ArrowRight', 'arrow-right'],
  ['ArrowUp', 'arrow-up'],
  ['ArrowDown', 'arrow-down'],
  ['Escape', 'clear-selection'],
];

describe('keyToAction', () => {
  it('maps each key of the table with no focus', () => {
    for (let i = 0; i < KEY_TABLE.length; i++) {
      const [key, action] = KEY_TABLE[i]!;
      const got = keyToAction({ key }, 'none');
      if (got !== action) throw new Error(`key map: row ${i}: key "${key}" expected ${action}, got ${String(got)}`);
    }
  });

  it('maps the same keys when a button has focus', () => {
    for (let i = 0; i < KEY_TABLE.length; i++) {
      const [key, action] = KEY_TABLE[i]!;
      const got = keyToAction({ key }, 'button');
      if (got !== action) throw new Error(`button focus: row ${i}: key "${key}" expected ${action}, got ${String(got)}`);
    }
  });

  it('returns null for keys with no action', () => {
    const unmapped = ['x', 'a', ' ', 'Enter', 'Tab', 'Shift', '0', '_', 'PageUp'];
    for (let i = 0; i < unmapped.length; i++) {
      const got = keyToAction({ key: unmapped[i]! }, 'none');
      if (got !== null) throw new Error(`unmapped keys: row ${i}: key "${unmapped[i]}" expected null, got ${got}`);
    }
  });

  it('ignores every shortcut while a text field, textarea, select or range slider has focus', () => {
    const blocked: ActiveElementKind[] = ['text-input', 'textarea', 'select', 'range-input'];
    for (let f = 0; f < blocked.length; f++) {
      for (let i = 0; i < KEY_TABLE.length; i++) {
        const key = KEY_TABLE[i]![0];
        const got = keyToAction({ key }, blocked[f]!);
        if (got !== null) {
          throw new Error(`focus ${blocked[f]}: row ${i}: key "${key}" expected null, got ${got}`);
        }
      }
    }
  });

  it('ignores a key held with Ctrl, Meta or Alt', () => {
    expect(keyToAction({ key: 'r', ctrlKey: true }, 'none')).toBeNull();
    expect(keyToAction({ key: 'm', metaKey: true }, 'none')).toBeNull();
    expect(keyToAction({ key: 'e', altKey: true }, 'none')).toBeNull();
    expect(keyToAction({ key: 'r', ctrlKey: false, metaKey: false, altKey: false }, 'none')).toBe('reset-position');
  });
});

describe('orbitAngleFromDrag', () => {
  it('follows the table (dragging right lowers the angle by 0.5 degree per pixel)', () => {
    const rows: ReadonlyArray<readonly [number, number, number]> = [
      [30, 0, 30],
      [30, 10, 25],
      [30, -10, 35],
      [0, 720, -360],
      [30, -720, 390],
      [100, 1, 99.5],
      [100, -1, 100.5],
    ];
    for (let i = 0; i < rows.length; i++) {
      const [start, dx, expected] = rows[i]!;
      near('orbitAngleFromDrag', i, orbitAngleFromDrag(start, dx), expected);
    }
  });

  it('throws for a non-finite input and names the value', () => {
    expect(() => orbitAngleFromDrag(NaN, 1)).toThrow(/NaN/);
    expect(() => orbitAngleFromDrag(1, Infinity)).toThrow(/Infinity/);
  });
});

describe('orbitKeyStep', () => {
  it('steps 5 frames (5 degrees): left adds, right subtracts, no wrapping', () => {
    const rows: ReadonlyArray<readonly [number, 'left' | 'right', number]> = [
      [30, 'left', 35],
      [30, 'right', 25],
      [0, 'right', -5],
      [358, 'left', 363],
      [12.5, 'left', 17.5],
    ];
    for (let i = 0; i < rows.length; i++) {
      const [angle, dir, expected] = rows[i]!;
      near('orbitKeyStep', i, orbitKeyStep(angle, dir), expected);
    }
  });

  it('throws for a non-finite angle', () => {
    expect(() => orbitKeyStep(NaN, 'left')).toThrow(/NaN/);
  });
});

describe('zoom steps', () => {
  it('stepZoom follows the table and clamps to 0 to 1', () => {
    const rows: ReadonlyArray<readonly [number, 1 | -1, number, number]> = [
      [0.25, 1, 0.1, 0.35],
      [0.25, -1, 0.1, 0.15],
      [0.95, 1, 0.1, 1],
      [0.05, -1, 0.1, 0],
      [1, 1, 0.1, 1],
      [0, -1, 0.1, 0],
      [0.5, -1, 0.25, 0.25],
    ];
    for (let i = 0; i < rows.length; i++) {
      const [z, dir, step, expected] = rows[i]!;
      near('stepZoom', i, stepZoom(z, dir, step), expected);
    }
  });

  it('zoomKeyStep moves 0.1', () => {
    near('zoomKeyStep', 0, zoomKeyStep(0.25, 1), 0.35);
    near('zoomKeyStep', 1, zoomKeyStep(0.25, -1), 0.15);
    near('zoomKeyStep', 2, zoomKeyStep(0.95, 1), 1);
    near('zoomKeyStep', 3, zoomKeyStep(0.05, -1), 0);
  });

  it('zoomWheelStep moves 0.05 by the sign of deltaY only (up zooms in)', () => {
    const rows: ReadonlyArray<readonly [number, number, number]> = [
      [0.5, -100, 0.55],
      [0.5, -3, 0.55],
      [0.5, 100, 0.45],
      [0.5, 0.5, 0.45],
      [0.5, 0, 0.5],
      [1, -1, 1],
      [0, 1, 0],
      [0.98, -1, 1],
    ];
    for (let i = 0; i < rows.length; i++) {
      const [z, dy, expected] = rows[i]!;
      near('zoomWheelStep', i, zoomWheelStep(z, dy), expected);
    }
  });

  it('throws for a non-finite input', () => {
    expect(() => stepZoom(NaN, 1, 0.1)).toThrow(/NaN/);
    expect(() => stepZoom(0.5, 1, Infinity)).toThrow(/Infinity/);
    expect(() => zoomWheelStep(0.5, NaN)).toThrow(/NaN/);
  });
});

describe('moveKeyStep', () => {
  it('moves 0.02 of the viewport per key (right and down are positive)', () => {
    const rows: ReadonlyArray<readonly [number, number, 'left' | 'right' | 'up' | 'down', number, number, number]> = [
      [0, 0, 'right', 0, 0.02, 0],
      [0, 0, 'left', 0, -0.02, 0],
      [0, 0, 'up', 0, 0, -0.02],
      [0, 0, 'down', 0, 0, 0.02],
      [0.1, -0.1, 'right', 0, 0.12, -0.1],
      [0.1, -0.1, 'down', 0, 0.1, -0.08],
    ];
    for (let i = 0; i < rows.length; i++) {
      const [x, y, dir, e, ex, ey] = rows[i]!;
      const got = moveKeyStep(x, y, dir, e);
      near('moveKeyStep x', i, got.x, ex);
      near('moveKeyStep y', i, got.y, ey);
    }
  });

  it('clamps by the Drag_Range at the Explode_Amount (0.25 at 0, 0.175 at 50, 0.1 at 100)', () => {
    const rows: ReadonlyArray<readonly [number, number, 'left' | 'right' | 'up' | 'down', number, number, number]> = [
      [0.25, 0, 'right', 0, 0.25, 0],
      [0.24, 0, 'right', 0, 0.25, 0],
      [0.17, 0, 'right', 50, 0.175, 0],
      [0.1, 0, 'right', 100, 0.1, 0],
      [0.3, 0, 'left', 100, 0.1, 0],
      [0, -0.1, 'up', 100, 0, -0.1],
      [0, 0.09, 'down', 100, 0, 0.1],
    ];
    for (let i = 0; i < rows.length; i++) {
      const [x, y, dir, e, ex, ey] = rows[i]!;
      const got = moveKeyStep(x, y, dir, e);
      near('moveKeyStep clamp x', i, got.x, ex);
      near('moveKeyStep clamp y', i, got.y, ey);
    }
  });

  it('throws for a non-finite offset', () => {
    expect(() => moveKeyStep(NaN, 0, 'left', 0)).toThrow(/NaN/);
    expect(() => moveKeyStep(0, Infinity, 'left', 0)).toThrow(/Infinity/);
  });
});
