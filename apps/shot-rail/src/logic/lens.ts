// Lens_Module: field of view for a focal length on the fixed sensor. Pure.

import { SENSOR_HEIGHT_MM, SENSOR_WIDTH_MM } from './constants.js';

export interface FieldOfView {
  horizontalDeg: number;
  verticalDeg: number;
}

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Horizontal fov = 2 atan((SENSOR_WIDTH_MM / 2) / f)   (18 / f)
 * Vertical fov   = 2 atan((SENSOR_HEIGHT_MM / 2) / f)  (10.125 / f)
 * Computed in radians, converted to degrees only in the returned object.
 *
 * Throws an Error naming the value when focalLengthMm is not finite or is 0 or less.
 */
export function fieldOfViewForFocalLengthMm(focalLengthMm: number): FieldOfView {
  if (!Number.isFinite(focalLengthMm) || focalLengthMm <= 0) {
    throw new Error(
      `fieldOfViewForFocalLengthMm: focalLengthMm must be a finite number above 0, got ${String(focalLengthMm)}`,
    );
  }
  const horizontalRad = 2 * Math.atan(SENSOR_WIDTH_MM / 2 / focalLengthMm);
  const verticalRad = 2 * Math.atan(SENSOR_HEIGHT_MM / 2 / focalLengthMm);
  return {
    horizontalDeg: horizontalRad * RAD_TO_DEG,
    verticalDeg: verticalRad * RAD_TO_DEG,
  };
}
