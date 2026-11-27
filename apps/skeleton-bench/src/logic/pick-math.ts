/**
 * Pointer position to normalised device coordinates (Task 17.7). Pure, no DOM.
 * The rectangle is the canvas rectangle in CSS pixels (left, top, width, height).
 * x runs -1 (left edge) to +1 (right edge); y runs +1 (top edge) to -1 (bottom edge).
 * The view offset needs no special case: the whole canvas is drawn with the offset projection,
 * so the canvas rectangle still maps linearly to NDC.
 */

export interface NdcOut {
  x: number;
  y: number;
}

/** Writes the NDC into `out` and returns it. Throws for a non-finite input or a rectangle with no area. */
export function clientToNdc(
  clientX: number,
  clientY: number,
  left: number,
  top: number,
  width: number,
  height: number,
  out: NdcOut,
): NdcOut {
  const values = [clientX, clientY, left, top, width, height];
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(`clientToNdc: every input must be a finite number, got ${String(v)}`);
    }
  }
  if (width <= 0 || height <= 0) {
    throw new Error(`clientToNdc: width and height must be above 0, got ${width} by ${height}`);
  }
  out.x = ((clientX - left) / width) * 2 - 1;
  out.y = -((clientY - top) / height) * 2 + 1;
  return out;
}
