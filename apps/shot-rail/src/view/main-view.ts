// Main view: one WebGLRenderer, one PerspectiveCamera, an empty stage (a ground grid only).
// Renders on change: nothing draws until requestRender() or showFrame() asks, and one animation frame
// is requested at most once at a time. Loads Three.js, so no test imports this file.
//
// Per-frame path (showFrame, draw): no objects, arrays or closures are created. The OutBuffer, the
// render callback and the camera are made once in createMainView.

import { GridHelper, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { Object3D } from 'three';
import type { OutBuffer } from '../logic/pathkit.js';
import { ASPECT_RATIO, DEVICE_PIXEL_RATIO_CAP, FILM_GAUGE } from '../logic/constants.js';
import type { CameraRig } from './camera-rig.js';

// View-only values (not in the design's Named constants table).
const GRID_SIZE_M = 200;
const GRID_DIVISIONS = 100; // 2 m cells
const NEAR_PLANE_M = 0.1;
const FAR_PLANE_M = 1000;
const BACKGROUND_COLOUR = 0x20242a;
const GRID_CENTRE_COLOUR = 0x8a93a0;
const GRID_LINE_COLOUR = 0x4a515c;

export interface MainView {
  /** Set the focal length in mm. Aspect stays 16/9 and the film gauge stays 36. Asks for a render. */
  setLensMm(focalLengthMm: number): void;
  /** Evaluate the camera at a displayed frame through the rig, place the camera, and ask for a render. */
  showFrame(rig: CameraRig, cameraId: string, displayedFrame: number): void;
  /** Add a Three.js object (for example a Group) to the stage scene. Does not ask for a render. */
  addObject(object: Object3D): void;
  /** Ask for one render on the next animation frame. Calls before it runs are merged. */
  requestRender(): void;
  /**
   * Draw the current camera state at once (not on the next animation frame) and return the canvas, or null
   * when the view has been disposed or lost its context. The caller must read the canvas (toBlob) in the
   * same task, because the drawing buffer is cleared after the browser composites it. Used by Capture.
   */
  renderNow(): HTMLCanvasElement | null;
  /** Stop observing and release the renderer. */
  dispose(): void;
}

/** Shows a plain message in `container`, replacing its content. Text only, never markup. */
function showMessage(container: HTMLElement, text: string): void {
  const p = document.createElement('p');
  p.setAttribute('role', 'alert');
  p.style.margin = '0';
  p.style.padding = '16px';
  p.style.color = '#f2f2f2';
  p.textContent = text;
  container.replaceChildren(p);
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Builds the main view inside `container` (a 16:9 box the caller sizes).
 * Returns null after showing a message when WebGL cannot start. The message says what failed and what to do.
 */
export function createMainView(container: HTMLElement): MainView | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true });
  } catch (e) {
    showMessage(
      container,
      `The 3D view could not start: this browser could not create a WebGL context (${errorText(e)}). ` +
        'Try another browser, turn on hardware acceleration in the browser settings, or update the graphics driver, then reload the page.',
    );
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DEVICE_PIXEL_RATIO_CAP));
  renderer.setClearColor(BACKGROUND_COLOUR);
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.replaceChildren(canvas);

  const scene = new Scene();
  scene.add(new GridHelper(GRID_SIZE_M, GRID_DIVISIONS, GRID_CENTRE_COLOUR, GRID_LINE_COLOUR));

  // Aspect first, then the focal length: setFocalLength reads the film height, which depends on the aspect.
  const camera = new PerspectiveCamera(50, ASPECT_RATIO, NEAR_PLANE_M, FAR_PLANE_M);
  camera.aspect = ASPECT_RATIO;
  camera.filmGauge = FILM_GAUGE;
  camera.setFocalLength(35);

  const out: OutBuffer = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };

  let pending = false;
  let disposed = false;

  // Created once. Reused for every animation-frame request.
  const draw = (): void => {
    pending = false;
    if (disposed) return;
    renderer.render(scene, camera);
  };

  const requestRender = (): void => {
    if (pending || disposed) return;
    pending = true;
    window.requestAnimationFrame(draw);
  };

  // Resize: set the drawing size from the box. Runs on a size change only, not per frame.
  const resize = (): void => {
    const width = container.clientWidth;
    if (width <= 0) return;
    const height = Math.round(width / ASPECT_RATIO);
    renderer.setSize(width, height, false);
    requestRender();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  canvas.addEventListener('webglcontextlost', (event: Event) => {
    event.preventDefault();
    disposed = true;
    showMessage(
      container,
      'The 3D view stopped: the browser lost the WebGL context (often a graphics driver reset or too many open tabs). Reload the page to start it again.',
    );
  });

  return {
    setLensMm(focalLengthMm: number): void {
      camera.setFocalLength(focalLengthMm);
      requestRender();
    },
    showFrame(rig: CameraRig, cameraId: string, displayedFrame: number): void {
      rig.evaluate(cameraId, displayedFrame, out);
      camera.position.set(out.position.x, out.position.y, out.position.z);
      camera.quaternion.set(out.rotation.x, out.rotation.y, out.rotation.z, out.rotation.w);
      requestRender();
    },
    addObject(object: Object3D): void {
      scene.add(object);
    },
    requestRender,
    renderNow(): HTMLCanvasElement | null {
      if (disposed) return null;
      renderer.render(scene, camera);
      return canvas;
    },
    dispose(): void {
      disposed = true;
      observer.disconnect();
      renderer.dispose();
    },
  };
}
