// Readout rules (task 38.1): pure data and formatting for the Readout. No DOM, no Three.js, no clock,
// so a test may import it. Every explanation, cut-off text and "commonly said" note comes from
// ../logic/term-text.ts. The only wording written here is the plain row labels, the two small prefixes
// ("Cut-off", "Source") and the units, listed below.

import { MEASURE_TERMS } from '../logic/term-text.js';
import type { TermLine } from '../logic/term-text.js';

// Decimal places shown at the UI (values are kept at full precision inside).
export const ELEVATION_DECIMALS = 1; // degrees
export const FILL_DECIMALS = 0; // percent
export const FIELD_OF_VIEW_DECIMALS = 1; // degrees
export const DISTANCE_DECIMALS = 1; // metres

// Plain labels. These rows have no term line of their own for the label, so the label is plain.
export const READOUT_LABELS = {
  angle: 'Angle',
  elevation: 'Elevation',
  framing: 'Framing',
  fill: 'Fill',
  horizontalFieldOfView: 'Horizontal field of view',
  verticalFieldOfView: 'Vertical field of view',
  horizontalDistance: 'Horizontal distance',
  straightLineDistance: 'Straight-line distance',
} as const;

export const CUTOFF_PREFIX = 'Cut-off: ';
export const SOURCE_PREFIX = 'Source: ';
const DEGREE_UNIT = '°';
const PERCENT_UNIT = '%';
const METRE_UNIT = ' m';
const SOURCE_SEPARATOR = ', ';

/**
 * The hover and focus line for the field of view rows: the term line, then the formula line.
 * Both come from term-text.ts; they are only joined here.
 */
export const FIELD_OF_VIEW_TITLE = `${MEASURE_TERMS.fieldOfView.text} ${MEASURE_TERMS.fieldOfViewFormula.text}`;

/** `value` rounded to `decimals`, as a whole number (value x 10^decimals). Compare keys to see if the shown text changes. */
export function valueKey(value: number, decimals: number): number {
  return Math.round(value * Math.pow(10, decimals));
}

/** Text of a key made by valueKey, with `decimals` places and no sign on zero ("0.0", never "-0.0"). */
export function keyText(key: number, decimals: number): string {
  return (key / Math.pow(10, decimals)).toFixed(decimals);
}

export function degreesText(key: number, decimals: number): string {
  return `${keyText(key, decimals)}${DEGREE_UNIT}`;
}

export function percentText(key: number, decimals: number): string {
  return `${keyText(key, decimals)}${PERCENT_UNIT}`;
}

export function metresText(key: number, decimals: number): string {
  return `${keyText(key, decimals)}${METRE_UNIT}`;
}

/** "Cut-off: <text>", where text is angleCutoffText or framingCutoffText. */
export function cutoffLine(cutoff: string): string {
  return `${CUTOFF_PREFIX}${cutoff}`;
}

/** "Source: id, id" for a note. The ids are rows of docs/sources.md. */
export function sourceLine(line: TermLine): string {
  return `${SOURCE_PREFIX}${line.sourceIds.join(SOURCE_SEPARATOR)}`;
}
