/**
 * App state: one plain object changed by small pure update functions.
 * Each function returns a new state and never changes its input. A rejected
 * change returns the same state object, so callers can test `next === prev`.
 * Mouse, keyboard and (Tier B) gestures all call these same functions.
 */

import { INITIAL_EXPLODE, INITIAL_ORBIT_ANGLE_DEG, INITIAL_ZOOM } from './constants.js';
import type { MachineId } from './data/catalogue-types.js';
import { clampOffset } from './logic/drag-range.js';
import { DEFAULT_LOOK } from './ui/storage.js';
import type { Look } from './ui/storage.js';

export type Mode = 'rotate' | 'move';
export type TourStatus = 'idle' | 'playing' | 'paused';

export interface TourState {
  readonly status: TourStatus;
  /** Orbit angle saved at Tour start (degrees). Meaningful only while not idle. */
  readonly savedAngleDeg: number;
  /** Zoom_Value saved at Tour start. Meaningful only while not idle. */
  readonly savedZoom: number;
}

export interface AppState {
  readonly machine: MachineId;
  readonly orbitAngleDeg: number;
  readonly zoom: number; // 0 to 1
  readonly explode: number; // 0 to 100 (percent)
  readonly offsetX: number; // fraction of viewport width, positive is right
  readonly offsetY: number; // fraction of viewport height, positive is down
  readonly mode: Mode;
  readonly selectedPart: string | null;
  readonly look: Look;
  readonly tour: TourState;
}

function requireFinite(value: number, fn: string, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${fn}: ${name} must be a finite number, got ${String(value)}`);
  }
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/** True while the Tour plays. The orbit, zoom, explode and move setters are rejected then. */
export function isTourPlaying(state: AppState): boolean {
  return state.tour.status === 'playing';
}

/** The initial state. The Look is the stored value (from loadLook) or the default. */
export function createInitialState(look: Look = DEFAULT_LOOK): AppState {
  return {
    machine: 'pump',
    orbitAngleDeg: INITIAL_ORBIT_ANGLE_DEG,
    zoom: INITIAL_ZOOM,
    explode: INITIAL_EXPLODE,
    offsetX: 0,
    offsetY: 0,
    mode: 'rotate',
    selectedPart: null,
    look,
    tour: { status: 'idle', savedAngleDeg: INITIAL_ORBIT_ANGLE_DEG, savedZoom: INITIAL_ZOOM },
  };
}

/** Switch Machine: explode 0, offset (0, 0), no selection. Orbit angle and zoom are kept. */
export function setMachine(state: AppState, machine: MachineId): AppState {
  return { ...state, machine, explode: 0, offsetX: 0, offsetY: 0, selectedPart: null };
}

/** Set the orbit angle in degrees (any finite value; the frame mapper wraps it). Rejected while the Tour plays. */
export function setOrbitAngle(state: AppState, angleDeg: number): AppState {
  requireFinite(angleDeg, 'setOrbitAngle', 'angle');
  if (isTourPlaying(state)) return state;
  return { ...state, orbitAngleDeg: angleDeg };
}

/** Set Zoom_Value, clamped to 0 to 1. Rejected while the Tour plays. */
export function setZoom(state: AppState, zoom: number): AppState {
  requireFinite(zoom, 'setZoom', 'zoom');
  if (isTourPlaying(state)) return state;
  return { ...state, zoom: clamp(zoom, 0, 1) };
}

/** Set Explode_Amount, clamped to 0 to 100, and re-clamp the offset to the new Drag_Range. Rejected while the Tour plays. */
export function setExplode(state: AppState, explode: number): AppState {
  requireFinite(explode, 'setExplode', 'explode amount');
  if (isTourPlaying(state)) return state;
  const e = clamp(explode, 0, 100);
  const o = clampOffset(state.offsetX, state.offsetY, e);
  return { ...state, explode: e, offsetX: o.x, offsetY: o.y };
}

/** Set the offset (fractions), clamped by Drag_Range at the current Explode_Amount. Rejected while the Tour plays. */
export function setOffset(state: AppState, fx: number, fy: number): AppState {
  requireFinite(fx, 'setOffset', 'offset x');
  requireFinite(fy, 'setOffset', 'offset y');
  if (isTourPlaying(state)) return state;
  const o = clampOffset(fx, fy, state.explode);
  return { ...state, offsetX: o.x, offsetY: o.y };
}

/** Toggle between Rotate and Move. */
export function toggleMode(state: AppState): AppState {
  return { ...state, mode: state.mode === 'rotate' ? 'move' : 'rotate' };
}

/** Select a Part by id, or null for none. */
export function selectPart(state: AppState, partId: string | null): AppState {
  return { ...state, selectedPart: partId };
}

/** Set the Look. */
export function setLook(state: AppState, look: Look): AppState {
  return { ...state, look };
}

/**
 * Start the Tour from idle: explode and offset go to 0, and the current angle
 * and zoom are saved. Any other status is unchanged (resume uses resumeTour).
 */
export function startTour(state: AppState): AppState {
  if (state.tour.status !== 'idle') return state;
  return {
    ...state,
    explode: 0,
    offsetX: 0,
    offsetY: 0,
    tour: { status: 'playing', savedAngleDeg: state.orbitAngleDeg, savedZoom: state.zoom },
  };
}

/** Pause a playing Tour. The saved angle and zoom are kept. */
export function pauseTour(state: AppState): AppState {
  if (state.tour.status !== 'playing') return state;
  return { ...state, tour: { ...state.tour, status: 'paused' } };
}

/** Resume a paused Tour. Nothing is saved again. */
export function resumeTour(state: AppState): AppState {
  if (state.tour.status !== 'paused') return state;
  return { ...state, tour: { ...state.tour, status: 'playing' } };
}

/** Stop the Tour (also used when it ends): restore the saved angle and zoom, go idle. Idle is unchanged. */
export function stopTour(state: AppState): AppState {
  if (state.tour.status === 'idle') return state;
  return {
    ...state,
    orbitAngleDeg: state.tour.savedAngleDeg,
    zoom: state.tour.savedZoom,
    tour: { ...state.tour, status: 'idle' },
  };
}
