// Temporary page for the Task 17.2, 17.4, 17.6 and 17.8 checkpoints. Drives the stage from the app state functions.
// Not the final app entry (index.html is not changed in this task).
import { bakeLaps } from '../pathkit/laps.js';
import { bakeParts } from '../pathkit/part-scenes.js';
import { DESK_LAMP_PARTS, HEAT_EXCHANGER_PARTS, PUMP_PARTS } from '../data/catalogue.js';
import type { PartEntry } from '../data/catalogue-types.js';
import { createClickTracker } from '../logic/click-tracker.js';
import {
  createInitialState,
  selectPart,
  setExplode,
  setLook,
  setOffset,
  setOrbitAngle,
  setZoom,
} from '../state.js';
import type { AppState } from '../state.js';
import { loadLook, saveLook } from '../ui/storage.js';
import type { Look } from '../ui/storage.js';
import { applySceneBackground, createLookLights } from './looks.js';
import { createPartPlacer } from './part-placement.js';
import { collectPartMeshes, createPicker } from './picking.js';
import { buildDeskLampModel } from './desk-lamp-model.js';
import { buildHeatExchangerModel } from './heat-exchanger-model.js';
import type { MachineModel } from './model-kit.js';
import { buildPumpModel, spinImpeller } from './pump-model.js';
import type { PumpModel } from './pump-model.js';
import { createShells } from './shells.js';
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
const lookInput = el<HTMLSelectElement>('look');

try {
  const result = createStage(container, bakeLaps());
  if (result.ok) {
    const stage = result.stage;
    let state: AppState = createInitialState(loadLook());

    // The URL picks the machine: ?machine=pump, heat-exchanger or desk-lamp. Anything else gives the Pump.
    const machineParam = new URLSearchParams(window.location.search).get('machine');
    let model: MachineModel;
    let machineParts: readonly PartEntry[];
    let pumpModel: PumpModel | null = null;
    if (machineParam === 'heat-exchanger') {
      machineParts = HEAT_EXCHANGER_PARTS;
      model = buildHeatExchangerModel(machineParts, state.look);
    } else if (machineParam === 'desk-lamp') {
      machineParts = DESK_LAMP_PARTS;
      model = buildDeskLampModel(machineParts, state.look);
    } else {
      machineParts = PUMP_PARTS;
      pumpModel = buildPumpModel(machineParts, state.look);
      model = pumpModel;
    }
    // Built and baked once here. The slider only reads baked frames.
    stage.machineGroup.add(model.root);
    stage.scene.add(createLookLights());
    applySceneBackground(stage.scene, state.look);
    lookInput.value = state.look;
    lookInput.addEventListener('change', () => {
      const look = lookInput.value as Look;
      state = setLook(state, look);
      saveLook(look);
      model.setLook(look);
      applySceneBackground(stage.scene, look);
      stage.requestRender();
    });
    const placer = createPartPlacer(model.partsById, bakeParts());

    // Picking and shells (Task 17.7). The mesh list is taken before the shells are added.
    const picker = createPicker(stage.camera, stage.scene, collectPartMeshes(model.root));
    const shells = createShells(model.root, state.look);
    lookInput.addEventListener('change', () => {
      shells.setLook(state.look);
      stage.requestRender();
    });
    const tracker = createClickTracker();
    const partsBox = el<HTMLDivElement>('parts');
    const partButtons = new Map<string, HTMLButtonElement>();
    const partName = (id: string | null): string => machineParts.find((p) => p.id === id)?.name ?? 'none';

    const applySelection = (): void => {
      shells.setSelected(state.selectedPart);
      for (const [id, button] of partButtons) {
        button.setAttribute('aria-pressed', id === state.selectedPart ? 'true' : 'false');
      }
      show();
    };
    for (const part of machineParts) {
      const button = document.createElement('button');
      button.textContent = part.name;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('focus', () => {
        shells.setFocused(part.id);
        stage.requestRender();
      });
      button.addEventListener('blur', () => {
        shells.setFocused(null);
        stage.requestRender();
      });
      button.addEventListener('click', () => {
        state = selectPart(state, part.id);
        applySelection();
      });
      partButtons.set(part.id, button);
      partsBox.appendChild(button);
    }
    el<HTMLButtonElement>('clear-selection').addEventListener('click', () => {
      state = selectPart(state, null);
      applySelection();
    });

    const canvas = stage.canvas;
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      tracker.press(event.clientX, event.clientY);
    });
    canvas.addEventListener('pointermove', (event) => {
      tracker.move(event.clientX, event.clientY);
    });
    canvas.addEventListener('pointercancel', () => tracker.cancel());
    canvas.addEventListener('pointerup', (event) => {
      if (tracker.release(event.clientX, event.clientY) !== 'click') return;
      const id = picker.pickClient(event.clientX, event.clientY, canvas);
      // A click on empty space leaves the selection as it is (the spec does not say otherwise).
      if (id === null) return;
      state = selectPart(state, id);
      applySelection();
    });

    const show = (): void => {
      placer.placeAtAmount(state.explode);
      stage.setView(state);
      readout.textContent =
        `look=${state.look}  angle=${state.orbitAngleDeg}  zoom=${state.zoom.toFixed(2)}  explode=${state.explode.toFixed(0)}%  ` +
        `offset=(${state.offsetX.toFixed(2)}, ${state.offsetY.toFixed(2)})  selected=${partName(state.selectedPart)}`;
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
      if (pumpModel !== null && spinImpeller(pumpModel, dt, reduced)) stage.requestRender();
      if (!reduced) {
        spinning = true;
        requestAnimationFrame(spinTick);
      }
    };
    const startSpin = (): void => {
      if (pumpModel === null || spinning || reduced) return;
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
