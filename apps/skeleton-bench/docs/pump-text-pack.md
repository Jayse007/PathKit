# Pump text pack (replaces the text of all 8 Pump Parts)

Written 2026-11-27. Save as `apps/skeleton-bench/docs/pump-text-pack.md`.

## 1. What changes and what does not

- Text only: `job`, `material`, `positionText` and `sourceId` of the 8 Pump Parts, plus 8 rows in `docs/sources.md`.
- Names, ids, rest positions, explode vectors and extents are NOT changed. No shape change. No test changes (the names still match `EXPECTED_PART_NAMES`).
- Every claim below was read on the page named in section 3. Where a page does not state a fact, the text says "not stated by the sources". Facts that rest on one manufacturer's page are marked "(weaker)" in section 3.
- Why the old text was replaced: most of it came from one supplier blog (slurrypumpsupply.com). Claims such as "431 or duplex stainless", "CF8M", "Viton or EPDM", "AISI 52100" and "cast iron motor frames on close-coupled pumps" were not found on any better source, so they are gone.

## 2. Catalogue block (replace the whole `PUMP_PARTS` array, keep the layout numbers exactly as they are)

```ts
export const PUMP_PARTS: readonly PartEntry[] = [
  {
    id: 'pump-motor',
    name: 'Motor',
    job: 'Supplies the turning power. In an induction motor, the most common pump driver, current in the fixed windings (the stator) makes the rotor spin, and the motor shaft carries that turning force to the pump end. In this model the motor drives the pump shaft through a coupling (a connector between two shafts), which is not drawn. In a close-coupled pump, a different layout, motor and pump share one shaft.',
    material: 'The stator has laminated steel cores with copper or aluminium windings. The rotor is usually a squirrel cage (a cage of conductive bars). One manufacturer lists cast iron frames, brackets and fan covers on its fan-cooled motors.',
    positionText: 'At the drive end, opposite the wet end. (The wet end is the part of the pump that touches the liquid.) The model draws the motor as one plain cylinder.',
    sourceId: 'pump-motor',
    restPosition: [-0.75, -0.05, 0],
    explodeVector: [-0.17, 0, 0],
    extents: [0.5, 0.4, 0.4],
  },
  {
    id: 'pump-bearing-housing',
    name: 'Bearing housing',
    job: 'Holds the rolling-element bearings that support the shaft. A radial bearing carries sideways load. A thrust (axial) bearing carries load along the shaft, such as the hydraulic push on the impeller. The housing also holds the oil or grease that lubricates the bearings.',
    material: 'The housing material is not stated by the sources. The bearings inside are rolling-element bearings. In ANSI pumps (a common standard pump size series), double-row angular contact ball bearings are widely used as the main thrust bearing.',
    positionText: 'Between the motor and the wet end, around the shaft. This model has a separate bearing housing because it is a frame-mounted pump, not a close-coupled one.',
    sourceId: 'pump-bearing-housing',
    restPosition: [-0.35, -0.02, 0],
    explodeVector: [-0.06, -0.2, 0],
    extents: [0.3, 0.3, 0.3],
  },
  {
    id: 'pump-shaft',
    name: 'Shaft',
    job: 'Carries the drive torque (turning force) from the motor to the impeller. It is the central rotating part and it carries the bearings. It must stay stiff enough that the turning parts never touch the casing. A shaft sleeve (not drawn) often covers the shaft in the seal area to protect it from wear and from aggressive liquid.',
    material: 'Usually steel or stainless steel. General-purpose water pumps use high-tensile steel. Where the shaft is wetted by corrosive liquid, a corrosion-resistant grade is needed. One maker (weaker source) names 4140 carbon steel as common but prone to rust, and 316L stainless as its standard.',
    positionText: 'Runs from the motor end, through the bearing housing and the seal, to the impeller in the casing.',
    sourceId: 'pump-shaft',
    restPosition: [-0.15, 0, 0],
    explodeVector: [0, 0, 0.36],
    extents: [0.7, 0.06, 0.06],
  },
  {
    id: 'pump-mechanical-seal',
    name: 'Mechanical seal',
    job: 'Seals the turning shaft where it passes through the casing. One flat face turns with the shaft and one is fixed to the housing. A spring and the liquid pressure press the two faces together, and liquid creeping between them forms a thin film that lubricates them. Rubber-like O-rings seal the other joints. Packing (soft rings around the shaft) is the alternative way to seal it.',
    material: 'The faces are rings of ceramic, carbide, carbon or composites, lapped flat to under 1 micron. The O-rings are elastomer (rubber-like), typically Shore A 70 to 90 (a hardness scale).',
    positionText: 'Where the shaft passes through the casing, in the shaft seal housing.',
    sourceId: 'pump-mechanical-seal',
    restPosition: [0.02, 0, 0],
    explodeVector: [-0.03, -0.44, 0],
    extents: [0.12, 0.16, 0.16],
  },
  {
    id: 'pump-bolts',
    name: 'Bolts (one group)',
    job: 'Fasteners. Foundation (anchor) bolts hold the baseplate to the concrete foundation, and are tightened after the grout has set. Other bolts join the casing to the rest of the pump. In a close-coupled pump the casing is bolted to the motor drive flange.',
    material: 'Not stated by the sources.',
    positionText: 'The model draws four short bolts at the back of the casing, where it joins the drive side. The baseplate, foundation and foundation bolts are not drawn.',
    sourceId: 'pump-bolts',
    restPosition: [0.12, 0, 0],
    explodeVector: [-0.08, -0.05, 0.04],
    extents: [0.08, 0.44, 0.4],
  },
  {
    id: 'pump-casing',
    name: 'Casing',
    job: 'Encloses the impeller, seals the inside of the pump from the air and holds the liquid pressure. Its spiral (volute) shape collects the fast liquid leaving the impeller and turns its speed into pressure (head). The volute keeps the speed even all the way round the impeller. Single-stage pumps usually have a volute casing.',
    material: 'Mostly cast. Cast iron, nodular (ductile) cast iron, cast steel and chrome steels are used. Cast iron is the usual choice for water. Ductile iron is used at higher pressure. Stainless steel is also used, for example in fabricated casings.',
    positionText: 'Surrounds the impeller at the wet end of the pump.',
    sourceId: 'pump-casing',
    restPosition: [0.4, 0, 0],
    explodeVector: [0.07, -0.13, -0.14],
    extents: [0.6, 0.5, 0.46],
  },
  {
    id: 'pump-impeller',
    name: 'Impeller',
    job: 'The rotating wheel with curved vanes. It pushes the liquid outward, which gives it speed. The casing then turns that speed into pressure. Every impeller has a back plate (shroud). One with no front plate is called open.',
    material: 'Bronze is the most widely used impeller material for water and other non-corrosive liquids. Cast iron is used in small, low-cost pumps. Stainless steel (304 or 316) is used where bronze is not enough.',
    positionText: 'Inside the casing, on the end of the shaft. The model draws six curved vanes on a back plate and hub,.',
    sourceId: 'pump-impeller',
    restPosition: [0.38, 0, 0],
    explodeVector: [0.2, 0.39, -0.18],
    extents: [0.34, 0.34, 0.34],
  },
  {
    id: 'pump-flange',
    name: 'Flange',
    job: 'A flange joins pipe sections to each other and to machine casings such as a pump. A pump has a suction flange where liquid enters and a discharge flange where it leaves. Flange designs follow flange standards.',
    material: 'Not stated by the sources.',
    positionText: 'The model draws only the discharge flange, on top of the casing. The suction flange is part of the Casing in this model.',
    sourceId: 'pump-flange',
    restPosition: [0.5, 0.28, 0],
    explodeVector: [0, 0.27, 0.19],
    extents: [0.2, 0.06, 0.2],
  },
];
```

## 3. Replace the 8 `pump-*` rows in `docs/sources.md`

Also replace the stale intro line "Kiro cannot read the system clock..." with: "Date checked is the day the page was read. Pages are paraphrased, not copied. Pump = a horizontal frame-mounted end-suction centrifugal pump driven by an electric motor through a coupling."

Source strength: strong = KSB (a pump maker's own technical glossary), Hydraulic Institute (the pump standards body); medium = Pumps and Systems, WaterWorld (Allan Budris, P.E.), Pump Industry; (weaker) = one maker's catalogue page.

| Id | Part | Claim | Source | Date checked |
| --- | --- | --- | --- | --- |
| pump-motor | Motor | Job: induction motors are the most common pump driver (Hydraulic Institute); voltage at the stator winding makes current flow and interact with the rotor, which spins the shaft (Hydraulic Institute); the motor shaft transfers rotational power from the rotor to the pump end, usually directly or sometimes through a coupling or belt (Nidec/U.S. Motors). The shaft coupling is the connecting element between motor and pump hydraulic system (KSB). A close-coupled pump has a common motor and pump shaft, with the casing bolted to the drive flange (KSB). Material: stator has laminated steel cores and copper or aluminium windings; rotor is generally a squirrel cage of conductive bars (Nidec). Cast iron frames, brackets and fan covers on one maker's fan-cooled motors (Toshiba, medium-voltage, weaker). Position: at the drive end. The page set does not describe the frame or cooling fins, so the text does not either. | https://pumpsandsystems.com/how-does-induction-motor-work ; https://www.pumpsandsystems.com/electric-motors-101-motor-types-pumping-applications ; https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/shaft-coupling-1116320 ; https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/close-coupled-pump-1116226 ; https://toshiba.com/tic/product/tefc/ | 2026-11-27 |
| pump-bearing-housing | Bearing housing | Job: radial and axial (thrust) rolling-element bearings, lubricated with grease or oil (KSB); bearings support the hydraulic loads on the impeller and the weight of impeller and shaft (Pumps and Systems, April 2014); oil splash lubrication with a constant-level oiler is common in the housing (Pumps and Systems, Thomas, Nov 2006; Reliable Plant). Material: housing material not stated; double-row angular contact ball bearings are used extensively as the primary thrust bearing in ANSI pumps (Pumps and Systems 2014). Position: KSB's lexicon has no "bearing housing" entry, so position comes from the model layout (frame-mounted pump), not from a source. | https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/rolling-element-bearing-1118246 ; https://pumpsandsystems.com/centrifugal-pumps-seals-bearings/april-2014-bearings-seals-boost-pump-performance ; https://www.pumpsandsystems.com/back-basics-pump-bearing-housing-lubrication-part-2 ; https://www.reliableplant.com/Articles/Print/22602 | 2026-11-27 |
| pump-shaft | Shaft | Job: transmits drive torque to the impellers; central rotor component; carries the bearings; deflection must stay small so rotating parts do not touch the casing (KSB). A shaft protecting sleeve protects against mechanical damage from seals and bearings and chemical damage from aggressive fluid (KSB); the sleeve is the sacrificial part that wears instead of the shaft (PumpWorks, weaker). Material: usually steel or stainless steel (Intro to Pumps); high-tensile steel shafts for general-purpose water pumps and high alloy steel at higher pressure (Pump Industry 2022); corrosion-resistant grades where wetted (KSB). 4140 carbon steel is strong but prone to rust; 316L is that maker's standard shaft (PumpWorks, weaker). Position: model layout. | https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/pump-shaft-1115634 ; https://ksb.com/en-global/centrifugal-pump-lexicon/article/shaft-protecting-sleeve-1118812 ; https://www.introtopumps.com/pumps-101/centrifugal-pump-parts/ ; https://www.pumpindustry.com.au/pump-materials-part-1/ ; https://www.pumpcatalog.com/pumpworks/ansi-pump-shafts-sleeves/ | 2026-11-27 |
| pump-mechanical-seal | Mechanical seal | Job: seals the rotating shaft where it passes through the casing; two faces pressed together by hydraulic and spring forces with a thin lubricating liquid film (KSB); one face is driven by the shaft, one is fixed to the stationary housing; the spring gives the initial closing force; fluid migrates between the faces and forms a stable film (Pumps and Systems, "Back to basics"). Packing or a mechanical seal seals the shaft (Intro to Pumps). Material: face rings of ceramic, carbide, carbon or composites, lapped flat to under 1 micron (Pumps and Systems); O-rings are the most common secondary seal, elastomer, Shore A 70 to 90 (KSB). Position: shaft seal housing (KSB). | https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/shaft-seal-1116516 ; https://pumpsandsystems.com/mechanical-seals/back-basics-mechanical-seals ; https://www.introtopumps.com/pumps-101/centrifugal-pump-parts/ | 2026-11-27 |
| pump-bolts | Bolts (one group) | Job: foundation bolts are tightened after the grout has set; grouting gives the baseplate rigidity; the baseplate is a joint base for pump and drive (KSB installation and baseplate pages); a combined baseplate sits on a concrete foundation (KSB). In a close-coupled pump the casing is bolted to the drive flange (KSB). Material: not stated by the sources. Position: from the model (four bolts at the back of the casing). | https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/installation-1117016 ; https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/baseplate-1117438 ; https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/pump-foundation-1118498 ; https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/close-coupled-pump-1116226 | 2026-11-27 |
| pump-casing | Casing | Job: seals the pump interior from the atmosphere, retains pressure, encloses the rotor (KSB); the volute converts the high velocity from the impeller to pressure and keeps velocity constant around the impeller (Pumps and Systems, "casing vs impeller"; undated, no byline); the volute casing is typical for single-stage pumps (KSB). Material: cast iron, nodular cast iron, cast steel, chrome steels; mostly cast (KSB); cast iron generally preferred for water and wastewater (WaterWorld, Budris 2014); ductile iron at higher pressure, stainless in some pumps (Pump Industry 2022). | https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/pump-casing-1118596 ; https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/volute-casing-pump-1117514 ; https://pumpsandsystems.com/casing-vs-impeller ; https://www.waterworld.com/municipal/technologies/pumps/article/16192827/the-impact-of-component-material-selection-on-pump-reliability ; https://www.pumpindustry.com.au/pump-materials-part-1/ | 2026-11-27 |
| pump-impeller | Impeller | Job: rotating component with vanes; flow deflection turns mechanical power into pump power; every impeller has a back shroud; one with no front shroud is open (KSB); it imparts velocity (Intro to Pumps). Material: bronze is the most widely used impeller material for most water and non-corrosive services; cast iron only in small low-cost pumps; stainless where bronze is not enough (WaterWorld, Budris 2014); 304 or 316 stainless common for water (Pump Industry 2022). | https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/impeller-1116078 ; https://www.introtopumps.com/pumps-101/centrifugal-pump-parts/ ; https://www.waterworld.com/municipal/technologies/pumps/article/16192827/the-impact-of-component-material-selection-on-pump-reliability ; https://www.pumpindustry.com.au/pump-materials-part-1/ | 2026-11-27 |
| pump-flange | Flange | Job: connects pipe sections to each other and to casings of machinery such as pumps; designs follow flange standards (KSB); the suction nozzle is the cross-section at the casing inlet and the boundary with the suction-side system (KSB); in a volute pump the discharge can be on top, bottom or side, and the suction nozzle on an overhung impeller is often axial (KSB). Material: not stated by the sources. Position: from the model (discharge flange on top). | https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/flange-1118684 ; https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/pump-suction-nozzle-1118872 ; https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/volute-casing-pump-1117514 | 2026-11-27 |

## 4. Kiro prompt (Task 18.2 style, text only)

> Open `apps/skeleton-bench/docs/pump-text-pack.md`. Do not research and do not reword.
> 1. In `src/data/catalogue.ts`, replace the `PUMP_PARTS` array with the block in section 2, character for character. Do not touch layout numbers.
> 2. In `docs/sources.md`, replace the 8 `pump-*` rows with the rows in section 3 and replace the stale intro line as described there.
> 3. Run the tests. Expected: unchanged counts (Skeleton Bench 218 passed). Stop and report. Do not start another task.

## 5. Honest limits

- The Pump has no coupling, baseplate, foundation, shaft sleeve, motor fins or suction flange part. The texts say "not drawn" or "part of the Casing" wherever the text touches them.
- Pumps and Systems "casing vs impeller" has no byline or date. It is used only for the volute wording, and KSB backs the rest.
- The "frame-mounted" claim about the bearing housing is from the model layout (a separate bearing housing and motor), not from a page. KSB's lexicon has no "bearing housing" entry.
- Toshiba is a medium-voltage motor catalogue page and the one source for cast iron motor frames. If you want it gone, delete the last sentence of the Motor material text and the Toshiba URL.
