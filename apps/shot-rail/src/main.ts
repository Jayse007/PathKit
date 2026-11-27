// Entry point (task 29.1): the empty stage. A 16:9 frame with a ground grid, seen through the first
// sample shot's camera at displayed frame 0, and a lens menu so the field of view can be checked.

import { CAMERA_IDS, LENS_PRESETS_MM } from './logic/constants.js';
import { DEFAULT_ROAD_POINTS } from './logic/default-road.js';
import { SAMPLE_SHOTS } from './logic/samples.js';
import { CameraRig } from './view/camera-rig.js';
import type { RigSettings } from './view/camera-rig.js';
import { createAuxRenderer } from './view/aux-renderer.js';
import { createGuideToggle, createGuidesOverlay } from './view/guides-view.js';
import { createMainView } from './view/main-view.js';
import { createStageOverview } from './view/stage-overview.js';
import { createSubjectView } from './view/subject-view.js';

const CAMERA_ID = 'cam-1';
const DISPLAYED_FRAME = 0;

function start(): void {
  const stage = document.getElementById('stage');
  const lensSelect = document.getElementById('lens') as HTMLSelectElement | null;
  const status = document.getElementById('status');
  if (stage === null || lensSelect === null || status === null) {
    throw new Error('index.html is missing #stage, #lens or #status');
  }

  const sample = SAMPLE_SHOTS[0];
  const settings: RigSettings = {
    shotLengthFrames: sample.shotLengthFrames,
    mainCameraId: CAMERA_ID,
    // cam-1 is the main camera. The other sample shots (push-in, crane) are extra cameras so that the
    // Stage_Overview shows their rails. Remove them when the camera list (task 35) takes over.
    cameras: SAMPLE_SHOTS.slice(0, 3).map((s, i) => ({
      id: CAMERA_IDS[i],
      shotType: s.shotType,
      ...s.placement,
    })),
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

  const overviewBox = document.getElementById('overview');
  if (overviewBox !== null) {
    const aux = createAuxRenderer();
    if (aux.renderer === null) {
      overviewBox.textContent = `The overview could not start: this browser could not create a WebGL context (${aux.reason}).`;
    } else {
      const overview = createStageOverview(overviewBox, aux.renderer, settings.road.points);
      if (overview !== null) {
        overview.setLayout(rig, settings);
        overview.showFrame(rig, DISPLAYED_FRAME);
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
