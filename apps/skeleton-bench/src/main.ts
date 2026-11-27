// App entry (Task 20.2): builds the layout and shows the Pump on the Stage at start (Requirements 15.4, 21.1).
// Task 20.2 added the layout, the Inventory, the Inspector, the Parts_List and the Motion_Check text.
// Task 20.4 adds the Control_Bar controls, drag (Rotate / Move), wheel, keys and Escape.
import { CLICK_THRESHOLD_PX, EXPLODE_TOGGLE_MS } from './constants.js';
import { explodeAnimationAmount, explodeToggleTarget } from './logic/explode-animation.js';
import { activeElementKind } from './logic/shortcut-guard.js';
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
import { createClickTracker } from './logic/click-tracker.js';
import { collectPartMeshes, createPicker } from './render/picking.js';
import type { Picker } from './render/picking.js';
import {
  createInitialState,
  isTourPlaying,
  selectPart,
  setExplode,
  setMachine,
  setOffset,
  setOrbitAngle,
  setZoom,
  toggleMode,
} from './state.js';
import type { AppState } from './state.js';
import {
  keyToAction,
  moveKeyStep,
  orbitAngleFromDrag,
  orbitKeyStep,
  zoomKeyStep,
  zoomWheelStep,
} from './ui/input.js';
import { findMachinePart, machineParts, selectionAfterStageClick, togglePartSelection } from './ui/inspector-text.js';
import { createLayout } from './ui/layout.js';
import { hasSeenHint, loadLook, markHintSeen } from './ui/storage.js';

const MODE_HINTS = {
  rotate:
    'Rotate mode: drag the Stage to turn the Machine, or press the left and right arrow keys. Press M to switch to Move mode.',
  move:
    'Move mode: drag the Stage to slide the Machine, or press the arrow keys. Press R to put it back. Press M to switch to Rotate mode.',
} as const;

function start(): void {
  const root = document.getElementById('app');
  if (root === null) {
    throw new Error('Skeleton Bench: the page has no #app element. Reload the page.');
  }

  let state: AppState = createInitialState(loadLook());
  let model: MachineModel | null = null;
  let shells: Shells | null = null;
  let placer: PartPlacer | null = null;
  let picker: Picker | null = null;
  let redraw: () => void = () => undefined;
  // False until the stage exists. The controls do nothing before that.
  let ready = false;

  // Explode toggle animation (key E): plain numbers, changed in place.
  let explodeTarget = state.explode;
  let animActive = false;
  let animFrom = 0;
  let animTo = 0;
  let animStartMs = 0;
  let animFrameId = 0;

  const layout = createLayout(document, root, CATALOGUE, {
    onModeToggle: () => {
      if (ready) switchMode();
    },
    onOrbitScrub: (angleDeg) => {
      if (ready) commit(setOrbitAngle(state, angleDeg));
    },
    onZoomSlider: (zoom) => {
      if (ready) commit(setZoom(state, zoom));
    },
    onExplodeSlider: (percent) => {
      if (!ready) return;
      cancelExplodeAnimation();
      explodeTarget = percent;
      applyExplodeAmount(percent);
    },
    onResetPosition: () => {
      if (ready) commit(setOffset(state, 0, 0));
    },
    onMachine: (machine) => showMachine(machine),
    onPartActivate: (partId) => {
      state = selectPart(state, togglePartSelection(state.selectedPart, partId));
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
    layout.setControls(state);
    layout.setCurrentMachine(state.machine);
    layout.setParts(machineParts(CATALOGUE, state.machine), null);
    layout.setSelected(null);
    return;
  }

  const created = createStage(layout.stageHost, baked.laps);
  if (!created.ok) {
    layout.setControls(state);
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
    cancelExplodeAnimation();
    state = setMachine(state, machine);
    explodeTarget = state.explode;
    model = buildModel(machine);
    stage.machineGroup.add(model.root);
    placer = createPartPlacer(model.partsById, baked.parts);
    // The mesh list is collected before the shells are added (picking.ts).
    picker = createPicker(stage.camera, stage.scene, collectPartMeshes(model.root));
    shells = createShells(model.root, state.look);
    placer.placeAtAmount(state.explode);
    stage.setView(state);
    layout.setControls(state);
    layout.setCurrentMachine(machine);
    layout.setParts(machineParts(CATALOGUE, machine), null);
    layout.setMotionCheck(baked.tours.get(machine)?.findingLines ?? []);
    applySelection();
  }

  /** Store a new state (a rejected change returns the same object), redraw and update the controls. */
  function commit(next: AppState): void {
    state = next;
    stage.setView(state);
    layout.setControls(state);
  }

  /** Set the Explode_Amount and move the Parts. Used by the slider, the key E animation and reduced motion. */
  function applyExplodeAmount(percent: number): void {
    commit(setExplode(state, percent));
    if (placer !== null) placer.placeAtAmount(state.explode);
  }

  function cancelExplodeAnimation(): void {
    if (animActive) cancelAnimationFrame(animFrameId);
    animActive = false;
  }

  // Created once. Each call moves the amount one step along the straight line (no allocation of its own).
  const animateExplode = (now: number): void => {
    if (!animActive) return;
    const elapsed = now - animStartMs;
    applyExplodeAmount(explodeAnimationAmount(animFrom, animTo, elapsed, EXPLODE_TOGGLE_MS));
    if (elapsed >= EXPLODE_TOGGLE_MS) {
      animActive = false;
    } else {
      animFrameId = requestAnimationFrame(animateExplode);
    }
  };

  /** Key E: toggle 0 and 100 with a 600 ms animation, or jump under reduced motion (Requirement 13.7). */
  function toggleExplode(): void {
    if (isTourPlaying(state)) return;
    cancelExplodeAnimation();
    explodeTarget = explodeToggleTarget(explodeTarget);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      applyExplodeAmount(explodeTarget);
      return;
    }
    animFrom = state.explode;
    animTo = explodeTarget;
    animStartMs = performance.now();
    animActive = true;
    animFrameId = requestAnimationFrame(animateExplode);
  }

  /** Show the first-use hint for a mode once, and remember that it was seen (Requirement 21.4). */
  function showModeHint(): void {
    const id = state.mode;
    if (hasSeenHint(id)) {
      layout.setHint('');
      return;
    }
    layout.setHint(MODE_HINTS[id]);
    markHintSeen(id);
  }

  function switchMode(): void {
    commit(toggleMode(state));
    showModeHint();
  }

  // Keys (Requirements 10.3, 11.1, 12.1, 12.3, 12.5, 12.9, 13.1, 14.13). Handled in one place; the guard ignores
  // keys while a text field, select or slider has focus.
  document.addEventListener('keydown', (event) => {
    const action = keyToAction(event, activeElementKind(document.activeElement));
    if (action === null) return;
    switch (action) {
      case 'toggle-mode':
        if (!event.repeat) switchMode();
        break;
      case 'toggle-explode':
        if (!event.repeat) toggleExplode();
        break;
      case 'reset-position':
        commit(setOffset(state, 0, 0));
        break;
      case 'zoom-in':
        commit(setZoom(state, zoomKeyStep(state.zoom, 1)));
        break;
      case 'zoom-out':
        commit(setZoom(state, zoomKeyStep(state.zoom, -1)));
        break;
      case 'clear-selection':
        state = selectPart(state, null);
        applySelection();
        break;
      case 'arrow-left':
      case 'arrow-right':
      case 'arrow-up':
      case 'arrow-down': {
        const direction = action.slice('arrow-'.length) as 'left' | 'right' | 'up' | 'down';
        if (state.mode === 'move') {
          const next = moveKeyStep(state.offsetX, state.offsetY, direction, state.explode);
          commit(setOffset(state, next.x, next.y));
        } else if (direction === 'left' || direction === 'right') {
          commit(setOrbitAngle(state, orbitKeyStep(state.orbitAngleDeg, direction)));
        } else {
          return; // Up and down do nothing in Rotate mode, so the page may scroll as usual.
        }
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  });

  // Stage pointer: click selects or clears (Requirement 14.13); a drag rotates or moves (Requirements 10.1, 12.2).
  // The drag starts after the pointer leaves the click radius, and the start values are taken at that moment.
  const tracker = createClickTracker();
  const canvas = stage.canvas;
  canvas.style.touchAction = 'none';
  let pressX = 0;
  let pressY = 0;
  let dragging = false;
  let dragStartAngle = 0;
  let dragStartOffsetX = 0;
  let dragStartOffsetY = 0;
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    tracker.press(event.clientX, event.clientY);
    pressX = event.clientX;
    pressY = event.clientY;
    dragging = false;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    tracker.move(event.clientX, event.clientY);
    if (!tracker.active) return;
    if (!dragging) {
      if (Math.hypot(event.clientX - pressX, event.clientY - pressY) <= CLICK_THRESHOLD_PX) return;
      dragging = true;
      pressX = event.clientX;
      pressY = event.clientY;
      dragStartAngle = state.orbitAngleDeg;
      dragStartOffsetX = state.offsetX;
      dragStartOffsetY = state.offsetY;
      return;
    }
    const dx = event.clientX - pressX;
    const dy = event.clientY - pressY;
    if (state.mode === 'rotate') {
      commit(setOrbitAngle(state, orbitAngleFromDrag(dragStartAngle, dx)));
    } else {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      commit(setOffset(state, dragStartOffsetX + dx / width, dragStartOffsetY + dy / height));
    }
  });
  canvas.addEventListener('pointercancel', () => {
    tracker.cancel();
    dragging = false;
  });
  // Wheel zooms (Requirement 11.1). Not passive, so the page does not scroll.
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      commit(setZoom(state, zoomWheelStep(state.zoom, event.deltaY)));
    },
    { passive: false },
  );
  canvas.addEventListener('pointerup', (event) => {
    if (event.button !== 0) return;
    dragging = false;
    if (tracker.release(event.clientX, event.clientY) !== 'click') return;
    if (picker === null) return;
    const id = picker.pickClient(event.clientX, event.clientY, canvas);
    state = selectPart(state, selectionAfterStageClick(state.selectedPart, id));
    applySelection();
  });

  ready = true;
  showMachine(state.machine);
  showModeHint();
}

try {
  start();
} catch (error) {
  const text = error instanceof Error ? error.message : String(error);
  const holder = document.getElementById('stage') ?? document.getElementById('app') ?? document.body;
  showStageMessage(holder, `Skeleton Bench could not start: ${text}. Reload the page. If it keeps failing, report this message.`);
}
