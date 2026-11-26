// Guides overlay: a 2D canvas on top of the main view that draws the rule-of-thirds lines and the
// safe-area rectangle, plus the toggles (checkboxes and the keys T and G).
// The geometry is in ../logic/guides.ts. This file touches the DOM, so no test imports it.
//
// Drawing runs only when a guide is toggled or the size changes, never per animation frame.

import { ASPECT_RATIO, DEVICE_PIXEL_RATIO_CAP, SAFE_AREA_FRACTION } from '../logic/constants.js';
import { loadGuideState, safeAreaRect, thirdsLines, toggleGuide } from '../logic/guides.js';
import type { GuideKey } from '../logic/guides.js';

const SHADOW_STYLE = 'rgba(0, 0, 0, 0.6)';
const LINE_STYLE = 'rgba(255, 255, 255, 0.9)';
const SHADOW_WIDTH_PX = 3;
const LINE_WIDTH_PX = 1;

export interface GuidesControls {
  /** The checkbox for the rule-of-thirds guide (key T). */
  readonly thirdsInput: HTMLInputElement;
  /** The checkbox for the safe-area guide (key G). */
  readonly safeAreaInput: HTMLInputElement;
}

export interface GuidesOverlay {
  /** Flip the rule-of-thirds guide, store it, update the checkbox and redraw. */
  toggleThirds(): void;
  /** Flip the safe-area guide, store it, update the checkbox and redraw. */
  toggleSafeArea(): void;
  /** Remove the overlay, the listeners and the observer. */
  dispose(): void;
}

/** Builds a labelled checkbox with a tooltip. Setup code, runs once. */
export function createGuideToggle(
  parent: HTMLElement,
  id: string,
  labelText: string,
  tooltip: string,
): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.title = tooltip;
  const label = document.createElement('label');
  label.htmlFor = id;
  label.title = tooltip;
  label.textContent = labelText;
  parent.append(input, label);
  return input;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && target.type !== 'checkbox' && target.type !== 'button';
}

/**
 * Adds the overlay canvas to `container` (the 16:9 stage box, after the main view is made) and
 * wires the two checkboxes and the keys T and G. Initial states come from storage.
 */
export function createGuidesOverlay(container: HTMLElement, controls: GuidesControls): GuidesOverlay {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.position = 'absolute';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  container.style.position = 'relative';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  let thirdsOn = loadGuideState('thirdsGuideOn');
  let safeAreaOn = loadGuideState('safeAreaGuideOn');
  controls.thirdsInput.checked = thirdsOn;
  controls.safeAreaInput.checked = safeAreaOn;

  const strokeLine = (x1: number, y1: number, x2: number, y2: number): void => {
    if (ctx === null) return;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const draw = (): void => {
    if (ctx === null) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!thirdsOn && !safeAreaOn) return;

    // Two passes, a dark wide stroke then a light thin one, so the lines show on any background.
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? SHADOW_STYLE : LINE_STYLE;
      ctx.lineWidth = pass === 0 ? SHADOW_WIDTH_PX : LINE_WIDTH_PX;
      if (thirdsOn) {
        const t = thirdsLines(width, height);
        strokeLine(t.vertical[0], 0, t.vertical[0], height);
        strokeLine(t.vertical[1], 0, t.vertical[1], height);
        strokeLine(0, t.horizontal[0], width, t.horizontal[0]);
        strokeLine(0, t.horizontal[1], width, t.horizontal[1]);
      }
      if (safeAreaOn) {
        const r = safeAreaRect(width, height, SAFE_AREA_FRACTION);
        ctx.strokeRect(r.x, r.y, r.width, r.height);
      }
    }
  };

  // Size runs on a size change only. The drawing buffer matches the main view's pixel ratio cap.
  const resize = (): void => {
    const cssWidth = container.clientWidth;
    if (cssWidth <= 0) return;
    const cssHeight = Math.round(cssWidth / ASPECT_RATIO);
    const ratio = Math.min(window.devicePixelRatio || 1, DEVICE_PIXEL_RATIO_CAP);
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    draw();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const toggle = (key: GuideKey): void => {
    if (key === 'thirdsGuideOn') {
      thirdsOn = toggleGuide(thirdsOn, key);
      controls.thirdsInput.checked = thirdsOn;
    } else {
      safeAreaOn = toggleGuide(safeAreaOn, key);
      controls.safeAreaInput.checked = safeAreaOn;
    }
    draw();
  };

  const onThirdsChange = (): void => {
    if (controls.thirdsInput.checked !== thirdsOn) toggle('thirdsGuideOn');
  };
  const onSafeAreaChange = (): void => {
    if (controls.safeAreaInput.checked !== safeAreaOn) toggle('safeAreaGuideOn');
  };
  controls.thirdsInput.addEventListener('change', onThirdsChange);
  controls.safeAreaInput.addEventListener('change', onSafeAreaChange);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (isTypingTarget(event.target)) return;
    if (event.key === 't' || event.key === 'T') toggle('thirdsGuideOn');
    else if (event.key === 'g' || event.key === 'G') toggle('safeAreaGuideOn');
  };
  window.addEventListener('keydown', onKeyDown);

  return {
    toggleThirds(): void {
      toggle('thirdsGuideOn');
    },
    toggleSafeArea(): void {
      toggle('safeAreaGuideOn');
    },
    dispose(): void {
      window.removeEventListener('keydown', onKeyDown);
      controls.thirdsInput.removeEventListener('change', onThirdsChange);
      controls.safeAreaInput.removeEventListener('change', onSafeAreaChange);
      observer.disconnect();
      canvas.remove();
    },
  };
}
