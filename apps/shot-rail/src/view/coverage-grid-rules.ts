// Pure rules for the Coverage_Grid: when to redraw, whether a camera may be added,
// and which camera a click selects. No Three.js, no DOM, no I/O, no clock.

import { MAX_CAMERAS, PLAYBACK_RATE_GRID } from '../logic/constants.js';
import type { ShotType } from '../logic/shot-builders.js';

/** The two app modes. The grid is drawn only in Angle mode. */
export type GridMode = 'angle' | 'move';

/** Milliseconds between grid redraws while the Timeline plays (100 ms at 10 Hz). */
export const GRID_REFRESH_INTERVAL_MS = 1000 / PLAYBACK_RATE_GRID;

/**
 * Decide whether the grid must be redrawn now.
 * - Outside Angle mode: never.
 * - Something changed: yes.
 * - Playing: yes once `msSinceLast` reaches the refresh interval.
 * - Nothing changed and stopped: no.
 */
export function shouldRenderGrid(
  mode: GridMode,
  changed: boolean,
  playing: boolean,
  msSinceLast: number,
): boolean {
  if (mode !== 'angle') return false;
  if (changed) return true;
  if (playing) return msSinceLast >= GRID_REFRESH_INTERVAL_MS;
  return false;
}

export type AddCameraResult =
  | { ok: true; count: number }
  | { ok: false; count: number; message: string };

/** Message shown when a seventh camera is refused. States the limit. */
export const CAMERA_LIMIT_MESSAGE = `At most ${MAX_CAMERAS} cameras are allowed. Remove one before adding another.`;

/**
 * Try to add one camera to a list that holds `count` cameras.
 * Refuses when the list is already at the limit; `count` is then returned unchanged.
 */
export function addCamera(count: number): AddCameraResult {
  if (count >= MAX_CAMERAS) {
    return { ok: false, count, message: CAMERA_LIMIT_MESSAGE };
  }
  return { ok: true, count: count + 1 };
}

/** A click (or Enter) on a tile makes that camera the Main_Camera. */
export function selectMain(id: string): string {
  return id;
}

export interface MainChange<T extends { id: string; shotType: ShotType }> {
  /** A new list of new objects; the input is never changed. */
  cameras: T[];
  /** Ids of the cameras changed to orbit, in list order. */
  converted: string[];
  /** '' when nothing was converted. */
  message: string;
}

/**
 * Plan a change of Main_Camera. Only the Main_Camera can be a rail shot (push-in or crane),
 * so every other camera with one of those shot types becomes an orbit shot. All other
 * fields are kept. The new main camera is never changed. Pure: the input is not mutated.
 */
export function planMainChange<T extends { id: string; shotType: ShotType }>(
  cameras: readonly T[],
  newMainId: string,
): MainChange<T> {
  if (!cameras.some((c) => c.id === newMainId)) {
    throw new Error(`Camera "${newMainId}" is not in the camera list.`);
  }
  const converted: string[] = [];
  const sentences: string[] = [];
  const next = cameras.map((c): T => {
    if (c.id !== newMainId && (c.shotType === 'push-in' || c.shotType === 'crane')) {
      converted.push(c.id);
      sentences.push(`${c.id} changed from ${c.shotType} to orbit.`);
      return { ...c, shotType: 'orbit' };
    }
    return { ...c };
  });
  const message = converted.length === 0 ? '' : `${sentences.join(' ')} Only the main camera can be a rail shot.`;
  return { cameras: next, converted, message };
}
