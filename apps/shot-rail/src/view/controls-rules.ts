// Controls rules (task 37.1): pure functions for the controls panel. No DOM, no Three.js, no I/O, so a test
// may import this file. It turns typed text into checked numbers, builds new RigSettings from old ones
// (never changing the old ones), and writes the key text shown beside each control.
//
// Units: bearing is in degrees here and in CameraSetting (bearingDeg), and the Shot_Builder converts it.
// Nothing in this file converts angles. Time is in whole frames.
//
// Ranges come from constants.ts. Bearing has no range: the design says bearing wraps and any real value is
// valid (sin and cos are periodic), so only "is a finite number" is checked.

import {
  CAMERA_HEIGHT_MAX,
  CAMERA_HEIGHT_MIN,
  CAMERA_IDS,
  CAMERA_RADIUS_MAX,
  CAMERA_RADIUS_MIN,
} from '../logic/constants.js';
import { PRIMARY_KEYS } from '../logic/key-map.js';
import type { KeyAction } from '../logic/key-map.js';
import type { ShotType } from '../logic/shot-builders.js';
import { validateShotLength } from '../logic/shot-length.js';
import type { CameraSetting, RigSettings } from './camera-rig.js';
import { addCamera } from './coverage-grid-rules.js';

// View-only values (not in the design's Named constants table).
export const BEARING_STEP_DEG = 1;
export const HEIGHT_STEP_M = 0.1;
export const DISTANCE_STEP_M = 0.5;
/** Shown beside a number field. Number fields have no key in the key map; the arrow keys step them. */
export const FIELD_KEY_HINT = '(Up/Down)';
/** The Shot_Type that a camera other than the Main_Camera falls back to (Requirement 7.5). */
const FALLBACK_SHOT_TYPE: ShotType = 'orbit';
/** The shot type a newly added camera gets. Only the Main_Camera can be a rail shot. */
const ADDED_CAMERA_SHOT_TYPE: ShotType = 'orbit';

export type PlacementField = 'bearingDeg' | 'heightM' | 'horizontalDistanceM';

export interface FieldSpec {
  readonly field: PlacementField;
  readonly label: string;
  readonly unit: string;
  /** null means no limit on that side. */
  readonly min: number | null;
  readonly max: number | null;
  readonly step: number;
}

export const PLACEMENT_FIELDS: readonly FieldSpec[] = [
  { field: 'bearingDeg', label: 'Bearing', unit: 'degrees', min: null, max: null, step: BEARING_STEP_DEG },
  { field: 'heightM', label: 'Height', unit: 'm', min: CAMERA_HEIGHT_MIN, max: CAMERA_HEIGHT_MAX, step: HEIGHT_STEP_M },
  {
    field: 'horizontalDistanceM',
    label: 'Horizontal distance',
    unit: 'm',
    min: CAMERA_RADIUS_MIN,
    max: CAMERA_RADIUS_MAX,
    step: DISTANCE_STEP_M,
  },
];

export type ValueResult = { ok: true; value: number } | { ok: false; message: string };

/** Typed text to a number. Blank text and text that is not a finite number give NaN. */
export function parseTyped(raw: string): number {
  const trimmed = raw.trim();
  return trimmed === '' ? NaN : Number(trimmed);
}

/** Checks typed text for one placement field. The message says what is wrong and what to type instead. */
export function checkPlacementValue(spec: FieldSpec, raw: string): ValueResult {
  const value = parseTyped(raw);
  const hasRange = spec.min !== null && spec.max !== null;
  const rangeText = hasRange ? ` from ${spec.min} to ${spec.max} ${spec.unit}` : ` in ${spec.unit}`;
  if (!Number.isFinite(value)) {
    return { ok: false, message: `${spec.label} must be a number${rangeText}, got "${raw}".` };
  }
  if (hasRange && (value < (spec.min as number) || value > (spec.max as number))) {
    return { ok: false, message: `${spec.label} must be a number${rangeText}, got ${value}.` };
  }
  return { ok: true, value };
}

/** Checks typed text for the Shot_Length with the logic module's own rule and message (60 to 600 frames). */
export function checkShotLengthText(raw: string): ValueResult {
  const result = validateShotLength(parseTyped(raw));
  return result.ok ? { ok: true, value: result.value } : { ok: false, message: result.message };
}

export type ChangeResult =
  | { ok: true; settings: RigSettings; message: string }
  | { ok: false; message: string };

function cameraIndex(settings: RigSettings, id: string): number {
  const index = settings.cameras.findIndex((c) => c.id === id);
  if (index < 0) throw new Error(`Camera "${id}" is not in the camera list.`);
  return index;
}

function withPlacement(c: CameraSetting, field: PlacementField, value: number): CameraSetting {
  switch (field) {
    case 'bearingDeg':
      return { ...c, bearingDeg: value };
    case 'heightM':
      return { ...c, heightM: value };
    case 'horizontalDistanceM':
      return { ...c, horizontalDistanceM: value };
  }
}

/** New settings with one placement value of one camera changed. The input is not changed. */
export function withPlacementValue(
  settings: RigSettings,
  cameraId: string,
  field: PlacementField,
  value: number,
): RigSettings {
  cameraIndex(settings, cameraId);
  return {
    ...settings,
    cameras: settings.cameras.map((c) => (c.id === cameraId ? withPlacement(c, field, value) : { ...c })),
  };
}

/**
 * New settings with one camera's Shot_Type changed. Only the Main_Camera can be a rail shot (push-in or
 * crane): for any other camera those two become orbit and the message says so (Requirement 7.5).
 * The message is '' when nothing was converted.
 */
export function withShotType(settings: RigSettings, cameraId: string, shotType: ShotType): { settings: RigSettings; message: string } {
  cameraIndex(settings, cameraId);
  const isRail = shotType === 'push-in' || shotType === 'crane';
  const converted = isRail && cameraId !== settings.mainCameraId;
  const applied: ShotType = converted ? FALLBACK_SHOT_TYPE : shotType;
  const message = converted ? `${cameraId} changed from ${shotType} to ${applied}. Only the main camera can be a rail shot.` : '';
  const change = (c: CameraSetting): CameraSetting => {
    // A non-main camera asked for a rail shot: it becomes orbit and remembers the requested type.
    if (converted) return { ...c, shotType: applied, railShotWhenMain: shotType as 'push-in' | 'crane' };
    // The Main_Camera set to push-in or crane: the remembered rail shot is left as it is.
    if (isRail) return { ...c, shotType: applied };
    // Orbit or tracking on any camera: forget the remembered rail shot (no key left).
    const { railShotWhenMain: _forgotten, ...rest } = c;
    return { ...rest, shotType: applied };
  };
  return {
    settings: {
      ...settings,
      cameras: settings.cameras.map((c) => (c.id === cameraId ? change(c) : { ...c })),
    },
    message,
  };
}

/** New settings with a different Shot_Length (the caller checks it first with checkShotLengthText). */
export function withShotLength(settings: RigSettings, frames: number): RigSettings {
  return { ...settings, shotLengthFrames: frames, cameras: settings.cameras.map((c) => ({ ...c })) };
}

/**
 * Adds one camera: the first unused id from CAMERA_IDS, copying the Main_Camera's placement and lens,
 * as an orbit shot. Refuses a seventh camera with CAMERA_LIMIT_MESSAGE (through addCamera).
 */
export function withAddedCamera(settings: RigSettings): ChangeResult {
  const room = addCamera(settings.cameras.length);
  if (!room.ok) return { ok: false, message: room.message };
  const used = new Set(settings.cameras.map((c) => c.id));
  const id = CAMERA_IDS.find((candidate) => !used.has(candidate));
  if (id === undefined) return { ok: false, message: 'No free camera id is left. Remove a camera first.' };
  const main = settings.cameras[cameraIndex(settings, settings.mainCameraId)];
  const { railShotWhenMain: _notCopied, ...mainCopy } = main;
  const added: CameraSetting = { ...mainCopy, id, shotType: ADDED_CAMERA_SHOT_TYPE };
  return {
    ok: true,
    settings: { ...settings, cameras: [...settings.cameras.map((c) => ({ ...c })), added] },
    message: `Added ${id} as an orbit camera, copied from ${main.id}. Select it to change its settings.`,
  };
}

/** Removes one camera. The Main_Camera cannot be removed: select another camera first. */
export function withRemovedCamera(settings: RigSettings, cameraId: string): ChangeResult {
  cameraIndex(settings, cameraId);
  if (cameraId === settings.mainCameraId) {
    return { ok: false, message: `${cameraId} is the main camera. Select another camera first, then remove ${cameraId}.` };
  }
  return {
    ok: true,
    settings: { ...settings, cameras: settings.cameras.filter((c) => c.id !== cameraId).map((c) => ({ ...c })) },
    message: `Removed ${cameraId}.`,
  };
}

/** The text of one key as shown to the User: ' ' is "Space", a letter is upper case, named keys stay as they are. */
export function keyText(key: string): string {
  if (key === ' ') return 'Space';
  return key.length === 1 ? key.toUpperCase() : key;
}

/** "(M)" for the primary key of an action; several actions give "(+ / -)". '' when an action has no key. */
export function keyHint(...actions: KeyAction[]): string {
  const texts: string[] = [];
  for (const action of actions) {
    const row = PRIMARY_KEYS.find((r) => r.action === action);
    if (row !== undefined) texts.push(keyText(row.key));
  }
  return texts.length === 0 ? '' : `(${texts.join(' / ')})`;
}

/** The select-slot action for the camera in list position `index` (0 to 5). */
export function slotAction(index: number): KeyAction {
  switch (index) {
    case 0:
      return 'select-slot-1';
    case 1:
      return 'select-slot-2';
    case 2:
      return 'select-slot-3';
    case 3:
      return 'select-slot-4';
    case 4:
      return 'select-slot-5';
    default:
      return 'select-slot-6';
  }
}
