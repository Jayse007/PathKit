// Render core (Task 17.1): renderer, stage, bench grid, camera from the baked blend, view offset,
// and a render-on-change loop. No machine models yet (Task 17.3).
//
// The per-frame path (draw) allocates nothing: it reads the baked laps through blendCamera into a
// preallocated blender, then calls position.set / quaternion.set / setViewOffset on existing objects.
// Allocation happens only in createStage (setup) and on the failure path.
import {
  Color,
  GridHelper,
  Group,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type LineBasicMaterial,
} from 'three';
import type { BakedData } from '../pathkit-api.js';
import { blendCamera, createCameraBlender } from '../pathkit/camera-blend.js';
import { angleToFrame } from '../logic/frame-mapper.js';
import { fractionToPixels } from '../logic/drag-range.js';
import type { AppState } from '../state.js';
import {
  CAMERA_FAR,
  CAMERA_FOV_DEG,
  CAMERA_NEAR,
  STAGE_GRID_COLOUR,
  STAGE_GRID_DIVISIONS,
  STAGE_GRID_OPACITY,
  STAGE_GRID_SIZE_M,
  STAGE_GRID_Y,
  STAGE_MAX_PIXEL_RATIO,
} from '../constants.js';

/** The part of the app state the stage draws from. */
export type StageView = Pick<AppState, 'orbitAngleDeg' | 'zoom' | 'offsetX' | 'offsetY'>;

export interface Stage {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** Parent of every Machine object. Later tasks add the models here. */
  readonly machineGroup: Group;
  readonly canvas: HTMLCanvasElement;
  /** Store a new view and schedule one draw. Allocates nothing. */
  setView(view: StageView): void;
  /** Schedule one draw (for example after a model or Look change). Allocates nothing. */
  requestRender(): void;
  /** Stop the loop, release the renderer and remove the canvas. */
  dispose(): void;
}

export type StageResult =
  | { readonly ok: true; readonly stage: Stage }
  | { readonly ok: false; readonly message: string };

export const WEBGL_FAILURE_MESSAGE =
  'Skeleton Bench needs WebGL to draw the 3D view, and this browser could not start it. ' +
  'Try another browser, or turn on hardware acceleration in the browser settings, then reload the page.';

/** Show a failure message inside the container (a text node, no HTML parsing). */
export function showStageMessage(container: HTMLElement, message: string): void {
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.textContent = message;
  box.style.padding = '16px';
  box.style.maxWidth = '40em';
  container.appendChild(box);
}

/**
 * Create the stage inside `container`. Needs the baked laps from bakeLaps().
 * If WebGL cannot start, the message is shown in the container and { ok: false } is returned.
 */
export function createStage(container: HTMLElement, laps: readonly BakedData[]): StageResult {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true });
  } catch {
    showStageMessage(container, WEBGL_FAILURE_MESSAGE);
    return { ok: false, message: WEBGL_FAILURE_MESSAGE };
  }

  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, STAGE_MAX_PIXEL_RATIO));

  const scene = new Scene();
  scene.background = new Color(0xf4f4f4);

  const grid = new GridHelper(STAGE_GRID_SIZE_M, STAGE_GRID_DIVISIONS, STAGE_GRID_COLOUR, STAGE_GRID_COLOUR);
  grid.position.y = STAGE_GRID_Y;
  const gridMaterial = grid.material as LineBasicMaterial;
  gridMaterial.transparent = true;
  gridMaterial.opacity = STAGE_GRID_OPACITY;
  scene.add(grid);

  const machineGroup = new Group();
  machineGroup.name = 'machine';
  scene.add(machineGroup);

  const camera = new PerspectiveCamera(CAMERA_FOV_DEG, 1, CAMERA_NEAR, CAMERA_FAR);
  const blender = createCameraBlender();

  // Current view and size. Plain numbers, changed in place.
  let orbitAngleDeg = 0;
  let zoom = 0;
  let offsetX = 0;
  let offsetY = 0;
  let width = 1;
  let height = 1;
  let rafId = 0;
  let pending = false;
  let disposed = false;

  function applySize(): void {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
  }

  // Draws one picture. No allocation: blendCamera writes into the preallocated blender,
  // and set() / setViewOffset() change existing objects.
  function draw(): void {
    blendCamera(laps, angleToFrame(orbitAngleDeg), zoom, blender);
    camera.position.set(blender.position.x, blender.position.y, blender.position.z);
    camera.quaternion.set(blender.rotation.x, blender.rotation.y, blender.rotation.z, blender.rotation.w);
    camera.updateMatrixWorld(true);
    if (offsetX === 0 && offsetY === 0) {
      camera.clearViewOffset();
    } else {
      // Spike S4: shifting the sub-window by -d moves the picture by +d.
      camera.setViewOffset(
        width,
        height,
        -fractionToPixels(offsetX, width),
        -fractionToPixels(offsetY, height),
        width,
        height,
      );
    }
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  // Created once. Each call draws one picture and stops until the next change.
  const tick = (): void => {
    pending = false;
    if (disposed) return;
    draw();
  };

  function requestRender(): void {
    if (pending || disposed) return;
    pending = true;
    rafId = requestAnimationFrame(tick);
  }

  function setView(view: StageView): void {
    orbitAngleDeg = view.orbitAngleDeg;
    zoom = view.zoom;
    offsetX = view.offsetX;
    offsetY = view.offsetY;
    requestRender();
  }

  const observer = new ResizeObserver(() => {
    applySize();
    requestRender();
  });
  observer.observe(container);

  applySize();
  requestRender();

  function dispose(): void {
    disposed = true;
    cancelAnimationFrame(rafId);
    observer.disconnect();
    grid.geometry.dispose();
    gridMaterial.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return {
    ok: true,
    stage: { scene, camera, machineGroup, canvas, setView, requestRender, dispose },
  };
}
