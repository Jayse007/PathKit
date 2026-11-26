// Guide geometry and guide on/off state. Pure: no Three.js and no DOM, so Vitest can run it in node.
// The drawing is in src/view/guides-view.ts.

import { readSetting, writeSetting } from './storage.js';
import type { StorageLike } from './storage.js';

/** A rectangle in pixels. The origin is the top-left corner of the frame. */
export interface GuideRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Rule-of-thirds lines. `vertical` holds x positions, `horizontal` holds y positions. */
export interface ThirdsLines {
  readonly vertical: readonly [number, number];
  readonly horizontal: readonly [number, number];
}

/** The storage keys for the two guides (both are in STORAGE_KEYS). */
export type GuideKey = 'thirdsGuideOn' | 'safeAreaGuideOn';

/** Two vertical lines at 1/3 and 2/3 of the width, two horizontal lines at 1/3 and 2/3 of the height. */
export function thirdsLines(width: number, height: number): ThirdsLines {
  return {
    vertical: [width / 3, (2 * width) / 3],
    horizontal: [height / 3, (2 * height) / 3],
  };
}

/** A centred rectangle that is `fraction` of each side of the frame. */
export function safeAreaRect(width: number, height: number, fraction: number): GuideRect {
  const w = width * fraction;
  const h = height * fraction;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

/** Read a guide's stored state. Anything other than a stored `true` gives false. Never throws. */
export function loadGuideState(key: GuideKey, storage?: StorageLike | null): boolean {
  return readSetting<unknown>(key, false, storage) === true;
}

/**
 * Flip a guide and store the new state under `key`. The new state is returned even when
 * storing fails (writeSetting never throws), so the guide still toggles.
 */
export function toggleGuide(current: boolean, key: GuideKey, storage?: StorageLike | null): boolean {
  const next = !current;
  writeSetting(key, next, storage);
  return next;
}
