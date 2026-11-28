// Entry point (task 29.1, extended by task 34.1): a 16:9 frame with a ground grid, seen through the main
// camera of the first sample shots, a lens menu so the field of view can be checked, and the Timeline.
// The Timeline decides which displayed frame is shown; the main view, the car, the overview and the grid
// all follow it.

import { CAMERA_IDS, LENS_PRESETS_MM } from './logic/constants.js';
import { DEFAULT_ROAD_POINTS } from './logic/default-road.js';
import { lensAfterWheel, presetOf } from './logic/lens-zoom.js';
import { SAMPLE_SHOTS } from './logic/samples.js';
import { CameraRig } from './view/camera-rig.js';
import type { RigSettings } from './view/camera-rig.js';
import { createAuxRenderer } from './view/aux-renderer.js';
import { createCoverageGrid } from './view/coverage-grid.js';
import type { CoverageGrid } from './view/coverage-grid.js';
import { planMainChange } from './view/coverage-grid-rules.js';
import type { GridMode } from './view/coverage-grid-rules.js';
import { createGuideToggle, createGuidesOverlay } from './view/guides-view.js';
import { createMainView } from './view/main-view.js';
import { createStageOverview } from './view/stage-overview.js';
import type { StageOverview } from './view/stage-overview.js';
import { createSubjectView } from './view/subject-view.js';
import { createTimeline } from './view/timeline.js';
import type { TimelineTick } from './view/timeline.js';

const CAMERA_ID = 'cam-1';
const MODE: GridMode = 'angle'; // Move mode does not exist yet; the grid draws in Angle mode only

function start(): void {
  const stage = document.getElementById('stage');
  const timelineBox = document.getElementById('timeline');
  const lensSelect = document.getElementById('lens') as HTMLSelectElement | null;
  const status = document.getElementById('status');
  if (stage === null || timelineBox === null || lensSelect === null || status === null) {
    throw new Error('index.html is missing #stage, #timeline, #lens or #status');
  }

  const sample = SAMPLE_SHOTS[1]; // the push-in
  const settings: RigSettings = {
    shotLengthFrames: sample.shotLengthFrames,
    mainCameraId: CAMERA_ID,
    // cam-1 is the main camera and is the push-in sample, so the Stage_Overview shows its rail. Only the main
    // camera can be a rail shot (scene-set.ts), so cam-2 is the orbit sample. Remove both when the camera list
    // (task 35) takes over.
    cameras: [
      { id: CAMERA_IDS[0], shotType: sample.shotType, ...sample.placement },
      { id: CAMERA_IDS[1], shotType: SAMPLE_SHOTS[0].shotType, ...SAMPLE_SHOTS[0].placement },
    ],
    road: { points: DEFAULT_ROAD_POINTS.map((p) => ({ x: p.x, y: p.y, z: p.z })), closed: true },
    subjectKind: 'car',
  };

  for (const mm of LENS_PRESETS_MM) {
    const option = document.createElement('option');
    option.value = String(mm);
    option.textContent = `${mm} mm`;
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
      'Show or hide the rule-of-thirds lines. Key: T',
    );
    const safeAreaInput = createGuideToggle(
      guidesBox,
      'guide-safe',
      'Safe area (G)',
      'Show or hide the safe-area rectangle. Key: G',
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

  // Draws everything at the Timeline's displayed frame. Evaluates baked data only; it never bakes.
  // Created once. While playing the grid is redrawn at 10 Hz (shouldRenderGrid); every other change redraws it.
  const showAt = (tick: Readonly<TimelineTick>): void => {
    view.showFrame(rig, current.mainCameraId, tick.frame);
    subjectView.showFrame(rig, tick.frame);
    if (overview !== null) overview.showFrame(rig, tick.frame);
    if (
      grid !== null &&
      grid.render(rig, tick.frame, MODE, tick.gridChanged, tick.playing, tick.nowMs - lastGridDrawMs)
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

  // Applies a lens to the main camera: the view, `current` (a new camera object; the rig's settings are not
  // touched and nothing is re-baked, because the lens does not change the move), the grid tile, and the lens
  // menu. A lens that is not a preset shows a disabled "Custom (N mm)" option, created once and reused.
  let customOption: HTMLOptionElement | null = null;
  const applyMainLens = (mm: number): void => {
    const mainId = current.mainCameraId;
    view.setLensMm(mm);
    current = { ...current, cameras: current.cameras.map((c) => (c.id === mainId ? { ...c, lensMm: mm } : c)) };
    if (grid !== null) {
      grid.setLensMm(mainId, mm);
      grid.render(rig, timeline.frame(), MODE, true, false, 0);
    }
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
    const frame = timeline.frame();
    view.showFrame(rig, id, frame);
    if (overview !== null) {
      overview.setLayout(rig, next);
      overview.showFrame(rig, frame);
    }
    if (grid !== null) {
      grid.setMain(id);
      grid.render(rig, frame, MODE, true, false, 0);
    }
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
        grid.render(rig, timeline.frame(), MODE, true, false, 0);
      }
    }
  }

  view.setLensMm(sample.placement.lensMm);
  view.showFrame(rig, current.mainCameraId, timeline.frame());

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
