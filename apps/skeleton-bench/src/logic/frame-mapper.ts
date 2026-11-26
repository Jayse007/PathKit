/**
 * Frame_Mapper. Pure: no state. The angle half has no zoom input; the zoom half has no angle input.
 * Frames are whole numbers 0 to 359 (one frame per degree).
 */

import { LAP_COUNT, LAP_DISTANCES } from '../constants.js';

/** Round half up: floor(x + 0.5). Shared with Explode_Easing. */
export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

/** Map an orbit angle in degrees to a whole frame 0 to 359. */
export function angleToFrame(angleDeg: number): number {
  if (!Number.isFinite(angleDeg)) {
    throw new Error(`angleToFrame: angle must be a finite number, got ${String(angleDeg)}`);
  }
  const wrapped = ((angleDeg % 360) + 360) % 360;
  return Math.floor(wrapped + 0.5) % 360;
}

/** Which two baked laps to blend for a zoom value, and the weight on the upper lap. */
export interface ZoomSelection {
  readonly lowerLap: number;
  readonly upperLap: number;
  readonly weight: number;
}

function clampZoom(zoom: number, fn: string): number {
  if (!Number.isFinite(zoom)) {
    throw new Error(`${fn}: zoom must be a finite number, got ${String(zoom)}`);
  }
  return Math.min(1, Math.max(0, zoom));
}

/** Pick the lower lap, upper lap and blend weight for a zoom value. Pure; no angle input. */
export function zoomSelection(zoom: number): ZoomSelection {
  const z = clampZoom(zoom, 'zoomSelection');
  const p = z * (LAP_COUNT - 1);
  const lowerLap = Math.min(Math.floor(p), LAP_COUNT - 2);
  return { lowerLap, upperLap: lowerLap + 1, weight: p - lowerLap };
}

/** Camera distance in metres for a zoom value: 6.5 at Z = 0 down to 2.6 at Z = 1. */
export function zoomDistance(zoom: number): number {
  const z = clampZoom(zoom, 'zoomDistance');
  const far = LAP_DISTANCES[0] as number;
  const near = LAP_DISTANCES[LAP_COUNT - 1] as number;
  return far - (far - near) * z;
}
