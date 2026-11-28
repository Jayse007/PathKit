import { describe, expect, it } from 'vitest';
import { LENS_PRESETS_MM } from '../../src/logic/constants.js';
import {
  ANGLE_NOTES,
  ANGLE_TERMS,
  CUTOFF_NOTE,
  FRAMING_TERMS,
  LENS_TERMS,
  MEASURE_TERMS,
  SHOT_TYPE_TERMS,
  TERM_SOURCE_IDS,
  angleCutoffText,
  framingCutoffText,
  type TermLine,
} from '../../src/logic/term-text.js';

const everyLine: Array<[string, TermLine]> = [
  ...Object.entries(ANGLE_TERMS),
  ...Object.entries(FRAMING_TERMS),
  ...Object.entries(SHOT_TYPE_TERMS),
  ...Object.entries(LENS_TERMS),
  ...Object.entries(MEASURE_TERMS),
  ...Object.entries(ANGLE_NOTES),
] as Array<[string, TermLine]>;

describe('term text lines', () => {
  it('has 4 + 3 + 4 + 4 + 12 + 3 = 30 lines', () => {
    expect(everyLine).toHaveLength(30);
  });

  it('keeps every line to one short line of text', () => {
    for (const [key, l] of everyLine) {
      expect(l.text, key).not.toMatch(/[\r\n]/);
      expect(l.text.trim(), key).toBe(l.text);
      expect(l.text.length, key).toBeGreaterThan(10);
      expect(l.text.length, key).toBeLessThanOrEqual(140);
    }
  });

  it('names only source ids that docs/sources.md is meant to hold', () => {
    for (const [key, l] of everyLine) {
      for (const id of l.sourceIds) expect(TERM_SOURCE_IDS, `${key}: ${id}`).toContain(id);
    }
  });

  it('gives every lens preset a line, and no other lens', () => {
    expect(Object.keys(LENS_TERMS).map(Number).sort((a, b) => a - b)).toEqual([...LENS_PRESETS_MM]);
  });
});

describe('commonly said notes', () => {
  it('has notes for low angle, eye level and high angle only', () => {
    expect(Object.keys(ANGLE_NOTES).sort()).toEqual(['eye level', 'high angle', 'low angle']);
  });

  it('marks each note "Commonly said:" and gives each at least one source', () => {
    for (const [key, l] of Object.entries(ANGLE_NOTES) as Array<[string, TermLine]>) {
      expect(l.text, key).toMatch(/^Commonly said: /);
      expect(l.sourceIds.length, key).toBeGreaterThan(0);
    }
  });

  it('does not state an effect in the plain angle explanations', () => {
    for (const [key, l] of Object.entries(ANGLE_TERMS) as Array<[string, TermLine]>) {
      expect(l.text, key).not.toMatch(/power|weak|small|strong|vulnerab|dominan/i);
    }
  });
});

describe('cut-off wording', () => {
  // Hand-written. The numbers come from the spec (-10, 10, 60 degrees; 35 and 70 percent), not from the constants.
  it('writes the angle cut-offs', () => {
    expect(angleCutoffText('low angle')).toBe('below -10°');
    expect(angleCutoffText('eye level')).toBe('-10° to 10°');
    expect(angleCutoffText('high angle')).toBe('above 10° up to 60°');
    expect(angleCutoffText('overhead')).toBe('above 60°');
  });

  it('writes the framing cut-offs', () => {
    expect(framingCutoffText('close-up')).toBe('above 70% fill');
    expect(framingCutoffText('medium')).toBe('35% to 70% fill');
    expect(framingCutoffText('wide')).toBe('below 35% fill');
  });

  it('calls the cut-offs the app\'s own and never "commonly used"', () => {
    expect(CUTOFF_NOTE).toContain("this app's own");
    expect(CUTOFF_NOTE).not.toMatch(/commonly used/i);
  });
});

describe('field of view formula line', () => {
  it('states the sensor size the app really uses', () => {
    expect(MEASURE_TERMS.fieldOfViewFormula.text).toContain('36 x 20.25 mm');
  });
});
