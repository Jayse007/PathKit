// Controls (task 37.1): mode tabs, camera list, bearing, height, horizontal distance, lens slider,
// Shot_Type and Shot_Length. Every control has a visible text label, a tooltip (a Term_Text line where one
// exists) and its key shown beside it. It only DISPLAYS the keys; the keyboard is wired in task 37.2.
// Every drag-style control has a typed or key alternative: number fields take typed values, the slider and
// the selects work with the arrow keys.
//
// It touches the DOM, so no test imports this file. The pure rules (checking typed values, building new
// settings, key text) are in controls-rules.ts.
//
// Controls never bake and never start playback. They build NEW settings from the caller's current settings
// (getSettings), hand them to onChange, and the caller does the re-bake. The lens does not re-bake: it goes
// through onLens. Settings edits apply to the Main_Camera; select another camera to edit that one.

import { LENS_ZOOM_MAX_MM, LENS_ZOOM_MIN_MM, MAX_CAMERAS, SHOT_LENGTH_MAX, SHOT_LENGTH_MIN } from '../logic/constants.js';
import type { ShotType } from '../logic/shot-builders.js';
import { MEASURE_TERMS, SHOT_TYPE_TERMS } from '../logic/term-text.js';
import type { CameraSetting, RigSettings } from './camera-rig.js';
import type { GridMode } from './coverage-grid-rules.js';
import {
  FIELD_KEY_HINT,
  PLACEMENT_FIELDS,
  checkPlacementValue,
  checkShotLengthText,
  keyHint,
  slotAction,
  withAddedCamera,
  withPlacementValue,
  withRemovedCamera,
  withShotLength,
  withShotType,
} from './controls-rules.js';
import type { FieldSpec } from './controls-rules.js';
import { setRegionEmpty } from './layout.js';

// View-only values (not in the design's Named constants table).
const CONTROLS_EMPTY_ID = 'controls-empty';
const LENS_SLIDER_ID = 'lens-slider';
const SHOT_TYPE_ID = 'shot-type';
const SHOT_LENGTH_ID = 'shot-length';
const FIELD_ID_PREFIX = 'camera-';
const LENS_SLIDER_STEP_MM = 1;
const SHOT_LENGTH_STEP_FRAMES = 1;
const KEY_CLASS = 'key-hint';
const FIELD_CLASS = 'field';
const ROW_CLASS = 'row';
const ATTR_SELECT = 'data-select';
const ATTR_REMOVE = 'data-remove';
const MODE_ANGLE_TEXT = 'Angle';
const MODE_MOVE_TEXT = 'Move';
const MODE_LABEL = 'Mode';
const CAMERAS_LABEL = 'Cameras';
const ADD_CAMERA_TEXT = 'Add camera';
const REMOVE_TEXT = 'Remove';
const MAIN_TEXT = 'main';
const EDITING_PREFIX = 'Settings below apply to';
const LENS_SLIDER_LABEL = 'Lens zoom';
const SHOT_TYPE_LABEL = 'Shot type';
const SHOT_LENGTH_LABEL = 'Shot length';
const SHOT_LENGTH_UNIT = 'frames';

const SHOT_TYPES: readonly { readonly type: ShotType; readonly text: string }[] = [
  { type: 'push-in', text: 'Push-in' },
  { type: 'orbit', text: 'Orbit' },
  { type: 'tracking', text: 'Tracking' },
  { type: 'crane', text: 'Crane' },
];

export interface ControlsOptions {
  /** Where the mode tabs, camera list and the three placement fields go (above the lens menu). */
  topBox: HTMLElement;
  /** Where Shot_Type and Shot_Length go (below the lens menu). */
  afterLensBox: HTMLElement;
  /** The existing lens field (label and menu). The key hint and the lens slider are added to it. */
  lensField: HTMLElement;
  mode: GridMode;
  /** The caller's current settings. Edits start from these, never from the rig's own copy. */
  getSettings: () => RigSettings;
  /**
   * Apply new settings: pause, re-bake, redraw. Returns false when the settings could not be applied
   * (the caller keeps the old ones and says why in the status line).
   */
  onChange: (next: RigSettings, message: string) => boolean;
  /** A camera was chosen in the list: make it the Main_Camera (same path as a tile click). */
  onSelectCamera: (id: string) => void;
  /** The lens slider moved. The caller applies the lens without a re-bake. */
  onLens: (mm: number) => void;
  onMode: (mode: GridMode) => void;
  /** A value was refused. The caller shows the message in the status line. */
  onRefuse: (message: string) => void;
}

export interface Controls {
  /** Show these settings in every control. Call after every change of settings or of the Main_Camera. */
  show(settings: RigSettings): void;
  /** Show the lens in the slider only. The lens menu is the caller's. */
  setLens(mm: number): void;
  /** Show the mode in the tabs. Does not call onMode. */
  setMode(mode: GridMode): void;
}

function makeKeySpan(text: string): HTMLElement {
  const span = document.createElement('span');
  span.className = KEY_CLASS;
  span.textContent = text;
  return span;
}

function makeLabel(forId: string, text: string, key: string, title: string | null): HTMLLabelElement {
  const label = document.createElement('label');
  label.htmlFor = forId;
  label.append(`${text} `, makeKeySpan(key));
  if (title !== null) label.title = title;
  return label;
}

function makeNumberInput(id: string, min: number | null, max: number | null, step: number, title: string | null): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.id = id;
  input.step = String(step);
  if (min !== null) input.min = String(min);
  if (max !== null) input.max = String(max);
  if (title !== null) input.title = title;
  return input;
}

/** The elements of one camera row, kept so show() can update them in place. */
interface RowParts {
  id: string;
  select: HTMLButtonElement;
  label: Text;
  key: HTMLElement;
  remove: HTMLButtonElement;
}

/** Builds the controls inside the boxes. Call once. Hides the "controls are not built yet" message. */
export function createControls(options: ControlsOptions): Controls {
  const { topBox, afterLensBox, lensField, getSettings, onChange } = options;

  // --- mode tabs -----------------------------------------------------------------------------
  const modeGroup = document.createElement('div');
  modeGroup.className = FIELD_CLASS;
  modeGroup.setAttribute('role', 'group');
  modeGroup.setAttribute('aria-label', MODE_LABEL);
  const modeTitle = document.createElement('span');
  modeTitle.textContent = MODE_LABEL;
  const modeRow = document.createElement('div');
  modeRow.className = ROW_CLASS;
  const angleTab = document.createElement('button');
  angleTab.type = 'button';
  angleTab.append(`${MODE_ANGLE_TEXT} `, makeKeySpan(keyHint('mode-angle')));
  const moveTab = document.createElement('button');
  moveTab.type = 'button';
  moveTab.append(`${MODE_MOVE_TEXT} `, makeKeySpan(keyHint('mode-move')));
  modeRow.append(angleTab, moveTab);
  modeGroup.append(modeTitle, modeRow);

  const setMode = (mode: GridMode): void => {
    angleTab.setAttribute('aria-pressed', mode === 'angle' ? 'true' : 'false');
    moveTab.setAttribute('aria-pressed', mode === 'move' ? 'true' : 'false');
  };
  angleTab.addEventListener('click', () => {
    setMode('angle');
    options.onMode('angle');
  });
  moveTab.addEventListener('click', () => {
    setMode('move');
    options.onMode('move');
  });
  setMode(options.mode);

  // --- camera list ---------------------------------------------------------------------------
  const cameraGroup = document.createElement('div');
  cameraGroup.className = FIELD_CLASS;
  cameraGroup.setAttribute('role', 'group');
  cameraGroup.setAttribute('aria-label', CAMERAS_LABEL);
  const cameraTitle = document.createElement('span');
  const cameraList = document.createElement('div');
  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.textContent = ADD_CAMERA_TEXT;
  const editingNote = document.createElement('span');
  editingNote.className = KEY_CLASS;
  cameraGroup.append(cameraTitle, cameraList, addButton, editingNote);

  // One listener for the whole list (created once); rows are rebuilt by show().
  cameraList.addEventListener('click', (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const select = target.closest(`button[${ATTR_SELECT}]`);
    if (select !== null) {
      const id = select.getAttribute(ATTR_SELECT);
      if (id !== null) options.onSelectCamera(id);
      return;
    }
    const remove = target.closest(`button[${ATTR_REMOVE}]`);
    if (remove === null) return;
    const id = remove.getAttribute(ATTR_REMOVE);
    if (id === null) return;
    const result = withRemovedCamera(getSettings(), id);
    if (!result.ok) {
      options.onRefuse(result.message);
      return;
    }
    onChange(result.settings, result.message);
  });

  addButton.addEventListener('click', () => {
    const result = withAddedCamera(getSettings());
    if (!result.ok) {
      options.onRefuse(result.message); // CAMERA_LIMIT_MESSAGE at the sixth camera
      return;
    }
    onChange(result.settings, result.message);
  });

  // --- placement fields ----------------------------------------------------------------------
  const placementInputs = new Map<string, HTMLInputElement>();
  const placementBox = document.createElement('div');
  for (const spec of PLACEMENT_FIELDS) {
    const id = `${FIELD_ID_PREFIX}${spec.field}`;
    const term = termTitleFor(spec);
    const wrap = document.createElement('div');
    wrap.className = FIELD_CLASS;
    const label = makeLabel(id, `${spec.label} (${spec.unit})`, FIELD_KEY_HINT, term);
    const input = makeNumberInput(id, spec.min, spec.max, spec.step, term);
    input.addEventListener('change', () => {
      const checked = checkPlacementValue(spec, input.value);
      if (!checked.ok) {
        input.setAttribute('aria-invalid', 'true');
        options.onRefuse(checked.message);
        return;
      }
      input.removeAttribute('aria-invalid');
      const settings = getSettings();
      const applied = onChange(withPlacementValue(settings, settings.mainCameraId, spec.field, checked.value), '');
      if (!applied) show(getSettings());
    });
    wrap.append(label, input);
    placementBox.appendChild(wrap);
    placementInputs.set(spec.field, input);
  }

  topBox.replaceChildren(modeGroup, cameraGroup, placementBox);

  // --- lens: key hint on the existing label, plus the slider ---------------------------------
  const lensLabel = lensField.querySelector('label');
  if (lensLabel !== null) lensLabel.append(' ', makeKeySpan(keyHint('cycle-lens')));

  const sliderWrap = document.createElement('div');
  sliderWrap.className = FIELD_CLASS;
  const sliderLabel = makeLabel(LENS_SLIDER_ID, LENS_SLIDER_LABEL, keyHint('zoom-in', 'zoom-out'), MEASURE_TERMS.lensZoom.text);
  const sliderRow = document.createElement('div');
  sliderRow.className = ROW_CLASS;
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = LENS_SLIDER_ID;
  slider.min = String(LENS_ZOOM_MIN_MM);
  slider.max = String(LENS_ZOOM_MAX_MM);
  slider.step = String(LENS_SLIDER_STEP_MM);
  slider.title = MEASURE_TERMS.lensZoom.text;
  const sliderValue = document.createElement('span');
  sliderRow.append(slider, sliderValue);
  sliderWrap.append(sliderLabel, sliderRow);
  lensField.appendChild(sliderWrap);
  slider.addEventListener('input', () => {
    const mm = Number(slider.value);
    if (Number.isFinite(mm)) options.onLens(mm);
  });

  const setLens = (mm: number): void => {
    slider.value = String(mm); // the browser snaps a value that is not on a step
    sliderValue.textContent = `${Math.round(mm)} mm`;
  };

  // --- Shot_Type and Shot_Length -------------------------------------------------------------
  const shotTypeWrap = document.createElement('div');
  shotTypeWrap.className = FIELD_CLASS;
  const shotTypeSelect = document.createElement('select');
  shotTypeSelect.id = SHOT_TYPE_ID;
  for (const entry of SHOT_TYPES) {
    const option = document.createElement('option');
    option.value = entry.type;
    option.textContent = entry.text;
    option.title = SHOT_TYPE_TERMS[entry.type].text;
    shotTypeSelect.appendChild(option);
  }
  shotTypeWrap.append(makeLabel(SHOT_TYPE_ID, SHOT_TYPE_LABEL, keyHint('cycle-shot-type'), null), shotTypeSelect);
  shotTypeSelect.addEventListener('change', () => {
    const settings = getSettings();
    const changed = withShotType(settings, settings.mainCameraId, shotTypeSelect.value as ShotType);
    if (!onChange(changed.settings, changed.message)) show(getSettings());
  });

  const lengthWrap = document.createElement('div');
  lengthWrap.className = FIELD_CLASS;
  const lengthInput = makeNumberInput(SHOT_LENGTH_ID, SHOT_LENGTH_MIN, SHOT_LENGTH_MAX, SHOT_LENGTH_STEP_FRAMES, null);
  lengthWrap.append(makeLabel(SHOT_LENGTH_ID, `${SHOT_LENGTH_LABEL} (${SHOT_LENGTH_UNIT})`, FIELD_KEY_HINT, null), lengthInput);
  lengthInput.addEventListener('change', () => {
    const checked = checkShotLengthText(lengthInput.value);
    if (!checked.ok) {
      lengthInput.setAttribute('aria-invalid', 'true');
      options.onRefuse(checked.message); // 59 and 601 stop here, with the range in the message
      return;
    }
    lengthInput.removeAttribute('aria-invalid');
    if (!onChange(withShotLength(getSettings(), checked.value), '')) show(getSettings());
  });

  afterLensBox.replaceChildren(shotTypeWrap, lengthWrap);

  // --- show ----------------------------------------------------------------------------------
  // The camera rows built last time, in order. Every row keeps a Remove button; the main row's is hidden.
  let rowParts: RowParts[] = [];

  // "orbit" or, when a rail shot is remembered, "orbit (push-in when main)".
  function shotText(c: CameraSetting): string {
    return c.railShotWhenMain === undefined ? c.shotType : `${c.shotType} (${c.railShotWhenMain} when main)`;
  }

  function fillRow(part: RowParts, index: number, id: string, shotType: string, isMain: boolean): void {
    part.select.setAttribute(ATTR_SELECT, id);
    part.select.setAttribute('aria-pressed', isMain ? 'true' : 'false');
    part.select.title = `Make ${id} the main camera`;
    part.label.nodeValue = `${id}${isMain ? ` (${MAIN_TEXT})` : ''}, ${shotType} `;
    part.key.textContent = keyHint(slotAction(index));
    part.remove.setAttribute(ATTR_REMOVE, id);
    part.remove.title = `${REMOVE_TEXT} ${id}`;
    part.remove.setAttribute('aria-label', `${REMOVE_TEXT} ${id}`);
    part.remove.hidden = isMain;
  }

  function show(settings: RigSettings): void {
    const active = document.activeElement;
    const focusedId = active instanceof Element ? active.getAttribute(ATTR_SELECT) : null;

    cameraTitle.textContent = `${CAMERAS_LABEL} (${settings.cameras.length} of ${MAX_CAMERAS})`;

    // Same ids in the same order: update the existing rows in place, so a click that follows a field's
    // change event still lands on a live button. Otherwise (camera added, removed or reordered) rebuild.
    let sameIds = rowParts.length === settings.cameras.length;
    for (let i = 0; sameIds && i < rowParts.length; i++) {
      if (rowParts[i].id !== settings.cameras[i].id) sameIds = false;
    }
    if (sameIds) {
      for (let i = 0; i < rowParts.length; i++) {
        fillRow(rowParts[i], i, settings.cameras[i].id, shotText(settings.cameras[i]), settings.cameras[i].id === settings.mainCameraId);
      }
    } else {
      const rows: HTMLElement[] = [];
      const parts: RowParts[] = [];
      for (let i = 0; i < settings.cameras.length; i++) {
        const camera = settings.cameras[i];
        const row = document.createElement('div');
        row.className = ROW_CLASS;
        const select = document.createElement('button');
        select.type = 'button';
        const label = document.createTextNode('');
        const key = makeKeySpan('');
        select.append(label, key);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = REMOVE_TEXT;
        row.append(select, remove);
        const part: RowParts = { id: camera.id, select, label, key, remove };
        fillRow(part, i, camera.id, shotText(camera), camera.id === settings.mainCameraId);
        parts.push(part);
        rows.push(row);
      }
      rowParts = parts;
      cameraList.replaceChildren(...rows);
      if (focusedId !== null) {
        const again = cameraList.querySelector<HTMLElement>(`button[${ATTR_SELECT}="${focusedId}"]`);
        if (again !== null) again.focus();
      }
    }
    editingNote.textContent = `${EDITING_PREFIX} ${settings.mainCameraId}.`;

    const main = settings.cameras.find((c) => c.id === settings.mainCameraId);
    if (main !== undefined) {
      placementValue('bearingDeg', main.bearingDeg);
      placementValue('heightM', main.heightM);
      placementValue('horizontalDistanceM', main.horizontalDistanceM);
      shotTypeSelect.value = main.shotType;
      shotTypeSelect.title = SHOT_TYPE_TERMS[main.shotType].text;
      setLens(main.lensMm);
    }
    lengthInput.value = String(settings.shotLengthFrames);
    for (const input of placementInputs.values()) input.removeAttribute('aria-invalid');
    lengthInput.removeAttribute('aria-invalid');
  }

  function placementValue(field: string, value: number): void {
    const input = placementInputs.get(field);
    if (input !== undefined) input.value = String(value);
  }

  show(getSettings());
  setRegionEmpty(CONTROLS_EMPTY_ID, false);

  return { show, setLens, setMode };
}

/** The Term_Text line for a placement field (bearing, height, horizontal distance). */
function termTitleFor(spec: FieldSpec): string {
  switch (spec.field) {
    case 'bearingDeg':
      return MEASURE_TERMS.bearing.text;
    case 'heightM':
      return MEASURE_TERMS.height.text;
    case 'horizontalDistanceM':
      return MEASURE_TERMS.horizontalDistance.text;
  }
}
