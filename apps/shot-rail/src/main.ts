// Entry point (task 29.1, extended by task 34.1): a 16:9 frame with a ground grid, seen through the main
// camera of the first sample shots, a lens menu so the field of view can be checked, and the Timeline.
// The Timeline decides which displayed frame is shown; the main view, the car, the overview and the grid
// all follow it.

import { LENS_KEY_STEP_RATIO, LENS_PRESETS_MM } from './logic/constants.js';
import { DEFAULT_ROAD_POINTS } from './logic/default-road.js';
import { lensAfterWheel, presetOf, stepLens } from './logic/lens-zoom.js';
import { motionCheckFailureOf } from './logic/motion-check-model.js';
import { SAMPLE_SHOTS } from './logic/samples.js';
import { LENS_TERMS, MEASURE_TERMS } from './logic/term-text.js';
import { CameraRig } from './view/camera-rig.js';
import type { RigSettings } from './view/camera-rig.js';
import { createAuxRenderer } from './view/aux-renderer.js';
import { createCoverageGrid } from './view/coverage-grid.js';
import type { CoverageGrid } from './view/coverage-grid.js';
import { planMainChange } from './view/coverage-grid-rules.js';
import type { GridMode } from './view/coverage-grid-rules.js';
import { createControls } from './view/controls.js';
import type { Controls } from './view/controls.js';
import { withShotType } from './view/controls-rules.js';
import { createGuideToggle, createGuidesOverlay } from './view/guides-view.js';
import { createKeyboard } from './view/keyboard.js';
import { nextLensPreset, nextShotType } from './view/keyboard-rules.js';
import { applyLayout } from './view/layout.js';
import { createMainView } from './view/main-view.js';
import { createMotionCheck } from './view/motion-check.js';
import type { MotionCheck } from './view/motion-check.js';
import { createReadout } from './view/readout.js';
import type { Readout } from './view/readout.js';
import { createSamplesMenu } from './view/samples-menu.js';
import { STARTUP_SAMPLE_INDEX, sampleLoadedMessage, sampleToSettings } from './view/samples-menu-rules.js';
import { createStageOverview } from './view/stage-overview.js';
import type { StageOverview } from './view/stage-overview.js';
import { createSubjectView } from './view/subject-view.js';
import { createTimeline } from './view/timeline.js';
import type { TimelineTick } from './view/timeline.js';

const MODE_CHANGED_MESSAGE = 'Mode changed. The camera grid is drawn in Angle mode only.';
const GRID_MOVE_MESSAGE = 'Camera views are shown in Angle mode (key A).';
const NO_SLOT_MESSAGE_PREFIX = 'There is no camera in slot';
const SHOT_CHANGED_PREFIX = 'The change could not be applied';

function start(): void {
  applyLayout(); // region messages, term titles and the focus hint line (task 36.1)
  const stage = document.getElementById('stage');
  const timelineBox = document.getElementById('timeline');
  const lensSelect = document.getElementById('lens') as HTMLSelectElement | null;
  const status = document.getElementById('status');
  if (stage === null || timelineBox === null || lensSelect === null || status === null) {
    throw new Error('index.html is missing #stage, #timeline, #lens or #status');
  }

  // The app starts with the first sample (task 40.1): one camera, the main camera, paused at frame 0.
  const sample = SAMPLE_SHOTS[STARTUP_SAMPLE_INDEX];
  const settings: RigSettings = sampleToSettings(sample, DEFAULT_ROAD_POINTS, 'car');

  for (const mm of LENS_PRESETS_MM) {
    const option = document.createElement('option');
    option.value = String(mm);
    option.textContent = `${mm} mm`;
    const lensLine = LENS_TERMS[mm];
    if (lensLine !== undefined) option.title = lensLine.text;
    option.selected = mm === sample.placement.lensMm;
    lensSelect.appendChild(option);
  }

  const view = createMainView(stage);
  if (view === null) {
    lensSelect.disabled = true;
    return;
  }

  const guidesBox = document.getElementById('guides');
  if (guidesBox !== null) {
    const thirdsInput = createGuideToggle(
      guidesBox,
      'guide-thirds',
      'Thirds (T)',
      MEASURE_TERMS.thirdsGuide.text,
    );
    const safeAreaInput = createGuideToggle(
      guidesBox,
      'guide-safe',
      'Safe area (G)',
      MEASURE_TERMS.safeAreaGuide.text,
    );
    createGuidesOverlay(stage, { thirdsInput, safeAreaInput });
  }

  const rig = new CameraRig();
  rig.setSettings(settings);
  const outcome = rig.tick();
  if (outcome === null || !outcome.ok) {
    status.textContent = `The camera move could not be built: ${outcome?.message ?? 'no settings'}`;
    lensSelect.disabled = true;
    return;
  }

  const subjectView = createSubjectView(settings.road.points);
  view.addObject(subjectView.object);

  // The overview and the grid share one auxiliary renderer; each copies its image out right after it draws.
  const overviewBox = document.getElementById('overview');
  const gridBox = document.getElementById('grid');
  let overview: StageOverview | null = null;
  let grid: CoverageGrid | null = null;
  let current: RigSettings = settings;
  let lastGridDrawMs = 0;
  let mode: GridMode = 'angle'; // Move mode only changes what the grid does so far: it draws in Angle mode only
  let controls: Controls | null = null;
  let readout: Readout | null = null; // created once the Timeline exists (task 38.1)
  let mainLensMm: number = sample.placement.lensMm; // the main camera's lens; applyMainLens keeps it current
  let motionCheck: MotionCheck | null = null; // created after the readout (task 39.1); updated after each re-bake only

  // Draws everything at the Timeline's displayed frame. Evaluates baked data only; it never bakes.
  // Created once. While playing the grid is redrawn at 10 Hz (shouldRenderGrid); every other change redraws it.
  const showAt = (tick: Readonly<TimelineTick>): void => {
    view.showFrame(rig, current.mainCameraId, tick.frame);
    subjectView.showFrame(rig, tick.frame);
    if (overview !== null) overview.showFrame(rig, tick.frame);
    // The readout is cheap and writes text only when a shown value changes, so it follows every frame
    // (up to 30 a second while playing) and not only the grid's 10 Hz redraw.
    if (readout !== null) readout.show(rig, current.mainCameraId, mainLensMm, tick.frame);
    if (
      grid !== null &&
      grid.render(rig, tick.frame, mode, tick.gridChanged, tick.playing, tick.nowMs - lastGridDrawMs)
    ) {
      lastGridDrawMs = tick.nowMs;
    }
  };

  // Starts paused at frame 0 and never starts by itself (requirements 11.13, 11.14).
  const timeline = createTimeline(timelineBox, {
    rig,
    shotLengthFrames: settings.shotLengthFrames,
    findings: rig.findingsForMain(),
    onChange: showAt,
  });
  subjectView.showFrame(rig, timeline.frame());

  readout = createReadout(document.getElementById('readout-column'));
  if (readout !== null) readout.show(rig, current.mainCameraId, mainLensMm, timeline.frame());

  // The motion check list goes below the readout in the same column. Activating a finding calls the
  // Timeline's seekTo, which pauses and never starts playback.
  motionCheck = createMotionCheck(document.getElementById('readout-column'), {
    onActivate: (frame: number) => timeline.seekTo(frame),
  });
  if (motionCheck !== null) motionCheck.update(rig.findingsForMain(), motionCheckFailureOf(outcome.message));

  // Applies a lens to the main camera: the view, `current` (a new camera object; the rig's settings are not
  // touched and nothing is re-baked, because the lens does not change the move), the grid tile, and the lens
  // menu. A lens that is not a preset shows a disabled "Custom (N mm)" option, created once and reused.
  let customOption: HTMLOptionElement | null = null;
  const applyMainLens = (mm: number): void => {
    const mainId = current.mainCameraId;
    view.setLensMm(mm);
    current = { ...current, cameras: current.cameras.map((c) => (c.id === mainId ? { ...c, lensMm: mm } : c)) };
    mainLensMm = mm;
    // The frame is clamped to the current shot: after a re-bake with a shorter shot the Timeline has not
    // been told yet (setShot comes after this call), so its frame may be past the new last frame.
    if (readout !== null) {
      readout.show(rig, mainId, mm, Math.min(timeline.frame(), current.shotLengthFrames - 1));
    }
    if (grid !== null) {
      grid.setLensMm(mainId, mm);
      grid.render(rig, timeline.frame(), mode, true, false, 0);
    }
    if (controls !== null) controls.setLens(mm);
    const preset = presetOf(mm);
    if (preset !== null) {
      lensSelect.value = String(preset);
      if (customOption !== null) customOption.hidden = true;
    } else {
      if (customOption === null) {
        customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.disabled = true;
        lensSelect.appendChild(customOption);
      }
      customOption.textContent = `Custom (${Math.round(mm)} mm)`;
      customOption.hidden = false;
      lensSelect.value = 'custom';
    }
  };

  // A tile click or Enter asks for a new Main_Camera. Only the main camera can be a rail shot
  // (scene-set.ts), so planMainChange converts any other push-in or crane camera to orbit and the
  // status line says so. If the rig cannot build the new set, the old settings are restored.
  // This is a re-bake, so playback is paused first (the rig also sets its own playing flag to false).
  const onSelect = (id: string): void => {
    if (id === current.mainCameraId) return;
    timeline.pause();
    const plan = planMainChange(current.cameras, id);
    const next: RigSettings = { ...current, mainCameraId: id, cameras: plan.cameras };
    rig.setSettings(next);
    const result = rig.tick();
    if (result === null || !result.ok) {
      status.textContent = `${id} could not be made the main camera: ${result?.message ?? 'no settings'}`;
      rig.setSettings(current); // the pending settings must not stay on the failed ones
      rig.tick();
      return;
    }
    current = next;
    status.textContent = plan.message;
    const camera = next.cameras.find((c) => c.id === id);
    if (camera !== undefined) applyMainLens(camera.lensMm); // the new main camera's own lens
    timeline.setShot(next.shotLengthFrames, rig.findingsForMain()); // pauses, new marks; the frame is kept
    if (motionCheck !== null) motionCheck.update(rig.findingsForMain(), motionCheckFailureOf(result.message));
    const frame = timeline.frame();
    view.showFrame(rig, id, frame);
    if (overview !== null) {
      overview.setLayout(rig, next);
      overview.showFrame(rig, frame);
    }
    if (grid !== null) {
      grid.setMain(id);
      grid.render(rig, frame, mode, true, false, 0);
    }
    if (controls !== null) controls.show(current);
  };

  // Applies new settings from the controls (task 37.1). Pauses first, re-bakes through the rig, then
  // redraws everything. `next` was built from `current`, which carries the zoomed lens, so a zoom is kept.
  // Returns false and restores the old settings when the rig cannot build the new set. Never starts playback.
  const applySettings = (next: RigSettings, message: string): boolean => {
    timeline.pause();
    rig.setSettings(next); // marks the rig dirty
    const result = rig.tick();
    if (result === null || !result.ok) {
      status.textContent = `${SHOT_CHANGED_PREFIX}: ${result?.message ?? 'no settings'}`;
      rig.setSettings(current); // the pending settings must not stay on the failed ones
      rig.tick();
      return false;
    }
    current = next;
    status.textContent = result.message === null ? message : `${message} ${result.message}`.trim();
    if (grid !== null) {
      grid.setLayout(next);
      grid.setMain(next.mainCameraId);
    }
    timeline.setShot(next.shotLengthFrames, rig.findingsForMain()); // pauses, new marks; the frame is kept
    if (motionCheck !== null) motionCheck.update(rig.findingsForMain(), motionCheckFailureOf(result.message));
    const frame = timeline.frame();
    const main = next.cameras.find((c) => c.id === next.mainCameraId);
    if (main !== undefined) applyMainLens(main.lensMm); // view, lens menu, slider and a grid redraw
    view.showFrame(rig, next.mainCameraId, frame);
    subjectView.showFrame(rig, frame);
    if (overview !== null) {
      overview.setLayout(rig, next);
      overview.showFrame(rig, frame);
    }
    if (controls !== null) controls.show(current);
    return true;
  };

  if (overviewBox !== null || gridBox !== null) {
    const aux = createAuxRenderer();
    if (aux.renderer === null) {
      const text = `could not start: this browser could not create a WebGL context (${aux.reason}).`;
      if (overviewBox !== null) overviewBox.textContent = `The overview ${text}`;
      if (gridBox !== null) gridBox.textContent = `The grid ${text}`;
    } else {
      if (overviewBox !== null) {
        overview = createStageOverview(overviewBox, aux.renderer, settings.road.points);
        if (overview !== null) {
          overview.setLayout(rig, settings);
          overview.showFrame(rig, timeline.frame());
        }
      }
      if (gridBox !== null) {
        grid = createCoverageGrid(gridBox, aux.renderer, settings.road.points, onSelect);
        grid.setLayout(settings);
        grid.render(rig, timeline.frame(), mode, true, false, 0);
      }
    }
  }

  view.setLensMm(sample.placement.lensMm);
  view.showFrame(rig, current.mainCameraId, timeline.frame());

  // Switches the mode: the Angle and Move buttons and the A and M keys all come here (the tabs are set too,
  // which does nothing when the click already set them). Move mode only stops the grid drawing, so far.
  // Move mode hides the tiles (their DOM is kept) and shows GRID_MOVE_MESSAGE; Angle mode shows the tiles
  // again and redraws them at once (changed = true), so a tile built or left stale while hidden is never seen.
  const gridMoveMessage = document.getElementById('grid-move-message');
  if (gridMoveMessage !== null) gridMoveMessage.textContent = GRID_MOVE_MESSAGE;
  const applyMode = (next: GridMode): void => {
    mode = next;
    status.textContent = MODE_CHANGED_MESSAGE;
    if (controls !== null) controls.setMode(next);
    if (grid !== null) {
      grid.setVisible(next === 'angle');
      if (gridMoveMessage !== null) gridMoveMessage.hidden = next === 'angle';
      grid.render(rig, timeline.frame(), mode, true, false, 0); // draws in Angle mode only (shouldRenderGrid)
    }
  };

  // The controls panel (task 37.1). Edits start from `current`, never from the rig's own copy.
  const controlsTop = document.getElementById('controls-top');
  const controlsAfterLens = document.getElementById('controls-after-lens');
  const lensField = document.getElementById('lens-field');
  if (controlsTop !== null && controlsAfterLens !== null && lensField !== null) {
    controls = createControls({
      topBox: controlsTop,
      afterLensBox: controlsAfterLens,
      lensField,
      mode,
      getSettings: () => current,
      onChange: applySettings,
      onSelectCamera: onSelect,
      onLens: applyMainLens,
      onMode: applyMode,
      onRefuse: (message: string) => {
        status.textContent = message;
      },
    });
  }

  // The samples menu (task 40.1). Loading builds new settings from the sample (nothing is changed in `current`;
  // the Road and the subject in use are kept) and goes through applySettings, which pauses, re-bakes, restores
  // the old settings on failure, and redraws everything including the lens. The Timeline then goes to frame 0,
  // which pauses and never starts playback (applySettings keeps the old frame, a sample starts at frame 0).
  const samplesBox = document.getElementById('samples-box');
  if (samplesBox !== null) {
    createSamplesMenu(samplesBox, {
      samples: SAMPLE_SHOTS,
      initialIndex: STARTUP_SAMPLE_INDEX,
      onLoad: (index: number): boolean => {
        const chosen = SAMPLE_SHOTS[index];
        const next = sampleToSettings(chosen, current.road.points, current.subjectKind);
        if (!applySettings(next, sampleLoadedMessage(chosen))) return false;
        timeline.seekTo(0);
        return true;
      },
    });
  }
  status.textContent = sampleLoadedMessage(sample);

  // The keyboard (task 37.2). Every handler takes the same path as the control it stands for.
  const mainCamera = (): RigSettings['cameras'][number] | undefined =>
    current.cameras.find((c) => c.id === current.mainCameraId);
  createKeyboard({
    timeline,
    onMode: applyMode,
    onSelectSlot: (index: number) => {
      const camera = current.cameras[index];
      if (camera === undefined) {
        status.textContent = `${NO_SLOT_MESSAGE_PREFIX} ${index + 1}.`;
        return;
      }
      onSelect(camera.id);
    },
    onCycleLens: () => {
      const main = mainCamera();
      if (main !== undefined) applyMainLens(nextLensPreset(main.lensMm));
    },
    onZoom: (direction: 1 | -1) => {
      const main = mainCamera();
      if (main !== undefined) applyMainLens(stepLens(main.lensMm, direction, LENS_KEY_STEP_RATIO));
    },
    onCycleShotType: () => {
      const main = mainCamera();
      if (main === undefined) return;
      const changed = withShotType(current, main.id, nextShotType(main.shotType));
      applySettings(changed.settings, changed.message); // pauses first, then re-bakes
    },
  });

  lensSelect.addEventListener('change', () => {
    applyMainLens(Number(lensSelect.value));
  });

  // Wheel over the main view zooms the lens (task 34.3). It never touches the frame or playback.
  stage.addEventListener(
    'wheel',
    (event: WheelEvent) => {
      event.preventDefault();
      const main = current.cameras.find((c) => c.id === current.mainCameraId);
      if (main === undefined) return;
      applyMainLens(lensAfterWheel(main.lensMm, event.deltaY));
    },
    { passive: false },
  );
}

start();
