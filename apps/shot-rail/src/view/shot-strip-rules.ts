// Shot_Strip text rules (task 44.3). Pure: no Three.js, no DOM. The view is in shot-strip.ts.

function checkFrame(name: string, frame: number): void {
  if (!Number.isInteger(frame) || frame < 0) {
    throw new Error(`${name}: frame must be a whole number >= 0, got ${String(frame)}`);
  }
}

/** The caption under one strip picture, for example "Frame 143". Throws when `frame` is not a whole number >= 0. */
export function stripLabel(frame: number): string {
  checkFrame('stripLabel', frame);
  return `Frame ${frame}`;
}

/** The accessible name and title of one strip picture, for example "Go to frame 143". Throws when `frame` is not a whole number >= 0. */
export function stripAriaLabel(frame: number): string {
  checkFrame('stripAriaLabel', frame);
  return `Go to frame ${frame}`;
}
