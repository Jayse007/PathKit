/**
 * Click classification. Pure: no state. App code, not PathKit.
 * The caller tracks the largest distance from the press position and passes it here.
 * Because the input is the largest distance seen so far, a gesture that went out to 6 px
 * and came back to 2 px is still a drag.
 */

import { CLICK_THRESHOLD_PX } from '../constants.js';

export type PointerKind = 'click' | 'drag';

/** Click if the largest distance never exceeded CLICK_THRESHOLD_PX (5 px is a click), otherwise drag. */
export function classifyPointer(maxDistancePx: number): PointerKind {
  if (!Number.isFinite(maxDistancePx) || maxDistancePx < 0) {
    throw new Error(
      `classifyPointer: distance must be a finite number of 0 or more, got ${String(maxDistancePx)}`,
    );
  }
  return maxDistancePx <= CLICK_THRESHOLD_PX ? 'click' : 'drag';
}
