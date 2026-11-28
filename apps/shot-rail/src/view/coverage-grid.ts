// Coverage_Grid view (task 32.3): one tile per camera, each showing what that camera sees, with its
// Angle_Label and Framing_Label as text. Click or Enter on a tile makes that camera the Main_Camera
// (through the onSelect callback). Loads Three.js, so no test imports this file. The pure rules (when to
// redraw, the camera limit, which camera a click selects) are in coverage-grid-rules.ts.
//
// It draws with the shared auxiliary renderer (aux-renderer.ts). Straight after each tile's render the
// image is copied into that tile's own 2D canvas with drawImage, before the next tile renders.
//
// Each tile is a real <button>, so the browser turns Enter and Space into a click and Tab reaches it.
// No separate key handler is added (it would fire twice).
//
// setLayout (after a re-bake) builds the tiles and may allocate. render (the per-frame path) creates no
// objects, arrays, strings or closures: the OutBuffers, scratch arrays, size vector and camera are made
// once, label text is only assigned when it changes (and is always a string that already exists).

import { Color, GridHelper, PerspectiveCamera, Scene, Vector2 } from 'three';
import type { Material, WebGLRenderer } from 'three';
import type { OutBuffer, Vec3 } from '../logic/pathkit.js';
import {
  ASPECT_RATIO,
  CAR_HALF_EXTENT_X,
  CAR_HALF_EXTENT_Y,
  CAR_HALF_EXTENT_Z,
  DEVICE_PIXEL_RATIO_CAP,
  FILM_GAUGE,
  TILE_SIZE_PX,
} from '../logic/constants.js';
import { framingPercent } from '../logic/fill.js';
import { angleLabel, framingLabel } from '../logic/labels.js';
import { fieldOfViewForFocalLengthMm } from '../logic/lens.js';
import type { CameraRig, RigSettings } from './camera-rig.js';
import { selectMain, shouldRenderGrid } from './coverage-grid-rules.js';
import type { GridMode } from './coverage-grid-rules.js';
import { createSubjectView } from './subject-view.js';

// View-only values (not in the design's Named constants table).
const NEAR_PLANE_M = 0.1;
const FAR_PLANE_M = 1000;
const BACKGROUND_COLOUR = 0x20242a;
const GRID_SIZE_M = 200;
const GRID_DIVISIONS = 100; // 2 m cells, the same ground grid as the main view
const GRID_CENTRE_COLOUR = 0x8a93a0;
const GRID_LINE_COLOUR = 0x4a515c;
const TILE_GAP_PX = 8;
const TILE_COLUMNS = 3; // 6 tiles make 2 rows of 3
const TILE_BORDER_PX = 3;
const TILE_BORDER_COLOUR = '#4a515c';
const TILE_BORDER_MAIN_COLOUR = '#2ee6c4'; // the same teal as the main marker in the Stage_Overview
const CAPTION_BACKGROUND = '#14171b';
const CAPTION_TEXT_COLOUR = '#f2f2f2'; // on #14171b this is far above CONTRAST_MIN_RATIO
const CAPTION_FONT = '12px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const CAPTION_PADDING = '3px 6px';
const MAIN_TAG_TEXT = 'Main';
const RAD_TO_DEG = 180 / Math.PI;
const SCRATCH_CORNERS_LENGTH = 24; // 8 corners x 3
const SCRATCH_NDC_LENGTH = 16; // 8 corners x 2
const NO_LABEL = ''; // before the first draw

// The car's box. Only the car exists as a subject so far (RigSettings.subjectKind is 'car' in every
// caller); the other kinds will need their own extents when they are built.
const SUBJECT_HALF_EXTENTS: Vec3 = { x: CAR_HALF_EXTENT_X, y: CAR_HALF_EXTENT_Y, z: CAR_HALF_EXTENT_Z };

export interface CoverageGrid {
  /** Rebuild the tiles from `settings`. Call after every re-bake that succeeded. Does not draw: call render next. */
  setLayout(settings: RigSettings): void;
  /** Mark one tile as the Main_Camera (border, "Main" tag, aria-pressed). No render. */
  setMain(cameraId: string): void;
  /**
   * Change one tile's lens and vertical field of view. No DOM is rebuilt and nothing is drawn: call render next.
   * An unknown id, or a lens that is not a finite number above 0, does nothing. Throws nothing.
   */
  setLensMm(cameraId: string, lensMm: number): void;
  /**
   * Draw every tile at `displayedFrame` when shouldRenderGrid says so. Returns true when it drew.
   * Never draws outside Angle mode. `msSinceLast` is the time since the last draw, in ms.
   */
  render(
    rig: CameraRig,
    displayedFrame: number,
    mode: GridMode,
    changed: boolean,
    playing: boolean,
    msSinceLast: number,
  ): boolean;
  /** Release this view's geometries and materials and remove the tiles. The shared renderer is not touched. */
  dispose(): void;
}

interface Tile {
  readonly id: string;
  readonly button: HTMLButtonElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly angleText: HTMLElement;
  readonly framingText: HTMLElement;
  readonly mainTag: HTMLElement;
  lensMm: number; // changed in place by setLensMm
  verticalFovRad: number; // changed in place by setLensMm
  lastAngle: string;
  lastFraming: string;
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
 * Builds the Coverage_Grid inside `container`. `auxRenderer` is the shared auxiliary renderer.
 * `onSelect` is called with the camera id when a tile is clicked or activated with Enter (or Space).
 * The grid does not change the Main_Camera itself: the caller decides, then calls setMain.
 */
export function createCoverageGrid(
  container: HTMLElement,
  auxRenderer: WebGLRenderer,
  roadPoints: readonly Vec3[],
  onSelect: (cameraId: string) => void,
): CoverageGrid {
  container.style.display = 'grid';
  container.style.gridTemplateColumns = `repeat(${TILE_COLUMNS}, max-content)`;
  container.style.gap = `${TILE_GAP_PX}px`;
  container.style.alignContent = 'start';

  const scene = new Scene();
  const ground = new GridHelper(GRID_SIZE_M, GRID_DIVISIONS, GRID_CENTRE_COLOUR, GRID_LINE_COLOUR);
  scene.add(ground);
  const subjectView = createSubjectView(roadPoints);
  scene.add(subjectView.object);
  scene.background = new Color(BACKGROUND_COLOUR); // the shared renderer's clear colour is not relied on

  // One camera for every tile; position, rotation and lens are set per tile.
  const camera = new PerspectiveCamera(50, ASPECT_RATIO, NEAR_PLANE_M, FAR_PLANE_M);
  camera.aspect = ASPECT_RATIO;
  camera.filmGauge = FILM_GAUGE;
  let cameraLensMm = 0; // 0 means "not set yet"

  const camOut: OutBuffer = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
  const subjectOut: OutBuffer = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
  const scratchCorners = new Float64Array(SCRATCH_CORNERS_LENGTH);
  const scratchNdc = new Float64Array(SCRATCH_NDC_LENGTH);
  const sizeScratch = new Vector2();

  let tiles: Tile[] = [];
  let tileWidthPx: number = TILE_SIZE_PX.width;
  let tileHeightPx: number = TILE_SIZE_PX.height;
  let disposed = false;

  // One listener on the container (created once). A tile is a <button>, so Enter and Space arrive as clicks.
  container.addEventListener('click', (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button[data-camera-id]');
    if (button === null || !container.contains(button)) return;
    const id = button.getAttribute('data-camera-id');
    if (id === null) return;
    onSelect(selectMain(id));
  });

  const drawTile = (rig: CameraRig, tile: Tile, displayedFrame: number): void => {
    rig.evaluate(tile.id, displayedFrame, camOut);
    camera.position.set(camOut.position.x, camOut.position.y, camOut.position.z);
    camera.quaternion.set(camOut.rotation.x, camOut.rotation.y, camOut.rotation.z, camOut.rotation.w);
    if (cameraLensMm !== tile.lensMm) {
      camera.setFocalLength(tile.lensMm);
      cameraLensMm = tile.lensMm;
    }

    auxRenderer.getSize(sizeScratch);
    if (sizeScratch.x !== tileWidthPx || sizeScratch.y !== tileHeightPx) {
      auxRenderer.setSize(tileWidthPx, tileHeightPx, false);
    }
    auxRenderer.render(scene, camera);
    tile.ctx.drawImage(auxRenderer.domElement, 0, 0, tileWidthPx, tileHeightPx);

    // Angle_Label: elevation from the true subject centre to the camera, in degrees (design: Elevation).
    const dx = camOut.position.x - subjectOut.position.x;
    const dz = camOut.position.z - subjectOut.position.z;
    const horizontal = Math.sqrt(dx * dx + dz * dz);
    const elevationDeg = Math.atan2(camOut.position.y - subjectOut.position.y, horizontal) * RAD_TO_DEG;
    const angle = angleLabel(elevationDeg);
    if (angle !== tile.lastAngle) {
      tile.angleText.textContent = angle;
      tile.lastAngle = angle;
    }

    // Framing_Label: how much of the frame the car's box covers.
    const fill = framingPercent(
      subjectOut.position,
      subjectOut.rotation,
      SUBJECT_HALF_EXTENTS,
      camOut.position,
      camOut.rotation,
      tile.verticalFovRad,
      ASPECT_RATIO,
      scratchCorners,
      scratchNdc,
    );
    const framing = framingLabel(fill);
    if (framing !== tile.lastFraming) {
      tile.framingText.textContent = framing;
      tile.lastFraming = framing;
    }
  };

  // Returns null when the browser cannot make a 2D canvas.
  const makeTile = (id: string, lensMm: number): Tile | null => {
    const canvas = document.createElement('canvas');
    canvas.width = tileWidthPx;
    canvas.height = tileHeightPx;
    canvas.style.display = 'block';
    canvas.style.width = `${TILE_SIZE_PX.width}px`;
    canvas.style.height = `${TILE_SIZE_PX.height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return null;

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-camera-id', id);
    button.setAttribute('aria-pressed', 'false');
    button.title = `Make ${id} the main camera`;
    button.style.padding = '0';
    button.style.margin = '0';
    button.style.cursor = 'pointer';
    button.style.background = CAPTION_BACKGROUND;
    button.style.border = `${TILE_BORDER_PX}px solid ${TILE_BORDER_COLOUR}`;
    button.style.font = CAPTION_FONT;
    button.style.color = CAPTION_TEXT_COLOUR;
    button.style.textAlign = 'left';

    const caption = document.createElement('div');
    caption.style.display = 'flex';
    caption.style.flexWrap = 'wrap';
    caption.style.gap = '4px 8px';
    caption.style.padding = CAPTION_PADDING;
    caption.style.background = CAPTION_BACKGROUND;
    caption.style.color = CAPTION_TEXT_COLOUR;

    const name = document.createElement('strong');
    name.textContent = id;
    const angleText = document.createElement('span');
    angleText.textContent = NO_LABEL;
    const framingText = document.createElement('span');
    framingText.textContent = NO_LABEL;
    const mainTag = document.createElement('span');
    mainTag.textContent = MAIN_TAG_TEXT;
    mainTag.style.display = 'none';
    mainTag.style.fontWeight = 'bold';
    caption.append(name, angleText, framingText, mainTag);
    button.append(canvas, caption);

    return {
      id,
      button,
      ctx,
      angleText,
      framingText,
      mainTag,
      lensMm,
      verticalFovRad: fieldOfViewForFocalLengthMm(lensMm).verticalDeg / RAD_TO_DEG,
      lastAngle: NO_LABEL,
      lastFraming: NO_LABEL,
    };
  };

  const markMain = (cameraId: string): void => {
    for (const t of tiles) {
      const isMain = t.id === cameraId;
      t.button.setAttribute('aria-pressed', isMain ? 'true' : 'false');
      t.button.style.borderColor = isMain ? TILE_BORDER_MAIN_COLOUR : TILE_BORDER_COLOUR;
      t.mainTag.style.display = isMain ? 'inline' : 'none';
    }
  };

  return {
    setLayout(settings: RigSettings): void {
      subjectView.setRoad(settings.road.points); // throws before anything below changes
      const dpr = Math.min(window.devicePixelRatio || 1, DEVICE_PIXEL_RATIO_CAP);
      tileWidthPx = Math.round(TILE_SIZE_PX.width * dpr);
      tileHeightPx = Math.round(TILE_SIZE_PX.height * dpr);

      const next: Tile[] = [];
      const buttons: HTMLElement[] = [];
      for (const c of settings.cameras) {
        const tile = makeTile(c.id, c.lensMm);
        if (tile === null) {
          showMessage(container, 'The grid could not start: this browser could not create a 2D canvas.');
          tiles = [];
          return;
        }
        next.push(tile);
        buttons.push(tile.button);
      }
      container.replaceChildren(...buttons);
      tiles = next;
      markMain(settings.mainCameraId);
    },
    setMain(cameraId: string): void {
      markMain(cameraId);
    },
    setLensMm(cameraId: string, lensMm: number): void {
      if (!Number.isFinite(lensMm) || lensMm <= 0) return;
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        if (tile.id !== cameraId) continue;
        tile.lensMm = lensMm; // drawTile applies it to the shared camera when it differs
        tile.verticalFovRad = fieldOfViewForFocalLengthMm(lensMm).verticalDeg / RAD_TO_DEG;
        return;
      }
    },
    render(
      rig: CameraRig,
      displayedFrame: number,
      mode: GridMode,
      changed: boolean,
      playing: boolean,
      msSinceLast: number,
    ): boolean {
      if (disposed || tiles.length === 0) return false;
      if (!shouldRenderGrid(mode, changed, playing, msSinceLast)) return false;
      subjectView.showFrame(rig, displayedFrame);
      rig.evaluateSubject(displayedFrame, subjectOut);
      for (let i = 0; i < tiles.length; i++) drawTile(rig, tiles[i], displayedFrame);
      return true;
    },
    dispose(): void {
      disposed = true;
      tiles = [];
      container.replaceChildren();
      subjectView.dispose();
      ground.geometry.dispose();
      disposeMaterial(ground.material);
    },
  };
}
