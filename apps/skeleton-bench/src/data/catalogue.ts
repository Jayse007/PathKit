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
    explodeVector: [-0.17, 0, 0],
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
    explodeVector: [-0.06, -0.2, 0],
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
    explodeVector: [0, 0, 0.36],
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
    explodeVector: [-0.03, -0.44, 0],
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
    explodeVector: [-0.08, -0.05, 0.04],
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
    explodeVector: [0.07, -0.13, -0.14],
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
    explodeVector: [0.2, 0.39, -0.18],
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
    explodeVector: [0, 0.27, 0.19],
    extents: [0.2, 0.06, 0.2],
  },
];

export const PUMP_MACHINE: MachineEntry = {
  id: 'pump',
  name: 'Pump',
  partIds: PUMP_PARTS.map((p) => p.id),
};

// Heat_Exchanger layout (Task 18.1): shell-and-tube, shell along x, channel head at -x. Metres.
// Facts come from docs/sources.md (ids hx-*). Text is waiting for User approval (Task 18.2).
// Rest and end boxes stay inside x +-1.2, y +-0.6, z +-0.4. Order = keyboard order and tour order, from the channel head end.
// End centres at Explode_Amount 100 (rest + explode vector), hand-checked pair gaps are in docs/build-notes.md.
export const HEAT_EXCHANGER_PARTS: readonly PartEntry[] = [
  {
    id: 'hx-channel-head',
    name: 'Channel head',
    job: 'An end cover that directs the tube-side fluid into and out of the tube bundle. A head cover caps the end of the tube sheet to contain that fluid. A bonnet, a similar end cover, gives access to the tubes for inspection and cleaning.',
    material: 'A bonnet, which is a similar end cover, is typically stainless steel or carbon steel.',
    positionText: 'At an end of the shell. A bonnet is attached to the end of the shell with bolts or clamps.',
    sourceId: 'hx-channel-head',
    restPosition: [-0.85, 0, 0],
    explodeVector: [-0.17, 0, 0],
    extents: [0.3, 0.42, 0.42],
  },
  {
    id: 'hx-tube-sheet',
    name: 'Tube sheet',
    job: 'A thick metal plate with holes drilled through it. The tube ends are fixed in the holes, so the tubes are held in place and rigidly supported, and the fluid inside the tubes stays separate from the fluid in the shell.',
    material: 'A thick metal plate. The metal is not stated by the sources.',
    positionText: 'At the ends of the shell, where the tubes end. The model shows one tube sheet, at the channel head end.',
    sourceId: 'hx-tube-sheet',
    restPosition: [-0.675, 0, 0],
    explodeVector: [-0.075, 0.07, 0],
    extents: [0.05, 0.42, 0.42],
  },
  {
    id: 'hx-shell',
    name: 'Shell',
    job: 'The outer cylindrical vessel. It holds the shell-side fluid and encloses the tube bundle and the other internal parts.',
    material: 'Carbon steel is the most widely used material, though the choice depends on the operating conditions and the fluid. Specialised alloys are also used.',
    positionText: 'The outermost part, surrounding the tube bundle.',
    sourceId: 'hx-shell',
    restPosition: [0.05, 0, 0],
    explodeVector: [0.1, -0.15, 0.19],
    extents: [1.4, 0.4, 0.4],
  },
  {
    id: 'hx-tube-bundle',
    name: 'Tube bundle',
    job: 'A bundle of many parallel tubes. One fluid flows through the tubes. The tube walls keep the two fluids apart and are the surface that heat passes through.',
    material: 'Tubes are mostly carbon steel. Stainless steel, cupronickel, copper, brass and aluminium are also used.',
    positionText: 'Inside the shell, with the tubes running parallel along its length.',
    sourceId: 'hx-tube-bundle',
    restPosition: [0.05, 0, 0],
    explodeVector: [0.1, 0, -0.25],
    extents: [1.3, 0.2, 0.2],
  },
  {
    id: 'hx-baffles',
    name: 'Baffles',
    job: 'Plates inside the shell. They support the tubes and reduce their vibration. They also make the shell-side fluid change direction again and again, which creates turbulence and improves heat transfer.',
    material: 'Metal plate. The metal is not stated by the sources.',
    positionText: 'Inside the shell, spaced out along the tubes. Each baffle has holes for the tubes to pass through.',
    sourceId: 'hx-baffles',
    restPosition: [0.05, 0, 0],
    explodeVector: [0, 0.4, 0],
    extents: [0.9, 0.32, 0.32],
  },
  {
    id: 'hx-nozzles',
    name: 'Nozzles',
    job: 'The inlet and outlet connections for the shell-side and tube-side fluids. Each is a small pipe section with a flange on the outer end to connect to the pipework.',
    material: 'Not stated by the sources.',
    positionText: 'On both the shell side and the tube side, welded to the shell or to the bonnet end cover. The model shows them as one group on top of the shell.',
    sourceId: 'hx-nozzles',
    restPosition: [0.05, 0.27, 0],
    explodeVector: [0, 0, -0.32],
    extents: [0.8, 0.14, 0.12],
  },
];

export const HEAT_EXCHANGER_MACHINE: MachineEntry = {
  id: 'heat-exchanger',
  name: 'Heat exchanger',
  partIds: HEAT_EXCHANGER_PARTS.map((p) => p.id),
};

// Desk_Lamp layout (Task 18.1): balanced-arm desk lamp, arms lean towards +x. Metres.
// Facts come from docs/sources.md (ids lamp-*). Text is waiting for User approval (Task 18.2).
// Rest and end boxes stay inside x +-1.2, y +-0.6, z +-0.4. Order = keyboard order and tour order, from the base up.
export const DESK_LAMP_PARTS: readonly PartEntry[] = [
  {
    id: 'lamp-base',
    name: 'Base',
    job: 'Gives the lamp its footing. A weighted desk or table base keeps the lamp from tipping when the arm is extended. Clamp and grommet mounts are alternatives that need no heavy base.',
    material: 'Not stated by the sources.',
    positionText: 'At the bottom of the lamp, on the desk or table.',
    sourceId: 'lamp-base',
    restPosition: [-0.5, -0.5, 0],
    explodeVector: [-0.3, 0, 0],
    extents: [0.5, 0.1, 0.5],
  },
  {
    id: 'lamp-lower-arm',
    name: 'Lower arm',
    job: 'One of the two connected arms. The jointed arms let the shade be moved up, down, forwards and backwards. Springs or other balancing mechanisms help the lamp hold its position.',
    material: 'Lamps with aluminium or steel arms and joints are more stable and carry more weight than plastic ones.',
    positionText: 'The arm nearer the base. The sources describe two connected arms between the base and the lamp head. The names lower and upper are this app\'s.',
    sourceId: 'lamp-lower-arm',
    restPosition: [-0.4, -0.15, 0],
    explodeVector: [0, 0.15, 0],
    extents: [0.3, 0.6, 0.1],
  },
  {
    id: 'lamp-joint',
    name: 'Joint',
    job: 'The pivot where arm segments meet. In a spring-balanced lamp each joint acts as a lever. Spring tension balances the turning force from the lamp\'s weight, and friction in the joint helps hold the arm in its final position.',
    material: 'Aluminium or steel joints are sturdier than plastic ones.',
    positionText: 'Where arm segments meet. The model shows the joint between the lower and upper arm.',
    sourceId: 'lamp-joint',
    restPosition: [-0.3, 0.2, 0],
    explodeVector: [0, 0, 0.25],
    extents: [0.12, 0.12, 0.16],
  },
  {
    id: 'lamp-upper-arm',
    name: 'Upper arm',
    job: 'The other of the two connected arms. It carries the lamp head. In a spring-balanced lamp the spring force nearly equals the weight of the lamp head and arm at any angle, so the arm stays where it is put.',
    material: 'Lamps with aluminium or steel arms and joints are more stable and carry more weight than plastic ones.',
    positionText: 'The arm farther from the base, reaching out to the shade.',
    sourceId: 'lamp-upper-arm',
    restPosition: [0.1, 0.22, 0],
    explodeVector: [0.15, 0, 0],
    extents: [0.8, 0.3, 0.1],
  },
  {
    id: 'lamp-shade',
    name: 'Shade',
    job: 'Surrounds the bulb and redirects its light. A cone-shaped metal shade helps direct light downward while reducing glare, and is a popular choice for task lighting.',
    material: 'Metal shades are made of steel, brass or aluminium. Other shades are made of fabric, parchment, glass, paper or plastic.',
    positionText: 'Around the bulb, on the lamp head at the end of the arms.',
    sourceId: 'lamp-shade',
    restPosition: [0.6, 0.15, 0],
    explodeVector: [0.35, -0.15, 0],
    extents: [0.3, 0.25, 0.3],
  },
  {
    id: 'lamp-bulb-holder',
    name: 'Bulb holder',
    job: 'Supports the bulb mechanically and provides its electrical connection. It lets the bulb be replaced safely and conveniently.',
    material: 'Ceramic insulation withstands much higher operating temperatures than bakelite or other plastics.',
    positionText: 'Inside the shade, where it holds the bulb.',
    sourceId: 'lamp-bulb-holder',
    restPosition: [0.6, 0.2, 0],
    explodeVector: [0.35, 0.1, 0],
    extents: [0.1, 0.14, 0.1],
  },
];

export const DESK_LAMP_MACHINE: MachineEntry = {
  id: 'desk-lamp',
  name: 'Desk lamp',
  partIds: DESK_LAMP_PARTS.map((p) => p.id),
};

export const CATALOGUE: Catalogue = {
  machines: [PUMP_MACHINE, HEAT_EXCHANGER_MACHINE, DESK_LAMP_MACHINE],
  parts: [...PUMP_PARTS, ...HEAT_EXCHANGER_PARTS, ...DESK_LAMP_PARTS],
};
