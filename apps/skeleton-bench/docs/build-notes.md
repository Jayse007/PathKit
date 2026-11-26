# Build notes

## Task 2.1: Create the app files
- Done: created package.json (exact pins), tsconfig.json, vite.config.ts, vitest.config.ts, .gitignore, index.html, src/pathkit-api.ts, src/constants.ts, THIRD_PARTY.md and the two docs stubs. Config files follow apps/shot-rail.
- Broke: nothing known. Nothing has been run (no terminal, install not yet done).
- Kiro got wrong: nothing known yet.
- PathKit feature used: none yet, only the re-export in src/pathkit-api.ts.
- Risk still open: Vite resolving the import from outside the app root, and type-checking PathKit source, are confirmed only at the first build.

## Task 3.1: Constants consistency test
- Done: wrote test/constants.test.ts (box radius 1.4, orbit speed 30, elevation sin/cos 5/13 and 12/13, lap r and h against hand-written values, r^2 + h^2 = d^2, distances strictly decreasing, clearance d - R >= 1.0). Expected values are typed in, not computed from the constants.
- Broke: nothing known. Not run yet (no terminal). If Vitest fails to start, esbuild's postinstall was not approved (allowScripts warning), which is a possible cause.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none.

## Task 4.1: Implement angleToFrame
- Done: added src/logic/frame-mapper.ts with `angleToFrame` (wrap with ((a % 360) + 360) % 360, floor(x + 0.5), then % 360; non-finite throws with the value in the message). No imports, no zoom input. `roundHalfUp` from the design table is not added yet (nothing needs it).
- Broke: nothing known. Not run (no terminal); tests are task 4.2.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none.

## Task 4.2: Angle tests
- Done: wrote test/angle-to-frame.test.ts (10-row table with hand-written frames, sweep -720 to 720 step 0.25 for whole frames 0 to 359, NaN/Infinity/-Infinity throw with the value in the message, repeat-call check).
- Broke: nothing known. Not run (no terminal). Mutation to try once: remove the final `% 360` in angleToFrame; the 359.9 table row must fail.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none.

## Task 5.1: Implement zoomSelection and zoomDistance
- Done: added `zoomSelection` (clamp 0 to 1, p = Z * 3, lower = min(floor(p), 2), upper = lower + 1, weight = p - lower) and `zoomDistance` (6.5 - 3.9 * Z, computed from LAP_DISTANCES first and last) to src/logic/frame-mapper.ts. Non-finite throws with the value in the message. No angle input. The file now imports LAP_COUNT and LAP_DISTANCES from '../constants.js'.
- Broke: nothing known. Not run (no terminal); tests are task 5.2.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none.

## Task 5.2: Zoom tests
- Done: wrote test/zoom.test.ts (7-row selection table, weight in [0, 1] and lap indices valid over Z -0.5 to 1.5 step 1/120, non-finite throws for both functions, distance table with 4.55 m at Z = 0.5 and clamping, monotonic distance sweep, independence loop over 13 zoom grid points x 360 angles). Distances use a 1e-9 tolerance because 6.5 - 3.9 * Z can differ by about 1e-16.
- Broke: nothing known. Not run (no terminal). Mutation to try once: change `Math.min(Math.floor(p), LAP_COUNT - 2)` to `LAP_COUNT - 1` in zoomSelection; the Z = 1 table row must fail.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none.

## Task 6.1: Build and bake the four lap scenes
- Done: added src/pathkit/laps.ts with `buildLapScene(lap)` (fps 30, 360 frames, entity `cam`, forward -Z, up +Y from constants, `orbitAround` order 0 around `orbitCentre` (0, h, 0), `aimAt` order 1 at `machineCentre` (0, 0, 0), dummy 2-point open path), `bakeLaps()` (bakes all four; call once at load), `lapRadius` and `lapHeight` (r = d * 12/13, h = d * 5/13 from the constants). Orbit speed and start angle come from constants, so frame f is f degrees.
- Broke: nothing known. Not run (no terminal); tests are task 6.2.
- Kiro got wrong: first tried to read this file with a terminal command and the hook blocked it. Nothing else known yet.
- PathKit feature used: `bake`, `Scene` and `BakedData` types, `orbitAround` and `aimAt` constraints (validation runs inside `bake`).
- Not tested: the look, WebGL, view offset, clicking, load time. Nothing in this task is tested yet.

## Task 6.2: Spike S1 tests
- Done: wrote test/laps.test.ts (7 tests): validateScene passes for four laps; orbitAround order below aimAt; forward and up on different axes; every frame of every lap readable (finite, unit rotation); frames 0, 90, 180, 270 at (0,h,r), (r,h,0), (0,h,-r), (-r,h,0) within 1e-9 using hand-written r and h; Bearing equals frame in degrees on all 360 frames within BEARING_TOLERANCE_DEG; bake time per lap logged with console.log, no timing assertion.
- Bake time per lap (ms), from the User's pasted run (all 25 tests passed): lap 0: 2.21, lap 1: 6.43, lap 2: 1.78, lap 3: 1.62.
- Broke: nothing known. Not run (no terminal). Mutation to try once: change ORBIT_START_ANGLE_DEG or ORBIT_SPEED_DEG_PER_S in constants (the lap builder reads them); the four-frame table and the bearing sweep must fail.
- Kiro got wrong: nothing known yet.
- PathKit feature used: `validateScene`, `bake`, `evaluateEntity`, `OutBuffer`.
- Not tested: the look, WebGL, view offset, clicking, load time, the aim rotation (checked for finite and unit length only; aim accuracy is in task 7.2).

## Task 7.1: Implement the camera blend
- Done: added src/pathkit/camera-blend.ts with `createCameraBlender()` (two OutBuffers plus one result position and rotation, allocated once) and `blendCamera(laps, frame, zoom, blender)`. It reads laps i and i+1 with `evaluateEntity` at the same whole frame, then `lerp` and `slerp` into the blender's result buffers. Throws for non-finite zoom; `evaluateEntity` throws for a bad frame.
- Decision: the lap selection (p = Z * 3, i = min(floor(p), 2), w = p - i) is written inline, not via `zoomSelection`, because `zoomSelection` returns a new object and the blend path must not allocate. Task 7.2 should check the two agree.
- Broke: nothing known. Not run (no terminal); tests are task 7.2.
- Kiro got wrong: nothing known yet.
- PathKit feature used: `evaluateEntity`, `OutBuffer`, `lerp`, `slerp` (always with `out`).
- Not tested: everything in this task (tests are 7.2); also the look, WebGL, view offset, clicking, load time.

## Task 7.2: Spike S2 and View_Pair tests

- Done: wrote test/camera-blend.test.ts (9 tests). Over 360 frames x 13 zoom points: Bearing, aim (angle between the rotated -Z vector and the direction to the centre, via atan2 of cross and dot), distance 6.5 - 3.9 * Z within 1e-9. Clearance to the box (corners included) at least 1.0 and at least d - R - 1e-9. Z = 1 minimum clearance 1.2035 (tolerance 0.001) within 2 frames of 72, below 1.2649 - 0.05, and the four side-on frames alone give at least 1.2649. Z = 0.5 positions and forward vectors from the design. Monotone distance, zoom keeps Bearing, angle keeps distance. Agreement check: blendCamera against a blend rebuilt from `zoomSelection` (14 zoom values including joints and out-of-range, 5 frames, 1e-12). Non-finite zoom throws.
- Broke: nothing known. Not run (no terminal).
- Kiro got wrong: nothing known yet.
- PathKit feature used: `evaluateEntity` (agreement check), through `blendCamera` (`lerp`, `slerp`).
- Source line it should catch: replace the lerp weight `weight` with `1 - weight` in blendCamera (distance check and the Z = 0.5 table fail), or set a lap distance below R (clearance check fails).
- Not tested: the look, WebGL, view offset, clicking, load time, per-frame allocation.

## Task 8.1: tour builder and finding text
- Done: `src/pathkit/tour.ts` (`buildTourScene`, ring of 12 points, `followPath` + `aimAt` with a keyframed target at each slot middle) and `src/logic/finding-text.ts` (five codes, unknown-code fallback, empty list text).
- Broke: nothing known. Not run (no terminal); tests are task 8.2.
- Kiro assumption to check: ring speed is taken from the arc-length table of the closed curve, in metres per second, so one turn spans the frame count. Ring bearing 0 is +Z, as in the laps.
- PathKit features: `followPath`, `aimAt`, keyframed target, `createCurve`, `createArcLengthTable`.

## Task 8.2: Tour tests (added four)
- Done: added four tests to test/tour.test.ts: closed ring (frame 0 to last frame under 0.2 m, 8 and 6 Parts), no `path-end-reached` finding from `motionLinter`, ring points at hand-written values (12 points, point 0 = (0, 1.5, 3.6), point 3 = (3.6, 1.5, 0), 1e-9, y equals `TOUR_RING_HEIGHT`), and `buildTourScene([])` throws `RangeError`. No source changes.
- Broke: nothing known. Not run (no terminal). Expected: tour.test.ts 12 tests, total 49.
- Mutations they must catch: `closed: true` to `false` in tour.ts (closed ring and path-end tests), `y: TOUR_RING_HEIGHT` to `y: 0` (ring points test), removing the empty-list check (empty tour test).
- Kiro assumption to check: `TOUR_RING_RADIUS` is 3.6 and `TOUR_RING_HEIGHT` is 1.5 in constants.ts; the ring test uses typed-in values.

## Task 10.1: Implement Drag_Range and Fraction_To_Pixels

- Done: added src/logic/drag-range.ts with `benchLimit` (0.25 - 0.15 * e / 100 from the two named constants, e clamped to 0 to 100), `clampOffset(fx, fy, e)` (each axis clamped independently, returns a new object), `resetOffset()` and `fractionToPixels(fraction, size)` (plain multiply). Non-finite input throws with the value in the message.
- Broke: nothing known. Not run (no terminal); tests are task 10.2.
- Kiro assumption: an Explode_Amount outside 0 to 100 is clamped, as `explodeFrame` does in the design; only non-finite throws.
- PathKit feature used: none.
- Not tested: everything in this task (tests are 10.2); also the look, WebGL, view offset, clicking, load time.

## Task 9.1: Write the S4 check page

- Done: added src/spike/s4-check.html and src/spike/s4-check.ts. Three shapes (sphere at the origin, box at x=1, cylinder at x=-1), camera driven by `bakeLaps`, `blendCamera` and `angleToFrame` with an angle slider and a zoom slider, offset buttons (step 0.1 of the viewport) calling `setViewOffset(W, H, -fx * W, -fy * H, W, H)` or `clearViewOffset` at (0, 0), a raycast click (NDC from the canvas rectangle) that prints the hit shape, fixed red cross-hairs at the screen centre, and a readout of where the sphere lands in pixels against the expected shift.
- Broke: nothing known. Nothing has been run or opened (no terminal, no browser). Editor diagnostics were not visible to Kiro.
- Kiro assumption: the design text says `clearView`; the Three.js method is `clearViewOffset`, which the page uses.
- PathKit features used: `bake` (via `bakeLaps`), `evaluateEntity`, `lerp`, `slerp` (via `blendCamera`), `orbitAround`, `aimAt`.
- Not tested: everything. The offset sign, orbit and zoom while offset, clicking and WebGL are all unchecked until the User's task 9.2.

## Task 9.2: Spike S4 result (User checkpoint)

- Result: PASS. The User opened src/spike/s4-check.html in a browser and answered: (1) the Machine moves on screen with the offset sign as designed: Yes; (2) orbit, zoom and clicking a shape still work while offset: Yes; (3) the shift direction matches: Yes.
- Decision: the `setViewOffset` approach is confirmed. No fallback is needed.
- Broke: nothing reported.
- Kiro got wrong: nothing reported. The `clearViewOffset` naming fix from task 9.1 held.
- Not tested: nothing new beyond the three checks above. These were manual answers from the User, not automated tests.

## Task 10.2: Drag_Range tests

- Done: wrote test/drag-range.test.ts (10 tests). Limits 0.25, 0.175, 0.10 at 0, 50, 100; 1000 x 800 px table (250/200, 175/140, 100/80); inside unchanged; on the edge unchanged; outside gives the nearest edge; axes independent; reset gives (0, 0); loop e = 0 to 100 checking L(e) = 0.25 - 0.0015 * e (typed in), strictly shrinking, and the clamped far offset; re-clamp when e changes 0 -> 50 -> 100; non-finite throws with the value for all four functions. Comparisons use a 1e-9 tolerance.
- Broke: nothing known. Not run (no terminal). Mutation to try once: in benchLimit use 0.25 instead of 0.15 as the slope, i.e. `BENCH_MAX_FRACTION_AT_0 - 0.25 * e / 100`; the 100 percent limit row must fail.
- Added later: test 'clamps an out-of-range Explode_Amount to 0..100' (now 11 tests). Hand-written: benchLimit(-20) = 0.25, benchLimit(150) = benchLimit(1000) = 0.10, clampOffset(1, -1, 150) = (0.1, -0.1), clampOffset(1, -1, -20) = (0.25, -0.25). It should fail if `Math.min(100, ...)` or `Math.max(0, ...)` is removed from benchLimit. Not run (no terminal).
- Not tested: the look, WebGL, view offset, clicking, load time.
- PathKit feature used: none.

### Task 11.1: explodeFrame and Part path points
- Done: added `src/logic/explode-easing.ts` (`explodeFrame`), `src/logic/part-path.ts` (`partPathPoints`), and exported `roundHalfUp` from `frame-mapper.ts`.
- Broke / Kiro got wrong: nothing known yet. Not run (no terminal); tests are task 11.2.
- PathKit feature used: none (app code). Catmull-Rom use comes later in the Part scenes.

## Task 11.2 Explode_Easing and Part path tests
- Done: wrote test/explode-easing.test.ts (8 tests) for explodeFrame and partPathPoints, hand-computed expected values. Not yet run by the User.
- Added 3 tests (now 11): far-out clamp (-50, -20, 150, 1000), offset rest position (1, 2, 3) with v = (0.6, 0, 0), and NaN/Infinity rest position throws naming the value. They target removing Math.min(100, ...) or Math.max(0, ...) in explodeFrame, replacing the first or last path point with the origin, and removing the rest-position finite check. Not yet run by the User.
- Broke: nothing known yet.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none (app logic only).

## Task 12.1: Pointer, shortcut guard, contrast and storage helpers
- Done: added src/logic/pointer.ts (`classifyPointer`, click when distance <= 5), src/logic/shortcut-guard.ts (`shouldHandleShortcut`, plus `activeElementKind` mapping a focused element to a kind), src/logic/contrast.ts (`contrastRatio`, WCAG formula, "#rgb" or "#rrggbb"), src/ui/storage.ts (`readStored`, `writeStored`, `loadLook`, `saveLook`, `hasSeenHint`, `markHintSeen`; every access in try/catch; optional storage argument so tests can pass a fake).
- Broke: nothing known. Not run (no terminal); tests are task 12.2.
- Kiro assumptions to check: negative or non-finite distance throws in `classifyPointer`; invalid colour strings throw in `contrastRatio`; Look values are the strings 'X_Ray_Skeleton' and 'Clean_Engineering'; hint flag is stored as "1".
- PathKit feature used: none.
- Not tested: everything in this task (tests are 12.2); also the look, WebGL, view offset, clicking, load time.

### Task 12.2: tests for pointer, shortcut guard, contrast, storage
- Done: four test files (pointer 4, shortcut-guard 3, contrast 5, storage 6 = 18 tests). Storage failure modes use a fake storage and a temporary override of `globalThis.localStorage`.
- Broke: nothing known yet; tests not run (Kiro cannot run commands).
- Kiro got wrong: nothing found. "Out to 6 and back to 2" is tested through a hand-written max-tracking helper, because `classifyPointer` takes the largest distance.
- PathKit feature used: none (app code only).
- Not tested: real browser localStorage, real DOM focus, real pointer events.
- Source line it should catch: change `<=` to `<` in `classifyPointer`; "is a click at 0 and at exactly 5 px" fails.
- Added later (test-only, 6 tests): contrast gets pure colours on white (3.998, 1.372, 8.592), #0a0a0a on white (19.80) and `#abc` vs `#aabbcc`; shortcut-guard gets all text input types and checkbox/button; storage gets hint values '0' and 'yes'. Expected values were worked out by hand. Counts are now pointer 4, shortcut-guard 5, contrast 8, storage 7 = 24; total 89 + 6 = 95. Not run.
- Mutations they should catch: swapped green/blue luminance weights; `12.92` changed to `12`; changed `#rgb` expansion; 'number' or 'password' removed from the text input types; `=== '1'` changed to `!== null`.

## Task 13.1: catalogue types and layout
- Done: added `src/data/catalogue-types.ts` (PartEntry, MachineEntry, Catalogue) and `src/data/catalogue.ts` (one-Part fixture with placeholder text, sourceId `fixture`). No machine facts.
- Broke: nothing known. Tests not run (task 13.2).
- Kiro got wrong: nothing known yet. The model builder field of the Machine definition is left out until the render code exists.
- PathKit feature used: none.
- Not tested: everything (checks come in 13.2).

## Task 13.2: catalogue checks
- Done: added `src/data/catalogue-checks.ts` (pure checks returning failure lists that name the Part: fields, unique ids, keyboard order, source ids, explode length, envelope, named Parts, `parseSourceIds`) and `test/catalogue.test.ts` (now 27 tests: 23 run, 4 skipped). The test reads `docs/sources.md` with `import SOURCES_TEXT from '../docs/sources.md?raw'` (Vite asset import, typed by `src/vite-env.d.ts`). This replaces `node:fs` (the task text said `node:fs`) so `tsc` passes without adding `@types/node`.
- Follow-up checks added (6 tests): envelope low side (rest x -1.2), end position on y and z (explode vector y and z), extents 0 reported, Machine with no Parts, duplicate Machine id, unknown id in a keyboard order. Mutations they must catch: removing the low-side envelope check; ignoring explode vector z in the end position; changing `extents <= 0` to `< 0`; removing the no-Parts, duplicate-Machine or unknown-id checks.
- Fixture handling: the source-id check exempts only the exact Part `fixture-part` with source `fixture`. The named-Parts checks per Machine (8, 6, 6) and the 20-Part total are `skipIf` while a Machine holds the fixture or is absent. They run on their own once Task 14 and Task 18 fill the catalogue. Not weakened.
- Naming rule for Tasks 14 and 18: Part `name` must equal the brief's name (case ignored, a trailing "(...)" note allowed), for example "Bolts (one group)", "Tube bundle", "Bulb holder".
- Broke: nothing known. Not run (no terminal).
- Kiro assumption: the envelope check puts a box of the Part's extents around the rest position and around rest + explode vector, and requires both boxes inside the Exploded_Box half-extents.
- PathKit feature used: none.
- Source line it should catch: delete a source id row from `docs/sources.md` (source check fails once rows exist) or duplicate a Part id (unique-id test names the Part).
- Not tested: the look, WebGL, view offset, clicking, load time, the 60 path frames (Task 15).

## Task 14.1: Research and write the Pump entries
- Done: searched and fetched pump parts guides, then wrote 8 rows in docs/sources.md (ids pump-casing, pump-impeller, pump-shaft, pump-bearing-housing, pump-mechanical-seal, pump-flange, pump-bolts, pump-motor) and 8 Pump entries in src/data/catalogue.ts (keyboard order motor to flange). The fixture exports stay for the tests; CATALOGUE now holds only the Pump machine. Rest and explode vectors were checked by hand against the envelope (x 1.2, y 0.6, z 0.4) and the 0.1 m minimum.
- Weak spots: the "date checked" column reads TO CONFIRM because Kiro cannot read the clock. Bearing housing material, flange material and bolt material are thinly sourced and the text says so. Several sources are supplier pages, not standards. springpump.com returned HTTP 403 and PDFs could not be fetched, so some claims rest on search snippets (ASHRAE casing and impeller materials, Pentair flange, aruba studs, stalkerpumps bolts, dultmeier fasteners, electricmotors.com cast iron frames).
- Broke: nothing known. Not run (no terminal); the User approves the text in Task 14.2, tests are Task 14.3.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none.
- Not tested: the look, WebGL, view offset, clicking, load time. Catalogue checks not yet run on the new data.

## Task 14.1 follow-up: claims removed after reviewer check
- Done: text-only edits to src/data/catalogue.ts and docs/sources.md. Removed claims the reviewer could not find on the cited pages:
  - Mechanical seal: "ceramic" face material and "Metal parts usually stainless steel 304 or 316" (not found on the cited pages).
  - Impeller: "Bronze is also used" (not found).
  - Bolts: "studs hold the casing to its cover" (not found).
  - Casing: "Cast iron is typical for general water duty. Stainless steel for corrosive liquids." replaced with "Cast iron is one common casing material. Ductile iron and stainless steel (SS316) are also used."
  - Motor: material replaced with "Close-coupled pump motors are sold with cast iron frames."; job now says the impeller can be mounted directly on the motor shaft in a close-coupled pump (the old "own extended shaft" wording is gone).
- URLs deleted from every sources.md row that listed them (they do not open): the Dynapro centrifugal-pump-parts-guide page, the Weltech how-to-select-mechanical-seal-based-on-liquid page, the ASHRAE s24_ch44 page. Rows affected: casing, impeller, shaft, bearing housing, mechanical seal, motor. Each now keeps the slurrypumpsupply page (motor also keeps electricmotors.com). No replacement URLs added.
- Bolts: the holding-down bolts text is kept and marked "NOT YET VERIFIED by the reviewer" in sources.md. The aruba URL stays in the row, relabelled "fasteners on the casing", because "fasten the casing parts together" still rests on it; the reviewer should check that claim too.
- Not removed, but unchecked: after the deletions the remaining sources for the shaft, bearing housing, seal, impeller and casing rows are one page (slurrypumpsupply). Kiro could not re-read it, so whether it supports each remaining claim is not confirmed here.
- Date checked column still TO CONFIRM.
- Broke: nothing known. Not run (no terminal). The User runs npm.cmd test from apps/skeleton-bench.

## Task 14.1 follow-up 2: four more links removed
- Done: text-only edits to src/data/catalogue.ts and docs/sources.md. The reviewer found four links that do not open: the Pentair PDF, the aruba PDF, the stalker PDF and the dultmeier page. All four are deleted from sources.md. This supersedes the earlier note that kept the aruba URL in the bolts row.
- Claims changed and why:
  - Flange material: the "cast iron body with ANSI 125 or PN16 flanges" claim rested only on the Pentair PDF. Now "Not stated by the sources." The suction/discharge flange job (slurrypumpsupply) and "enters at the end, leaves at the top" (kendisco) stay.
  - Bolts job: the old text rested on the aruba and stalker PDFs. Now: anchor bolts tie baseplate, grout and foundation together; capscrews fasten the casing (volute) together. New sources: pumpsandsystems.com (anchor bolts) and the Xylem Goulds parts list (volute capscrews on one pump model).
  - Bolts material: the "stainless steel fasteners" claim rested only on the dultmeier page. Now "Not stated by the sources."
  - Bolts row: "NOT YET VERIFIED" wording removed. Position text unchanged.
  - Impeller material: now "Cast iron and stainless steel such as CF8M are used." The "for clean water" and "for corrosive liquids" pairings are removed from catalogue.ts and sources.md.
  - Mechanical seal job: faces are pressed together by springs and the pressure of the liquid. Added source: aesseal.com "what is a mechanical seal".
- Other rows checked (casing, motor, shaft, bearing housing, seal, impeller): none cited any of the four deleted links, so no further claims were removed. They still rest on slurrypumpsupply (and electricmotors.com for the motor); Kiro could not re-read those pages.
- "Date checked" stays TO CONFIRM. No other URL was added. catalogue-checks.ts and the tests are unchanged.
- Broke: nothing known. Not run (no terminal). The User runs npm.cmd test from apps/skeleton-bench; exact pass counts need the pasted output.

## Task 14.2: Pump text approved
- Pump text approved by the user, date checked 2026-11-26. All 8 "Date checked" cells in docs/sources.md now read 2026-11-26 (were TO CONFIRM). Docs-only change; no code or tests touched, nothing run.

## Task 15.1: Build and bake one scene per Part

- Done: added `src/pathkit/part-scenes.ts` with `buildPartScene(part)` (one open `followPath` scene per Part: fps 30, 60 frames, entity id = Part id, forward +Z and up +Y from constants, `followPath` order 0, influence 1, startOffset 0, `alignToPath` false, no `aimAt`, empty targets, path from `partPathPoints`), `partPathLength(part)` (read from `createCurve` and `createArcLengthTable`) and `bakeParts(parts = CATALOGUE.parts)` which returns `Map<partId, BakedData>`. Speed = length * FPS / (EXPLODE_FRAMES - 1) = length * 30 / 59, so frame 59 reaches the path end.
- Broke: nothing known. Not run (no terminal); tests are task 15.2.
- PathKit features used: `createCurve`, `createArcLengthTable`, `followPath`, `bake`.
- Not tested: everything in this task (tests are 15.2); also the look, WebGL, view offset, clicking, load time.

## Task 15.2: Part scene tests

- Done: wrote test/part-scenes.test.ts (14 tests). Three hand-made fixture Parts (along +X, diagonal, vertical) plus every catalogue Part. Checks: `validateScene` passes; scene shape (fps 30, 60 frames, one open `followPath`, no `aimAt`, no targets, +Z and +Y, speed * 59 / 30 equals the path length); length between |v| and 1.1 * |v|; frame 0 equals rest within 1e-9; frame 59 equals typed end positions (fixtures) and rest + v (catalogue) within 1e-6; travelled distance starts at 0, never decreases and ends at the path length; all 60 frames inside the envelope; frame 30 travelled = length * 30/59 (0.5084745762711864 typed in); frames 29 and 30 mirror each other about the middle of the path (hand-derived symmetry, tolerance 1e-4); unique ids; `bakeParts` keys and sizes; `buildPartScene` returns a new equal scene.
- Kiro assumptions to check: the mirror check relies on the centripetal Catmull-Rom curve with reflected end points being symmetric for these control points. The envelope check applies to Part positions only (not extents).
- Broke: nothing known. Not run (no terminal). Expected: 15 files, 133 passed, 3 skipped.
- Source line it should catch: in `buildPartScene`, change `(EXPLODE_FRAMES - 1)` to `EXPLODE_FRAMES` in the speed. The end-position, travelled-end, frame-30 and mirror tests must fail.
- Not tested: the look, WebGL, view offset, clicking, load time.
