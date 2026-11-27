import { describe, expect, it } from 'vitest';
import { loadGuideState, safeAreaRect, thirdsLines, toggleGuide } from '../../src/logic/guides.js';
import type { GuideKey } from '../../src/logic/guides.js';
import type { StorageLike } from '../../src/logic/storage.js';

/** A working in-memory mock. `data` holds the raw keys and text. */
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

const throwingSet: StorageLike = {
  getItem(): string | null {
    return null;
  },
  setItem(): void {
    throw new Error('quota exceeded');
  },
};

const throwingGet: StorageLike = {
  getItem(): string | null {
    throw new Error('access denied');
  },
  setItem(): void {
    // not used
  },
};

describe('thirdsLines', () => {
  it('1600 x 900 gives x 533.333 and 1066.667, y 300 and 600', () => {
    const t = thirdsLines(1600, 900);
    expect(t.vertical).toHaveLength(2);
    expect(t.horizontal).toHaveLength(2);
    expect(Math.abs(t.vertical[0] - 533.333)).toBeLessThan(1e-3);
    expect(Math.abs(t.vertical[1] - 1066.667)).toBeLessThan(1e-3);
    expect(Math.abs(t.horizontal[0] - 300)).toBeLessThan(1e-9);
    expect(Math.abs(t.horizontal[1] - 600)).toBeLessThan(1e-9);
  });

  it('1920 x 1080 gives x 640 and 1280, y 360 and 720', () => {
    const t = thirdsLines(1920, 1080);
    expect(Math.abs(t.vertical[0] - 640)).toBeLessThan(1e-9);
    expect(Math.abs(t.vertical[1] - 1280)).toBeLessThan(1e-9);
    expect(Math.abs(t.horizontal[0] - 360)).toBeLessThan(1e-9);
    expect(Math.abs(t.horizontal[1] - 720)).toBeLessThan(1e-9);
  });
});

describe('safeAreaRect', () => {
  it('1600 x 900 at 0.9 gives x 80, y 45, width 1440, height 810', () => {
    const r = safeAreaRect(1600, 900, 0.9);
    expect(Math.abs(r.x - 80)).toBeLessThan(1e-9);
    expect(Math.abs(r.y - 45)).toBeLessThan(1e-9);
    expect(Math.abs(r.width - 1440)).toBeLessThan(1e-9);
    expect(Math.abs(r.height - 810)).toBeLessThan(1e-9);
  });

  it('1920 x 1080 at 0.93 gives x 67.2, y 37.8, width 1785.6, height 1004.4', () => {
    const r = safeAreaRect(1920, 1080, 0.93);
    expect(Math.abs(r.x - 67.2)).toBeLessThan(1e-6);
    expect(Math.abs(r.y - 37.8)).toBeLessThan(1e-6);
    expect(Math.abs(r.width - 1785.6)).toBeLessThan(1e-6);
    expect(Math.abs(r.height - 1004.4)).toBeLessThan(1e-6);
  });

  it('fraction 1 gives the whole frame at the origin', () => {
    const r = safeAreaRect(1600, 900, 1);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.width).toBe(1600);
    expect(r.height).toBe(900);
  });
});

describe('toggleGuide', () => {
  it('false becomes true and stores "true" under the prefixed key', () => {
    const { storage, data } = makeMock();
    expect(toggleGuide(false, 'thirdsGuideOn', storage)).toBe(true);
    expect(data.get('shot-rail:thirdsGuideOn')).toBe('true');
    expect(data.size).toBe(1);
  });

  it('true becomes false and stores "false"', () => {
    const { storage, data } = makeMock();
    expect(toggleGuide(true, 'safeAreaGuideOn', storage)).toBe(false);
    expect(data.get('shot-rail:safeAreaGuideOn')).toBe('false');
    expect(data.size).toBe(1);
  });

  it.each<[GuideKey, string]>([
    ['thirdsGuideOn', 'shot-rail:thirdsGuideOn'],
    ['safeAreaGuideOn', 'shot-rail:safeAreaGuideOn'],
  ])('writes the key %s as %s and no other key', (key, expected) => {
    const { storage, data } = makeMock();
    toggleGuide(false, key, storage);
    expect([...data.keys()]).toEqual([expected]);
  });

  it('a storage whose setItem throws still toggles and does not throw', () => {
    expect(toggleGuide(false, 'thirdsGuideOn', throwingSet)).toBe(true);
    expect(toggleGuide(true, 'thirdsGuideOn', throwingSet)).toBe(false);
  });

  it('with no storage (null) it still toggles', () => {
    expect(toggleGuide(false, 'safeAreaGuideOn', null)).toBe(true);
    expect(toggleGuide(true, 'safeAreaGuideOn', null)).toBe(false);
  });

  it('toggling one guide leaves the other guide off', () => {
    const { storage } = makeMock();
    toggleGuide(false, 'thirdsGuideOn', storage);
    expect(loadGuideState('thirdsGuideOn', storage)).toBe(true);
    expect(loadGuideState('safeAreaGuideOn', storage)).toBe(false);
  });

  it('toggle, toggle again, then load gives false', () => {
    const { storage } = makeMock();
    const first = toggleGuide(false, 'thirdsGuideOn', storage);
    const second = toggleGuide(first, 'thirdsGuideOn', storage);
    expect(second).toBe(false);
    expect(loadGuideState('thirdsGuideOn', storage)).toBe(false);
  });
});

describe('loadGuideState', () => {
  it('a missing value gives false', () => {
    const { storage } = makeMock();
    expect(loadGuideState('thirdsGuideOn', storage)).toBe(false);
  });

  it('a stored "true" gives true', () => {
    const { storage, data } = makeMock();
    data.set('shot-rail:safeAreaGuideOn', 'true');
    expect(loadGuideState('safeAreaGuideOn', storage)).toBe(true);
  });

  it.each<[string]>([['false'], ['not json'], ['1'], ['"true"'], ['null'], ['']])(
    'the stored text %j gives false',
    (text) => {
      const { storage, data } = makeMock();
      data.set('shot-rail:thirdsGuideOn', text);
      expect(loadGuideState('thirdsGuideOn', storage)).toBe(false);
    },
  );

  it('a storage whose getItem throws gives false', () => {
    expect(loadGuideState('thirdsGuideOn', throwingGet)).toBe(false);
  });

  it('no storage (null) gives false', () => {
    expect(loadGuideState('thirdsGuideOn', null)).toBe(false);
  });
});
