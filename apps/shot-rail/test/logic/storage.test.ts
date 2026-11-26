import { describe, expect, it } from 'vitest';
import { readSetting, writeSetting } from '../../src/logic/storage.js';
import type { StorageLike } from '../../src/logic/storage.js';

/** A working in-memory mock. `data` is exposed so tests can look at the raw keys and text. */
function makeMock(): { storage: StorageLike; data: Map<string, string>; setCalls: string[] } {
  const data = new Map<string, string>();
  const setCalls: string[] = [];
  const storage: StorageLike = {
    getItem(key: string): string | null {
      const v = data.get(key);
      return v === undefined ? null : v;
    },
    setItem(key: string, value: string): void {
      setCalls.push(key);
      data.set(key, value);
    },
  };
  return { storage, data, setCalls };
}

const throwingGet: StorageLike = {
  getItem(): string | null {
    throw new Error('getItem blocked');
  },
  setItem(): void {
    // not used
  },
};

const throwingSet: StorageLike = {
  getItem(): string | null {
    return null;
  },
  setItem(): void {
    throw new Error('quota exceeded');
  },
};

describe('storage wrapper (mock StorageLike, node environment)', () => {
  // Catches: removing the try/catch around getItem in readSetting.
  it('readSetting returns the fallback when getItem throws', () => {
    expect(readSetting('speed', 7, throwingGet)).toBe(7);
  });

  // Catches: removing the try/catch around setItem in writeSetting (the task's named source line).
  it('writeSetting does not throw when setItem throws', () => {
    expect(() => writeSetting('speed', 5, throwingSet)).not.toThrow();
  });

  // Catches: dropping the `storage === null` check in readSetting (it would throw on null.getItem, or the catch is removed).
  it('readSetting returns the fallback when the storage object is missing', () => {
    expect(readSetting('speed', 'fb', null)).toBe('fb');
  });

  // Catches: dropping the `storage === null` check in writeSetting.
  it('writeSetting does not throw when the storage object is missing', () => {
    expect(() => writeSetting('speed', 5, null)).not.toThrow();
  });

  // Catches: removing the try/catch around JSON.parse in readSetting.
  it('readSetting returns the fallback when the stored text is not valid JSON', () => {
    const { storage, data } = makeMock();
    data.set('shot-rail:speed', '{not json');
    expect(readSetting('speed', 99, storage)).toBe(99);
  });

  // Catches: returning JSON.parse(null) (which gives null) instead of the fallback for a missing key.
  it('readSetting returns the fallback when the key was never stored', () => {
    const { storage } = makeMock();
    expect(readSetting('absent', 123, storage)).toBe(123);
  });

  // Catches: changing or dropping the 'shot-rail:' prefix in writeSetting or readSetting.
  it('writeSetting stores JSON under "shot-rail:" plus the key', () => {
    const { storage, data } = makeMock();
    writeSetting('speed', 42, storage);
    expect(Array.from(data.keys())).toEqual(['shot-rail:speed']);
    expect(data.get('shot-rail:speed')).toBe('42');
  });

  // Catches: writing without JSON.stringify or reading without JSON.parse (objects and strings would not round-trip).
  it.each([
    ['a number', 42, 0],
    ['a string', 'hello', ''],
    ['an object', { a: 1, b: [2, 3] }, null],
  ])('round trip keeps %s', (_label, value, fallback) => {
    const { storage } = makeMock();
    writeSetting('k', value, storage);
    expect(readSetting('k', fallback, storage)).toEqual(value);
  });

  // Catches: the default parameter reaching localStorage outside try/catch (node has no browser localStorage).
  it('readSetting with no storage argument returns the fallback without throwing', () => {
    expect(readSetting('test-only-key-that-is-never-written', 'fallback-value')).toBe('fallback-value');
  });

  // Catches: the default parameter or its lookup throwing in writeSetting when no browser storage exists.
  it('writeSetting with no storage argument does not throw', () => {
    expect(() => writeSetting('test-only-key-never-read', 1)).not.toThrow();
  });

  // Catches: removing the `text === undefined` guard (setItem would be called with undefined).
  it('writeSetting does not call setItem for a value JSON cannot represent', () => {
    const { storage, setCalls } = makeMock();
    writeSetting('k', undefined, storage);
    expect(setCalls).toEqual([]);
  });

  // Catches: moving JSON.stringify outside the try/catch in writeSetting.
  it('writeSetting does not throw for a circular value', () => {
    const { storage, setCalls } = makeMock();
    const loop: { self?: unknown } = {};
    loop.self = loop;
    expect(() => writeSetting('k', loop, storage)).not.toThrow();
    expect(setCalls).toEqual([]);
  });

  function withGlobalLocalStorage(descriptor: PropertyDescriptor, run: () => void): void {
    const target = globalThis as { localStorage?: unknown };
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { ...descriptor, configurable: true });
    try {
      run();
    } finally {
      if (original !== undefined) {
        Object.defineProperty(globalThis, 'localStorage', original);
      } else {
        delete target.localStorage;
      }
    }
  }

  // Catches: browserStorage() looking at the wrong object, or caching the lookup at module load (the fake would not be seen).
  it('with no storage argument, reads and writes go to globalThis.localStorage under the prefix', () => {
    const { storage, data } = makeMock();
    withGlobalLocalStorage({ value: storage }, () => {
      writeSetting('speed', 8);
      expect(data.get('shot-rail:speed')).toBe('8');
      expect(readSetting('speed', 0)).toBe(8);
    });
  });

  // Catches: removing the try/catch inside browserStorage() (a blocked lookup would throw out of the default parameter).
  it('with no storage argument, a localStorage that throws when looked up gives the fallback and no error', () => {
    withGlobalLocalStorage(
      { get(): never { throw new Error('SecurityError: storage is blocked'); } },
      () => {
        expect(readSetting('speed', 'fb')).toBe('fb');
        expect(() => writeSetting('speed', 1)).not.toThrow();
      },
    );
  });
});
