// Temporary page for the Task 17.2 checkpoint. Drives the stage from the app state functions.
// Not the final app entry (index.html is not changed in this task).
import { bakeLaps } from '../pathkit/laps.js';
import { createInitialState, setOffset, setOrbitAngle, setZoom } from '../state.js';
import type { AppState } from '../state.js';
import { createStage, showStageMessage } from './stage.js';

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) {
    throw new Error(`stage preview: missing element #${id}`);
  }
  return found as T;
}

const container = el<HTMLDivElement>('stage');
const readout = el<HTMLDivElement>('readout');
const angleInput = el<HTMLInputElement>('angle');
const zoomInput = el<HTMLInputElement>('zoom');
const offxInput = el<HTMLInputElement>('offx');
const offyInput = el<HTMLInputElement>('offy');

try {
  const result = createStage(container, bakeLaps());
  if (result.ok) {
    const stage = result.stage;
    let state: AppState = createInitialState();

    const show = (): void => {
      stage.setView(state);
      readout.textContent =
        `angle=${state.orbitAngleDeg}  zoom=${state.zoom.toFixed(2)}  ` +
        `offset=(${state.offsetX.toFixed(2)}, ${state.offsetY.toFixed(2)})`;
    };

    angleInput.addEventListener('input', () => {
      state = setOrbitAngle(state, Number(angleInput.value));
      show();
    });
    zoomInput.addEventListener('input', () => {
      state = setZoom(state, Number(zoomInput.value));
      show();
    });
    const onOffset = (): void => {
      state = setOffset(state, Number(offxInput.value), Number(offyInput.value));
      show();
    };
    offxInput.addEventListener('input', onOffset);
    offyInput.addEventListener('input', onOffset);
    el<HTMLButtonElement>('reset').addEventListener('click', () => {
      offxInput.value = '0';
      offyInput.value = '0';
      onOffset();
    });

    show();
  }
} catch (error) {
  const text = error instanceof Error ? error.message : String(error);
  showStageMessage(container, `The stage could not start: ${text}. Reload the page; if it keeps failing, report this message.`);
}
