// WCAG 2.x contrast ratio between two sRGB colours. Pure, no imports.

/** A colour written as a six-digit hex string such as "#767676" (case-insensitive). */
export type RgbColor = string;

const HEX_PATTERN = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;

/** Linearise one sRGB channel given as 0..255. */
function linearChannel(value255: number): number {
  const c = value255 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
function relativeLuminance(color: RgbColor): number {
  const match = HEX_PATTERN.exec(color);
  if (match === null) {
    throw new Error(`contrastRatio: expected a colour like "#rrggbb", got "${String(color)}"`);
  }
  const r = linearChannel(parseInt(match[1], 16));
  const g = linearChannel(parseInt(match[2], 16));
  const b = linearChannel(parseInt(match[3], 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, from 1 (identical) to 21 (black on white). Order of the two colours does not matter. */
export function contrastRatio(fg: RgbColor, bg: RgbColor): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
