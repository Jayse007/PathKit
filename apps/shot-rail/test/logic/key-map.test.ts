import { describe, expect, it } from 'vitest';
import {
  actionForKey,
  KEY_ACTIONS,
  KEY_ALIASES,
  PRIMARY_KEYS,
  type KeyAction,
} from '../../src/logic/key-map.js';

// Hand-written from the design's Keyboard map: [key, action]. 21 rows, one primary key each.
const TABLE: Array<[string, KeyAction]> = [
  [' ', 'toggle-play'],
  ['ArrowLeft', 'step-back'],
  ['ArrowRight', 'step-forward'],
  ['Home', 'first-frame'],
  ['End', 'last-frame'],
  ['a', 'mode-angle'],
  ['m', 'mode-move'],
  ['1', 'select-slot-1'],
  ['2', 'select-slot-2'],
  ['3', 'select-slot-3'],
  ['4', 'select-slot-4'],
  ['5', 'select-slot-5'],
  ['6', 'select-slot-6'],
  ['l', 'cycle-lens'],
  ['+', 'zoom-in'],
  ['-', 'zoom-out'],
  ['s', 'cycle-shot-type'],
  ['t', 'toggle-thirds'],
  ['g', 'toggle-safe-area'],
  ['c', 'capture-frame'],
  ['?', 'open-about'],
];

// Hand-written count of actions.
const ACTION_COUNT = 21;

describe('actionForKey: key table', () => {
  it.each(TABLE)('key %j gives %s', (key, action) => {
    expect(actionForKey(key, false)).toBe(action);
  });

  it.each<[string, KeyAction]>([
    ['A', 'mode-angle'],
    ['M', 'mode-move'],
    ['L', 'cycle-lens'],
    ['S', 'cycle-shot-type'],
    ['T', 'toggle-thirds'],
    ['G', 'toggle-safe-area'],
    ['C', 'capture-frame'],
  ])('upper-case %s gives %s', (key, action) => {
    expect(actionForKey(key, false)).toBe(action);
  });

  it('= gives the same action as +', () => {
    expect(actionForKey('=', false)).toBe('zoom-in');
    expect(actionForKey('=', false)).toBe(actionForKey('+', false));
  });

  it.each(['x', '/', 'Escape', '', '7', 'Spacebar'])('unknown key %j gives null', (key) => {
    expect(actionForKey(key, false)).toBeNull();
  });
});

describe('actionForKey: focus in a text or number field', () => {
  it.each([...TABLE.map(([key]) => key), '='])('key %j gives null in a field', (key) => {
    expect(actionForKey(key, true)).toBeNull();
  });

  it('typing "a" or "1" in a number field gives no action', () => {
    expect(actionForKey('a', true)).toBeNull();
    expect(actionForKey('1', true)).toBeNull();
  });
});

describe('key map tables', () => {
  it('PRIMARY_KEYS has one row per action, no action and no key twice', () => {
    expect(PRIMARY_KEYS.length).toBe(ACTION_COUNT);
    expect(new Set(PRIMARY_KEYS.map((row) => row.action)).size).toBe(ACTION_COUNT);
    expect(new Set(PRIMARY_KEYS.map((row) => row.key)).size).toBe(ACTION_COUNT);
    expect(PRIMARY_KEYS.map((row) => [row.key, row.action])).toEqual(TABLE);
  });

  it('KEY_ACTIONS lists exactly the 21 actions of the table', () => {
    expect(KEY_ACTIONS.length).toBe(ACTION_COUNT);
    expect([...KEY_ACTIONS].sort()).toEqual(TABLE.map(([, action]) => action).sort());
  });

  it('KEY_ALIASES is only = for zoom-in; each alias targets a listed action and is not a primary key', () => {
    expect(KEY_ALIASES.length).toBe(1);
    for (let i = 0; i < KEY_ALIASES.length; i++) {
      const alias = KEY_ALIASES[i];
      if (!KEY_ACTIONS.includes(alias.action)) {
        throw new Error(`alias action check, index ${i}, value ${alias.action}`);
      }
      if (PRIMARY_KEYS.some((row) => row.key === alias.key)) {
        throw new Error(`alias key is also primary, index ${i}, value ${alias.key}`);
      }
    }
    expect(KEY_ALIASES[0].key).toBe('=');
    expect(KEY_ALIASES[0].action).toBe('zoom-in');
  });
});
