import { describe, expect, it } from 'vitest';
import { activeElementKind, shouldHandleShortcut } from '../src/logic/shortcut-guard.js';

// Design Property 17. Requirements 14.6, 35.16.
describe('shouldHandleShortcut', () => {
  it('ignores a text input, textarea, select and range input', () => {
    expect(shouldHandleShortcut('text-input')).toBe(false);
    expect(shouldHandleShortcut('textarea')).toBe(false);
    expect(shouldHandleShortcut('select')).toBe(false);
    expect(shouldHandleShortcut('range-input')).toBe(false);
  });

  it('accepts a button and no focus', () => {
    expect(shouldHandleShortcut('button')).toBe(true);
    expect(shouldHandleShortcut('none')).toBe(true);
  });
});

describe('activeElementKind', () => {
  it('maps tag names and input types to kinds', () => {
    expect(activeElementKind(null)).toBe('none');
    expect(activeElementKind({ tagName: 'TEXTAREA' })).toBe('textarea');
    expect(activeElementKind({ tagName: 'SELECT' })).toBe('select');
    expect(activeElementKind({ tagName: 'INPUT', type: 'text' })).toBe('text-input');
    expect(activeElementKind({ tagName: 'INPUT', type: 'range' })).toBe('range-input');
    expect(activeElementKind({ tagName: 'BUTTON' })).toBe('button');
  });
});
