# Design pack for Task 18.3 (Heat_Exchanger and Desk_Lamp)

Written by Claude (not by Kiro). Research read on 2026-11-27. This file replaces the Task 18.1 texts, sources and layout numbers
for the Heat_Exchanger and the Desk_Lamp. Kiro copies the data below character for character and writes the code and tests.
Kiro does not research, reword or "improve" any text, name, number or source in this file.

## 1. What changed from Task 18.1, and why

Heat_Exchanger is now a U-tube shell-and-tube exchanger (TEMA name BEU: bonnet front head, one-pass shell, U-tube bundle).
- Straight tubes with one tube sheet were wrong: tubes need a tube sheet at both ends, or U-bends. U-tubes are the standard way to have one tube sheet.
- "Channel head" is now "Bonnet (front head)" and carries the two tube-side nozzles. "Nozzles" is now "Shell nozzles".
- The baffle window is 25 percent of the diameter (the sources recommend 20 to 35 percent). Baffles now have tie rods.
- Ids changed: hx-channel-head -> hx-bonnet, hx-nozzles -> hx-shell-nozzles. hx-tube-sheet, hx-shell, hx-tube-bundle, hx-baffles keep their ids.

Desk_Lamp is now a spring-balanced lamp with a Spring Part (seven Parts, not six).
- Names follow Wikipedia's parts list: upper arm, forearm, lamp cap. The old "lower arm" is now "Upper arm" and the old "upper arm" is now "Forearm".
- "Joint" is now "Elbow joint". New Part: "Spring". Ids: lamp-base, lamp-upper-arm, lamp-spring, lamp-elbow, lamp-forearm, lamp-shade, lamp-bulb-holder.
- The Catalogue total is 21 Parts (8 + 6 + 7).

## 2. Catalogue data (copy exactly into src/data/catalogue.ts)

Replace the whole HEAT_EXCHANGER_PARTS block, HEAT_EXCHANGER_MACHINE, DESK_LAMP_PARTS and DESK_LAMP_MACHINE with this.

```ts
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
```

Then in CATALOGUE: parts stay `[...PUMP_PARTS, ...HEAT_EXCHANGER_PARTS, ...DESK_LAMP_PARTS]` (21 Parts).
In src/data/catalogue-checks.ts, EXPECTED_PART_NAMES becomes:
- 'heat-exchanger': ['bonnet', 'tube sheet', 'shell', 'u-tube bundle', 'baffles and tie rods', 'shell nozzles']
- 'desk-lamp': ['base', 'upper arm', 'spring', 'elbow joint', 'forearm', 'shade', 'bulb holder']
(Matching ignores case and a trailing "(...)" note, so "Bonnet (front head)" matches "bonnet", and "Shade (lamp head)" matches "shade".)

## 3. docs/sources.md rows (replace the 12 old hx-* and lamp-* rows, and the Task 18.1 paragraph above the table)

New paragraph to replace the "Task 18.1 rows" paragraph:

> Task 18.3 rows (hx-* and lamp-*): written by Claude from pages it read on 2026-11-27 (not by Kiro). Content was paraphrased, not copied. Heat_Exchanger = a U-tube shell-and-tube heat exchanger (TEMA name BEU). Desk_Lamp = a spring-balanced articulated-arm desk lamp. A statement marked "model" describes how this app draws the Part, not a fact about all real machines. Where a page does not state a fact, the row says so and the catalogue text says "Not stated by the sources." Source strength: HEI (Heat Exchange Institute), Mukherjee (Chemical Engineering Progress), NPTEL (IIT course notes) and French and Widden (IMechE journal) are professional or academic. EnggCyclopedia, Wermac, Engineer Fix and Antique Lamp Supply are weaker (articles or a shop); claims that rest only on them are marked (weaker).

Rows (the Date checked cell is 2026-11-27 in every row). The URL list under the table names each source.

| Id | Part | Claim | Source | Date checked |
| --- | --- | --- | --- | --- |
| hx-bonnet | Bonnet (front head) | Job: channels contain the tube-side fluid (HEI section 3.5); tube-side nozzles are where that fluid enters and leaves it (HEI 3.5); pass plates separate the tube passes (HEI 3.5), and a pass is one trip of the fluid along the exchanger (EnggCyclopedia); a bonnet seals the end and gives access to the tubes and internals (EnggCyclopedia, weaker). Material: typically stainless steel or carbon steel (EnggCyclopedia, weaker). Position: attached to the end of the shell with bolts or clamps (EnggCyclopedia, weaker); nozzles are welded to the shell or the bonnet (EnggCyclopedia, weaker). Model: the partition is horizontal, so the fluid goes in at the top nozzle, along the upper tube legs, round the U-bends and back along the lower legs. The page names bonnet-type channel covers such as BEM (Mukherjee). | https://assets.noviams.com/novi-file-uploads/hei/TDS/Shell_and_Tube/FINALTechSheet133BasicsofShellTubeHeatExchangers-f217490d.pdf ; https://enggcyclopedia.com/2023/01/heat-exchanger-parts ; https://my.che.utah.edu/~ring/Design%20I/Articles/Sizing%20Shell%20and%20Tube%20Heat%20Exchanger.pdf | 2026-11-27 |
| hx-tube-sheet | Tube sheet | Job: a thick round metal plate with holes, holding the tubes (EnggCyclopedia, weaker); the tube to tube sheet joint is leak-free and made by rolling (EnggCyclopedia, weaker); there is only one tube sheet in a U-tube exchanger (Mukherjee); U-tubes are rolled into it (NPTEL); the tubes expand freely towards the U-bend end (NPTEL), because one end is free the bundle can expand or contract with stress differences (Mukherjee). Material: not stated by the sources. Position: the tube sheet is stationary at one end of the shell (HEI 3.3). | https://my.che.utah.edu/~ring/Design%20I/Articles/Sizing%20Shell%20and%20Tube%20Heat%20Exchanger.pdf ; https://archive.nptel.ac.in/content/storage2/courses/103103027/module1/lec1/1.html ; https://enggcyclopedia.com/2023/01/heat-exchanger-parts ; https://assets.noviams.com/novi-file-uploads/hei/TDS/Shell_and_Tube/FINALTechSheet133BasicsofShellTubeHeatExchangers-f217490d.pdf | 2026-11-27 |
| hx-shell | Shell | Job: the shell is usually a closed cylinder containing the fluid that flows over the tubes (HEI 3.1) and encloses the tube bundle (EnggCyclopedia, weaker); large shells are rolled from plate and welded along the length (HEI 3.1; EnggCyclopedia); the U-tube bundle can be removed for cleaning and replacement (Mukherjee; NPTEL). Material: carbon steel is the most widely used (EnggCyclopedia, weaker). Position: the outermost part, around the bundle. Model: the rear end is drawn rounded and closed. | https://assets.noviams.com/novi-file-uploads/hei/TDS/Shell_and_Tube/FINALTechSheet133BasicsofShellTubeHeatExchangers-f217490d.pdf ; https://enggcyclopedia.com/2023/01/heat-exchanger-parts ; https://my.che.utah.edu/~ring/Design%20I/Articles/Sizing%20Shell%20and%20Tube%20Heat%20Exchanger.pdf ; https://archive.nptel.ac.in/content/storage2/courses/103103027/module1/lec1/1.html | 2026-11-27 |
| hx-tube-bundle | U-tube bundle | Job: tube walls separate the two fluids (EnggCyclopedia, weaker); U-tubes usually give the most economical way to limit stress from differential thermal expansion (HEI 3.2); the tube interior cannot be cleaned effectively in the U-bends (Wermac, weaker; Mukherjee); individual tubes can be difficult or expensive to replace, especially inner ones (Wermac, weaker). Material: tubes are mostly carbon steel, and stainless steel, cupronickel, copper, brass and aluminium are also used (EnggCyclopedia, weaker). Position: inside the shell, both ends of each tube in the one tube sheet (Mukherjee). Model: 17 U-tubes, real bundles hold many more. | https://assets.noviams.com/novi-file-uploads/hei/TDS/Shell_and_Tube/FINALTechSheet133BasicsofShellTubeHeatExchangers-f217490d.pdf ; https://my.che.utah.edu/~ring/Design%20I/Articles/Sizing%20Shell%20and%20Tube%20Heat%20Exchanger.pdf ; https://enggcyclopedia.com/2023/01/heat-exchanger-parts ; https://www.wermac.org/equipment/heatexchanger_part5.html | 2026-11-27 |
| hx-baffles | Baffles and tie rods | Job: baffles support the tubes to prevent vibration and guide the shell-side flow (HEI 3.4); they are plates with holes in the same pattern as the tube sheet (HEI 3.4); common types are single segmental, double segmental and no tubes in the window (HEI 3.4); a segmental baffle is a plate in the form of a segment of a circle with holes for the tubes (EnggCyclopedia, weaker); baffles direct the flow so that it does not take a short cut (Wikipedia Shell-and-tube heat exchanger); baffle cut can be 15 to 45 percent of the shell inside diameter and only 20 to 35 percent is strongly recommended (Mukherjee); tie rods and spacers fix the baffles in place (HEI 3.4), and spacers are hollow tubes slid over the tie rods (EnggCyclopedia, weaker). Material: not stated by the sources. Model: five single segmental baffles, windows alternating top and bottom, 25 percent windows, four tie rods, no spacers. | https://assets.noviams.com/novi-file-uploads/hei/TDS/Shell_and_Tube/FINALTechSheet133BasicsofShellTubeHeatExchangers-f217490d.pdf ; https://my.che.utah.edu/~ring/Design%20I/Articles/Sizing%20Shell%20and%20Tube%20Heat%20Exchanger.pdf ; https://enggcyclopedia.com/2023/01/heat-exchanger-parts ; https://en.wikipedia.org/wiki/Shell-and-tube_heat_exchanger | 2026-11-27 |
| hx-shell-nozzles | Shell nozzles | Job: nozzles are on both the shell and tube sides to let the fluids flow in and out (EnggCyclopedia, weaker); they are small pipe sections welded to the shell or bonnet (EnggCyclopedia, weaker); nozzle sizes should match the line sizes (Mukherjee); an impingement plate or rod goes under a shell-side inlet nozzle at high velocity, because direct impingement on the tubes may cause erosion and failure (HEI 3.4). Material: not stated by the sources. Model: two nozzles on top of the shell with flange rings; no impingement plate drawn. | https://assets.noviams.com/novi-file-uploads/hei/TDS/Shell_and_Tube/FINALTechSheet133BasicsofShellTubeHeatExchangers-f217490d.pdf ; https://my.che.utah.edu/~ring/Design%20I/Articles/Sizing%20Shell%20and%20Tube%20Heat%20Exchanger.pdf ; https://enggcyclopedia.com/2023/01/heat-exchanger-parts | 2026-11-27 |
| lamp-base | Base | Job: the mass of the base stops the lamp tipping when the arm is extended, and it is a broad weighted platform (Engineer Fix, weaker); the whole assembly can rotate in the horizontal plane on a stable foot, and in some designs the weight of the base is needed to avoid over-balancing (Wikipedia). Material: not stated by the sources. Position: the page lists the parts as lamp cap, forearm, upper arm, stand or body, and base (Wikipedia). | https://engineerfix.com/how-do-articulated-arm-lights-work/ ; https://en.wikipedia.org/wiki/Balanced-arm_lamp | 2026-11-27 |
| lamp-upper-arm | Upper arm | Job: the lamp has two connected arms (Wikipedia); in the Anglepoise lamp a four-bar chain is a parallelogram, which carries the vertical reference from the inner to the outer joint (French and Widden); the lamp cap keeps pointing in the same vertical direction when the height is adjusted (Wikipedia). Material: aluminium or steel arms and joints give more stability and a higher supported weight than plastic (Engineer Fix, weaker). Model: two parallel bars, with the spring between them. | https://en.wikipedia.org/wiki/Balanced-arm_lamp ; https://eprints.lancs.ac.uk/id/eprint/20295/1/20295.pdf ; https://engineerfix.com/how-do-articulated-arm-lights-work/ | 2026-11-27 |
| lamp-spring | Spring | Job: gravity is always counteracted by springs, whatever the position of the arms (Wikipedia); extension springs counteract the weight of the arm and the tension they exert nearly equals the weight of the lamp head and arm at any angle (Engineer Fix, weaker); the spring tension is proportional to its overall length and the free length must be zero, in practice a close-coiled spring with an effectively zero free length (French and Widden). Material: not stated by the sources. Position: springs can be on the forearm or the upper arm or both, can be tension or compression springs, and sometimes two coil springs work in parallel on both sides of the arm (Wikipedia); the Anglepoise design has its springs at the base (French and Widden). Model: one tension spring between the two bars of the upper arm. | https://en.wikipedia.org/wiki/Balanced-arm_lamp ; https://eprints.lancs.ac.uk/id/eprint/20295/1/20295.pdf ; https://engineerfix.com/how-do-articulated-arm-lights-work/ | 2026-11-27 |
| lamp-elbow | Elbow joint | Job: joints are hinged pivots (Wikipedia); each joint acts as a lever and the spring tension is engineered to act on the pivot (Engineer Fix, weaker); joint friction helps lock the arm in its final position (Engineer Fix, weaker); friction cannot be entirely eliminated from the mechanism (French and Widden). Material: aluminium or steel joints give more stability than plastic (Engineer Fix, weaker). Position: where the two arms meet. The name elbow is this app's. | https://en.wikipedia.org/wiki/Balanced-arm_lamp ; https://engineerfix.com/how-do-articulated-arm-lights-work/ ; https://eprints.lancs.ac.uk/id/eprint/20295/1/20295.pdf | 2026-11-27 |
| lamp-forearm | Forearm | Job: the forearm is one of the arms (Wikipedia), and in the Tizio-type description the lamp cap sits on the forearm (Wikipedia); the arms are linked as a parallelogram so the head direction is kept (Wikipedia; French and Widden). Material: aluminium or steel arms are more stable than plastic (Engineer Fix, weaker). Model: two parallel bars. | https://en.wikipedia.org/wiki/Balanced-arm_lamp ; https://eprints.lancs.ac.uk/id/eprint/20295/1/20295.pdf ; https://engineerfix.com/how-do-articulated-arm-lights-work/ | 2026-11-27 |
| lamp-shade | Shade (lamp head) | Job: a lampshade envelops the bulb to redirect its light, and shades can reduce glare (Wikipedia Lampshade); a metal shade redirects light downward in one direction, which is ideal for task lighting (Antique Lamp Supply, weaker); the lamp is mounted in trunnions on a yoke so that the position of its own centroid is unchanged, and balance is kept as the lamp is rotated (French and Widden). Material: aluminium, brass, copper and steel for metal shades (Antique Lamp Supply, weaker); fabric, parchment, glass, paper or plastic for others (Wikipedia Lampshade). Model: a metal cone with a small bracket and pivot standing for the yoke. | https://en.wikipedia.org/wiki/Lampshade ; https://antiquelampsupply.com/pages/how-do-metal-lampshades-work ; https://eprints.lancs.ac.uk/id/eprint/20295/1/20295.pdf | 2026-11-27 |
| lamp-bulb-holder | Bulb holder (socket) | Job: a socket mechanically supports a lamp base and provides its electrical connections, and lets lamps be replaced safely and conveniently (Wikipedia Lightbulb socket). Material: ceramic insulation withstands considerably higher temperatures than bakelite or other plastics (Wikipedia Lightbulb socket). Position: the model puts it inside the shade at the top; the pages do not say where it sits. | https://en.wikipedia.org/wiki/Lightbulb_socket | 2026-11-27 |

HEI URL (for the Source column): https://assets.noviams.com/novi-file-uploads/hei/TDS/Shell_and_Tube/FINALTechSheet133BasicsofShellTubeHeatExchangers-f217490d.pdf
(HEI Tech Sheet 133 "Basics of Shell and Tube Heat Exchangers", Heat Exchange Institute, revised 2017.)
Mukherjee = https://my.che.utah.edu/~ring/Design%20I/Articles/Sizing%20Shell%20and%20Tube%20Heat%20Exchanger.pdf ("Effectively Design Shell-and-Tube Heat Exchangers", Rajiv Mukherjee, Chemical Engineering Progress, February 1998).
NPTEL = https://archive.nptel.ac.in/content/storage2/courses/103103027/module1/lec1/1.html (NPTEL course 103103027, module 1, lecture 1).
EnggCyclopedia = https://enggcyclopedia.com/2023/01/heat-exchanger-parts (Heat Exchanger Parts, 2023-01-30).
Wermac = https://www.wermac.org/equipment/heatexchanger_part5.html (Heat Transfer by Shell and Tube Heat Exchangers, part five).
French and Widden = https://eprints.lancs.ac.uk/id/eprint/20295/1/20295.pdf (M. J. French and M. B. Widden, "The spring-and-lever balancing mechanism, George Carwardine and the Anglepoise lamp", Proc. IMechE Part C, vol. 214, 2000).


## 4. Shapes (new files: src/render/heat-exchanger-model.ts and src/render/desk-lamp-model.ts)

Units: metres. Y up. Each Part is a Group named `part:<id>` at its restPosition. Shapes are written around the Part's own centre.
A prototype of exactly these shapes was built and measured by Claude: every Part fits its extents box (tolerance 1e-6), the Clearance, Envelope and
Explode-length checks pass, and both Machines render clearly. Kiro writes its own code from the numbers.

### Heat_Exchanger (axis along x)

TUBE_R = 0.012 (tube radius). BEND_X = 0.53 (x of the centre of every U-bend). The U-tubes are listed as (R, z): each U-tube has two straight legs at y = +R and y = -R
(same z) joined at the rear by a half circle of radius R. The 17 U-tubes:
- R = 0.02 at z = -0.12, -0.08, -0.04, 0, 0.04, 0.08, 0.12 (7)
- R = 0.06 at z = -0.08, -0.04, 0, 0.04, 0.08 (5)
- R = 0.10 at z = -0.08, -0.04, 0, 0.04, 0.08 (5)
LEGS = the 34 leg positions (y, z). One shared constant U_TUBES, and LEGS derived from it, used by the tube sheet, the baffles and the bundle.
Largest distance of a leg from the axis: 0.12806. Closest two legs: 0.04 apart (hand-checked: neighbours at the same R are 0.04 apart in z; the R rows are 0.04 apart in y).

- hx-bonnet: 5 meshes.
  1. One closed solid of revolution about x: LatheGeometry, 40 segments, then rotateZ(-PI/2) so the axial coordinate points to +x. Profile points (radius, axial): a quarter-ellipse dome for t = 0 to PI/2 in 12 steps, point = (0.19 sin t, -0.05 - 0.10 cos t); then (0.19, 0.12), (0.21, 0.12), (0.21, 0.15), (0, 0.15).
  2. Tube-side nozzles, one at the top and one at the bottom (s = +1 and -1): pipe cylinderY radius 0.05, length 0.14, 24 segments, at (0.03, s * 0.23, 0); flange cylinderY radius 0.07, length 0.03, 28 segments, at (0.03, s * 0.315, 0).
- hx-tube-sheet: 1 mesh. A disc of radius 0.21 and thickness 0.05 along x (centred on x = 0), with 34 holes of radius 0.012 at LEGS.
- hx-shell: 1 mesh. A closed solid of revolution about x (Lathe, 48 segments, rotateZ(-PI/2)). Profile (radius, axial): (0, -0.7), (0.2, -0.7), (0.2, -0.67), (0.19, -0.67), then a quarter ellipse for t = 0 to PI/2 in 8 steps, point = (0.19 cos t, 0.6 + 0.10 sin t). That gives a thin front flange, a body of radius 0.19 and a rounded rear end.
- hx-tube-bundle: 1 mesh. For each U-tube: two legs, cylinderX radius TUBE_R, length 1.18, 10 segments, centred at x = -0.06 (they run from x = -0.65 to x = 0.53), at (y = +R, z) and (y = -R, z); one half torus (TorusGeometry radius R, tube TUBE_R, 8 radial segments, 16 tubular segments, arc PI, then rotateZ(-PI/2) so it bulges towards +x), centred at (BEND_X, 0, z). All 51 pieces are joined with mergeGeometries (from 'three/examples/jsm/utils/BufferGeometryUtils.js', part of the installed three package) into ONE mesh.
- hx-baffles: 9 meshes. Five plates, thickness 0.012 along x, at x = -0.43, -0.215, 0, 0.215, 0.43. Each plate is a circle of radius 0.16 with a flat cut at |y| = 0.08 (the window is 0.08 tall, 25 percent of the 0.32 diameter): plates 1, 3 and 5 have the top cut away, plates 2 and 4 the bottom. A plate has a 0.014 radius hole for each leg whose hole lies fully on the plate: top-cut plates keep the legs with y <= 0.08 - 0.014, bottom-cut plates keep the legs with y >= -0.08 + 0.014 (so the legs in the window pass through with no hole). Then four tie rods: cylinderX radius 0.008, length 0.89, 10 segments, at (0, y, z) for y = -0.05, +0.05 and z = -0.14, +0.14.
- hx-shell-nozzles: 4 meshes. Two nozzles at x = -0.34 and x = +0.34: pipe cylinderY radius 0.04, length 0.11, 20 segments, at y = -0.015; flange cylinderY radius 0.06, length 0.03, 24 segments, at y = +0.055.

Measured by the prototype (for orientation only, do not assert these): bundle 1.292 x 0.224 x 0.264; baffles 0.89 x 0.32 x 0.32; all other Parts fill their box exactly.

### Desk_Lamp

- lamp-base: 2 meshes. Disc cylinderY radius 0.25, height 0.05, 48 segments, at y = -0.025; post cylinderY radius 0.06, height 0.05, 32 segments, at y = +0.025.
- lamp-upper-arm: 2 meshes. Two round bars of radius 0.016 (16 segments) from (-0.095, -0.288) to (0.095, 0.288) in the x-y plane, at z = -0.032 and z = +0.032.
- lamp-spring: 3 meshes. A close-coiled helix as a TubeGeometry: helix radius 0.009, 40 turns, wire radius 0.004, 480 tubular segments, 6 radial segments, along the line between the bars: it runs from (-0.0798, -0.2419) to (0.0798, 0.2419) in the x-y plane at z = 0 (build it along y, then rotateZ(-atan2(2 * 0.0798, 2 * 0.2419))). Then two end pins: cylinderZ radius 0.006, length 0.05, 12 segments, at (+0.0798, +0.2419, 0) and (-0.0798, -0.2419, 0).
- lamp-elbow: 3 meshes. A barrel cylinderZ radius 0.06, length 0.14, 32 segments, at the centre; two end caps cylinderZ radius 0.035, length 0.02, 20 segments, at z = -0.07 and z = +0.07.
- lamp-forearm: 2 meshes. Two round bars of radius 0.016 from (-0.39, -0.02) to (0.39, 0.025), at z = -0.032 and z = +0.032.
- lamp-shade: 3 meshes. A closed solid of revolution about y (Lathe, 48 segments) with profile (radius, y): (0, 0.125), (0.05, 0.125), (0.05, 0.12), (0.15, -0.125), (0.142, -0.125), (0.042, 0.112), (0, 0.112); a bracket cylinderX radius 0.016, length 0.12, 16 segments, at (-0.09, 0.095, 0); a pivot cylinderZ radius 0.03, length 0.1, 24 segments, at (-0.12, 0.095, 0).
- lamp-bulb-holder: 3 meshes, all cylinderY, 20 segments: radius 0.03, height 0.06 at y = +0.04; radius 0.04, height 0.03 at y = -0.005; radius 0.035, height 0.05 at y = -0.045.

Clean_Engineering grey: use the Part's index inside its own Machine (0 to 5 for the Heat_Exchanger, 0 to 6 for the Desk_Lamp).

Known limits to write in build-notes.md: the bulb holder is mostly hidden inside the shade in Clean_Engineering (it shows when exploded, in X_Ray_Skeleton, or from below); the spring is thin and small at the default zoom; the pass partition, impingement plate, spacers, bulb and wiring are not drawn; the inside of the bonnet and shell are solid.

## 5. Tests Kiro writes for each Machine (expected values typed in by hand, never copied from the code)

1. Fit: every Part inside its extents box, tolerance 1e-6, using Box3.setFromObject(group, true), like pump-fit.test.ts.
2. Mesh counts per Part, in catalogue order: Heat_Exchanger 5, 1, 1, 1, 9, 4 (total 21). Desk_Lamp 2, 2, 3, 3, 2, 3, 3 (total 18).
3. Heat_Exchanger layout: 17 U-tubes and 34 legs; closest two legs 0.04 apart (tolerance 1e-6); largest distance of a leg from the axis 0.12806 (tolerance 1e-4); every leg y between -0.10 and 0.10. The tube sheet has 34 holes. A top-cut baffle has 29 holes (the 5 legs at y = +0.10 are in its window, so they get no hole) and a bottom-cut baffle has 29 holes (the 5 legs at y = -0.10 get none). No hole of any baffle reaches the cut line.
4. Every mesh has userData.partId and fillIndex; each Part group is named part:<id>; buildMachineModel throws for a Part with no builder.
5. The tube bundle is exactly one Mesh (not an InstancedMesh).
6. Catalogue tests: names (EXPECTED_PART_NAMES above), 21 Parts at the end of Step C (20 until then), ids unique, every sourceId is in docs/sources.md, Envelope, Explode-length and Clearance checks pass.

## 6. Spec and document edits (Kiro, one step each, re-check neighbouring headings after each edit)

- requirements.md Requirement 18: criterion 2 becomes: "THE Part_Catalogue SHALL list for the Heat_Exchanger these Parts: bonnet (front head), tube sheet, shell, U-tube bundle (many U-shaped tubes merged into one mesh, one Part), baffles and tie rods, and shell nozzles." Criterion 3 becomes: "THE Part_Catalogue SHALL list for the Desk_Lamp these Parts: base, upper arm, spring, elbow joint, forearm, shade (lamp head) and bulb holder."
- design.md, the line about the Heat_Exchanger tube bundle being an InstancedMesh: it is one merged Mesh with that tag.
- tasks.md 18.3 text and the "20 Parts" mentions: the Heat_Exchanger tube bundle is one merged mesh; 21 Parts in total.
- brief.md line about the Heat exchanger parts: update to the new list.
- THIRD_PARTY.md: add the six web pages above under a new heading "Facts and sources" (facts paraphrased, no text or images copied), and note that the shapes are drawn by the User's project in code.
