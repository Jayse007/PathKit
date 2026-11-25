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
