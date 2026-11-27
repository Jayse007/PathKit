import { describe, expect, it } from 'vitest';
import { CATALOGUE, PUMP_PARTS } from '../src/data/catalogue.js';
import type { MachineId } from '../src/data/catalogue-types.js';
import {
  EMPTY_INSPECTOR_TEXT,
  findMachinePart,
  inspectorContent,
  machineParts,
  modelSizeText,
  SAMPLE_DATA_LABEL,
  selectionAfterStageClick,
  togglePartSelection,
} from '../src/ui/inspector-text.js';
import { ABOUT_LINES } from '../src/ui/about-text.js';
import { escapeAction } from '../src/ui/input.js';
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH, thumbnailShapes } from '../src/ui/thumbnails.js';

// Task 20.2. Tests for the pure parts of the layout: Inspector text, Parts_List order, thumbnail data.
// The DOM builders (layout.ts, main.ts) are not run here: there is no browser in the tests.

const PUMP_IDS_IN_ORDER = [
  'pump-motor',
  'pump-bearing-housing',
  'pump-shaft',
  'pump-mechanical-seal',
  'pump-bolts',
  'pump-casing',
  'pump-impeller',
  'pump-flange',
];

describe('Inspector text', () => {
  it('uses the exact texts of Requirements 14.4 and 14.5', () => {
    expect(EMPTY_INSPECTOR_TEXT).toBe('Pick a part to read about it');
    expect(SAMPLE_DATA_LABEL).toBe('sample data');
  });

  it('with no Part selected, gives the empty message', () => {
    expect(inspectorContent(null)).toEqual({ kind: 'empty', message: 'Pick a part to read about it' });
  });

  it('for the Motor, shows name, job, material, position text and the sample model size', () => {
    const motor = PUMP_PARTS[0];
    const content = inspectorContent(motor);
    if (content.kind !== 'part') throw new Error('expected a part content for the Motor');
    expect(content.name).toBe('Motor');
    expect(content.job).toBe(motor.job);
    expect(content.material).toBe(motor.material);
    expect(content.positionText).toBe(motor.positionText);
    expect(content.sampleSpecs).toEqual([
      { label: 'Model size (length x height x depth)', value: '500 x 400 x 400 mm' },
    ]);
  });

  it('turns metres into whole millimetres', () => {
    expect(modelSizeText([0.08, 0.44, 0.4])).toBe('80 x 440 x 400 mm');
    expect(modelSizeText([0.7, 0.06, 0.06])).toBe('700 x 60 x 60 mm');
  });

  it('rounds to the nearest millimetre, not down', () => {
    // 0.6, 1.4 and 0.4 mm round to 1, 1 and 0. 1.005 m is 1005 mm (1.005 * 1000 is 1004.9999999999999 in floating point, which must still give 1005).
    expect(modelSizeText([0.0006, 0.0014, 0.0004])).toBe('1 x 1 x 0 mm');
    expect(modelSizeText([1.005, 0.5, 0.25])).toBe('1005 x 500 x 250 mm');
  });
});

describe('Parts_List order', () => {
  it('lists the eight Pump Parts in catalogue order', () => {
    expect(machineParts(CATALOGUE, 'pump').map((p) => p.id)).toEqual(PUMP_IDS_IN_ORDER);
  });

  it('lists 8, 6 and 7 Parts for the three Machines, in the keyboard order of each Machine', () => {
    const expected: ReadonlyArray<readonly [MachineId, number]> = [
      ['pump', 8],
      ['heat-exchanger', 6],
      ['desk-lamp', 7],
    ];
    for (const [id, count] of expected) {
      const listed = machineParts(CATALOGUE, id).map((p) => p.id);
      const machine = CATALOGUE.machines.find((m) => m.id === id);
      if (machine === undefined) throw new Error(`machine ${id} is missing from the catalogue`);
      expect(listed.length).toBe(count);
      expect(listed).toEqual([...machine.partIds]);
    }
  });

  it('finds a Part of the current Machine and gives null for null or another Machine', () => {
    expect(findMachinePart(CATALOGUE, 'pump', 'pump-shaft')?.name).toBe('Shaft');
    expect(findMachinePart(CATALOGUE, 'pump', null)).toBeNull();
    expect(findMachinePart(CATALOGUE, 'pump', 'lamp-base')).toBeNull();
    expect(findMachinePart(CATALOGUE, 'pump', 'nope')).toBeNull();
  });

  it('gives an empty list for an unknown Machine', () => {
    expect(machineParts(CATALOGUE, 'nope' as MachineId)).toEqual([]);
  });
});

describe('Accordion selection rule (Requirement 14.10)', () => {
  it('opens a Part when nothing is open', () => {
    expect(togglePartSelection(null, 'pump-shaft')).toBe('pump-shaft');
  });

  it('closes the open Part when its button is activated again', () => {
    expect(togglePartSelection('pump-shaft', 'pump-shaft')).toBeNull();
  });

  it('switches to another Part when a different button is activated', () => {
    expect(togglePartSelection('pump-shaft', 'pump-motor')).toBe('pump-motor');
  });

  it('gives null after two activations of the same button from null', () => {
    expect(togglePartSelection(togglePartSelection(null, 'pump-bolts'), 'pump-bolts')).toBeNull();
  });
});

describe('Stage click selection rule (Requirement 14.13)', () => {
  it('keeps nothing selected when empty space is clicked with nothing selected', () => {
    expect(selectionAfterStageClick(null, null)).toBeNull();
  });

  it('clears the selection when empty space is clicked', () => {
    expect(selectionAfterStageClick('pump-shaft', null)).toBeNull();
  });

  it('selects the picked Part when nothing was selected', () => {
    expect(selectionAfterStageClick(null, 'pump-motor')).toBe('pump-motor');
  });

  it('switches to the picked Part when another Part was selected', () => {
    expect(selectionAfterStageClick('pump-shaft', 'pump-motor')).toBe('pump-motor');
  });

  it('keeps the Part selected when the selected Part is clicked again', () => {
    expect(selectionAfterStageClick('pump-shaft', 'pump-shaft')).toBe('pump-shaft');
  });
});

describe('Inventory thumbnails', () => {
  it('has at least five shapes for each of the three Machines, all with every number inside the viewBox', () => {
    const machines: readonly MachineId[] = ['pump', 'heat-exchanger', 'desk-lamp'];
    for (const machine of machines) {
      const shapes = thumbnailShapes(machine);
      if (shapes.length < 5) throw new Error(`thumbnail ${machine}: only ${shapes.length} shapes`);
      shapes.forEach((shape, index) => {
        for (const [name, value] of Object.entries(shape.attrs)) {
          if (name === 'points') {
            for (const pair of value.split(' ')) {
              const [x, y] = pair.split(',').map(Number);
              if (!(x >= 0 && x <= THUMBNAIL_WIDTH && y >= 0 && y <= THUMBNAIL_HEIGHT)) {
                throw new Error(`thumbnail ${machine} shape ${index}: point ${pair} is outside the viewBox`);
              }
            }
            continue;
          }
          const n = Number(value);
          const limit = name.startsWith('x') || name === 'cx' || name === 'width' ? THUMBNAIL_WIDTH : THUMBNAIL_HEIGHT;
          if (!Number.isFinite(n) || n < 0 || n > limit) {
            throw new Error(`thumbnail ${machine} shape ${index}: ${name}=${value} is outside the viewBox`);
          }
        }
      });
    }
  });
});

describe('Escape key and About text (Requirement 24)', () => {
  it('closes the About_Panel when it is open', () => {
    expect(escapeAction(true)).toBe('close-about');
  });

  it('clears the selection when the About_Panel is closed', () => {
    expect(escapeAction(false)).toBe('clear-selection');
  });

  it('says nothing about which parts use or do not use PathKit', () => {
    const text = ABOUT_LINES.join('\n');
    expect(text).not.toMatch(/not PathKit/i);
    expect(text).not.toMatch(/Three\.js/i);
    expect(text).toContain('The Machines are simplified models built from shapes');
    expect(text).toContain('PathKit cannot follow a live hand');
  });
});
