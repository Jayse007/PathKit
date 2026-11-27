// Stage_Overview (task 31.1): a small top-down view of the car, the road, the camera positions and the
// camera rails (push-in and crane). Loads Three.js, so no test imports this file. The pure framing maths
// is in stage-overview-framing.ts, which a test can import.
//
// It draws with the shared auxiliary renderer (aux-renderer.ts). Straight after each render the image is
// copied into this view's own 2D canvas with drawImage, so the shared renderer is free for the next view.
//
// setLayout (after a re-bake) builds geometry and may allocate. showFrame (the per-frame path) creates no
// objects, arrays or closures: the OutBuffer, the size scratch vector and the render function are made
// once, and the camera markers are moved in place.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  Vector2,
} from 'three';
import type { WebGLRenderer } from 'three';
import type { OutBuffer, Vec3 } from '../logic/pathkit.js';
import { DEVICE_PIXEL_RATIO_CAP } from '../logic/constants.js';
import type { CameraRig, RigSettings } from './camera-rig.js';
import { computeTopDownFraming, extendRailEnd } from './stage-overview-framing.js';
import { createSubjectView } from './subject-view.js';

// View-only values (not in the design's Named constants table).
const OVERVIEW_ASPECT = 1; // the overview is square
const FRAMING_MARGIN_FRACTION = 0.1; // free space around everything, each side
const FRAMING_MIN_HALF_HEIGHT_M = 10; // never zoom in closer than a 20 m tall view
const FRAMING_SAMPLE_COUNT = 9; // frames sampled along the shot, to keep an orbiting camera inside the view
const OVERVIEW_CAMERA_HEIGHT_M = 300; // the top-down camera hovers this far above the ground
const OVERVIEW_NEAR_M = 1;
const OVERVIEW_FAR_M = 700;
const MARKER_SIZE_FRACTION = 0.05; // marker length as a fraction of the view height, so it stays readable
const MARKER_RADIUS = 0.35; // unit marker: a cone 1 long, pointing along the camera's forward axis
const MARKER_LENGTH = 1;
const MARKER_SEGMENTS = 8;
const MARKER_RENDER_ORDER = 10;
const RAIL_RENDER_ORDER = 9;
const BACKGROUND_COLOUR = 0x20242a;
const MAIN_MARKER_COLOUR = 0x2ee6c4;
const OTHER_MARKER_COLOUR = 0xe8e8e8;
const RAIL_COLOUR = 0x6fa8ff;

export interface StageOverview {
  /** The 2D canvas the overview is copied into. It is already inside the container. */
  readonly canvas: HTMLCanvasElement;
  /**
   * Rebuild the road, the camera markers, the rails and the framing from `settings`. Call after every
   * re-bake that succeeded. The rig must have baked these settings. Throws when the Road cannot make a curve.
   * Does not draw: call showFrame next, because the markers start at the origin.
   */
  setLayout(rig: CameraRig, settings: RigSettings): void;
  /** Move the car and the camera markers to a displayed frame through the rig, render, and copy. */
  showFrame(rig: CameraRig, displayedFrame: number): void;
  /** Release this view's geometries and materials. The shared renderer is not touched. */
  dispose(): void;
}

interface Marker {
  readonly id: string;
  readonly group: Group;
}

/** Shows a plain message in `container`, replacing its content. Text only, never markup. */
function showMessage(container: HTMLElement, text: string): void {
  const p = document.createElement('p');
  p.setAttribute('role', 'alert');
  p.style.margin = '0';
  p.style.padding = '8px';
  p.style.color = '#f2f2f2';
  p.textContent = text;
  container.replaceChildren(p);
}

/**
 * Builds the Stage_Overview inside `container` (a box the caller sizes; the overview is square, so the
 * caller gives the box equal width and height). `auxRenderer` is the shared auxiliary renderer.
 * Returns null after showing a message when the 2D canvas cannot start.
 */
export function createStageOverview(
  container: HTMLElement,
  auxRenderer: WebGLRenderer,
  roadPoints: readonly Vec3[],
): StageOverview | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    showMessage(container, 'The overview could not start: this browser could not create a 2D canvas.');
    return null;
  }
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.replaceChildren(canvas);

  const scene = new Scene();
  scene.background = new Color(BACKGROUND_COLOUR);

  const camera = new OrthographicCamera(-1, 1, 1, -1, OVERVIEW_NEAR_M, OVERVIEW_FAR_M);
  camera.up.set(0, 0, -1); // north (-Z) is up the picture, +X is to the right
  camera.position.set(0, OVERVIEW_CAMERA_HEIGHT_M, 0);
  camera.lookAt(0, 0, 0);

  const subjectView = createSubjectView(roadPoints);
  scene.add(subjectView.object);

  // Markers and rails sit in one group that setLayout rebuilds.
  const layoutGroup = new Group();
  scene.add(layoutGroup);
  const markerGeometry = new ConeGeometry(MARKER_RADIUS, MARKER_LENGTH, MARKER_SEGMENTS);
  const mainMaterial = new MeshBasicMaterial({ color: MAIN_MARKER_COLOUR, depthTest: false });
  const otherMaterial = new MeshBasicMaterial({ color: OTHER_MARKER_COLOUR, depthTest: false });
  const railMaterial = new LineBasicMaterial({ color: RAIL_COLOUR, depthTest: false });
  let railGeometries: BufferGeometry[] = [];
  let markers: Marker[] = [];

  const out: OutBuffer = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
  const sizeScratch = new Vector2();
  let sizePx = 1;
  let laidOut = false;
  let disposed = false;

  // Created once. Copies the shared renderer's image into this view's canvas straight after the render.
  const render = (): void => {
    if (disposed || !laidOut) return;
    auxRenderer.getSize(sizeScratch);
    if (sizeScratch.x !== sizePx || sizeScratch.y !== sizePx) auxRenderer.setSize(sizePx, sizePx, false);
    auxRenderer.render(scene, camera);
    ctx.drawImage(auxRenderer.domElement, 0, 0, sizePx, sizePx);
  };

  // Runs on a size change only, not per frame. Setting the canvas size clears it, so draw again.
  const resize = (): void => {
    const side = Math.round(container.clientWidth * Math.min(window.devicePixelRatio || 1, DEVICE_PIXEL_RATIO_CAP));
    if (side <= 0 || side === sizePx) return;
    sizePx = side;
    canvas.width = side;
    canvas.height = side;
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const clearLayout = (): void => {
    layoutGroup.clear();
    for (const g of railGeometries) g.dispose();
    railGeometries = [];
    markers = [];
  };

  return {
    canvas,
    setLayout(rig: CameraRig, settings: RigSettings): void {
      subjectView.setRoad(settings.road.points); // throws before anything below changes
      clearLayout();

      const n = settings.shotLengthFrames;
      const ground: { x: number; z: number }[] = settings.road.points.map((p) => ({ x: p.x, z: p.z }));
      const first: Vec3 = { x: 0, y: 0, z: 0 };
      const last: Vec3 = { x: 0, y: 0, z: 0 };
      const end: Vec3 = { x: 0, y: 0, z: 0 };
      const newMarkers: Marker[] = [];
      const newRails: BufferGeometry[] = [];

      for (const c of settings.cameras) {
        // Positions along the shot, so that an orbiting camera stays inside the picture.
        const samples = Math.min(n, FRAMING_SAMPLE_COUNT);
        for (let i = 0; i < samples; i++) {
          const frame = samples > 1 ? Math.round((i * (n - 1)) / (samples - 1)) : 0;
          rig.evaluate(c.id, frame, out);
          ground.push({ x: out.position.x, z: out.position.z });
        }

        if (c.shotType === 'push-in' || c.shotType === 'crane') {
          rig.evaluate(c.id, 0, out);
          first.x = out.position.x;
          first.y = out.position.y;
          first.z = out.position.z;
          rig.evaluate(c.id, n - 1, out);
          last.x = out.position.x;
          last.y = out.position.y;
          last.z = out.position.z;
          extendRailEnd(first, last, n, end);
          ground.push({ x: end.x, z: end.z });

          const geometry = new BufferGeometry();
          geometry.setAttribute(
            'position',
            new BufferAttribute(new Float32Array([first.x, first.y, first.z, end.x, end.y, end.z]), 3),
          );
          const rail = new Line(geometry, railMaterial);
          rail.renderOrder = RAIL_RENDER_ORDER;
          layoutGroup.add(rail);
          newRails.push(geometry);
        }
      }

      const framing = computeTopDownFraming(ground, OVERVIEW_ASPECT, FRAMING_MARGIN_FRACTION, FRAMING_MIN_HALF_HEIGHT_M);
      camera.left = -framing.halfWidth;
      camera.right = framing.halfWidth;
      camera.top = framing.halfHeight;
      camera.bottom = -framing.halfHeight;
      camera.position.set(framing.centreX, OVERVIEW_CAMERA_HEIGHT_M, framing.centreZ);
      camera.lookAt(framing.centreX, 0, framing.centreZ);
      camera.updateProjectionMatrix();

      const markerSize = 2 * framing.halfHeight * MARKER_SIZE_FRACTION;
      for (const c of settings.cameras) {
        const group = new Group();
        group.scale.setScalar(markerSize);
        const cone = new Mesh(markerGeometry, c.id === settings.mainCameraId ? mainMaterial : otherMaterial);
        cone.rotation.x = -Math.PI / 2; // the cone's tip points along -Z, the camera's forward axis
        cone.renderOrder = MARKER_RENDER_ORDER;
        group.add(cone);
        layoutGroup.add(group);
        newMarkers.push({ id: c.id, group });
      }

      railGeometries = newRails;
      markers = newMarkers;
      laidOut = true;
    },
    showFrame(rig: CameraRig, displayedFrame: number): void {
      subjectView.showFrame(rig, displayedFrame);
      for (let i = 0; i < markers.length; i++) {
        const m = markers[i];
        rig.evaluate(m.id, displayedFrame, out);
        m.group.position.set(out.position.x, out.position.y, out.position.z);
        m.group.quaternion.set(out.rotation.x, out.rotation.y, out.rotation.z, out.rotation.w);
      }
      render();
    },
    dispose(): void {
      disposed = true;
      observer.disconnect();
      clearLayout();
      markerGeometry.dispose();
      mainMaterial.dispose();
      otherMaterial.dispose();
      railMaterial.dispose();
      subjectView.dispose();
    },
  };
}
