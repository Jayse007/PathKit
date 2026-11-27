/**
 * Press-to-release tracking for the click rule (Requirement 14.6). Pure bookkeeping: no DOM, no clock.
 * It keeps the largest distance from the press position, so a gesture that went out to 6 px and came
 * back to 2 px is still a drag. The caller passes the result to classifyPointer through `release`.
 * One tracker is created at setup and reused; its methods allocate nothing.
 */

import { classifyPointer } from './pointer.js';
import type { PointerKind } from './pointer.js';

export interface ClickTracker {
  /** Start a gesture at a pointer position (CSS pixels). */
  press(x: number, y: number): void;
  /** Report a pointer position during the gesture. Ignored when no gesture is active. */
  move(x: number, y: number): void;
  /** End the gesture. Returns its kind, or null when no gesture was active. */
  release(x: number, y: number): PointerKind | null;
  /** Drop the gesture (for example on pointercancel). */
  cancel(): void;
  /** True between press and release or cancel. */
  readonly active: boolean;
}

export function createClickTracker(): ClickTracker {
  let active = false;
  let startX = 0;
  let startY = 0;
  let maxDistance = 0;

  function note(x: number, y: number): void {
    const d = Math.hypot(x - startX, y - startY);
    if (d > maxDistance) maxDistance = d;
  }

  return {
    press(x: number, y: number): void {
      active = true;
      startX = x;
      startY = y;
      maxDistance = 0;
    },
    move(x: number, y: number): void {
      if (active) note(x, y);
    },
    release(x: number, y: number): PointerKind | null {
      if (!active) return null;
      note(x, y);
      active = false;
      return classifyPointer(maxDistance);
    },
    cancel(): void {
      active = false;
    },
    get active(): boolean {
      return active;
    },
  };
}
