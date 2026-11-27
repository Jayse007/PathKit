// Inventory thumbnails (Task 20.2): small SVG drawings made by the project, as plain data.
// The DOM builder turns each shape into an SVG element. No colours here: strokes use currentColor.
import type { MachineId } from '../data/catalogue-types.js';

export const THUMBNAIL_WIDTH = 120;
export const THUMBNAIL_HEIGHT = 72;

export interface ThumbnailShape {
  readonly tag: 'rect' | 'circle' | 'line' | 'polygon';
  readonly attrs: Readonly<Record<string, string>>;
}

const PUMP: readonly ThumbnailShape[] = [
  { tag: 'rect', attrs: { x: '8', y: '24', width: '30', height: '26', rx: '2' } }, // motor
  { tag: 'rect', attrs: { x: '40', y: '28', width: '16', height: '18' } }, // bearing housing
  { tag: 'line', attrs: { x1: '8', y1: '37', x2: '84', y2: '37' } }, // shaft
  { tag: 'circle', attrs: { cx: '76', cy: '37', r: '22' } }, // casing
  { tag: 'circle', attrs: { cx: '76', cy: '37', r: '10' } }, // impeller
  { tag: 'rect', attrs: { x: '92', y: '29', width: '20', height: '16' } }, // outlet
  { tag: 'line', attrs: { x1: '4', y1: '62', x2: '116', y2: '62' } }, // bench
];

const HEAT_EXCHANGER: readonly ThumbnailShape[] = [
  { tag: 'rect', attrs: { x: '20', y: '22', width: '80', height: '30', rx: '3' } }, // shell
  { tag: 'rect', attrs: { x: '8', y: '24', width: '12', height: '26' } }, // bonnet
  { tag: 'rect', attrs: { x: '100', y: '24', width: '12', height: '26' } }, // rear head
  { tag: 'line', attrs: { x1: '20', y1: '30', x2: '100', y2: '30' } }, // tube
  { tag: 'line', attrs: { x1: '20', y1: '37', x2: '100', y2: '37' } }, // tube
  { tag: 'line', attrs: { x1: '20', y1: '44', x2: '100', y2: '44' } }, // tube
  { tag: 'rect', attrs: { x: '36', y: '12', width: '10', height: '10' } }, // nozzle
  { tag: 'rect', attrs: { x: '76', y: '52', width: '10', height: '10' } }, // nozzle
  { tag: 'line', attrs: { x1: '4', y1: '66', x2: '116', y2: '66' } }, // bench
];

const DESK_LAMP: readonly ThumbnailShape[] = [
  { tag: 'rect', attrs: { x: '18', y: '56', width: '34', height: '8', rx: '2' } }, // base
  { tag: 'line', attrs: { x1: '35', y1: '56', x2: '50', y2: '30' } }, // lower arm
  { tag: 'line', attrs: { x1: '50', y1: '30', x2: '82', y2: '16' } }, // upper arm
  { tag: 'circle', attrs: { cx: '50', cy: '30', r: '3' } }, // joint
  { tag: 'polygon', attrs: { points: '76,14 104,14 112,34 68,34' } }, // shade
  { tag: 'circle', attrs: { cx: '90', cy: '42', r: '4' } }, // bulb
];

const SHAPES: Readonly<Record<MachineId, readonly ThumbnailShape[]>> = {
  pump: PUMP,
  'heat-exchanger': HEAT_EXCHANGER,
  'desk-lamp': DESK_LAMP,
};

/** The shapes of one Machine's thumbnail. Each has at least five shapes, all inside the viewBox. */
export function thumbnailShapes(machine: MachineId): readonly ThumbnailShape[] {
  return SHAPES[machine];
}

/** Build the SVG element for a Machine's card. Decorative: the card's text names the Machine. */
export function buildThumbnail(doc: Document, machine: MachineId): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}`);
  svg.setAttribute('width', String(THUMBNAIL_WIDTH));
  svg.setAttribute('height', String(THUMBNAIL_HEIGHT));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const shape of thumbnailShapes(machine)) {
    const node = doc.createElementNS(ns, shape.tag);
    for (const [name, value] of Object.entries(shape.attrs)) {
      node.setAttribute(name, value);
    }
    svg.appendChild(node);
  }
  return svg;
}
