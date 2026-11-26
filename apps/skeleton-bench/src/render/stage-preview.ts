// Temporary page for the Task 17.2 and 17.4 checkpoints. Drives the stage from the app state functions.
// Not the final app entry (index.html is not changed in this task).
import { bakeLaps } from '../pathkit/laps.js';
import { bakeParts } from '../pathkit/part-scenes.js';
import { createInitialState, setExplode, setOffset, setOrbitAngle, setZoom } from '../state.js';
import type { AppState } from '../state.js';
import { createPartPlacer } from './part-placement.js';
import { buildPumpModel, spinImpeller } from './pump-model.js';
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
const explodeInput = el<HTMLInputElement>('explode');
const reducedInput = el<HTMLInputElement>('reduced');

try {
  const result = createStage(container, bakeLaps());
  if (result.ok) {
    const stage = result.stage;
    let state: AppState = createInitialState();

    // Pump: built and baked once here. The slider only reads baked frames.
    const model = buildPumpModel();
    stage.machineGroup.add(model.root);
    const placer = createPartPlacer(model.partsById, bakeParts());

    const show = (): void => {
      placer.placeAtAmount(state.explode);
      stage.setView(state);
      readout.textContent =
        `angle=${state.orbitAngleDeg}  zoom=${state.zoom.toFixed(2)}  explode=${state.explode.toFixed(0)}%  ` +
        `offset=(${state.offsetX.toFixed(2)}, ${state.offsetY.toFixed(2)})`;
    };

    // Impeller spin: the loop runs only while the impeller turns. Under reduced motion it stops.
    let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    reducedInput.checked = reduced;
    let lastMs = 0;
    let spinning = false;
    const spinTick = (nowMs: number): void => {
      spinning = false;
      const dt = lastMs === 0 ? 0 : Math.min(0.1, (nowMs - lastMs) / 1000);
      lastMs = nowMs;
      if (spinImpeller(model, dt, reduced)) stage.requestRender();
      if (!reduced) {
        spinning = true;
        requestAnimationFrame(spinTick);
      }
    };
    const startSpin = (): void => {
      if (spinning || reduced) return;
      lastMs = 0;
      spinning = true;
      requestAnimationFrame(spinTick);
    };
    reducedInput.addEventListener('change', () => {
      reduced = reducedInput.checked;
      startSpin();
    });
    explodeInput.addEventListener('input', () => {
      state = setExplode(state, Number(explodeInput.value));
      show();
    });

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
    startSpin();
  }
} catch (error) {
  const text = error instanceof Error ? error.message : String(error);
  showStageMessage(container, `The stage could not start: ${text}. Reload the page; if it keeps failing, report this message.`);
}
