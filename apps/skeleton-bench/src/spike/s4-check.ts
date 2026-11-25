// SPIKE S4 check page. Not part of the app. Checks, in a browser, that:
//  1. camera.setViewOffset(W, H, -fx * W, -fy * H, W, H) moves the picture by (+fx, +fy) of the viewport,
//  2. orbit (baked camera) and zoom still work while offset,
//  3. a raycast click on a shape still hits the right shape while offset.
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  CylinderGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { bakeLaps } from '../pathkit/laps.js';
import { blendCamera, createCameraBlender } from '../pathkit/camera-blend.js';
import { angleToFrame } from '../logic/frame-mapper.js';
import { CAMERA_FAR, CAMERA_FOV_DEG, CAMERA_NEAR } from '../constants.js';

const OFFSET_STEP = 0.1;

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) {
    throw new Error(`S4 page: missing element #${id}`);
  }
  return found as T;
}

const stage = el<HTMLDivElement>('stage');
const readout = el<HTMLDivElement>('readout');
const angleInput = el<HTMLInputElement>('angle');
const zoomInput = el<HTMLInputElement>('zoom');

const width = stage.clientWidth;
const height = stage.clientHeight;

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.setPixelRatio(1);
stage.appendChild(renderer.domElement);

// Fixed cross-hairs at the screen centre (does not move with the offset).
const cross = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
cross.setAttribute('id', 'cross');
cross.setAttribute('viewBox', `0 0 ${width} ${height}`);
cross.innerHTML =
  `<line x1="${width / 2}" y1="0" x2="${width / 2}" y2="${height}" stroke="#d33" stroke-width="1"/>` +
  `<line x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}" stroke="#d33" stroke-width="1"/>`;
stage.appendChild(cross);

const scene = new Scene();
scene.background = new Color(0xf0f0f0);
scene.add(new AmbientLight(0xffffff, 1.2));
const sun = new DirectionalLight(0xffffff, 2);
sun.position.set(3, 5, 4);
scene.add(sun);

function addShape(name: string, mesh: Mesh, x: number, y: number, z: number): void {
  mesh.name = name;
  mesh.position.set(x, y, z);
  scene.add(mesh);
}
// Shape "centre" sits at the world origin (the point every lap aims at).
addShape('centre sphere', new Mesh(new SphereGeometry(0.4, 24, 16), new MeshStandardMaterial({ color: 0xcc3333 })), 0, 0, 0);
addShape('box right', new Mesh(new BoxGeometry(0.5, 0.5, 0.5), new MeshStandardMaterial({ color: 0x3366cc })), 1.0, 0, 0);
addShape('cylinder left', new Mesh(new CylinderGeometry(0.25, 0.25, 0.7, 20), new MeshStandardMaterial({ color: 0x33aa55 })), -1.0, 0, 0);

const camera = new PerspectiveCamera(CAMERA_FOV_DEG, width / height, CAMERA_NEAR, CAMERA_FAR);

const laps = bakeLaps();
const blender = createCameraBlender();

let fx = 0;
let fy = 0;
let lastClick = 'none';

function applyOffset(): void {
  if (fx === 0 && fy === 0) {
    camera.clearViewOffset();
  } else {
    camera.setViewOffset(width, height, -fx * width, -fy * height, width, height);
  }
  camera.updateProjectionMatrix();
}

const probe = new Vector3();
function render(): void {
  const frame = angleToFrame(Number(angleInput.value));
  const zoom = Number(zoomInput.value);
  blendCamera(laps, frame, zoom, blender);
  camera.position.set(blender.position.x, blender.position.y, blender.position.z);
  camera.quaternion.set(blender.rotation.x, blender.rotation.y, blender.rotation.z, blender.rotation.w);
  camera.updateMatrixWorld(true);
  applyOffset();
  renderer.render(scene, camera);

  // Where the world origin lands on screen, in pixels from the top-left.
  probe.set(0, 0, 0).project(camera);
  const px = (probe.x * 0.5 + 0.5) * width;
  const py = (-probe.y * 0.5 + 0.5) * height;
  readout.textContent =
    `offset fx=${fx.toFixed(2)} fy=${fy.toFixed(2)}   frame=${frame}   zoom=${zoom.toFixed(2)}\n` +
    `centre sphere on screen: x=${px.toFixed(1)} px, y=${py.toFixed(1)} px   ` +
    `(no offset: x=${(width / 2).toFixed(1)}, y=${(height / 2).toFixed(1)})\n` +
    `expected shift from no offset: dx=${(fx * width).toFixed(1)} px, dy=${(fy * height).toFixed(1)} px\n` +
    `last click hit: ${lastClick}`;
}

const raycaster = new Raycaster();
const ndc = new Vector2();
renderer.domElement.addEventListener('click', (event: MouseEvent) => {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(scene.children, false);
  const first = hits[0];
  lastClick = first === undefined ? 'nothing' : first.object.name;
  render();
});

function bump(dx: number, dy: number): void {
  // Round to one decimal place so repeated presses do not accumulate float error.
  fx = Math.round((fx + dx) * 100) / 100;
  fy = Math.round((fy + dy) * 100) / 100;
  render();
}
el<HTMLButtonElement>('left').addEventListener('click', () => bump(-OFFSET_STEP, 0));
el<HTMLButtonElement>('right').addEventListener('click', () => bump(OFFSET_STEP, 0));
el<HTMLButtonElement>('up').addEventListener('click', () => bump(0, -OFFSET_STEP));
el<HTMLButtonElement>('down').addEventListener('click', () => bump(0, OFFSET_STEP));
el<HTMLButtonElement>('reset').addEventListener('click', () => {
  fx = 0;
  fy = 0;
  render();
});
angleInput.addEventListener('input', render);
zoomInput.addEventListener('input', render);

render();
