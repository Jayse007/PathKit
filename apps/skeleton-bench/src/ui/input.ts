/**
 * Pure UI input helpers: the key map and the step functions. No state, no DOM.
 * App code, not PathKit. The caller reads the event fields and passes them in.
 * Orbit angles are degrees; one frame is one degree (ORBIT_LAP_FRAMES = 360).
 */

import {
  MOVE_KEY_STEP_FRACTION,
  ORBIT_DEG_PER_PIXEL,
  ORBIT_KEY_STEP_FRAMES,
  ORBIT_LAP_FRAMES,
  ZOOM_KEY_STEP,
  ZOOM_WHEEL_STEP,
} from '../constants.js';
import { clampOffset } from '../logic/drag-range.js';
import type { Offset } from '../logic/drag-range.js';
import { shouldHandleShortcut } from '../logic/shortcut-guard.js';
import type { ActiveElementKind } from '../logic/shortcut-guard.js';

export type ArrowDirection = 'left' | 'right' | 'up' | 'down';

export type KeyAction =
  | 'toggle-mode' // M
  | 'toggle-explode' // E
  | 'reset-position' // R
  | 'zoom-in' // + or =
  | 'zoom-out' // -
  | 'arrow-left'
  | 'arrow-right'
  | 'arrow-up'
  | 'arrow-down'
  | 'clear-selection'; // Escape

/** The fields of a keyboard event that the key map reads. */
export interface KeyInput {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
}

/**
 * Map a key press to an action, or null.
 * Null when focus is in a text field, select or range slider (Requirement 12.9),
 * when Ctrl, Meta or Alt is held (so browser shortcuts such as Ctrl+R still work),
 * or when the key has no action. Letters match in either case. `=` counts as `+`
 * because most keyboards need Shift for `+`.
 */
export function keyToAction(input: KeyInput, focus: ActiveElementKind): KeyAction | null {
  if (!shouldHandleShortcut(focus)) return null;
  if (input.ctrlKey === true || input.metaKey === true || input.altKey === true) return null;
  switch (input.key) {
    case 'm':
    case 'M':
      return 'toggle-mode';
    case 'e':
    case 'E':
      return 'toggle-explode';
    case 'r':
    case 'R':
      return 'reset-position';
    case '+':
    case '=':
      return 'zoom-in';
    case '-':
      return 'zoom-out';
    case 'ArrowLeft':
      return 'arrow-left';
    case 'ArrowRight':
      return 'arrow-right';
    case 'ArrowUp':
      return 'arrow-up';
    case 'ArrowDown':
      return 'arrow-down';
    case 'Escape':
      return 'clear-selection';
    default:
      return null;
  }
}

function requireFinite(value: number, fn: string, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${fn}: ${name} must be a finite number, got ${String(value)}`);
  }
}

/**
 * Orbit angle in degrees from a drag. Dragging right (positive dx) makes the angle
 * decrease, so the Machine seems to turn with the pointer.
 */
export function orbitAngleFromDrag(startAngleDeg: number, dxPx: number): number {
  requireFinite(startAngleDeg, 'orbitAngleFromDrag', 'start angle');
  requireFinite(dxPx, 'orbitAngleFromDrag', 'drag distance');
  return startAngleDeg - dxPx * ORBIT_DEG_PER_PIXEL;
}

/**
 * Orbit angle after an arrow key in Rotate mode: ORBIT_KEY_STEP_FRAMES frames.
 * Left adds, right subtracts, so the key matches a drag in the same direction.
 * The result is not wrapped (the Frame_Mapper wraps).
 */
export function orbitKeyStep(angleDeg: number, direction: 'left' | 'right'): number {
  requireFinite(angleDeg, 'orbitKeyStep', 'angle');
  const stepDeg = (ORBIT_KEY_STEP_FRAMES * 360) / ORBIT_LAP_FRAMES;
  return direction === 'left' ? angleDeg + stepDeg : angleDeg - stepDeg;
}

/**
 * What the Escape key does (Requirement 24.11): with the About_Panel open it closes the panel
 * and leaves the selection alone; otherwise it clears the selection (Requirement 14).
 */
export function escapeAction(aboutOpen: boolean): 'close-about' | 'clear-selection' {
  return aboutOpen ? 'close-about' : 'clear-selection';
}

/** Zoom_Value after a step in direction +1 (closer) or -1 (further), clamped to 0 to 1. */
export function stepZoom(zoom: number, direction: 1 | -1, step: number): number {
  requireFinite(zoom, 'stepZoom', 'zoom');
  requireFinite(step, 'stepZoom', 'step');
  return Math.min(1, Math.max(0, zoom + direction * step));
}

/** Zoom_Value after the `+` or `-` key (ZOOM_KEY_STEP). */
export function zoomKeyStep(zoom: number, direction: 1 | -1): number {
  return stepZoom(zoom, direction, ZOOM_KEY_STEP);
}

/**
 * Zoom_Value after a wheel event (ZOOM_WHEEL_STEP, sign of deltaY).
 * Scrolling up (negative deltaY) zooms in; scrolling down zooms out; 0 changes nothing.
 */
export function zoomWheelStep(zoom: number, deltaY: number): number {
  requireFinite(zoom, 'zoomWheelStep', 'zoom');
  requireFinite(deltaY, 'zoomWheelStep', 'deltaY');
  if (deltaY === 0) return Math.min(1, Math.max(0, zoom));
  return stepZoom(zoom, deltaY < 0 ? 1 : -1, ZOOM_WHEEL_STEP);
}

/**
 * Offset after an arrow key in Move mode: MOVE_KEY_STEP_FRACTION of the viewport,
 * clamped by the Drag_Range at the given Explode_Amount. Positive x is right, positive y is down.
 */
export function moveKeyStep(
  offsetX: number,
  offsetY: number,
  direction: ArrowDirection,
  explodePercent: number,
): Offset {
  requireFinite(offsetX, 'moveKeyStep', 'offset x');
  requireFinite(offsetY, 'moveKeyStep', 'offset y');
  let x = offsetX;
  let y = offsetY;
  switch (direction) {
    case 'left':
      x -= MOVE_KEY_STEP_FRACTION;
      break;
    case 'right':
      x += MOVE_KEY_STEP_FRACTION;
      break;
    case 'up':
      y -= MOVE_KEY_STEP_FRACTION;
      break;
    case 'down':
      y += MOVE_KEY_STEP_FRACTION;
      break;
    default:
      throw new Error(`moveKeyStep: unknown direction ${String(direction)}`);
  }
  return clampOffset(x, y, explodePercent);
}
