import { describe, expect, it } from 'vitest';
import { isPanelVisible } from '../../src/view/mode-panels-rules.js';
import type { PanelId } from '../../src/view/mode-panels-rules.js';
import type { GridMode } from '../../src/view/coverage-grid-rules.js';

// Source line it should catch: swapping the two modes, or showing 'shot' in angle.
// All expected values are hand-written literals (Requirements 7.13, 8.16).
describe('isPanelVisible', () => {
  it.each<[PanelId, GridMode, boolean]>([
    ['cameras', 'angle', true],
    ['cameras', 'move', false],
    ['placement', 'angle', true],
    ['placement', 'move', false],
    ['lens', 'angle', true],
    ['lens', 'move', false],
    ['shot', 'angle', false],
    ['shot', 'move', true],
  ])('panel %s in %s mode: visible is %s', (panel, mode, expected) => {
    expect(isPanelVisible(panel, mode)).toBe(expected);
  });
});
