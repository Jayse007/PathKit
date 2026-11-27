// Entry point (task 29.1): the empty stage. A 16:9 frame with a ground grid, seen through the first
// push-in sample shot's camera at displayed frame 0, and a lens menu so the field of view can be checked.

import { CAMERA_IDS, LENS_PRESETS_MM } from './logic/constants.js';
import { DEFAULT_ROAD_POINTS } from './logic/default-road.js';
import { SAMPLE_SHOTS } from './logic/samples.js';
import { CameraRig } from './view/camera-rig.js';
import type { RigSettings } from './view/camera-rig.js';
import { createAuxRenderer } from './view/aux-renderer.js';
import { createCoverageGrid } from './view/coverage-grid.js';
import type { CoverageGrid } from './view/coverage-grid.js';
import type { GridMode } from './view/coverage-grid-rules.js';
import { createGuideToggle, createGuidesOverlay } from './view/guides-view.js';
import { createMainView } from './view/main-view.js';
import { createStageOverview } from './view/stage-overview.js';
import type { StageOverview } from './view/stage-overview.js';
import { createSubjectView } from './view/subject-view.js';

const CAMERA_ID = 'cam-1';
const DISPLAYED_FRAME = 0;
const MODE: GridMode = 'angle'; // Move mode does not exist yet; the grid draws in Angle mode only

function start(): void {
  const stage = document.getElementById('stage');
  const lensSelect = document.getElementById('lens') as HTMLSelectElement | null;
  const status = document.getElementById('status');
  if (stage === null || lensSelect === null || status === null) {
    throw new Error('index.html is missing #stage, #lens or #status');
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
  subjectView.showFrame(rig, DISPLAYED_FRAME);

  // The overview and the grid share one auxiliary renderer; each copies its image out right after it draws.
  const overviewBox = document.getElementById('overview');
  const gridBox = document.getElementById('grid');
  let overview: StageOverview | null = null;
  let grid: CoverageGrid | null = null;
  let current: RigSettings = settings;

  // A tile click or Enter asks for a new Main_Camera. Only the main camera can be a rail shot
  // (scene-set.ts), so the change is refused, with a message, while any other camera is a rail shot.
  // The rig is not touched in that case, so the app never builds an invalid camera set.
  const onSelect = (id: string): void => {
    if (id === current.mainCameraId) return;
    const rail = current.cameras.find((c) => c.id !== id && (c.shotType === 'push-in' || c.shotType === 'crane'));
    if (rail !== undefined) {
      status.textContent =
        `${id} cannot be the main camera yet: ${rail.id} is a ${rail.shotType} shot, and only the main camera can be a rail shot. ` +
        `Change ${rail.id} to an orbit shot first.`;
      return;
    }
    const next: RigSettings = { ...current, mainCameraId: id };
    rig.setSettings(next);
    const result = rig.tick();
    if (result === null || !result.ok) {
      status.textContent = `${id} could not be made the main camera: ${result?.message ?? 'no settings'}`;
      rig.setSettings(current); // the pending settings must not stay on the failed ones
      rig.tick();
      return;
    }
    current = next;
    status.textContent = '';
    const camera = next.cameras.find((c) => c.id === id);
    if (camera !== undefined) {
      view.setLensMm(camera.lensMm);
      lensSelect.value = String(camera.lensMm);
    }
    view.showFrame(rig, id, DISPLAYED_FRAME);
    if (overview !== null) {
      overview.setLayout(rig, next);
      overview.showFrame(rig, DISPLAYED_FRAME);
    }
    if (grid !== null) {
      grid.setMain(id);
      grid.render(rig, DISPLAYED_FRAME, MODE, true, false, 0);
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
          overview.showFrame(rig, DISPLAYED_FRAME);
        }
      }
      if (gridBox !== null) {
        grid = createCoverageGrid(gridBox, aux.renderer, settings.road.points, onSelect);
        grid.setLayout(settings);
        grid.render(rig, DISPLAYED_FRAME, MODE, true, false, 0);
      }
    }
  }

  view.setLensMm(sample.placement.lensMm);
  view.showFrame(rig, CAMERA_ID, DISPLAYED_FRAME);

  lensSelect.addEventListener('change', () => {
    view.setLensMm(Number(lensSelect.value));
  });
}

start();
