import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../src/logic/contrast.js';

// Expected values are written by hand (worked out from the WCAG formula, or
// published WCAG checker values), never computed by contrastRatio.

describe('contrastRatio', () => {
  it('black on white is 21', () => {
    expect(Math.abs(contrastRatio('#000000', '#ffffff') - 21)).toBeLessThan(1e-9);
  });

  it('white on white is 1', () => {
    expect(Math.abs(contrastRatio('#ffffff', '#ffffff') - 1)).toBeLessThan(1e-9);
  });

  it('#777777 on white is about 4.48, below 4.5', () => {
    const r = contrastRatio('#777777', '#ffffff');
    expect(Math.abs(r - 4.48)).toBeLessThan(0.01);
    expect(r).toBeLessThan(4.5);
  });

  it('#767676 on white is about 4.54, above 4.5', () => {
    const r = contrastRatio('#767676', '#ffffff');
    expect(Math.abs(r - 4.54)).toBeLessThan(0.01);
    expect(r).toBeGreaterThan(4.5);
  });

  // #666666 has a channel value of 0.4, between 0.04045 and 0.4045, so it
  // exercises the power-curve branch right below a wrongly raised threshold.
  it('#666666 on white is about 5.74 (published WCAG value)', () => {
    expect(Math.abs(contrastRatio('#666666', '#ffffff') - 5.74)).toBeLessThan(0.01);
  });

  it('#595959 on white is about 7.0 (published WCAG value)', () => {
    expect(Math.abs(contrastRatio('#595959', '#ffffff') - 7.0)).toBeLessThan(0.05);
  });

  it.each([
    ['#000000', '#ffffff', 21],
    ['#777777', '#ffffff', 4.48],
    ['#666666', '#ffffff', 5.74],
  ])('order of %s and %s does not change the result', (a, b, expected) => {
    const forward = contrastRatio(a, b);
    const backward = contrastRatio(b, a);
    expect(Math.abs(forward - backward)).toBeLessThan(1e-12);
    expect(Math.abs(backward - expected)).toBeLessThan(0.01);
  });

  // Pure colours on black. Ratio = (luminance + 0.05) / 0.05 with luminance
  // 0.2126 (red), 0.7152 (green), 0.0722 (blue). Catches a wrong channel weight.
  it.each([
    ['#FF0000', 5.252],
    ['#00FF00', 15.304],
    ['#0000FF', 2.444],
  ])('%s on #000000 is about %s in both argument orders', (c, expected) => {
    expect(Math.abs(contrastRatio(c, '#000000') - expected)).toBeLessThan(0.001);
    expect(Math.abs(contrastRatio('#000000', c) - expected)).toBeLessThan(0.001);
  });

  // Channel 10/255 = 0.0392 is below 0.04045, so it uses c / 12.92.
  // Luminance 0.003035, ratio (0.003035 + 0.05) / 0.05.
  it('#0a0a0a on #000000 is about 1.0607 (linear branch)', () => {
    expect(Math.abs(contrastRatio('#0a0a0a', '#000000') - 1.0607)).toBeLessThan(0.0005);
    expect(Math.abs(contrastRatio('#000000', '#0a0a0a') - 1.0607)).toBeLessThan(0.0005);
  });

  it.each(['red', '#fff', '#12345', '#1234567', '#gggggg', '', ' #ffffff', '#ffffff '])(
    'bad colour "%s" throws in either argument position',
    (bad) => {
      expect(() => contrastRatio(bad, '#ffffff')).toThrow(/expected a colour like/);
      expect(() => contrastRatio('#ffffff', bad)).toThrow(/expected a colour like/);
    },
  );
});
