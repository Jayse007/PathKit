/**
 * Storage helpers. Every read and write is inside try/catch, so a missing,
 * blocked or full localStorage never throws and the app falls back to defaults.
 * Keys carry the `skeletonBench.` prefix (set in constants.ts) because
 * localStorage is per origin and Shot Rail shares the origin.
 */

import { STORAGE_KEY_HINT_PREFIX, STORAGE_KEY_LOOK } from '../constants.js';

/** The part of the Storage interface the helpers use. A fake with these two methods works in tests. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type Look = 'X_Ray_Skeleton' | 'Clean_Engineering';

export const DEFAULT_LOOK: Look = 'X_Ray_Skeleton';

/** The browser's localStorage, or null if it is missing or access throws. */
function defaultStorage(): StorageLike | null {
  try {
    const s = (globalThis as { localStorage?: StorageLike }).localStorage;
    return s === undefined || s === null ? null : s;
  } catch {
    return null;
  }
}

/** Returns the stored string, or null if missing or on any failure. */
export function readStored(key: string, storage?: StorageLike | null): string | null {
  try {
    const s = storage === undefined ? defaultStorage() : storage;
    if (s === null) return null;
    const value = s.getItem(key);
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

/** Returns true if the value was written, false on any failure. */
export function writeStored(key: string, value: string, storage?: StorageLike | null): boolean {
  try {
    const s = storage === undefined ? defaultStorage() : storage;
    if (s === null) return false;
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** The stored Look, or DEFAULT_LOOK if missing, invalid or storage fails. */
export function loadLook(storage?: StorageLike | null): Look {
  const value = readStored(STORAGE_KEY_LOOK, storage);
  return value === 'X_Ray_Skeleton' || value === 'Clean_Engineering' ? value : DEFAULT_LOOK;
}

export function saveLook(look: Look, storage?: StorageLike | null): boolean {
  return writeStored(STORAGE_KEY_LOOK, look, storage);
}

/** True only if the hint flag was stored as "1". Any failure counts as not seen. */
export function hasSeenHint(hintId: string, storage?: StorageLike | null): boolean {
  return readStored(STORAGE_KEY_HINT_PREFIX + hintId, storage) === '1';
}

export function markHintSeen(hintId: string, storage?: StorageLike | null): boolean {
  return writeStored(STORAGE_KEY_HINT_PREFIX + hintId, '1', storage);
}
