import { describe, expect, it } from 'vitest';
import {
  ANGLE_HINT_TEXT,
  HINT_DISMISS_LABEL,
  MOVE_HINT_TEXT,
  hintStorageKey,
  hintTextForMode,
  hintToShow,
} from '../../src/view/hints-rules.js';
import { readSetting, writeSetting } from '../../src/logic/storage.js';
import type { StorageLike } from '../../src/logic/storage.js';
import type { GridMode } from '../../src/view/coverage-grid-rules.js';

// All expected values are hand-written literals. Nothing is imported from constants.ts.
const ANGLE_TEXT =
  'Angle mode: add up to six cameras and compare their views. Click a view to make it the main camera.';
const MOVE_TEXT =
  'Move mode: choose how the main camera moves, by shot type and shot length. Camera views are shown in Angle mode (key A).';

/** A working in-memory mock. `data` exposes the raw keys and text. */
function makeMock(): { storage: StorageLike; data: Map<string, string> } {
  const data = new Map<string, string>();
  const storage: StorageLike = {
    getItem(key: string): string | null {
      const v = data.get(key);
      return v === undefined ? null : v;
    },
    setItem(key: string, value: string): void {
      data.set(key, value);
    },
  };
  return { storage, data };
}

const throwingStorage: StorageLike = {
  getItem(): string | null {
    throw new Error('getItem blocked');
  },
  setItem(): void {
    throw new Error('quota exceeded');
  },
};

describe('hints-rules (pure; the DOM file hints.ts is not imported)', () => {
  // Catches: swapping the two branches of hintToShow, checking the wrong seen flag
  // (e.g. `seenMove ? null : 'angle'`), or returning the other mode.
  it.each<[GridMode, boolean, boolean, GridMode | null]>([
    ['angle', false, false, 'angle'],
    ['angle', true, false, null],
    ['angle', false, true, 'angle'],
    ['angle', true, true, null],
    ['move', false, false, 'move'],
    ['move', true, false, 'move'],
    ['move', false, true, null],
    ['move', true, true, null],
  ])('hintToShow(%s, seenAngle=%s, seenMove=%s) is %s', (mode, seenAngle, seenMove, expected) => {
    expect(hintToShow(mode, seenAngle, seenMove)).toBe(expected);
  });

  // Catches: any edit to the approved wording or the button label.
  it('keeps the approved texts exactly', () => {
    expect(ANGLE_HINT_TEXT).toBe(ANGLE_TEXT);
    expect(MOVE_HINT_TEXT).toBe(MOVE_TEXT);
    expect(HINT_DISMISS_LABEL).toBe('Got it');
  });

  // Catches: hintTextForMode returning the other mode's hint (swapped ternary branches).
  it.each<[GridMode, string]>([
    ['angle', ANGLE_TEXT],
    ['move', MOVE_TEXT],
  ])('hintTextForMode(%s) gives that mode\'s text', (mode, expected) => {
    expect(hintTextForMode(mode)).toBe(expected);
  });

  // Catches: swapping the two keys (STORAGE_KEYS[0] and [1]) or writing the flag under another key.
  it.each<[GridMode, string]>([
    ['angle', 'hintSeenAngle'],
    ['move', 'hintSeenMove'],
  ])('hintStorageKey(%s) is %s', (mode, expected) => {
    expect(hintStorageKey(mode)).toBe(expected);
  });

  // Catches: never storing the flag, storing the wrong text, or dropping the 'shot-rail:' prefix.
  it.each<[GridMode, string]>([
    ['angle', 'shot-rail:hintSeenAngle'],
    ['move', 'shot-rail:hintSeenMove'],
  ])('writing true for %s stores the text true under %s and reads back true', (mode, storedKey) => {
    const { storage, data } = makeMock();
    writeSetting(hintStorageKey(mode), true, storage);
    expect(data.size).toBe(1);
    expect(data.get(storedKey)).toBe('true');
    expect(readSetting(hintStorageKey(mode), false, storage)).toBe(true);
  });

  // Catches: a fallback of true (a hint that never shows on a first visit).
  it('reads a missing value as not seen', () => {
    const { storage } = makeMock();
    expect(readSetting(hintStorageKey('angle'), false, storage)).toBe(false);
    expect(readSetting(hintStorageKey('move'), false, storage)).toBe(false);
  });

  // Catches: a parse failure that escapes or returns something other than the fallback.
  it('reads text that is not valid JSON as not seen', () => {
    const { storage, data } = makeMock();
    data.set('shot-rail:hintSeenAngle', 'not json {');
    expect(readSetting(hintStorageKey('angle'), false, storage)).toBe(false);
  });

  // Catches: removing the try/catch in readSetting, so a blocked localStorage breaks start-up.
  it('reads from a storage that throws as not seen', () => {
    expect(readSetting(hintStorageKey('angle'), false, throwingStorage)).toBe(false);
    expect(readSetting(hintStorageKey('move'), false, throwingStorage)).toBe(false);
  });

  // Catches: removing the try/catch in writeSetting, so a full or blocked storage breaks dismissing.
  it('writing to a storage that throws does not throw', () => {
    expect(() => writeSetting(hintStorageKey('angle'), true, throwingStorage)).not.toThrow();
    expect(() => writeSetting(hintStorageKey('move'), true, throwingStorage)).not.toThrow();
  });

  // Catches: both modes sharing one key (e.g. hintStorageKey always returning 'hintSeenAngle').
  it('one mode\'s seen flag does not affect the other', () => {
    const a = makeMock();
    writeSetting(hintStorageKey('angle'), true, a.storage);
    expect(readSetting(hintStorageKey('angle'), false, a.storage)).toBe(true);
    expect(readSetting(hintStorageKey('move'), false, a.storage)).toBe(false);

    const m = makeMock();
    writeSetting(hintStorageKey('move'), true, m.storage);
    expect(readSetting(hintStorageKey('move'), false, m.storage)).toBe(true);
    expect(readSetting(hintStorageKey('angle'), false, m.storage)).toBe(false);
  });

  // The flow hints.ts follows, built from the same pure pieces: first open shows, dismiss stores,
  // second open shows nothing; the other mode still shows. Catches: storing under the wrong key
  // or never storing (the second open would show again, or the other mode would be hidden).
  it('first open shows, dismissing stores the flag, the second open shows none', () => {
    const { storage } = makeMock();
    const seen = (mode: GridMode): boolean => readSetting<boolean>(hintStorageKey(mode), false, storage) === true;
    const toShow = (mode: GridMode): GridMode | null => hintToShow(mode, seen('angle'), seen('move'));

    expect(toShow('angle')).toBe('angle');
    writeSetting(hintStorageKey('angle'), true, storage); // the dismiss
    expect(toShow('angle')).toBe(null);
    expect(toShow('move')).toBe('move');
  });
});
