// The Part_Catalogue. Task 13.1 holds a one-Part fixture only.
// The Pump entries are written in Task 14, the others in Task 18.
// The fixture text is a placeholder, not a machine fact.

import type { Catalogue, MachineEntry, PartEntry } from './catalogue-types.js';

export const FIXTURE_PART: PartEntry = {
  id: 'fixture-part',
  name: 'Fixture part',
  job: 'Placeholder text, not a machine fact.',
  material: 'Placeholder text, not a machine fact.',
  positionText: 'Placeholder text, not a machine fact.',
  sourceId: 'fixture',
  restPosition: [0, 0, 0],
  explodeVector: [0.5, 0, 0],
  extents: [0.2, 0.2, 0.2],
};

export const FIXTURE_MACHINE: MachineEntry = {
  id: 'pump',
  name: 'Fixture machine',
  partIds: ['fixture-part'],
};

export const FIXTURE_CATALOGUE: Catalogue = {
  machines: [FIXTURE_MACHINE],
  parts: [FIXTURE_PART],
};

export const CATALOGUE: Catalogue = FIXTURE_CATALOGUE;
