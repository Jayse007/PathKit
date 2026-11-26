/**
 * Contrast_Function. Pure: no state. App code, not PathKit.
 * WCAG 2.x contrast ratio of two sRGB colours, given as "#rrggbb" or "#rgb".
 */

function parseHex(colour: string): [number, number, number] {
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(colour);
  if (match === null) {
    throw new Error(`contrastRatio: colour must be #rgb or #rrggbb, got ${String(colour)}`);
  }
  let hex = match[1] as string;
  if (hex.length === 3) {
    hex = `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function linear(channel8bit: number): number {
  const c = channel8bit / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(colour: string): number {
  const [r, g, b] = parseHex(colour);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** (lighter + 0.05) / (darker + 0.05). Symmetric in its arguments. Range 1 to 21. */
export function contrastRatio(colourA: string, colourB: string): number {
  const la = relativeLuminance(colourA);
  const lb = relativeLuminance(colourB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
