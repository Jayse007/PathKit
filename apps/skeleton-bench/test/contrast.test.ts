import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../src/logic/contrast.js';

// Design Property 20. Requirements 22.2, 35.16.
describe('contrastRatio', () => {
  it('gives 21 for black on white', () => {
    expect(Math.abs(contrastRatio('#000000', '#ffffff') - 21)).toBeLessThan(1e-9);
  });

  it('gives 1 for the same colour', () => {
    expect(Math.abs(contrastRatio('#336699', '#336699') - 1)).toBeLessThan(1e-9);
  });

  it('gives about 4.54 for #767676 on white', () => {
    expect(Math.abs(contrastRatio('#767676', '#ffffff') - 4.54)).toBeLessThan(0.01);
  });

  it('does not depend on argument order, and accepts #rgb', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBe(contrastRatio('#ffffff', '#767676'));
    expect(Math.abs(contrastRatio('#000', '#fff') - 21)).toBeLessThan(1e-9);
  });

  it('rejects a colour that is not #rgb or #rrggbb', () => {
    expect(() => contrastRatio('white', '#000000')).toThrow();
  });
});
