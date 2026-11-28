// Pure lens zoom steps. No DOM, no clock, no mutation.

import {
  LENS_PRESETS_MM,
  LENS_WHEEL_STEP_RATIO,
  LENS_ZOOM_MAX_MM,
  LENS_ZOOM_MIN_MM,
} from './constants.js';

function clampLens(mm: number): number {
  return Math.min(LENS_ZOOM_MAX_MM, Math.max(LENS_ZOOM_MIN_MM, mm));
}

function checkCurrent(currentMm: number): void {
  if (!Number.isFinite(currentMm) || currentMm <= 0) {
    throw new Error(`Lens must be a finite number above 0 mm, got ${currentMm}`);
  }
}

// currentMm * ratio^direction, clamped to the zoom range.
export function stepLens(currentMm: number, direction: 1 | -1, ratio: number): number {
  checkCurrent(currentMm);
  if (!Number.isFinite(ratio) || ratio <= 1) {
    throw new Error(`Lens step ratio must be a finite number above 1, got ${ratio}`);
  }
  const next = direction === 1 ? currentMm * ratio : currentMm / ratio;
  return clampLens(next);
}

// Wheel up (deltaY below 0) zooms in, wheel down zooms out, 0 only clamps.
export function lensAfterWheel(currentMm: number, deltaY: number): number {
  checkCurrent(currentMm);
  if (!Number.isFinite(deltaY)) {
    throw new Error(`Wheel deltaY must be a finite number, got ${deltaY}`);
  }
  if (deltaY < 0) return stepLens(currentMm, 1, LENS_WHEEL_STEP_RATIO);
  if (deltaY > 0) return stepLens(currentMm, -1, LENS_WHEEL_STEP_RATIO);
  return clampLens(currentMm);
}

// The preset equal to lensMm exactly, else null.
export function presetOf(lensMm: number): number | null {
  for (const preset of LENS_PRESETS_MM) {
    if (preset === lensMm) return preset;
  }
  return null;
}
