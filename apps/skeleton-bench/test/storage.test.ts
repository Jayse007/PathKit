import { describe, expect, it } from 'vitest';
import { STORAGE_KEY_HINT_PREFIX, STORAGE_KEY_LOOK } from '../src/constants.js';
import {
  DEFAULT_LOOK,
  hasSeenHint,
  loadLook,
  markHintSeen,
  readStored,
  saveLook,
  writeStored,
  type StorageLike,
} from '../src/ui/storage.js';

// Design Property 22. Requirements 23.3, 35.16.
function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

/** Runs fn with globalThis.localStorage replaced, then restores the original. */
function withGlobalStorage(descriptor: PropertyDescriptor, fn: () => void): void {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { ...descriptor, configurable: true });
  try {
    fn();
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
}

describe('storage failure modes', () => {
  it('survives getItem throwing', () => {
    const fake: StorageLike = {
      getItem: () => {
        throw new Error('read blocked');
      },
      setItem: () => {},
    };
    expect(readStored('skeletonBench.x', fake)).toBeNull();
    expect(loadLook(fake)).toBe(DEFAULT_LOOK);
    expect(hasSeenHint('a', fake)).toBe(false);
  });

  it('survives setItem throwing (quota full)', () => {
    const fake: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(writeStored('skeletonBench.x', 'v', fake)).toBe(false);
    expect(saveLook('Clean_Engineering', fake)).toBe(false);
    expect(markHintSeen('a', fake)).toBe(false);
  });

  it('survives localStorage being missing', () => {
    withGlobalStorage({ value: undefined, writable: true }, () => {
      expect(readStored('skeletonBench.x')).toBeNull();
      expect(writeStored('skeletonBench.x', 'v')).toBe(false);
      expect(loadLook()).toBe(DEFAULT_LOOK);
    });
  });

  it('survives reading localStorage throwing (access denied)', () => {
    withGlobalStorage(
      {
        get: () => {
          throw new Error('SecurityError');
        },
      },
      () => {
        expect(readStored('skeletonBench.x')).toBeNull();
        expect(writeStored('skeletonBench.x', 'v')).toBe(false);
        expect(hasSeenHint('a')).toBe(false);
      },
    );
  });
});

describe('storage keys and values', () => {
  it('uses keys that start with skeletonBench.', () => {
    expect(STORAGE_KEY_LOOK.startsWith('skeletonBench.')).toBe(true);
    expect(STORAGE_KEY_HINT_PREFIX.startsWith('skeletonBench.')).toBe(true);
    const fake = memoryStorage();
    saveLook('Clean_Engineering', fake);
    markHintSeen('explode', fake);
    expect(fake.data.size).toBe(2);
    for (const key of fake.data.keys()) {
      if (!key.startsWith('skeletonBench.')) throw new Error(`key without prefix: ${key}`);
    }
  });

  it('round-trips the look and the hint flag, and defaults on an invalid look', () => {
    const fake = memoryStorage();
    expect(loadLook(fake)).toBe('X_Ray_Skeleton');
    expect(saveLook('Clean_Engineering', fake)).toBe(true);
    expect(loadLook(fake)).toBe('Clean_Engineering');
    expect(hasSeenHint('explode', fake)).toBe(false);
    expect(markHintSeen('explode', fake)).toBe(true);
    expect(hasSeenHint('explode', fake)).toBe(true);
    fake.data.set(STORAGE_KEY_LOOK, 'garbage');
    expect(loadLook(fake)).toBe('X_Ray_Skeleton');
  });

  it('counts a hint as seen only when the stored value is "1"', () => {
    const fake = memoryStorage();
    fake.data.set(STORAGE_KEY_HINT_PREFIX + 'explode', '0');
    expect(hasSeenHint('explode', fake)).toBe(false);
    fake.data.set(STORAGE_KEY_HINT_PREFIX + 'explode', 'yes');
    expect(hasSeenHint('explode', fake)).toBe(false);
  });
});
