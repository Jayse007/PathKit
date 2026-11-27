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

## Task 16.1: Implement the state functions

- Done: added `src/state.ts`. `AppState` is a plain object (machine, orbitAngleDeg, zoom, explode, offsetX/offsetY, mode, selectedPart, look, tour with saved angle and zoom). Pure update functions return a new state: `createInitialState(look)` (angle 30, zoom 0.25, explode 0, Pump from constants), `setMachine` (explode 0, offset 0, no selection), `setOrbitAngle`, `setZoom` (clamp 0 to 1), `setExplode` (clamp 0 to 100, re-clamps the offset via `clampOffset`), `setOffset` (clamped by Drag_Range at the current explode), `toggleMode`, `selectPart`, `setLook`, `startTour` (idle only: explode and offset 0, saves angle and zoom), `pauseTour`, `resumeTour`, `stopTour` (restores angle and zoom; also used when the Tour ends). While the Tour status is `playing`, the orbit, zoom, explode and offset setters return the same state object. Non-finite input throws with the value in the message.
- Kiro choices to check: (1) the setters are rejected only while `playing`, not while `paused`; stopping still restores the saved values. (2) `setMachine` and the other setters not named in the task are not blocked during the Tour. (3) The orbit angle is stored unwrapped; `angleToFrame` wraps it. (4) Tour start from `paused` or `playing` does nothing.
- Broke: nothing known. Not run (no terminal); tests are task 16.2.
- PathKit feature used: none (app logic only).
- Not tested: everything in this task; also the look, WebGL, view offset, clicking, load time.

## Task 16.2: State tests
- Done: wrote test/state.test.ts (10 tests): initial values; orbit angle; zoom clamp table; explode clamp with offset re-clamp (50, 100, 150, -10, and 100 then 0 does not restore the offset); offset clamp at explode 0 and 50; mode, select Part, Look; Machine switch reset; Tour start/stop table over four start states (the Tour-moved angle and zoom are set by hand between start and stop, so a missing restore shows); pause/resume/stop transitions; the four setters rejected while playing (same object returned). Expected values typed in.
- Added test 11 (paused Tour): the orbit, zoom, explode and move setters are accepted while the Tour is paused, the Tour stays paused with its saved angle (30) and zoom (0.25) unchanged, and stop restores them. This pins the decision that setters are allowed while the Tour is paused (state.ts blocks them only while `playing`). Not run yet.
- Spec check: state.ts matches Requirement 16.11 and design (only orbit, zoom, explode and move setters are blocked, only while status is `playing`). Spec is silent on `paused` and on Machine switch, mode, select and Look during the Tour, so no test asserts those.
- Broke: nothing known. Not run (no terminal). Expected: 16 files, 143 passed, 3 skipped.
- Mutation to try once: in `stopTour` delete the `zoom: state.tour.savedZoom,` line; the Tour table test must fail on "zoom after stop".
- Not tested: the look, WebGL, view offset, clicking, load time, the Tour UI wiring.

## Task 17.1: Renderer, stage, camera and view offset
- Done: added `src/render/stage.ts` (`createStage(container, laps)`): WebGLRenderer in try/catch with a WebGL-failure message (`WEBGL_FAILURE_MESSAGE`, role="alert"); scene, `GridHelper` at y = -0.6 (faint, opacity 0.5), empty `machineGroup` for Task 17.3; camera from `blendCamera` via `position.set` and `quaternion.set`; view offset `setViewOffset(W, H, -fx*W, -fy*H, W, H)` using `fractionToPixels`, `clearViewOffset` at (0, 0); render-on-change (one `requestAnimationFrame` per change, no continuous loop); ResizeObserver; `dispose`. Added stage constants (`STAGE_GRID_*`, `STAGE_MAX_PIXEL_RATIO`) to constants.ts. Added a temporary page `src/render/stage-preview.html` and `.ts` (sliders for angle, zoom, offset x and y, driven by the state functions) for the 17.2 checkpoint.
- Decision: `index.html` was not changed (only README.md may change among existing files), so the final entry point (`src/main.ts`) is left for a later task. The preview page is the only way to see the stage for now.
- Per-frame path: `draw` allocates nothing in app code (preallocated blender, `set()` calls). Three.js allocates its `view` object once on the first `setViewOffset`.
- Broke: nothing known. Nothing run, no browser opened, editor diagnostics not visible to Kiro.
- Kiro assumption to check: `new WebGLRenderer` throws when WebGL is missing (so the catch shows the message). Grid colour 0x889099 on background 0xf4f4f4 is a guess at "faint"; Looks come in 17.5.
- PathKit feature used: `evaluateEntity`, `lerp`, `slerp` through `blendCamera` and the baked laps from `bakeLaps` (`bake`, `orbitAround`, `aimAt`). The view offset is Three.js, not PathKit.
- Not tested: the look, WebGL, view offset, clicking, load time, resize, WebGL-failure message, per-frame allocation. No unit tests were written for this task (rendering needs a browser).

## Task 17.2: Empty stage result (User checkpoint)

- Result: PASS. The User opened src/render/stage-preview.html in a browser and answered: (1) a faint grid with no machine: Yes; (2) the orbit slider turns the view around the grid: Yes; (3) the zoom slider moves the camera closer and further: Yes; (4) positive offset x moves the whole stage right, positive offset y moves it down, and reset brings it back to centre: Yes.
- The checks were manual answers from the User, not automated tests.
- The offset sign matches Spike S4 (task 9.2).
- Docs-only change. No code edited.

## Task 17.3: Pump model and Part placement
- Done: added `src/render/pump-model.ts` (`buildPumpModel`: eight Part groups named `part:<id>`, each with `userData.partId`, and the Meshes inside carry the same `partId`; shapes are cylinders and boxes sized inside the catalogue extents; `spinImpeller(model, dt, reducedMotion)` turns the inner impeller spinner about x at `IMPELLER_SPIN_RAD_PER_S`, and does nothing under reduced motion) and `src/render/part-placement.ts` (`createPartPlacer`: `placeAtAmount(percent)` goes through `explodeFrame`, then `evaluateEntity` on each baked Part scene into one preallocated `OutBuffer`, then `position.set`; a plain indexed loop, no allocation per call). Extended the temporary preview page (`stage-preview.html` and `.ts`) with an explode slider, a reduced-motion checkbox (starts from the browser setting) and a spin loop that runs only while the impeller turns. `index.html` and the catalogue text were not changed.
- Decisions: the placeholder material is `MeshNormalMaterial` (needs no lights); the two Looks replace it in 17.5. The impeller is inside the casing, so with this opaque placeholder it is hidden until the Pump is exploded (the casing moves -z and the impeller up and right). The casing is a plain barrel, not a volute. The bolt group is four short bolts. The spin is on an inner group so the Part group's position still comes only from the baked scene.
- Broke: nothing known. Nothing run, no browser opened, editor diagnostics not visible to Kiro. No unit tests written (rendering needs a browser).
- Kiro assumptions to check: `Group.userData` accepts `.partId` assignment under this tsconfig (it is `Record<string, any>`); `noUncheckedIndexedAccess` may be on, so `placeAtFrame` guards `entries[i]`.
- PathKit feature used: `evaluateEntity` and `OutBuffer` (reading baked Part scenes), through the scenes from `bakeParts` (`followPath`, `createCurve`, `createArcLengthTable`). The spin is Three.js only.
- Not tested: the look, WebGL, the shapes against the extents, view offset, clicking, load time, per-frame allocation, reduced-motion behaviour, the spin.
- Tests added later (not yet run): `test/pump-model.test.ts` and `test/part-placement.test.ts` use Three's `Group` and `Mesh` in the Node environment (no renderer). They check group names, parents, rest positions, mesh counts (bolts 4, impeller 7), the two build errors, `dispose`, the spin (dt 0.5 gives pi/2, then pi; guarded cases return false), placer end frames, the easing frames (25% to 9, 50% to 30), the missing-baked-scene error and that Parts never rotate. Expected values are written by hand, tolerance 1e-6. Source files were not changed.

## Spec change: exploded-view clearance for every Machine
- Done: at Explode_Amount 100, every two Parts of the same Machine must be at least 0.08 m apart. Added requirements 9.7 and 13.8, `PART_MIN_CLEARANCE_M` = 0.08 in design.md (constants table, entry table, Property 18) and in `src/constants.ts`, and `checkExplodedClearance(catalogue, minGap = PART_MIN_CLEARANCE_M)` in `src/data/catalogue-checks.ts`. Centre = restPosition + explodeVector. Extents are full box sizes (the envelope check halves them), so gap = max over x, y, z of |centreA - centreB| - (extentsA + extentsB) / 2. A pair fails when gap < minGap - 1e-9, and the message names both Parts and the gap. Parts of different Machines are never compared. The function does not change its input.
- Changed only the Pump explode vectors in `src/data/catalogue.ts`: motor [-0.17, 0, 0], bearing housing [-0.06, -0.2, 0], shaft [0, 0, 0.36], mechanical seal [-0.03, -0.44, 0], bolts [-0.08, -0.05, 0.04], casing [0.07, -0.13, -0.14], impeller [0.2, 0.39, -0.18], flange [0, 0.27, 0.19]. No text changed.
- Tests: `test/catalogue.test.ts` gets 1 real-catalogue test and 8 synthetic tests (gap 0.1 passes, 0.05 fails and names both Parts, 0.08 passes and 0.07 fails, overlap fails, apart on y only passes, end position used, different Machines never compared, input not changed). Expected values written by hand.
- Known effect on a test written for 17.3: `test/part-placement.test.ts` hard-codes the old end positions in its `END` table, so "placeAtFrame(59) puts every Part at rest + explode vector" will fail until `END` is updated. That file was not edited in this change. `test/pump-model.test.ts` holds rest positions only and is not affected.
- Broke: nothing known. Not run (no terminal). The User runs npm.cmd test from apps/skeleton-bench.
- Not tested: how the new vectors look in a browser (the paths bow sideways and could cross other Parts between frame 0 and frame 59; the check covers only the end position).

## Task 17.4: User checkpoint: view the Pump assembled and exploded

- Result: PASS. The User opened src/render/stage-preview.html in a browser, with the new Pump explode vectors from the clearance change, and answered Yes to all five checks: (1) at 0% explode, eight Parts form a compact pump, motor on the left, casing on the right; (2) dragging the explode slider moves each Part along its own short curved path and they separate smoothly; (3) at 100% all eight Parts are visible, none touching each other or leaving the view; (4) the impeller turns once visible, and Reduced motion stops and restarts it; (5) orbit, zoom and offset still work with the Pump on screen.
- Manual: these were the User's visual answers, not automated tests. The latest test run was 18 files, 176 passed, 3 skipped.
- Not separately confirmed: whether Parts pass through each other partway through the explode. The User did not report on this; check 3 covers only the 100% state.

## Task 17.5: The two Looks
- Done: added src/render/looks.ts (two palette objects, two material sets, lights, scene background helper). Replaced the temporary MeshNormalMaterial in src/render/pump-model.ts: every mesh now has a cyan EdgesGeometry LineSegments child (shown only in X_Ray_Skeleton), and `model.setLook(look)` swaps the fill material. X_Ray_Skeleton uses translucent unlit ivory (opacity 0.22, depthWrite off). Clean_Engineering uses matte MeshStandardMaterial (roughness 1) and needs the lights. Added a Look dropdown to src/render/stage-preview.ts/.html that uses loadLook/saveLook. No new tests; existing tests untouched.
- Broke: nothing known. Not run (no terminal, no browser). Not checked: whether the edges and translucent fills look right, whether the translucent sort order shows inner Parts well, the Clean_Engineering lighting, or the colour contrast of the palettes (the contrast check of Task 20 covers text pairs only).
- Kiro got wrong: nothing known yet. One blocked terminal call was attempted by mistake and was stopped by the hook.
- PathKit feature used: none (Looks are app code). The grid colour is the same in both Looks and was left alone.

## Task 17.3 revision (step 1): casing and impeller look like real parts, fit test for all eight Parts
- Done: in src/render/pump-model.ts only the `pump-casing` and `pump-impeller` builders changed, plus three small helpers. Casing (5 meshes): a spiral volute body (48-step y-z outline, radius 0.17 rising to 0.23, extruded along x from -0.30 to +0.18), suction snout, suction flange ring, discharge neck on top, foot. Impeller (8 meshes, all in the spinner): back plate, hub, and six curved vanes (each a thin strip, 0.012 thick, swept back 0.9 rad, one pivot group per vane). Other six builders, names, `userData.partId`, nesting, `setLook`, edges and spin are unchanged.
- Helper `extrudeAlongX`: after `rotateY(+PI/2)` a shape point (x, y) extruded over z in [0, L] maps to world (z, y, -x). The extrusion therefore runs along +x as wanted, and the outline's z is the negated shape x. I kept the specified geometry and negated the shape x inside the helper (outline points are given as {y, z}).
- Shapes are drawn from scratch in code with Three.js. No third-party asset, no model file, no THIRD_PARTY change.
- Tests: test/pump-model.test.ts impeller mesh counts 7 to 8 (and the two titles). New test/pump-fit.test.ts (2 tests): every Pump Part's exact box (`Box3.setFromObject(group, true)`) against its extents at spinner rotation.x 0, 0.3, 1 (overshoot <= 1e-6, message names Part and axis); casing x extent 0.05 smaller gives an overshoot above 0.02 on x.
- Spec: Requirement 18.6 added; design "Pump model" paragraph added (design had no such section, so it was created before "Looks and theme"); note added under task 17.3 in tasks.md.
- Broke: nothing known. Not run (no terminal). The User runs npm.cmd test from apps/skeleton-bench.
- Not tested: how the new shapes look in a browser (volute outline, vane sweep direction, translucent X_Ray fill).

## Task 17.6: Look checkpoint result and two decisions

- User answers: (1) starts in X_Ray_Skeleton: yes. (2) X-ray background, translucent ivory Parts, cyan outlines, inner Parts visible: yes. (3) Outlines stay visible on explode, orbit and zoom and turn with the impeller: yes. (4) Clean_Engineering background, matte grey, no outlines: yes, but assembled Parts were all the same grey and separated only by shading. (5) Look persists after reload: yes. (6) Casing recognisable (snout, flange ring, neck, foot) but the spiral is subtle and reads as a drum with a step; impeller recognisable (back plate, hub, six curved vanes).
- Decision 1: three Clean_Engineering greys instead of one. A #7d8793, B #5f6974, C #444e59 on background #eceff1 (unchanged). Fill = grey at catalogue index mod 3. Pump order (checked in catalogue.ts): motor A, bearing housing B, shaft C, seal A, bolts B, casing C, impeller A, flange B. X_Ray_Skeleton unchanged; lights kept. Code: `CLEAN_FILLS` and `cleanFillIndex` in src/render/looks.ts; `LookMaterials.fills` holds three materials (X-ray repeats its one material); pump-model.ts passes the Part index and stores `userData.fillIndex` on each mesh so `setLook` picks the right fill.
- Contrast by hand (WCAG, background luminance 0.8592): A luminance 0.2380 gives 0.9092 / 0.2880 = 3.16; B 0.1379 gives 0.9092 / 0.1879 = 4.84; C 0.0740 gives 0.9092 / 0.1240 = 7.33. Test: test/looks.test.ts.
- Decision 2: volute radius r = 0.165 + 0.085 * (a / 2PI), was 0.17 + 0.06 * (a / 2PI). No tongue mesh. Fit against casing half-extents (y 0.25, z 0.23): y max 0.25 at a = 2PI (exactly the limit; fit test tolerance is 1e-6); y min 0.2075 at a = PI; z at a = PI/2 is 0.18625; z at a = 3PI/2 is 0.22875 (vertex 36 of 48), inside 0.23 by 0.00125. The 0.206 quoted for z is not what this formula gives; 0.22875 is. Vertex 37 gives about 0.2286, so no vertex is larger than step 36.
- Not tested: how the three greys and the new spiral look in a browser, until the User views them again. Nothing run (no terminal).
- Follow-up tests (test only, no source change). test/pump-model.test.ts: Clean_Engineering hex per Part in order 7d8793, 5f6974, 444e59, 7d8793, 5f6974, 444e59, 7d8793, 5f6974 (also checked against `CLEAN_FILLS[i % 3]`); same colours after `setLook('Clean_Engineering')` from X_Ray_Skeleton; X_Ray_Skeleton meshes have opacity 0.22 and transparent true, each mesh has one visible `LineSegments` child; Clean_Engineering edges are not visible. 3 new tests. test/pump-fit.test.ts: casing body (first mesh of the casing group, the volute) has no vertex closer than 0.164 to the x axis; `extrudeAlongX` bakes its rotateY and translate into the geometry and the mesh position is 0, so the raw vertices are in the casing frame (the test still applies `mesh.matrix`). Minimum is 0.165 at a = 0. Impeller largest radius at most 0.16 + 1e-6, measured through each mesh's world matrix into the impeller group frame (includes vane pivots). 2 new tests.
- Vane radius by hand: last centre point s = 1 is r 0.155 at angle -0.9 rad, y 0.09635, z -0.12142. Point s = 0.9 is y 0.09929, z -0.10430. Tangent (-0.002938, -0.017119), length 0.017369, normal (0.98563, -0.16915). Outer corner y 0.10226, z -0.12243, radius 0.1595. Inner corner radius 0.1506. Largest vane vertex 0.1595, under 0.16 by about 0.0005, so the test is written. The back plate (radius 0.16) sets the maximum.
- Expected counts, if the above is right: 20 files, 189 passed, 3 skipped (184 + 5 new). Not run (no terminal).
- Latest test run (pasted by the User): 20 files, 189 passed, 3 skipped, 0 failed (looks 6, pump-model 16, pump-fit 4).
- User answer on the revised Looks: the casing (the part that holds the impeller) looks too dark in Clean_Engineering (it is grey C, #444e59). Decision: superseded by a later Pump polish task, which will use light fills with thin dark outlines plus material-hint tints, to be specified after the Pump redraw. looks.ts is not changed now.
- Tighter casing spiral (r = 0.165 + 0.085 * a / 2PI): the User's visual judgement is "not answered".
- Task 17.6 marked complete with these notes.

## Task 17.7: Picking and shells

- Done: added `src/logic/pick-math.ts` (`clientToNdc`, canvas rectangle to NDC, writes into a caller-provided object), `src/logic/click-tracker.ts` (`createClickTracker`: keeps the largest distance from the press and calls `classifyPointer` on release), `src/render/picking.ts` (`collectPartMeshes`, `createPicker`: one `Raycaster`, one `Vector2` and one hit array created at setup; tests only the listed meshes, non-recursive, so the edge `LineSegments` children and the shells cannot be hit; calls `updateMatrixWorld` on the root before each ray) and `src/render/shells.ts` (`createShells`: two back-face shells per Part mesh, scale `SELECT_SHELL_SCALE` 1.05 and `FOCUS_SHELL_SCALE` 1.03 about the geometry's bounding-box centre, children of the mesh so they follow explode and spin, colour = Look accent, orange `#ff8a1f` in X-ray and blue `#1f6feb` in Clean_Engineering; the focus shell is hidden on the selected Part). Extended the temporary preview page (`stage-preview.html` and `.ts`) with click picking on the canvas, a temporary Parts button list (focus shows the focus shell, Enter or Space selects), a Clear selection button and `selected=` in the readout. New test file `test/picking.test.ts`. `looks.ts`, the catalogue, `state.ts`, `constants.ts` and `index.html` are unchanged.
- Follow-up (test only, no source change): the shell offset test compared `position.y` with `toBe(0)`, which fails on -0; it now checks `Math.abs(...) < 1e-12`. Added three tests to `test/picking.test.ts`: a new press after a drag starts a fresh gesture (drag, then press (0,0) and release (1,1) gives click); the visible selection shell and focus shell both take `1f6feb` in Clean_Engineering and `ff8a1f` in X_Ray_Skeleton after `setLook`; `pickClient` on a 0 x 0 canvas rectangle returns null without throwing (`picking.ts` already guards this).
- Task 17.7 revision (fixed rim width): reason: at scale 1.05 the rim on small Parts (bolts, seal) was about 1 mm and invisible. `SELECT_SHELL_SCALE` and `FOCUS_SHELL_SCALE` are replaced in `src/constants.ts` by `SELECT_SHELL_RIM_M` = 0.012, `FOCUS_SHELL_RIM_M` = 0.007 and `SHELL_MAX_SCALE` = 3. In `src/render/shells.ts` the new pure function `shellAxisScale(size, rim)` gives, per axis, `min(3, 1 + rim / (size / 2))` (3 for size 0); `makeShell` sets `scale.set(sx, sy, sz)` and `position = centre * (1 - scale)` per axis. Hand values: unit box select 1.024, focus 1.014; box centred at x = 2 has offset 2 * (1 - 1.024) = -0.048; size 0.02 gives 2.2; size 0.002 is capped at 3; size 0 gives 3; boxes of size 0.04 and 0.4 both have rim (scale - 1) * size / 2 = 0.012. Where a cap applies the rim is (3 - 1) * size / 2 = size, thinner than 0.012 (only for size under 0.012 m). Real Pump, selection scale: a bolt mesh (cylinder, radius 0.02, length 0.08, so about 0.08 x 0.04 x 0.04) gives 1.3 along x and 1.6 across; the seal (0.12 x 0.16 x 0.16) gives 1.2 and 1.15. The cap is not reached by any Pump Part. Design decision 18 and its constants table are updated; Requirements 14.7 and 14.9 name no scale, so they are unchanged. `looks.ts` and the colours are unchanged. Tests in `test/picking.test.ts`: 3 changed (selection scale, focus scale, offset), 4 added (`shellAxisScale` values, thin axis 2.2, cap 3, equal rim for sizes 0.04 and 0.4). Expected counts: 21 files, 215 passed, 3 skipped (211 + 4). Not run (no terminal).
- Decisions: a click on empty space leaves the selection unchanged (Requirement 14 does not say otherwise; the Clear button is a preview-only way to deselect). Picking runs on a click only; Three.js still allocates inside `intersectObjects`, so "no allocation" covers only the objects this code owns. Heat_Exchanger tube bundle (`InstancedMesh`) is not handled: shells would need instancing, so that belongs to the Heat_Exchanger task.
- Expected counts, if the above is right: 21 files, 208 passed, 3 skipped (189 + 19 new: NDC 3, click tracker 5, picking 5, shells 6). The first run observed 207 passed and 1 failed (the -0 test). After the follow-up (3 new tests): 21 files, 211 passed, 3 skipped. Not run (no terminal).
- Test tolerance note: BoxGeometry positions are Float32, so geometry-backed shell scales differ from hand values by about 1e-8; those tests use 1e-6.
- Broke: nothing known. Not run.
- Not tested: clicking in a browser, the look of the shells (rim width, orange or blue against the fills, X-ray translucency), picking while the view offset is non-zero, picking on a real Pump, per-click allocation inside Three.js, keyboard focus in the real Parts list (Task 17.8 is the User's check).
- Source line it should catch: in `src/logic/pointer.ts` change `<=` to `<`; the "5 px from the press is a click" test (and `pointer.test.ts`) must fail. In `src/render/picking.ts` remove `mesh.isMesh === true &&` from `collectPartMeshes`; the "collectPartMeshes returns the three Part meshes" test must fail (it would also list the edge lines).
- PathKit feature used: none (picking and shells are Three.js and app code).

## Task 17.8: click and focus checkpoint

- Result: PASS. The User opened src/render/stage-preview.html in a browser and answered Yes to all six checks:
  1. Clicking a Part shows `selected=<name>` and an accent rim (orange in X_Ray_Skeleton, blue in Clean_Engineering), visible on both backgrounds, including the bolts and the seal.
  2. A press and release that moves more than 5 px selects nothing; within 5 px it selects.
  3. At Explode 0, 50 and 100% and with a non-zero offset, the clicked Part is the one the User sees.
  4. Keyboard: Tab to a Part button gives that Part the thin focus rim, and the rim moves with Tab. Enter selects (thick rim, readout updates). With a selection, the next focused Part has the thin rim while the selected Part keeps the thick rim. Space also selects.
  5. Switching the Look with a Part selected changes the rim colour.
  6. The rim turns with the impeller and stays on the Part when orbiting.
- Lesson: the first wording of check 4 was unclear to the User. Kiro rewrote it as numbered steps before the User answered. Give checkpoint steps as concrete actions with the exact control names.
- Checks were manual answers from the User, not automated tests. Latest test run (pasted by the User): 21 files, 215 passed, 3 skipped.
- Clicking empty space keeps the current selection. The User did not ask for a change, so the behaviour stays as decided in Task 17.7.
- Docs-only change. No code, tests or spec files edited. Nothing run.

## Task 18.1: Research and write the Heat_Exchanger and Desk_Lamp facts

- Done: fetched and read 10 pages (engineerfix x2, enggcyclopedia, goelscientific, mckissock, Wikipedia Balanced-arm lamp, Lampshade and Lightbulb socket, anglepoise.com journal, grandbrass.com). Wrote 12 rows in docs/sources.md (hx-channel-head, hx-tube-sheet, hx-shell, hx-tube-bundle, hx-baffles, hx-nozzles, lamp-base, lamp-lower-arm, lamp-joint, lamp-upper-arm, lamp-shade, lamp-bulb-holder), all with Date checked = TO CONFIRM. Added `HEAT_EXCHANGER_PARTS`, `HEAT_EXCHANGER_MACHINE`, `DESK_LAMP_PARTS`, `DESK_LAMP_MACHINE` to src/data/catalogue.ts and put all three Machines in `CATALOGUE` (20 Parts). Pump entries and the FIXTURE_* exports are unchanged.
- Dropped: the Anglepoise manual PDF (could not be fetched), the kezareng.com page (only a truncated preview came back, so not used) and every other page seen only as a search snippet (TEMA PDF, Design Museum, Wikipedia Anglepoise, a substack essay), the enggcyclopedia "Channel" paragraph (puts the channel inside the shell, conflicts with the other pages), any spring or lamp base material (a cast iron base appeared only in a search snippet of a page not fetched), the "centre joint" wording (snippet only). Base, nozzle, tube sheet and baffle materials read "not stated".
- Weak spots: several sources are vendor or blog pages (engineerfix, goelscientific, grandbrass, enggcyclopedia), not standards. Bulb holder position ("inside the shade") joins two read claims and is flagged in sources.md. "Lower" and "upper" arm are this app's names, flagged in the text. Channel head facts lean on "bonnet" and "head cover" wording.
- Layout (metres; gap = largest over x, y, z of |end centre A - end centre B| - (extent A + extent B) / 2; need at least 0.08):
  - Heat_Exchanger end centres: channel head (-1.02, 0, 0) ext (0.3, 0.42, 0.42); tube sheet (-0.75, 0.07, 0) ext (0.05, 0.42, 0.42); shell (0.15, -0.15, 0.19) ext (1.4, 0.4, 0.4); tube bundle (0.15, 0, -0.25) ext (1.3, 0.2, 0.2); baffles (0.05, 0.4, 0) ext (0.9, 0.32, 0.32); nozzles (0.05, 0.27, -0.32) ext (0.8, 0.14, 0.12). Explode lengths: 0.17, 0.1026, 0.2618, 0.2693, 0.4, 0.32 (all at least 0.1).
  - 15 pairs: head-sheet x 0.27 - 0.175 = 0.095; head-shell x 1.17 - 0.85 = 0.32; head-bundle x 1.17 - 0.8 = 0.37; head-baffles x 1.07 - 0.6 = 0.47; head-nozzles x 1.07 - 0.55 = 0.52; sheet-shell x 0.9 - 0.725 = 0.175; sheet-bundle x 0.9 - 0.675 = 0.225; sheet-baffles x 0.8 - 0.475 = 0.325; sheet-nozzles x 0.8 - 0.425 = 0.375; shell-bundle z 0.44 - 0.3 = 0.14; shell-baffles y 0.55 - 0.36 = 0.19; shell-nozzles z 0.51 - 0.26 = 0.25; bundle-baffles y 0.4 - 0.26 = 0.14; bundle-nozzles y 0.27 - 0.17 = 0.10; baffles-nozzles z 0.32 - 0.22 = 0.10. Smallest 0.095.
  - Envelope: largest end box edges x -1.17 (head), y 0.56 (baffles), z -0.38 (nozzles) and 0.39 (shell). All inside x 1.2, y 0.6, z 0.4. Rest boxes are inside (head x -1.0 to -0.7, shell x -0.65 to 0.75).
  - Desk_Lamp end centres: base (-0.8, -0.5, 0) ext (0.5, 0.1, 0.5); lower arm (-0.4, 0, 0) ext (0.3, 0.6, 0.1); joint (-0.3, 0.2, 0.25) ext (0.12, 0.12, 0.16); upper arm (0.25, 0.22, 0) ext (0.8, 0.3, 0.1); shade (0.95, 0, 0) ext (0.3, 0.25, 0.3); bulb holder (0.95, 0.3, 0) ext (0.1, 0.14, 0.1). Explode lengths: 0.3, 0.15, 0.25, 0.15, 0.3808, 0.3640 (all at least 0.1).
  - 15 pairs: base-lower y 0.5 - 0.35 = 0.15; base-joint x 0.5 - 0.31 = 0.19; base-upper x 1.05 - 0.65 = 0.40; base-shade x 1.75 - 0.4 = 1.35; base-holder x 1.75 - 0.3 = 1.45; lower-joint z 0.25 - 0.13 = 0.12; lower-upper x 0.65 - 0.55 = 0.10; lower-shade x 1.35 - 0.3 = 1.05; lower-holder x 1.35 - 0.2 = 1.15; joint-upper z 0.25 - 0.13 = 0.12 (x gives 0.09); joint-shade x 1.25 - 0.21 = 1.04; joint-holder x 1.25 - 0.11 = 1.14; upper-shade x 0.70 - 0.55 = 0.15; upper-holder x 0.70 - 0.45 = 0.25; shade-holder y 0.3 - 0.195 = 0.105. Smallest 0.10.
  - Envelope: base x -1.05 to -0.55, shade x up to 1.10, joint z up to 0.33, base y down to -0.55. All inside. Every centre path stays well inside because the largest |x| is 1.02, |y| 0.5, |z| 0.32, and the bow is 0.15 * |v| at most (0.06).
- Tests that the new Machines affect (not edited, not run): see the Task 18.1 report. In short, test/part-scenes.test.ts now bakes 20 Parts; test/catalogue.test.ts runs the heat-exchanger and desk-lamp name checks and the 20-Part total, which were skipped before. Expected total: 21 files, 218 passed, 0 skipped.
- Broke: nothing known. Not run (no terminal). Kiro twice tried a terminal command by mistake and the hook blocked both; nothing was run.
- Not tested: the look, WebGL, view offset, clicking, load time. No shapes exist yet for the two new Machines (Task 18.3), so the fit of shapes inside extents is untested. The paths bow sideways and could cross other Parts between frame 0 and frame 59; the check covers only the end position.
- PathKit feature used: none in this task (the catalogue feeds `followPath` Part scenes through the existing `bakeParts`).

## Task 18.1 revision: text-only corrections

- Scope: text in src/data/catalogue.ts, docs/sources.md and this file only. No layout numbers (restPosition, explodeVector, extents), no other Part, no test and no source logic changed.
- lamp-shade: the Grand Brass sentence was re-checked by fetching https://grandbrass.com/shades/metal-lamp-shades-and-bulb-cages/cone-shape-metal-lamp-shades/ . The page says cone shape metal shades "feature a tapered design that helps direct light downward while reducing glare" and that this shape is "a popular choice for task lighting"; it also says the shades are made from "steel, brass, or aluminum". So the sentence and the material claim are kept. Why one wording changed: "which suits task lighting" overstated "popular choice", so the text now says "and is a popular choice for task lighting". The grandbrass.com source stays in the row.
- hx-nozzles: "short pipe section" changed to "small pipe section" (catalogue.ts and sources.md), because enggcyclopedia says "small".
- hx-channel-head: enggcyclopedia gives inspection and cleaning access to the bonnet, not to the channel. The job now reads: channel head directs the tube-side fluid into and out of the tube bundle; a head cover caps the end of the tube sheet to contain that fluid; a bonnet, a similar end cover, gives access to the tubes for inspection and cleaning. The wording that gave inspection access to the channel head itself is removed. The "caps the end of the tube sheet" claim is kept, but its source (mckissock) says "head cover", not "channel head" by name; the reviewer should judge whether that counts for this part.
- Date checked: set to 2026-11-27 for all 12 hx-* and lamp-* rows in sources.md (was TO CONFIRM); the 8 Pump rows stay 2026-11-26. The intro paragraph above the table was updated to match. catalogue.ts has no date field.
- Broke: nothing known. Not run (no terminal). Expected counts unchanged: 21 files, 218 passed, 0 skipped. The User runs npm.cmd test from apps/skeleton-bench.

## Task 18.3, Step B: Heat_Exchanger (U-tube, TEMA BEU)
- Done: replaced HEAT_EXCHANGER_PARTS and HEAT_EXCHANGER_MACHINE in src/data/catalogue.ts with the data from docs/design-pack-18-3.md section 2, copied character for character. Changed the heat-exchanger line of EXPECTED_PART_NAMES in src/data/catalogue-checks.ts. Replaced the Task 18.1 paragraph and the six hx-* rows in docs/sources.md with the pack text, and added the HEI, Mukherjee, NPTEL, EnggCyclopedia and Wermac source lines under the table. The lamp rows and the Desk_Lamp catalogue block are untouched until Step C.
- Spec edits (pack section 6): requirements.md Requirement 18 criterion 2; design.md picking line (the tube bundle is one merged Mesh); tasks.md Task 18.3 text and Task 18.4 text (21 Parts in total); brief.md Heat exchanger part list. No task checkbox or status was changed. Not done yet, because they belong to Step C: Requirement 18 criterion 3, the Desk_Lamp lines, the "20 scenes" and "Desk_Lamp 6" mentions in design.md and tasks.md, the THIRD_PARTY.md "Facts and sources" heading.
- Added src/render/heat-exchanger-model.ts (built with buildMachineModel; exports U_TUBES, LEGS, tubeSheetShape and baffleShape so the tests can count holes) and test/heat-exchanger-model.test.ts (8 tests: Part ids and order, fit, mesh counts 5, 1, 1, 1, 9, 4, layout numbers, hole counts, partId and fillIndex, no builder throws, bundle is one Mesh). No existing test was edited.
- The Catalogue stays at 20 Parts until Step C (6 + 6 + 8).
- Known limits: the bulb holder is mostly hidden inside the shade in Clean_Engineering (it shows when exploded, in X_Ray_Skeleton, or from below); the spring is thin and small at the default zoom; the pass partition, impingement plate, spacers, bulb and wiring are not drawn; the inside of the bonnet and shell are solid.
- Not run (no terminal). Not tested: the look in a browser; the Lathe face direction of the bonnet and shell has not been checked by eye.

## Task 18.3, Step C: Desk_Lamp (spring-balanced arm lamp)
- Done: replaced DESK_LAMP_PARTS and DESK_LAMP_MACHINE in src/data/catalogue.ts with the data from docs/design-pack-18-3.md section 2, copied character for character (seven Parts: base, upper arm, spring, elbow joint, forearm, shade, bulb holder). Changed the desk-lamp line of EXPECTED_PART_NAMES in src/data/catalogue-checks.ts. In docs/sources.md the six old lamp rows were replaced by the seven pack rows (lamp-base, lamp-upper-arm, lamp-spring, lamp-elbow, lamp-forearm, lamp-shade, lamp-bulb-holder) and the French and Widden source line was added under the table. The Catalogue now has 21 Parts (8 + 6 + 7).
- Spec edits (pack section 6): requirements.md Requirement 18 criterion 3; brief.md Desk lamp part list; design.md "20 part paths" now 21, the scene count (21 scenes, Desk_Lamp 7), "Loop over 21 Parts", and the bake estimate (28 scenes); tasks.md task 13.2 text (Desk_Lamp 7). No task checkbox or status was changed. The pack did not name these, but they follow from the Desk_Lamp count, so Kiro also recomputed in design.md: 21 x 5,280 B = 110,880 B for the Part scenes, the Desk_Lamp tour length 7 x 90 = 630 frames, and the tour memory total 63,360 + 47,520 + 55,440 = 166,320 B. The User should check these.
- THIRD_PARTY.md: added the heading "Facts and sources" with the six web pages and the note that the shapes are drawn in code.
- Added src/render/desk-lamp-model.ts (built with buildMachineModel; the arm bars, spring helix, shade cone, barrel and holder come from pack section 4) and test/desk-lamp-model.test.ts (5 tests: Part ids and order, fit inside extents with tolerance 1e-6, mesh counts 2, 2, 3, 3, 2, 3, 3 (18 in total), partId and fillIndex and group names, no builder throws).
- Edited existing tests: test/catalogue.test.ts only. The desk-lamp expected count 6 became 7, and the full-catalogue test and its text went from 20 Parts (8 + 6 + 6) to 21 Parts (8 + 6 + 7). The tour test still uses fixtures of 8 and 6 Parts and is unchanged.
- Known limits: the bulb holder is mostly hidden inside the shade in Clean_Engineering (it shows when exploded, in X_Ray_Skeleton, or from below); the spring is thin and small at the default zoom; the pass partition, impingement plate, spacers, bulb and wiring are not drawn; the inside of the bonnet and shell are solid.
- Not run (no terminal). Not tested: the look in a browser; the Part scenes and the Explode-length and Clearance checks were checked by the pack's prototype, not by Kiro here.

## Task 18.3 follow-up: Heat_Exchanger hardening

- Done: followed docs/hx-hardening-pack.md. In src/render/heat-exchanger-model.ts added `LEG_START_X = -0.65` under `BEND_X`, and the tube legs now use length `BEND_X - LEG_START_X` and centre `(BEND_X + LEG_START_X) / 2` (same values as before: 1.18 and -0.06, so the model does not change). Added three tests to test/heat-exchanger-model.test.ts: baffle window cut at y = 0.08, tube bundle x range -0.65 to 0.642, and 4,777 vertices (17 x 281) in the merged bundle. No existing test or import changed.
- Broke: nothing known. Not run (no terminal). Expected: Skeleton Bench 234 tests (231 + 3).
- Not tested: the look, WebGL.

## Stage preview: machine chosen by the URL
- Done: `src/render/stage-preview.ts` reads `?machine=pump`, `?machine=heat-exchanger` or `?machine=desk-lamp`; no parameter or an unknown value gives the Pump. It picks the builder (`buildPumpModel`, `buildHeatExchangerModel`, `buildDeskLampModel`) and the Part list (`PUMP_PARTS`, `HEAT_EXCHANGER_PARTS`, `DESK_LAMP_PARTS`), and uses that list for the part buttons and the readout name. `spinImpeller` and the spin loop run only for the Pump. `stage-preview.html` has three plain links at the top. No other file changed; no task status changed.
- Broke: nothing known. Not run (no terminal, no browser).
- Kiro assumption to check: `PumpModel` is assigned to a `MachineModel` variable, which needs `PumpModel` to have the same `root`, `partsById` and `setLook` members; editor diagnostics were not visible.
- Not tested: everything; the User opens each of the three links to check.

## Task 18.4: Three Machines checkpoint result

- Tests (pasted by the User, `npm.cmd test` from apps/skeleton-bench): 234 passed, 0 failed, 0 skipped, 23 files.
- Visual check: the User opened the stage preview page (src/render/stage-preview.html) with `?machine=pump`, `?machine=heat-exchanger` and `?machine=desk-lamp`, and reported that all three Machines work as expected.
- Scope of the visual check: done by the User, by eye, on the stage preview page only. The full app UI does not exist yet, so nothing in it was checked. These were manual answers, not automated tests.
- Docs-only change. No code, tests, spec files or task checkboxes edited. Nothing run by Kiro.

## Task 19.1: Bake and wire the Tours

- Done: added `src/pathkit/bake-all.ts` (`bakeTour(machine)`, `bakeAll()`, `bakeFailureMessage`). `bakeAll` bakes the four laps, 21 Part scenes and one Tour per Machine at load, runs `motionLinter` on each Tour, turns the findings into plain lines with `findingsToPlainText` ("No findings reported." when empty), and returns `{ ok: false, message }` instead of throwing, so the UI can show what failed and what to do. Tour order is the Machine's `partIds` (keyboard order). Added `src/logic/tour-playback.ts`: `TOUR_LOCKED_LABEL` ("Stop the tour to use this"), `tourFrameAtElapsed` (whole frames at 30 fps), `tourHasEnded`, reduced-motion helpers (`reducedMotionPartIndex` with the 3000 ms hold, `reducedMotionFrame` = slot middle, `reducedMotionHasEnded`), `readTourPose` (writes into a caller buffer) and `tourControlsLocked`.
- Start, Pause, Resume and Stop state changes already exist in src/state.ts (`startTour`, `pauseTour`, `resumeTour`, `stopTour`) and were not changed. The Control_Bar, the Motion_Check panel and the render loop do not exist yet (task 20), so the buttons, the visible label and the error display are not placed on screen in this task. This task only supplies the baked data, text and pure helpers they will call.
- Broke: nothing known. Not run (no terminal). No new test file; tests are task 19.2. Expected `npm.cmd test` count is unchanged: 234 passed, 23 files.
- Spec issue found: task 19.2 says frame counts 720, 540 and 540, but the Desk_Lamp has 7 Parts, so design.md and `TOUR_FRAMES_PER_PART` give 630. Needs the User's decision before 19.2.
- PathKit features used: `bake`, `validateScene` (inside `bake`), `motionLinter`, `evaluateEntity`, `followPath`, `aimAt` (through the existing tour scene).
- Not tested: everything new; also the look, WebGL, view offset, clicking, load time, bake time of the three Tours.

### Task 19.2: Tour tests with the real catalogue

- Done: wrote test/tour-catalogue.test.ts (7 tests) using `bakeAll()` and the real CATALOGUE. Frame counts 720, 540, 630 (typed in); `motionLinter` does not throw and returns a list for each Tour; camera at least `CAMERA_MIN_CLEARANCE_M` outside the Exploded_Box on every frame of every Tour; keyboard order per Machine checked against typed-in Part ids; slot keyframe i is at frame i * 90 + 45 and holds the rest position of Part i; `bakeTour` throws for an unknown Machine. No source changes.
- Broke: nothing known. Not run (no terminal). Expected: 7 new tests, total 241 in 24 files.
- Kiro assumption to check: the expected Part id order was read from catalogue.ts (Pump 8, Heat exchanger 6, Desk lamp 7 Parts). The rest positions compared against are read from the catalogue by id, not typed in.
- Source line it should catch: in `bakeTour` (src/pathkit/bake-all.ts) swap two entries of the `rest` array before `buildTourScene(rest)`. The keyframe order test fails.
- PathKit features used: `bake`, `evaluateEntity`, `motionLinter` (through bakeAll).
- Not tested: the look, WebGL, view offset, clicking, load time, Tour start/stop state reset and restore (Property 19 is not in this task's list).

## Task 20.1: Pure UI helpers

- Done: added `src/ui/input.ts` and `test/ui-input.test.ts` (16 tests). `keyToAction(input, focus)` maps M, E, R, `+` (also `=`), `-`, the four arrows and Escape to action names, returns null when `shouldHandleShortcut` says no (text field, textarea, select, range slider; reused from `src/logic/shortcut-guard.ts`) and when Ctrl, Meta or Alt is held. Step functions: `orbitAngleFromDrag` (start - dx * 0.5), `orbitKeyStep` (5 frames = 5 degrees), `stepZoom`, `zoomKeyStep` (0.1), `zoomWheelStep` (0.05, sign of deltaY), `moveKeyStep` (0.02 of the viewport, clamped with the existing `clampOffset`). Constants and `clampOffset` are reused; nothing new in constants.ts or state.ts.
- Kiro choices to check (the spec is silent): (1) Arrow-left adds 5 degrees and arrow-right subtracts 5, so a key matches a drag in the same direction (drag right lowers the angle). (2) Wheel up (negative deltaY) zooms in. (3) Escape maps to `clear-selection` (design error table). (4) `=` counts as `+`. (5) Ctrl, Meta and Alt combinations are ignored so Ctrl+R still reloads. (6) Move arrows: right and down are positive, matching `setOffset`. (7) The E toggle rule for an in-between Explode_Amount is not decided here; it belongs to the Control_Bar wiring task.
- Broke: nothing known. Not run (no terminal). Expected: 25 files, 257 passed (241 + 16).
- Source line it should catch: in `orbitAngleFromDrag` change `startAngleDeg - dxPx * ORBIT_DEG_PER_PIXEL` to `+`; the drag table test must fail.
- PathKit feature used: none (app code).
- Not tested: the look, WebGL, view offset, clicking, load time, real keyboard and wheel events, the wiring of these helpers to the page (tasks 20.2 and later).

### Task 20.2: Layout and Inspector with Parts_List

- Done: added `src/main.ts` (app entry: `bakeAll`, `createStage`, Pump at start, Machine switching from the cards, selection shell and focus shell), `src/ui/layout.ts` (DOM: Inventory with three cards, Stage host, Inspector with Parts_List, Motion_Check list, Control_Bar region), `src/ui/inspector-text.ts` (pure: empty text "Pick a part to read about it", "sample data" label, `machineParts` in catalogue order, `findMachinePart`, `modelSizeText`) and `src/ui/thumbnails.ts` (SVG shape data for three drawings, DOM builder). `index.html` now holds the page styles and loads `./src/main.ts` (CSS is inline so no non-`.js` relative import is needed). Test file: `test/ui-layout.test.ts` (8 tests).
- Decision to check: `PartEntry` has no specification fields, so the only "sample data" value shown is the drawn model size taken from `extents` (for example "500 x 400 x 400 mm"). It is the project's own number and needs no source. Say if you want other sample values.
- Not built yet (Task 20.4): every control, key hints, click-to-select on the Stage, impeller spin, Look toggle. The Control_Bar shows a one-line note. Parts_List buttons already select (click, Enter, Space) and focus shows the focus shell.
- Broke: nothing known. Nothing has been run (no terminal).
- Not tested: the look, WebGL, view offset, clicking, load time, the DOM builders in `layout.ts` and `main.ts`, the CSS grid, small-screen layout.
- PathKit feature used: none new (the Stage reads the baked laps and Part scenes made earlier; the Motion_Check text comes from `motionLinter` findings through `bakeAll`).

### Task 20.2a: Accordion Parts_List

- Done: spec edits (Requirement 14.3 reworded, 14.10 to 14.12 added; task 20.2a added; checks added to 20.3). Added `togglePartSelection(current, clicked)` to `src/ui/inspector-text.ts` and 4 tests to `test/ui-layout.test.ts`. `src/ui/layout.ts`: the separate inspector-body is gone; each Part is an `<h4>` holding the button (`aria-expanded`, `aria-controls`) followed by a `role="region"` panel (`aria-labelledby`, `hidden` when closed) with Job, Material, Typical position and the sample spec. `aria-live` removed. `setSelected` opens only the selected panel, shows the empty line only when nothing is selected, and calls `inspector.scrollTo({ top: button.offsetTop, behavior })` (`'auto'` under reduced motion, else `'smooth'`; not `scrollIntoView`). `src/main.ts`: `onPartActivate` toggles through `togglePartSelection`. `index.html`: `#inspector` is `position: relative`; CSS arrow (rotated border corner), bold text and orange border on the open button; open panel has a 3px accent left border and a lighter background (#1f2a37).
- Approximate: the open panel has `min-height: calc(100vh - 160px)` so the last Part can reach the top. The 160px is an estimate of the heading, Parts heading and Control_Bar space, not measured. The User checks it in 20.3 (open the last Part).
- Contrast (by hand, not measured in a browser): #e6edf3 and #b4c0cc on #1f2a37 are both well above 4.5 to 1.
- Not run: `npm.cmd test` (expected 26 files, 271 tests) and `npx tsc --noEmit -p .` (forbidden by project rules). Not tested: the DOM in `layout.ts`, scrolling, the arrow, the look, WebGL, clicking.
- Note: click-to-select on the Stage is not wired yet (Task 20.4). Only the Parts_List button toggles; `setSelected` scrolls whichever way a Part becomes selected.

### Task 20.2b: Stage click selects or clears

- Done: spec edits (Requirement 14.13 added; design error-table row "Part click hits no Part" now clears the selection; task 20.2b added; checks added to 20.3). Added `selectionAfterStageClick(current, pickedId)` to `src/ui/inspector-text.ts` (returns `pickedId`: empty space clears, the selected Part stays selected) and 5 tests to `test/ui-layout.test.ts`. `src/main.ts`: a picker from `collectPartMeshes(model.root)` is made in `showMachine`, before `createShells`, so it is replaced whenever the Machine changes. One click tracker and the four pointer listeners (`pointerdown`, `pointermove`, `pointercancel`, `pointerup`) are added once on `stage.canvas`, left button only. On a click, `selectPart(state, selectionAfterStageClick(...))` then `applySelection()`. A drag does nothing here (orbit is Task 20.4). `stage-preview.ts` is not changed.
- Not run: `npm.cmd test` (expected 276 tests) and `npx tsc --noEmit -p .` (forbidden by project rules). Not tested: the DOM and pointer wiring in `main.ts`, picking in a browser, WebGL, the look.
- Note: the Escape key clearing the selection (Requirement 14.13) is not wired; it belongs with the key handling in Task 20.4.

### Task 20.4: Controls

- Done: `src/logic/explode-animation.ts` (pure: `explodeAnimationAmount` straight line over 600 ms, `explodeToggleTarget` 0 when the target is 50 or more, else 100) with `test/explode-animation.test.ts` (6 tests). `src/ui/layout.ts`: Control_Bar now holds the Mode button, orbit scrub (0 to 359), zoom slider, explode slider, `Reset position` and a disabled `Gestures (not available yet)` button; each has a visible label with its key hint; `setControls` and `setHint` added. `src/main.ts`: one `keydown` handler (M, E, R, + and =, -, arrows per mode, Escape clears the selection, all through `keyToAction` and the focus guard); drag on the Stage rotates or moves after leaving the 5 px click radius; wheel zooms; E animates 600 ms or jumps under `prefers-reduced-motion`; first-use hint per mode stored with `hasSeenHint` / `markHintSeen`. `index.html`: control styles. Escape-to-clear (Requirement 14.13) is now wired.
- Decisions to check: E from a slider value of 50 or more goes to 0 (below 50 goes to 100). Up and down arrows do nothing in Rotate mode. The controls do nothing if baking or WebGL failed. State objects are created per drag or animation step (the evaluation path itself, `placeAtAmount`, still allocates nothing).
- Not built (later tasks): Tour, Pause, Stop and the "Stop the tour to use this" label, Look toggle, About, impeller spin.
- Broke: nothing known. Nothing has been run (no terminal).
- Not run: `npm.cmd test` (expected 27 files, 282 tests) and `npx tsc --noEmit -p .` (forbidden by project rules). Not tested: the DOM and pointer, key and wheel wiring, the animation, reduced motion, the look, WebGL, view offset, clicking.
- PathKit feature used: none new (Part placement still reads baked Part scenes; the camera still reads the baked laps).

## Task 20.6: Tour, Look toggle and About wiring

- Done: Tour, Pause/Resume and Stop buttons wired to `startTour`/`pauseTour`/`resumeTour`/`stopTour`. A frame loop in `src/main.ts` adds time only while playing, reads the baked Tour with `readTourPose` and draws it through the new `stage.setTourPose` (the stage uses the pose instead of the orbit blend; no allocation per frame). The Tour ends or stops with a cut back to the saved view. Reduced motion jumps one Part per hold. Switching Machine stops the Tour. A Look button stores the Look with `saveLook` (silent on failure), recolours the model, shells and background. An About button opens an About_Panel (`src/ui/about-text.ts`, four true limits only; Task 22.1 writes the full list). Error line (`layout.setMessage`) says what failed and what to do. Files: main.ts, ui/layout.ts, ui/about-text.ts, render/stage.ts, index.html (styles).
- Decisions where the spec was silent: controls are locked while the Tour is playing and also while paused (the state accepts changes when paused, but the Stage still shows the Tour camera); the mode toggle and key M stay active; a click still selects during the Tour; the reduced-motion setting is read when the Tour starts.
- Broke: nothing known. Not run (no terminal). No new tests: the wiring is DOM and WebGL code.
- Kiro got wrong: nothing known yet.
- PathKit features used: `followPath` and `aimAt` Tour baked earlier, read with `evaluateEntity`; `motionLinter` result shown by existing Motion_Check.
- Not tested: the look, WebGL, view offset, clicking, load time, the Tour animation in a browser, focus movement between the Tour buttons, the About_Panel layout. `npx tsc --noEmit -p .` was NOT run.

## About_Panel: Escape closes it, and the PathKit-use line moves to the README

- Done: spec change (Requirement 24.3 now README only; new 24.11 for Escape; tasks 20.6 and 22.1 updated). Added `escapeAction(aboutOpen)` to src/ui/input.ts. Removed the "impeller spin, dragging and cursor" line from src/ui/about-text.ts. Added `isAboutOpen()` and `closeAbout()` to the Layout in src/ui/layout.ts (`setAboutOpen(false)` already focuses the About button). In src/main.ts, the Escape case closes the panel instead of clearing the selection when the panel is open. Added 3 tests to test/ui-layout.test.ts.
- Broke: nothing known. Not run (no terminal). `npx tsc --noEmit -p .` was NOT run. Expected after `npm.cmd test`: 27 files, 285 passed.
- Not tested: the real keypress in a browser (focus return and the selection staying). The README text is written in task 22.1.
- PathKit feature used: none.
