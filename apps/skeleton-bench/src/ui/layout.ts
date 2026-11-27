// The page layout (Task 20.2, Requirement 20.1): Inventory on the left, Stage in the centre,
// Inspector on the right, Control_Bar at the bottom, Motion_Check as a small region.
// DOM only. All text is set with textContent (no HTML parsing). Not unit tested (no browser in the tests).
import type { Catalogue, MachineId, PartEntry } from '../data/catalogue-types.js';
import { inspectorContent, SAMPLE_DATA_LABEL } from './inspector-text.js';
import { buildThumbnail } from './thumbnails.js';

export interface Layout {
  readonly stageHost: HTMLElement;
  readonly motionCheckBody: HTMLElement;
  readonly controlBar: HTMLElement;
  /** Show which Machine card is current. */
  setCurrentMachine(machine: MachineId): void;
  /** Replace the Inspector text and the Parts_List for a Machine. Selected is the Part id or null. */
  setParts(parts: readonly PartEntry[], selectedId: string | null): void;
  /** Update the Inspector text and the pressed state of the Parts_List buttons. */
  setSelected(part: PartEntry | null): void;
  /** Show Motion_Check lines in plain words. */
  setMotionCheck(lines: readonly string[]): void;
}

export interface LayoutHandlers {
  onMachine(machine: MachineId): void;
  onPartActivate(partId: string): void;
  onPartFocus(partId: string | null): void;
}

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
  const inspectorBody = make(doc, 'div', { className: 'inspector-body' });
  inspectorBody.setAttribute('aria-live', 'polite');
  inspector.appendChild(inspectorBody);
  inspector.appendChild(make(doc, 'h3', { text: 'Parts' }));
  const partsList = make(doc, 'div', { id: 'parts-list', className: 'parts-list' });
  partsList.setAttribute('role', 'group');
  partsList.setAttribute('aria-label', 'Parts list');
  inspector.appendChild(partsList);

  // Control_Bar (bottom). The controls arrive in Task 20.4.
  const controlBar = make(doc, 'footer', { id: 'control-bar', className: 'control-bar', label: 'Control bar' });
  controlBar.appendChild(make(doc, 'p', { className: 'muted', text: 'Controls: the buttons and sliders are added in the next build step.' }));

  shell.appendChild(left);
  shell.appendChild(stageHost);
  shell.appendChild(inspector);
  shell.appendChild(controlBar);
  root.appendChild(shell);

  const buttons = new Map<string, HTMLButtonElement>();

  function setCurrentMachine(machine: MachineId): void {
    for (const [id, card] of cards) {
      card.setAttribute('aria-pressed', id === machine ? 'true' : 'false');
    }
  }

  function setParts(parts: readonly PartEntry[], selectedId: string | null): void {
    partsList.textContent = '';
    buttons.clear();
    for (const part of parts) {
      const button = make(doc, 'button', { className: 'part-button', text: part.name });
      button.type = 'button';
      button.setAttribute('aria-pressed', part.id === selectedId ? 'true' : 'false');
      button.addEventListener('click', () => handlers.onPartActivate(part.id));
      button.addEventListener('focus', () => handlers.onPartFocus(part.id));
      button.addEventListener('blur', () => handlers.onPartFocus(null));
      buttons.set(part.id, button);
      partsList.appendChild(button);
    }
  }

  function setSelected(part: PartEntry | null): void {
    for (const [id, button] of buttons) {
      button.setAttribute('aria-pressed', part !== null && id === part.id ? 'true' : 'false');
    }
    const content = inspectorContent(part);
    inspectorBody.textContent = '';
    if (content.kind === 'empty') {
      inspectorBody.appendChild(make(doc, 'p', { className: 'muted', text: content.message }));
      return;
    }
    inspectorBody.appendChild(make(doc, 'h3', { text: content.name }));
    const fields: ReadonlyArray<readonly [string, string]> = [
      ['Job', content.job],
      ['Material', content.material],
      ['Typical position', content.positionText],
    ];
    for (const [label, value] of fields) {
      const p = make(doc, 'p');
      p.appendChild(make(doc, 'strong', { text: `${label}: ` }));
      p.appendChild(doc.createTextNode(value));
      inspectorBody.appendChild(p);
    }
    for (const spec of content.sampleSpecs) {
      const p = make(doc, 'p');
      p.appendChild(make(doc, 'strong', { text: `${spec.label}: ` }));
      p.appendChild(doc.createTextNode(`${spec.value} `));
      p.appendChild(make(doc, 'span', { className: 'badge', text: `(${SAMPLE_DATA_LABEL})` }));
      inspectorBody.appendChild(p);
    }
  }

  function setMotionCheck(lines: readonly string[]): void {
    motionCheckBody.textContent = '';
    for (const line of lines) {
      motionCheckBody.appendChild(make(doc, 'li', { text: line }));
    }
  }

  return { stageHost, motionCheckBody, controlBar, setCurrentMachine, setParts, setSelected, setMotionCheck };
}
