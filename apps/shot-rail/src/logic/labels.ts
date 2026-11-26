// Label_Module: pure angle and framing labels. Thresholds come from constants.ts.

import {
  ANGLE_LOW_MAX_DEG,
  ANGLE_HIGH_MIN_DEG,
  ANGLE_OVERHEAD_MIN_DEG,
  FILL_WIDE_MAX_PERCENT,
  FILL_CLOSEUP_MIN_PERCENT,
} from './constants.js';

export type AngleLabel = 'low angle' | 'eye level' | 'high angle' | 'overhead';
export type FramingLabel = 'close-up' | 'medium' | 'wide';

// Elevation in degrees. Overhead is checked first so it takes precedence over high angle.
// Below -10 is low angle; -10 to 10 inclusive is eye level; above 10 up to 60 inclusive
// is high angle; above 60 is overhead.
export function angleLabel(elevationDeg: number): AngleLabel {
  if (elevationDeg > ANGLE_OVERHEAD_MIN_DEG) return 'overhead';
  if (elevationDeg > ANGLE_HIGH_MIN_DEG) return 'high angle';
  if (elevationDeg >= ANGLE_LOW_MAX_DEG) return 'eye level';
  return 'low angle';
}

// Fill in percent, 0 to 100. Below 35 is wide; 35 to 70 inclusive is medium; above 70 is close-up.
export function framingLabel(fillFractionPercent: number): FramingLabel {
  if (!Number.isFinite(fillFractionPercent) || fillFractionPercent < 0 || fillFractionPercent > 100) {
    throw new Error(
      `framingLabel: fill fraction must be a finite number from 0 to 100, got ${fillFractionPercent}`,
    );
  }
  if (fillFractionPercent > FILL_CLOSEUP_MIN_PERCENT) return 'close-up';
  if (fillFractionPercent >= FILL_WIDE_MAX_PERCENT) return 'medium';
  return 'wide';
}
