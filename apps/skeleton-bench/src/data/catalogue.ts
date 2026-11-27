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

// Heat_Exchanger layout (Task 18.3): U-tube shell-and-tube exchanger (TEMA BEU), axis along x. Metres.
// Texts and layout come from docs/design-pack-18-3.md and docs/sources.md (ids hx-*). Waiting for the User's approval (Task 18.2).
// Rest and end boxes stay inside x +-1.2, y +-0.6, z +-0.4. Order = keyboard order and tour order, front to rear.
// End centres: bonnet (-1.02, 0, 0); tube sheet (-0.75, 0.07, 0); shell (0.15, -0.15, 0.19);
// tube bundle (0.1, 0, -0.25); baffles (0.05, 0.4, 0); shell nozzles (0.05, 0.29, -0.32).
// Explode lengths: 0.17, 0.1026, 0.2618, 0.2693, 0.4, 0.3214 (all at least 0.1). Smallest gap 0.095 m (bonnet and tube sheet).
export const HEAT_EXCHANGER_PARTS: readonly PartEntry[] = [
  {
    id: 'hx-bonnet',
    name: 'Bonnet (front head)',
    job: 'The cap on the front end. It receives the tube-side fluid through one nozzle, sends it into the tubes and collects it again on the way out. A pass partition plate inside the cap (not shown) separates the tube passes, where a pass is one trip of the fluid along the length of the exchanger. A bonnet also gives access to the tubes and the parts inside.',
    material: 'Typically metal, such as stainless steel or carbon steel.',
    positionText: 'On the front end of the shell, where the tubes end. It is attached to the shell with bolts or clamps. In this model the partition is horizontal: the fluid enters at the top nozzle, runs along the upper tube legs, turns in the U-bends and returns along the lower legs to the bottom nozzle.',
    sourceId: 'hx-bonnet',
    restPosition: [-0.85, 0, 0],
    explodeVector: [-0.17, 0, 0],
    extents: [0.3, 0.66, 0.42],
  },
  {
    id: 'hx-tube-sheet',
    name: 'Tube sheet',
    job: 'A thick round metal plate with holes drilled through it. Each tube end is fixed in a hole with a leak-free joint, made by rolling the tube. A U-tube exchanger has only one tube sheet, because both ends of every tube go into it. The bundle is free at the U-bend end, so it can expand and contract with temperature without straining the plate.',
    material: 'A thick metal plate. The metal is not stated by the sources.',
    positionText: 'At the front end of the shell, where all the tube ends are held.',
    sourceId: 'hx-tube-sheet',
    restPosition: [-0.675, 0, 0],
    explodeVector: [-0.075, 0.07, 0],
    extents: [0.05, 0.42, 0.42],
  },
  {
    id: 'hx-shell',
    name: 'Shell',
    job: 'The outer vessel: a closed cylinder that holds the shell-side fluid, which flows over the outside of the tubes. It encloses the tube bundle. In a U-tube exchanger the whole bundle can be pulled out of the shell for cleaning and replacement. Large shells are made by rolling a metal plate and welding it along its length.',
    material: 'Carbon steel is the most widely used material for the shell.',
    positionText: 'The outermost part, around the tube bundle. The two shell nozzles are on top of it. In this model the rear end is a rounded closed end.',
    sourceId: 'hx-shell',
    restPosition: [0.05, 0, 0],
    explodeVector: [0.1, -0.15, 0.19],
    extents: [1.4, 0.4, 0.4],
  },
  {
    id: 'hx-tube-bundle',
    name: 'U-tube bundle',
    job: 'Many tubes, each bent into a U. One fluid flows inside the tubes and the other flows over their outside, so heat passes through the tube walls, which also keep the two fluids apart. U-tubes are usually the most economical way to cope with differential thermal expansion, which means the tubes and the shell growing by different amounts. Two limits: the inside of the bends cannot be cleaned effectively, and single tubes, especially inner ones, are hard to replace.',
    material: 'Tubes are mostly carbon steel. Stainless steel, cupronickel, copper, brass and aluminium are also used.',
    positionText: 'Inside the shell, running along its length, with both ends of every tube in the tube sheet and the U-bends at the rear. The model shows 17 U-tubes. A real bundle holds many more.',
    sourceId: 'hx-tube-bundle',
    restPosition: [0, 0, 0],
    explodeVector: [0.1, 0, -0.25],
    extents: [1.3, 0.24, 0.28],
  },
  {
    id: 'hx-baffles',
    name: 'Baffles and tie rods',
    job: 'Plates across the inside of the shell. They support the tubes so that they do not vibrate, and they make the shell-side fluid zig-zag across the tubes instead of taking a short cut. Each plate is a circle with a flat piece cut away (the window) and holes in the same pattern as the tube sheet. A window of 20 to 35 percent of the shell diameter is recommended. Tie rods, with spacer tubes over them, hold the baffles at their places.',
    material: 'Metal plate. The metal is not stated by the sources.',
    positionText: 'Inside the shell, spaced along the tube bundle, with the window at the top on one plate and at the bottom on the next. The model shows five baffles with 25 percent windows and four tie rods. The spacer tubes are not shown.',
    sourceId: 'hx-baffles',
    restPosition: [0.05, 0, 0],
    explodeVector: [0, 0.4, 0],
    extents: [0.9, 0.32, 0.32],
  },
  {
    id: 'hx-shell-nozzles',
    name: 'Shell nozzles',
    job: 'The inlet and outlet connections for the shell-side fluid. Each is a small pipe section welded to the shell, and it joins the exchanger to the plant piping. Under a fast inlet nozzle an impingement plate (not shown) stops the jet from hitting the tubes directly, which could wear them away.',
    material: 'Not stated by the sources.',
    positionText: 'On top of the shell, one near each end, drawn with a flange ring on the outer end. The tube-side nozzles are on the bonnet.',
    sourceId: 'hx-shell-nozzles',
    restPosition: [0.05, 0.26, 0],
    explodeVector: [0, 0.03, -0.32],
    extents: [0.8, 0.14, 0.12],
  },
];

export const HEAT_EXCHANGER_MACHINE: MachineEntry = {
  id: 'heat-exchanger',
  name: 'Heat exchanger',
  partIds: HEAT_EXCHANGER_PARTS.map((p) => p.id),
};

// Desk_Lamp layout (Task 18.3): spring-balanced arm lamp, arms lean towards +x. Metres.
// Texts and layout come from docs/design-pack-18-3.md and docs/sources.md (ids lamp-*). Waiting for the User's approval (Task 18.2).
// Rest and end boxes stay inside x +-1.2, y +-0.6, z +-0.4. Order = keyboard order and tour order, from the base up.
// End centres: base (-0.8, -0.5, 0); upper arm (-0.4, 0, 0); spring (-0.3, -0.15, -0.3); elbow joint (-0.3, 0.2, 0.25);
// forearm (0.25, 0.22, 0); shade (0.95, 0, 0); bulb holder (0.95, 0.3, 0).
// Explode lengths: 0.3, 0.15, 0.3162, 0.25, 0.15, 0.3808, 0.364 (all at least 0.1). Smallest gap 0.10 m (upper arm and forearm).
export const DESK_LAMP_PARTS: readonly PartEntry[] = [
  {
    id: 'lamp-base',
    name: 'Base',
    job: 'A broad, heavy foot. Its weight stops the lamp tipping over when the arm is stretched out. The whole arm assembly can turn on it in the horizontal plane. In some designs the weight of the base is also needed to avoid over-balancing.',
    material: 'Not stated by the sources.',
    positionText: 'At the bottom, on the desk. The model includes the short post on top of the disc, where the upper arm pivots. Wikipedia lists it as the stand or body.',
    sourceId: 'lamp-base',
    restPosition: [-0.5, -0.5, 0],
    explodeVector: [-0.3, 0, 0],
    extents: [0.5, 0.1, 0.5],
  },
  {
    id: 'lamp-upper-arm',
    name: 'Upper arm',
    job: 'The arm that rises from the base. It is built from two parallel bars. Together with the forearm it forms a parallelogram linkage, a four-bar frame whose opposite sides stay parallel, so the lamp head keeps pointing in the same direction when the height changes. The names upper arm and forearm follow Wikipedia.',
    material: 'Lamps with aluminium or steel arms and joints are more stable and carry more weight than plastic ones.',
    positionText: 'From the base up to the elbow joint, leaning towards the lamp head. The spring sits between its two bars.',
    sourceId: 'lamp-upper-arm',
    restPosition: [-0.4, -0.15, 0],
    explodeVector: [0, 0.15, 0],
    extents: [0.3, 0.6, 0.1],
  },
  {
    id: 'lamp-spring',
    name: 'Spring',
    job: 'A coil spring that pulls on the arm to cancel the pull of gravity. Its tension nearly equals the weight of the lamp head and arm at any angle, so the lamp stays where it is put. For the balance to hold at every angle, the spring tension must grow in proportion to its total length, so a close-coiled spring with an effectively zero free length is used.',
    material: 'Not stated by the sources.',
    positionText: 'Along the upper arm, between its two bars. The model has one spring. Some lamps use two springs side by side, or compression springs. The first Anglepoise design had its springs at the base.',
    sourceId: 'lamp-spring',
    restPosition: [-0.4, -0.15, 0],
    explodeVector: [0.1, 0, -0.3],
    extents: [0.2, 0.52, 0.06],
  },
  {
    id: 'lamp-elbow',
    name: 'Elbow joint',
    job: 'The hinged pivot between the upper arm and the forearm. Each joint acts as a lever, and the spring tension is set up to cancel the turning effect of the lamp weight about the pivot. Friction in the joints helps lock the arm in its final position. The designer Carwardine noted that friction cannot be removed entirely.',
    material: 'Lamps with aluminium or steel arms and joints are more stable and carry more weight than plastic ones.',
    positionText: 'At the top of the upper arm, where it meets the forearm.',
    sourceId: 'lamp-elbow',
    restPosition: [-0.3, 0.2, 0],
    explodeVector: [0, 0, 0.25],
    extents: [0.12, 0.12, 0.16],
  },
  {
    id: 'lamp-forearm',
    name: 'Forearm',
    job: 'The second arm of the lamp. It carries the lamp head and is also built from two parallel bars. Moving the two arms changes the height and the reach of the head while the parallelogram linkage keeps the head pointing in the same direction.',
    material: 'Lamps with aluminium or steel arms and joints are more stable and carry more weight than plastic ones.',
    positionText: 'From the elbow joint out to the shade.',
    sourceId: 'lamp-forearm',
    restPosition: [0.1, 0.22, 0],
    explodeVector: [0.15, 0, 0],
    extents: [0.8, 0.3, 0.1],
  },
  {
    id: 'lamp-shade',
    name: 'Shade (lamp head)',
    job: 'Surrounds the bulb and redirects its light, and it can reduce glare. A metal shade sends the light downward in one direction, which suits task lighting, meaning light for working on a surface. The head hangs in a fork (yoke) on pivots, so that its balance point stays put as it is tilted.',
    material: 'Metal shades are made of aluminium, brass, copper, steel and other metals. Other shades use fabric, parchment, glass, paper or plastic.',
    positionText: 'At the end of the forearm, around the bulb. The small bracket and round pivot at the top of the cone stand for the fork and its pivots.',
    sourceId: 'lamp-shade',
    restPosition: [0.6, 0.15, 0],
    explodeVector: [0.35, -0.15, 0],
    extents: [0.3, 0.25, 0.3],
  },
  {
    id: 'lamp-bulb-holder',
    name: 'Bulb holder (socket)',
    job: 'Supports the bulb mechanically and gives it its electrical connection. It lets the bulb be changed safely and conveniently.',
    material: 'Ceramic insulation can withstand much higher temperatures than bakelite or other plastics.',
    positionText: 'Inside the shade at the top, holding the bulb. The bulb and the wiring are not shown.',
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
