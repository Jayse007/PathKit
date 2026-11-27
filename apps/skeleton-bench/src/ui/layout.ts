// The page layout (Task 20.2, Requirement 20.1): Inventory on the left, Stage in the centre,
// Inspector on the right, Control_Bar at the bottom, Motion_Check as a small region.
// DOM only. All text is set with textContent (no HTML parsing). Not unit tested (no browser in the tests).
import type { Catalogue, MachineId, PartEntry } from '../data/catalogue-types.js';
import { TOUR_LOCKED_LABEL } from '../logic/tour-playback.js';
import { ABOUT_LINES, ABOUT_TITLE } from './about-text.js';
import { EMPTY_INSPECTOR_TEXT, inspectorContent, SAMPLE_DATA_LABEL } from './inspector-text.js';
import type { Look } from './storage.js';
import { buildThumbnail } from './thumbnails.js';

export interface Layout {
  readonly stageHost: HTMLElement;
  readonly motionCheckBody: HTMLElement;
  readonly controlBar: HTMLElement;
  /** Show which Machine card is current. */
  setCurrentMachine(machine: MachineId): void;
  /** Replace the Inspector text and the Parts_List for a Machine. Selected is the Part id or null. */
  setParts(parts: readonly PartEntry[], selectedId: string | null): void;
  /** Open only this Part's details (null closes all), update the empty line, and scroll the Inspector to the button. */
  setSelected(part: PartEntry | null): void;
  /** Show Motion_Check lines in plain words. */
  setMotionCheck(lines: readonly string[]): void;
  /** Bring the Control_Bar into step with the state (slider values, mode button text, readouts). */
  setControls(view: ControlsView): void;
  /** Show a one-line hint under the controls (empty text hides it). */
  setHint(text: string): void;
  /** Show an error under the controls. It says what went wrong and what to do (empty text hides it). */
  setMessage(text: string): void;
}

/** The part of the app state the Control_Bar shows. */
export interface ControlsView {
  readonly mode: 'rotate' | 'move';
  readonly orbitAngleDeg: number;
  readonly zoom: number;
  readonly explode: number;
  readonly look: Look;
  readonly tour: { readonly status: 'idle' | 'playing' | 'paused' };
}

export interface LayoutHandlers {
  onMachine(machine: MachineId): void;
  onPartActivate(partId: string): void;
  onPartFocus(partId: string | null): void;
  onModeToggle(): void;
  /** Orbit scrub moved: degrees 0 to 359. */
  onOrbitScrub(angleDeg: number): void;
  /** Zoom slider moved: 0 to 1. */
  onZoomSlider(zoom: number): void;
  /** Explode slider moved: 0 to 100. */
  onExplodeSlider(percent: number): void;
  onResetPosition(): void;
  onTour(): void;
  /** The Pause button; it reads Resume while the Tour is paused. */
  onTourPause(): void;
  onTourStop(): void;
  onLookToggle(): void;
}

/** Visible label text with the key hint beside it (Requirements 10.6, 21.2). */
export const CONTROL_LABELS = {
  mode: 'Mode (key M)',
  orbit: 'Orbit (drag, or keys \u2190 \u2192)',
  zoom: 'Zoom (wheel, or keys + \u2212)',
  explode: 'Explode (key E)',
  reset: 'Reset position (key R)',
  tour: 'Tour',
  tourPause: 'Pause tour',
  tourResume: 'Resume tour',
  tourStop: 'Stop tour',
  look: 'Look',
  about: 'About',
  gestures: 'Gestures (not available yet)',
} as const;

function make<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  options: { id?: string; className?: string; text?: string; label?: string } = {},
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (options.id !== undefined) node.id = options.id;
  if (options.className !== undefined) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.label !== undefined) node.setAttribute('aria-label', options.label);
  return node;
}

export function createLayout(doc: Document, root: HTMLElement, catalogue: Catalogue, handlers: LayoutHandlers): Layout {
  root.textContent = '';
  const shell = make(doc, 'div', { className: 'bench' });

  // Inventory (left): one card per Machine.
  const inventory = make(doc, 'nav', { id: 'inventory', className: 'region', label: 'Inventory' });
  inventory.appendChild(make(doc, 'h2', { text: 'Inventory' }));
  const cards = new Map<MachineId, HTMLButtonElement>();
  for (const machine of catalogue.machines) {
    const card = make(doc, 'button', { className: 'card' });
    card.type = 'button';
    card.appendChild(buildThumbnail(doc, machine.id));
    card.appendChild(make(doc, 'span', { className: 'card-name', text: machine.name }));
    card.setAttribute('aria-pressed', 'false');
    card.addEventListener('click', () => handlers.onMachine(machine.id));
    cards.set(machine.id, card);
    inventory.appendChild(card);
  }

  // Motion_Check (small region, under the Inventory).
  const motionCheck = make(doc, 'section', { id: 'motion-check', className: 'region small', label: 'Motion check' });
  motionCheck.appendChild(make(doc, 'h2', { text: 'Motion check' }));
  const motionCheckBody = make(doc, 'ul', { className: 'plain-list' });
  motionCheck.appendChild(motionCheckBody);
  const left = make(doc, 'div', { className: 'left-column' });
  left.appendChild(inventory);
  left.appendChild(motionCheck);

  // Stage (centre).
  const stageHost = make(doc, 'main', { id: 'stage', className: 'stage', label: 'Stage' });

  // Inspector (right) with the Parts_List.
  const inspector = make(doc, 'aside', { id: 'inspector', className: 'region', label: 'Inspector' });
  inspector.appendChild(make(doc, 'h2', { text: 'Inspector' }));
  // Shown only while no Part is selected (Requirement 14.5). No aria-live: the button's aria-expanded is announced.
  const emptyLine = make(doc, 'p', { className: 'muted', text: EMPTY_INSPECTOR_TEXT });
  inspector.appendChild(emptyLine);
  inspector.appendChild(make(doc, 'h3', { text: 'Parts' }));
  const partsList = make(doc, 'div', { id: 'parts-list', className: 'parts-list' });
  partsList.setAttribute('role', 'group');
  partsList.setAttribute('aria-label', 'Parts list');
  inspector.appendChild(partsList);

  // Control_Bar (bottom): Rotate / Move toggle, orbit scrub, zoom slider, explode slider, Reset position,
  // and a disabled Gestures toggle (Requirement 20.3). Tour and Look controls come in later tasks.
  const controlBar = make(doc, 'footer', { id: 'control-bar', className: 'control-bar', label: 'Control bar' });
  const controlRow = make(doc, 'div', { className: 'control-row' });

  const modeButton = make(doc, 'button', { id: 'mode-toggle', className: 'control-button' });
  modeButton.type = 'button';
  modeButton.addEventListener('click', () => handlers.onModeToggle());
  const modeGroup = make(doc, 'div', { className: 'control' });
  modeGroup.appendChild(make(doc, 'span', { className: 'control-label', text: CONTROL_LABELS.mode }));
  modeGroup.appendChild(modeButton);
  controlRow.appendChild(modeGroup);

  function addSlider(
    id: string,
    labelText: string,
    min: number,
    max: number,
    step: number,
    onInput: (value: number) => void,
  ): { input: HTMLInputElement; readout: HTMLSpanElement } {
    const group = make(doc, 'div', { className: 'control' });
    const label = doc.createElement('label');
    label.htmlFor = id;
    label.className = 'control-label';
    label.textContent = labelText;
    const input = doc.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.addEventListener('input', () => {
      const value = Number(input.value);
      if (Number.isFinite(value)) onInput(value);
    });
    const readout = make(doc, 'span', { className: 'control-readout' });
    group.appendChild(label);
    group.appendChild(input);
    group.appendChild(readout);
    controlRow.appendChild(group);
    return { input, readout };
  }
  const orbitControl = addSlider('orbit-scrub', CONTROL_LABELS.orbit, 0, 359, 1, (v) => handlers.onOrbitScrub(v));
  const zoomControl = addSlider('zoom-slider', CONTROL_LABELS.zoom, 0, 1, 0.01, (v) => handlers.onZoomSlider(v));
  const explodeControl = addSlider('explode-slider', CONTROL_LABELS.explode, 0, 100, 1, (v) => handlers.onExplodeSlider(v));

  const resetButton = make(doc, 'button', { id: 'reset-position', className: 'control-button', text: CONTROL_LABELS.reset });
  resetButton.type = 'button';
  resetButton.addEventListener('click', () => handlers.onResetPosition());
  controlRow.appendChild(resetButton);

  // Tour controls (Requirement 16.1, 16.4): Tour is always shown; Pause and Stop show while a Tour is not idle.
  const tourGroup = make(doc, 'div', { className: 'control tour-group' });
  tourGroup.setAttribute('role', 'group');
  tourGroup.setAttribute('aria-label', 'Tour');
  const tourButtons = make(doc, 'div', { className: 'control-row-inline' });
  const tourButton = make(doc, 'button', { id: 'tour-button', className: 'control-button', text: CONTROL_LABELS.tour });
  tourButton.type = 'button';
  tourButton.addEventListener('click', () => handlers.onTour());
  const pauseButton = make(doc, 'button', { id: 'tour-pause', className: 'control-button', text: CONTROL_LABELS.tourPause });
  pauseButton.type = 'button';
  pauseButton.hidden = true;
  pauseButton.addEventListener('click', () => handlers.onTourPause());
  const stopButton = make(doc, 'button', { id: 'tour-stop', className: 'control-button', text: CONTROL_LABELS.tourStop });
  stopButton.type = 'button';
  stopButton.hidden = true;
  stopButton.addEventListener('click', () => handlers.onTourStop());
  tourButtons.appendChild(tourButton);
  tourButtons.appendChild(pauseButton);
  tourButtons.appendChild(stopButton);
  tourGroup.appendChild(tourButtons);
  // Visible label while the Tour plays (Requirement 16.11). It is text, so it does not rely on colour.
  const lockedLabel = make(doc, 'span', { id: 'tour-locked-label', className: 'control-readout', text: TOUR_LOCKED_LABEL });
  lockedLabel.hidden = true;
  tourGroup.appendChild(lockedLabel);
  controlRow.appendChild(tourGroup);

  // Look toggle (Requirement 17.1): the button names the current Look and says what a press does.
  const lookButton = make(doc, 'button', { id: 'look-toggle', className: 'control-button' });
  lookButton.type = 'button';
  lookButton.addEventListener('click', () => handlers.onLookToggle());
  controlRow.appendChild(lookButton);

  // About button (Requirement 24.10) and the About_Panel it opens.
  const aboutButton = make(doc, 'button', { id: 'about-button', className: 'control-button', text: CONTROL_LABELS.about });
  aboutButton.type = 'button';
  aboutButton.setAttribute('aria-expanded', 'false');
  aboutButton.setAttribute('aria-controls', 'about-panel');
  controlRow.appendChild(aboutButton);

  const aboutPanel = make(doc, 'section', { id: 'about-panel', className: 'about-panel', label: ABOUT_TITLE });
  aboutPanel.hidden = true;
  aboutPanel.appendChild(make(doc, 'h2', { text: ABOUT_TITLE }));
  for (const line of ABOUT_LINES) aboutPanel.appendChild(make(doc, 'p', { text: line }));
  const aboutClose = make(doc, 'button', { id: 'about-close', className: 'control-button', text: 'Close' });
  aboutClose.type = 'button';
  aboutPanel.appendChild(aboutClose);
  function setAboutOpen(open: boolean): void {
    aboutPanel.hidden = !open;
    aboutButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) aboutClose.focus();
    else aboutButton.focus();
  }
  aboutButton.addEventListener('click', () => setAboutOpen(aboutPanel.hidden));
  aboutClose.addEventListener('click', () => setAboutOpen(false));

  // The Gestures toggle is shown disabled while Tier B is locked.
  const gesturesButton = make(doc, 'button', { id: 'gestures-toggle', className: 'control-button', text: CONTROL_LABELS.gestures });
  gesturesButton.type = 'button';
  gesturesButton.disabled = true;
  controlRow.appendChild(gesturesButton);

  const hintLine = make(doc, 'p', { id: 'control-hint', className: 'muted' });
  hintLine.setAttribute('role', 'status');
  hintLine.hidden = true;
  const messageLine = make(doc, 'p', { id: 'control-message', className: 'control-message' });
  messageLine.setAttribute('role', 'alert');
  messageLine.hidden = true;
  controlBar.appendChild(controlRow);
  controlBar.appendChild(hintLine);
  controlBar.appendChild(messageLine);

  shell.appendChild(left);
  shell.appendChild(stageHost);
  shell.appendChild(aboutPanel);
  shell.appendChild(inspector);
  shell.appendChild(controlBar);
  root.appendChild(shell);

  let lastTourStatus: 'idle' | 'playing' | 'paused' = 'idle';
  const buttons = new Map<string, HTMLButtonElement>();
  const panels = new Map<string, HTMLElement>();

  /** Open or close one Part's details and keep aria-expanded in step with the hidden state. */
  function setOpen(id: string, open: boolean): void {
    buttons.get(id)?.setAttribute('aria-expanded', open ? 'true' : 'false');
    const panel = panels.get(id);
    if (panel !== undefined) panel.hidden = !open;
  }

  /** The panel under a button: Job, Material, Typical position and the sample specification. */
  function buildPanel(part: PartEntry, panelId: string, buttonId: string): HTMLDivElement {
    const panel = make(doc, 'div', { id: panelId, className: 'part-panel' });
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', buttonId);
    const content = inspectorContent(part);
    if (content.kind !== 'part') return panel;
    const fields: ReadonlyArray<readonly [string, string]> = [
      ['Job', content.job],
      ['Material', content.material],
      ['Typical position', content.positionText],
    ];
    for (const [label, value] of fields) {
      const p = make(doc, 'p');
      p.appendChild(make(doc, 'strong', { text: `${label}: ` }));
      p.appendChild(doc.createTextNode(value));
      panel.appendChild(p);
    }
    for (const spec of content.sampleSpecs) {
      const p = make(doc, 'p');
      p.appendChild(make(doc, 'strong', { text: `${spec.label}: ` }));
      p.appendChild(doc.createTextNode(`${spec.value} `));
      p.appendChild(make(doc, 'span', { className: 'badge', text: `(${SAMPLE_DATA_LABEL})` }));
      panel.appendChild(p);
    }
    return panel;
  }

  function setCurrentMachine(machine: MachineId): void {
    for (const [id, card] of cards) {
      card.setAttribute('aria-pressed', id === machine ? 'true' : 'false');
    }
  }

  function setParts(parts: readonly PartEntry[], selectedId: string | null): void {
    partsList.textContent = '';
    buttons.clear();
    panels.clear();
    for (const part of parts) {
      const buttonId = `part-button-${part.id}`;
      const panelId = `part-panel-${part.id}`;
      const button = make(doc, 'button', { id: buttonId, className: 'part-button', text: part.name });
      button.type = 'button';
      button.setAttribute('aria-controls', panelId);
      button.addEventListener('click', () => handlers.onPartActivate(part.id));
      button.addEventListener('focus', () => handlers.onPartFocus(part.id));
      button.addEventListener('blur', () => handlers.onPartFocus(null));
      const heading = make(doc, 'h4', { className: 'part-heading' });
      heading.appendChild(button);
      buttons.set(part.id, button);
      panels.set(part.id, buildPanel(part, panelId, buttonId));
      setOpen(part.id, part.id === selectedId);
      partsList.appendChild(heading);
      const panel = panels.get(part.id);
      if (panel !== undefined) partsList.appendChild(panel);
    }
  }

  function setSelected(part: PartEntry | null): void {
    for (const id of buttons.keys()) {
      setOpen(id, part !== null && id === part.id);
    }
    emptyLine.hidden = part !== null;
    if (part === null) return;
    const button = buttons.get(part.id);
    if (button === undefined) return;
    // Scroll only the Inspector (not the page), so this Part's button is at its top (Requirement 14.11).
    // #inspector is position: relative, so offsetTop is measured from the Inspector.
    const reduced = doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
    inspector.scrollTo({ top: button.offsetTop, behavior: reduced ? 'auto' : 'smooth' });
  }

  function setMotionCheck(lines: readonly string[]): void {
    motionCheckBody.textContent = '';
    for (const line of lines) {
      motionCheckBody.appendChild(make(doc, 'li', { text: line }));
    }
  }

  function setControls(view: ControlsView): void {
    modeButton.textContent = view.mode === 'rotate' ? 'Rotate (press M for Move)' : 'Move (press M for Rotate)';
    modeButton.setAttribute('aria-pressed', view.mode === 'move' ? 'true' : 'false');
    // The scrub shows the angle wrapped to 0 to 359 whole degrees.
    const wrapped = Math.floor((((view.orbitAngleDeg % 360) + 360) % 360) + 0.5) % 360;
    orbitControl.input.value = String(wrapped);
    orbitControl.readout.textContent = `${wrapped}\u00b0`;
    zoomControl.input.value = String(view.zoom);
    zoomControl.readout.textContent = `${Math.round(view.zoom * 100)}%`;
    explodeControl.input.value = String(view.explode);
    explodeControl.readout.textContent = `${Math.round(view.explode)}%`;

    // Look button: names the current Look and what a press does.
    const xray = view.look === 'X_Ray_Skeleton';
    lookButton.textContent = `${CONTROL_LABELS.look}: ${xray ? 'X-ray skeleton' : 'Clean engineering'} (press for ${xray ? 'Clean engineering' : 'X-ray skeleton'})`;
    lookButton.setAttribute('aria-pressed', xray ? 'false' : 'true');

    // Tour controls. The orbit, zoom, explode and move controls are disabled while the Tour plays and also
    // while it is paused: the state accepts them when paused, but the Stage still shows the Tour camera,
    // so a change would not be visible. The locked label shows with them.
    const status = view.tour.status;
    const locked = status !== 'idle';
    orbitControl.input.disabled = locked;
    zoomControl.input.disabled = locked;
    explodeControl.input.disabled = locked;
    resetButton.disabled = locked;
    lockedLabel.hidden = !locked;
    tourButton.disabled = status !== 'idle';
    pauseButton.hidden = status === 'idle';
    stopButton.hidden = status === 'idle';
    pauseButton.textContent = status === 'paused' ? CONTROL_LABELS.tourResume : CONTROL_LABELS.tourPause;
    // A disabled or hidden button loses focus, so hand it to the button that takes over.
    if (status !== lastTourStatus) {
      const active = doc.activeElement;
      const onTourControl = active === tourButton || active === pauseButton || active === stopButton || active === doc.body;
      if (onTourControl) {
        if (status !== 'idle' && lastTourStatus === 'idle') pauseButton.focus();
        else if (status === 'idle') tourButton.focus();
      }
      lastTourStatus = status;
    }
  }

  function setHint(text: string): void {
    hintLine.textContent = text;
    hintLine.hidden = text === '';
  }

  function setMessage(text: string): void {
    messageLine.textContent = text;
    messageLine.hidden = text === '';
  }

  return {
    stageHost,
    motionCheckBody,
    controlBar,
    setCurrentMachine,
    setParts,
    setSelected,
    setMotionCheck,
    setControls,
    setHint,
    setMessage,
  };
}
