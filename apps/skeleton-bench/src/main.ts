// App entry (Task 20.2): builds the layout and shows the Pump on the Stage at start (Requirements 15.4, 21.1).
// This task adds the layout, the Inventory, the Inspector, the Parts_List and the Motion_Check text.
// The Control_Bar controls come in Task 20.4.
import { CATALOGUE } from './data/catalogue.js';
import type { MachineId } from './data/catalogue-types.js';
import { bakeAll } from './pathkit/bake-all.js';
import { buildDeskLampModel } from './render/desk-lamp-model.js';
import { buildHeatExchangerModel } from './render/heat-exchanger-model.js';
import { applySceneBackground, createLookLights } from './render/looks.js';
import type { MachineModel } from './render/model-kit.js';
import { createPartPlacer } from './render/part-placement.js';
import type { PartPlacer } from './render/part-placement.js';
import { buildPumpModel } from './render/pump-model.js';
import { createShells } from './render/shells.js';
import type { Shells } from './render/shells.js';
import { createStage, showStageMessage } from './render/stage.js';
import { createInitialState, selectPart, setMachine } from './state.js';
import type { AppState } from './state.js';
import { findMachinePart, machineParts } from './ui/inspector-text.js';
import { createLayout } from './ui/layout.js';
import { loadLook } from './ui/storage.js';

function start(): void {
  const root = document.getElementById('app');
  if (root === null) {
    throw new Error('Skeleton Bench: the page has no #app element. Reload the page.');
  }

  let state: AppState = createInitialState(loadLook());
  let model: MachineModel | null = null;
  let shells: Shells | null = null;
  let placer: PartPlacer | null = null;
  let redraw: () => void = () => undefined;

  const layout = createLayout(document, root, CATALOGUE, {
    onMachine: (machine) => showMachine(machine),
    onPartActivate: (partId) => {
      state = selectPart(state, partId);
      applySelection();
    },
    onPartFocus: (partId) => {
      if (shells === null) return;
      shells.setFocused(partId);
      redraw();
    },
  });

  const baked = bakeAll();
  if (!baked.ok) {
    showStageMessage(layout.stageHost, baked.message);
    layout.setCurrentMachine(state.machine);
    layout.setParts(machineParts(CATALOGUE, state.machine), null);
    layout.setSelected(null);
    return;
  }

  const created = createStage(layout.stageHost, baked.laps);
  if (!created.ok) {
    layout.setCurrentMachine(state.machine);
    layout.setParts(machineParts(CATALOGUE, state.machine), null);
    layout.setSelected(null);
    return;
  }
  const stage = created.stage;
  redraw = () => stage.requestRender();
  stage.scene.add(createLookLights());
  applySceneBackground(stage.scene, state.look);

  function buildModel(machine: MachineId): MachineModel {
    const parts = machineParts(CATALOGUE, machine);
    if (machine === 'heat-exchanger') return buildHeatExchangerModel(parts, state.look);
    if (machine === 'desk-lamp') return buildDeskLampModel(parts, state.look);
    return buildPumpModel(parts, state.look);
  }

  function applySelection(): void {
    if (shells !== null) shells.setSelected(state.selectedPart);
    layout.setSelected(findMachinePart(CATALOGUE, state.machine, state.selectedPart));
    redraw();
  }

  function showMachine(machine: MachineId): void {
    if (!baked.ok) return;
    if (shells !== null) shells.dispose();
    if (model !== null) {
      stage.machineGroup.remove(model.root);
      model.dispose();
    }
    state = setMachine(state, machine);
    model = buildModel(machine);
    stage.machineGroup.add(model.root);
    placer = createPartPlacer(model.partsById, baked.parts);
    shells = createShells(model.root, state.look);
    placer.placeAtAmount(state.explode);
    stage.setView(state);
    layout.setCurrentMachine(machine);
    layout.setParts(machineParts(CATALOGUE, machine), null);
    layout.setMotionCheck(baked.tours.get(machine)?.findingLines ?? []);
    applySelection();
  }

  showMachine(state.machine);
}

try {
  start();
} catch (error) {
  const text = error instanceof Error ? error.message : String(error);
  const holder = document.getElementById('stage') ?? document.getElementById('app') ?? document.body;
  showStageMessage(holder, `Skeleton Bench could not start: ${text}. Reload the page. If it keeps failing, report this message.`);
}
