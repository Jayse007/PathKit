import { STORAGE_KEY_PREFIX } from './constants.js';

/** The two Storage methods this module uses. A test passes a mock of this shape. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The browser's localStorage, or null when it does not exist or cannot be reached. */
function browserStorage(): StorageLike | null {
  try {
    const s = (globalThis as { localStorage?: StorageLike }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

/**
 * Read a stored setting. Never throws: any failure (missing storage, getItem
 * throws, missing key, text that is not valid JSON) returns `fallback`.
 * `storage` defaults to the browser's localStorage; passing `null` means "no storage".
 */
export function readSetting<T>(
  key: string,
  fallback: T,
  storage: StorageLike | null = browserStorage(),
): T {
  try {
    if (storage === null) return fallback;
    const text = storage.getItem(STORAGE_KEY_PREFIX + key);
    if (text === null || text === undefined) return fallback;
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/**
 * Store a setting as JSON under the prefixed key. Never throws: any failure
 * (missing storage, setItem throws, value not serialisable) does nothing.
 */
export function writeSetting<T>(
  key: string,
  value: T,
  storage: StorageLike | null = browserStorage(),
): void {
  try {
    if (storage === null) return;
    const text = JSON.stringify(value);
    if (text === undefined) return;
    storage.setItem(STORAGE_KEY_PREFIX + key, text);
  } catch {
    // Storage is optional. Ignore the failure.
  }
}
