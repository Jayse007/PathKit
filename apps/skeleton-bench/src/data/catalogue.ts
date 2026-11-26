// The Part_Catalogue. The Pump entries are written in Task 14 (facts from docs/sources.md).
// The other two Machines are written in Task 18.
// The fixture below is a placeholder kept for the catalogue tests. It is not a machine fact.

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

// Pump layout: shaft along x, motor at -x, wet end (casing, impeller) at +x. Metres.
// Rest and end boxes (centre +- extents/2) stay inside x +-1.2, y +-0.6, z +-0.4.
// Order below is the keyboard order and the tour order, from the motor to the wet end.
export const PUMP_PARTS: readonly PartEntry[] = [
  {
    id: 'pump-motor',
    name: 'Motor',
    job: 'Supplies the turning power. It drives the shaft through a coupling. In a close-coupled pump the impeller can be mounted directly on the motor shaft.',
    material: 'Close-coupled pump motors are sold with cast iron frames.',
    positionText: 'At the drive end of the pump, opposite the wet end (casing and impeller).',
    sourceId: 'pump-motor',
    restPosition: [-0.75, -0.05, 0],
    explodeVector: [-0.15, 0, 0],
    extents: [0.5, 0.4, 0.4],
  },
  {
    id: 'pump-bearing-housing',
    name: 'Bearing housing',
    job: 'Holds the bearings that support the shaft and carry its radial and thrust loads, keeping the shaft in line.',
    material: 'The bearings inside are typically chrome steel or bronze sleeve bearings. The housing material is not stated by the sources.',
    positionText: 'Between the motor side and the wet end, around the shaft.',
    sourceId: 'pump-bearing-housing',
    restPosition: [-0.35, -0.02, 0],
    explodeVector: [-0.08, -0.2, 0],
    extents: [0.3, 0.3, 0.3],
  },
  {
    id: 'pump-shaft',
    name: 'Shaft',
    job: 'Carries the turning force from the motor to the impeller and holds the impeller in place.',
    material: 'Alloy steel such as AISI 4140 for general duty. 431 or duplex stainless steel where corrosion resistance is needed.',
    positionText: 'Runs from the drive end, through the bearing housing and the seal, to the impeller in the casing.',
    sourceId: 'pump-shaft',
    restPosition: [-0.15, 0, 0],
    explodeVector: [0, 0, 0.3],
    extents: [0.7, 0.06, 0.06],
  },
  {
    id: 'pump-mechanical-seal',
    name: 'Mechanical seal',
    job: 'Stops the pumped liquid leaking out along the turning shaft. One flat face turns with the shaft and one is fixed to the casing. The two faces are pressed together by springs and the pressure of the liquid, with a thin liquid film between them.',
    material: 'Faces of carbon, silicon carbide or tungsten carbide. Rubber-like secondary seals such as Viton or EPDM.',
    positionText: 'Where the shaft passes through the casing, in the seal chamber.',
    sourceId: 'pump-mechanical-seal',
    restPosition: [0.02, 0, 0],
    explodeVector: [0, -0.35, 0],
    extents: [0.12, 0.16, 0.16],
  },
  {
    id: 'pump-bolts',
    name: 'Bolts (one group)',
    job: 'Anchor bolts in the foundation tie the pump\'s baseplate, grout and foundation together. Capscrews fasten the pump\'s casing (volute) together.',
    material: 'Not stated by the sources.',
    positionText: 'Around the casing joint and at the base. The model shows them as one group at the casing joint.',
    sourceId: 'pump-bolts',
    restPosition: [0.12, 0, 0],
    explodeVector: [0, -0.1, 0.18],
    extents: [0.08, 0.44, 0.4],
  },
  {
    id: 'pump-casing',
    name: 'Casing',
    job: 'Houses the impeller, holds the pumped liquid and guides it from the impeller to the discharge. Its spiral (volute) shape turns the liquid\'s speed into pressure.',
    material: 'Cast iron is one common casing material. Ductile iron and stainless steel (SS316) are also used.',
    positionText: 'Surrounds the impeller at the wet end of the pump.',
    sourceId: 'pump-casing',
    restPosition: [0.4, 0, 0],
    explodeVector: [0, 0, -0.15],
    extents: [0.6, 0.5, 0.46],
  },
  {
    id: 'pump-impeller',
    name: 'Impeller',
    job: 'The rotating part with curved vanes. It throws the liquid outward and gives it speed and pressure. It has the largest effect on flow, head and efficiency.',
    material: 'Cast iron and stainless steel such as CF8M are used.',
    positionText: 'Inside the casing, on the end of the shaft.',
    sourceId: 'pump-impeller',
    restPosition: [0.38, 0, 0],
    explodeVector: [0.2, 0.25, 0],
    extents: [0.34, 0.34, 0.34],
  },
  {
    id: 'pump-flange',
    name: 'Flange',
    job: 'Connects the pump to the pipework. The suction flange takes liquid in and the discharge flange sends the pressurised liquid on.',
    material: 'Not stated by the sources.',
    positionText: 'In an end-suction pump the liquid enters at the end of the casing and leaves at the top. The model shows the discharge flange on top.',
    sourceId: 'pump-flange',
    restPosition: [0.5, 0.28, 0],
    explodeVector: [0, 0.25, 0],
    extents: [0.2, 0.06, 0.2],
  },
];

export const PUMP_MACHINE: MachineEntry = {
  id: 'pump',
  name: 'Pump',
  partIds: PUMP_PARTS.map((p) => p.id),
};

export const CATALOGUE: Catalogue = {
  machines: [PUMP_MACHINE],
  parts: [...PUMP_PARTS],
};
