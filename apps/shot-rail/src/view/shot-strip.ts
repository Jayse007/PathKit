// Shot_Strip view (task 44.3): six small pictures of the Main_Camera view along the shot, each labelled with
// its frame number. Activating a picture (click, or Enter or Space on the focused button) calls onActivate
// with that frame, and the caller moves the Timeline there. Loads Three.js, so no test imports this file.
// The pure label text is in shot-strip-rules.ts, the frame picker in ../logic/strip-frames.ts.
//
// It draws with the shared auxiliary renderer (aux-renderer.ts), the same way the Coverage_Grid does. Straight
// after each picture's render the image is copied into that picture's own 2D canvas with drawImage, before the
// next picture renders.
//
// Each picture is a real <button>, so the browser turns Enter and Space into a click and Tab reaches it.
// No separate key handler is added (it would fire twice). The page's :focus-visible outline applies to it.
//
// The buttons are built at the first render and again only when the shot length changes. render is not a
// per-frame path (the caller redraws the strip when the shot, the main camera or the lens changes), but it
// still creates no objects per call: the OutBuffer, the camera and the size vector are made once, and caption
// text is only assigned when it changes.

import { Color, GridHelper, PerspectiveCamera, Scene, Vector2 } from 'three';
import type { Material, WebGLRenderer } from 'three';
import type { OutBuffer, Vec3 } from '../logic/pathkit.js';
import {
  ASPECT_RATIO,
  DEVICE_PIXEL_RATIO_CAP,
  FILM_GAUGE,
  THUMBNAIL_SIZE_PX,
} from '../logic/constants.js';
import { stripFrames } from '../logic/strip-frames.js';
import type { CameraRig } from './camera-rig.js';
import { stripAriaLabel, stripLabel } from './shot-strip-rules.js';
import { createSubjectView } from './subject-view.js';

// View-only values (not in the design's Named constants table). The scene matches the Coverage_Grid's.
const NEAR_PLANE_M = 0.1;
const FAR_PLANE_M = 1000;
const BACKGROUND_COLOUR = 0x20242a;
const GRID_SIZE_M = 200;
const GRID_DIVISIONS = 100; // 2 m cells, the same ground grid as the main view
const GRID_CENTRE_COLOUR = 0x8a93a0;
const GRID_LINE_COLOUR = 0x4a515c;
const PICTURE_BORDER_PX = 2;
const PICTURE_BORDER_COLOUR = '#4a515c';
const CAPTION_BACKGROUND = '#14171b';
const CAPTION_TEXT_COLOUR = '#f2f2f2'; // on #14171b this is far above CONTRAST_MIN_RATIO
const CAPTION_FONT = '12px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const CAPTION_PADDING = '2px 6px';
const NO_LABEL = ''; // before the first draw

export interface ShotStrip {
  /**
   * Draw the six pictures of `mainCameraId` at the frames stripFrames(shotLengthFrames) picks, with the
   * lens `lensMm`. Builds the buttons at the first call and when shotLengthFrames changes. Call it after the
   * rig has re-baked. A lens that is not a finite number above 0 does nothing.
   */
  render(rig: CameraRig, mainCameraId: string, lensMm: number, shotLengthFrames: number): void;
  /** Release this view's geometries and materials and remove the pictures. The shared renderer is not touched. */
  dispose(): void;
}

interface Picture {
  readonly frame: number;
  readonly button: HTMLButtonElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly caption: HTMLElement;
  lastCaption: string;
}

/** Shows a plain message in `container`, replacing its content. Text only, never markup. */
function showMessage(container: HTMLElement, text: string): void {
  const p = document.createElement('p');
  p.setAttribute('role', 'alert');
  p.style.margin = '0';
  p.style.padding = '8px';
  p.textContent = text;
  container.replaceChildren(p);
}

function disposeMaterial(material: Material | Material[]): void {
  if (Array.isArray(material)) {
    for (const m of material) m.dispose();
  } else {
    material.dispose();
  }
}

/**
 * Builds the Shot_Strip inside `container`. `auxRenderer` is the shared auxiliary renderer.
 * `onActivate` is called with the frame number when a picture is clicked or activated with Enter (or Space).
 * The strip does not move the Timeline itself: the caller decides.
 */
export function createShotStrip(
  container: HTMLElement,
  auxRenderer: WebGLRenderer,
  roadPoints: readonly Vec3[],
  onActivate: (frame: number) => void,
): ShotStrip {
  const scene = new Scene();
  const ground = new GridHelper(GRID_SIZE_M, GRID_DIVISIONS, GRID_CENTRE_COLOUR, GRID_LINE_COLOUR);
  scene.add(ground);
  const subjectView = createSubjectView(roadPoints);
  scene.add(subjectView.object);
  scene.background = new Color(BACKGROUND_COLOUR); // the shared renderer's clear colour is not relied on

  // One camera for every picture; position, rotation and lens are set per picture.
  const camera = new PerspectiveCamera(50, ASPECT_RATIO, NEAR_PLANE_M, FAR_PLANE_M);
  camera.aspect = ASPECT_RATIO;
  camera.filmGauge = FILM_GAUGE;
  let cameraLensMm = 0; // 0 means "not set yet"

  const camOut: OutBuffer = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
  const sizeScratch = new Vector2();

  let pictures: Picture[] = [];
  let builtLength = 0; // the shot length the buttons were built for; 0 means none built
  let pictureWidthPx: number = THUMBNAIL_SIZE_PX.width;
  let pictureHeightPx: number = THUMBNAIL_SIZE_PX.height;
  let disposed = false;

  // One listener on the container (created once). A picture is a <button>, so Enter and Space arrive as clicks.
  const onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button[data-frame]');
    if (button === null || !container.contains(button)) return;
    const text = button.getAttribute('data-frame');
    if (text === null) return;
    const frame = Number(text);
    if (!Number.isInteger(frame) || frame < 0) return;
    onActivate(frame);
  };
  container.addEventListener('click', onClick);

  // Returns null when the browser cannot make a 2D canvas.
  const makePicture = (frame: number): Picture | null => {
    const canvas = document.createElement('canvas');
    canvas.width = pictureWidthPx;
    canvas.height = pictureHeightPx;
    canvas.style.display = 'block';
    canvas.style.width = `${THUMBNAIL_SIZE_PX.width}px`;
    canvas.style.height = `${THUMBNAIL_SIZE_PX.height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return null;

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-frame', String(frame));
    const ariaLabel = stripAriaLabel(frame);
    button.setAttribute('aria-label', ariaLabel);
    button.title = ariaLabel;
    button.style.padding = '0';
    button.style.margin = '0';
    button.style.cursor = 'pointer';
    button.style.background = CAPTION_BACKGROUND;
    button.style.border = `${PICTURE_BORDER_PX}px solid ${PICTURE_BORDER_COLOUR}`;
    button.style.font = CAPTION_FONT;
    button.style.color = CAPTION_TEXT_COLOUR;
    button.style.textAlign = 'left';

    const caption = document.createElement('div');
    caption.style.padding = CAPTION_PADDING;
    caption.style.background = CAPTION_BACKGROUND;
    caption.style.color = CAPTION_TEXT_COLOUR;
    caption.textContent = NO_LABEL;
    button.append(canvas, caption);

    return { frame, button, ctx, caption, lastCaption: NO_LABEL };
  };

  // Builds the buttons for `shotLengthFrames`. Returns false after showing a message when a canvas fails.
  const build = (shotLengthFrames: number): boolean => {
    const dpr = Math.min(window.devicePixelRatio || 1, DEVICE_PIXEL_RATIO_CAP);
    pictureWidthPx = Math.round(THUMBNAIL_SIZE_PX.width * dpr);
    pictureHeightPx = Math.round(THUMBNAIL_SIZE_PX.height * dpr);

    const frames = stripFrames(shotLengthFrames); // throws for a length outside 60 to 600
    const next: Picture[] = [];
    const buttons: HTMLElement[] = [];
    for (const frame of frames) {
      const picture = makePicture(frame);
      if (picture === null) {
        showMessage(container, 'The shot strip could not start: this browser could not create a 2D canvas.');
        pictures = [];
        builtLength = 0;
        return false;
      }
      next.push(picture);
      buttons.push(picture.button);
    }
    container.replaceChildren(...buttons);
    pictures = next;
    builtLength = shotLengthFrames;
    return true;
  };

  const drawPicture = (rig: CameraRig, picture: Picture, mainCameraId: string, lensMm: number): void => {
    rig.evaluate(mainCameraId, picture.frame, camOut);
    camera.position.set(camOut.position.x, camOut.position.y, camOut.position.z);
    camera.quaternion.set(camOut.rotation.x, camOut.rotation.y, camOut.rotation.z, camOut.rotation.w);
    if (cameraLensMm !== lensMm) {
      camera.setFocalLength(lensMm);
      cameraLensMm = lensMm;
    }
    subjectView.showFrame(rig, picture.frame); // the car at this picture's frame

    auxRenderer.getSize(sizeScratch);
    if (sizeScratch.x !== pictureWidthPx || sizeScratch.y !== pictureHeightPx) {
      auxRenderer.setSize(pictureWidthPx, pictureHeightPx, false);
    }
    auxRenderer.render(scene, camera);
    picture.ctx.drawImage(auxRenderer.domElement, 0, 0, pictureWidthPx, pictureHeightPx);

    const text = stripLabel(picture.frame);
    if (text !== picture.lastCaption) {
      picture.caption.textContent = text;
      picture.lastCaption = text;
    }
  };

  return {
    render(rig: CameraRig, mainCameraId: string, lensMm: number, shotLengthFrames: number): void {
      if (disposed) return;
      if (!Number.isFinite(lensMm) || lensMm <= 0) return;
      if (shotLengthFrames !== builtLength || pictures.length === 0) {
        if (!build(shotLengthFrames)) return;
      }
      for (let i = 0; i < pictures.length; i++) drawPicture(rig, pictures[i], mainCameraId, lensMm);
    },
    dispose(): void {
      disposed = true;
      container.removeEventListener('click', onClick);
      pictures = [];
      container.replaceChildren();
      subjectView.dispose();
      ground.geometry.dispose();
      disposeMaterial(ground.material);
    },
  };
}
