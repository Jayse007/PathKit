# Implementation Plan: Skeleton Bench

## Execution Rules

Read this section first. Then read only the current task.

- Do one task at a time, in list order. Say which task is starting. Report the result in one or two sentences.
- Kiro runs no terminal command (a hook blocks them). At each checkpoint, give the User one exact one-line command and the folder, then wait.
  - Allowed commands, run from `apps/skeleton-bench`, and only after the User has added the matching lines to `.kiro/steering/windows-terminal.md` (Task 1): `npm.cmd install` (once, run by the User), `npm.cmd test` and `npm.cmd run build`.
  - Never ask for npx, tsc, watch mode or anything that does not exit.
  - Never ask for a dev server. Viewing the app in a browser is the User's own choice. Kiro does not request or run a server.
- Imports: every relative import ends in `.js`, in `src` and in `test`. Never write `.ts` in an import path. Never change `module` or `moduleResolution`.
  - PathKit is imported only through the app's one re-export file, which imports `packages/pathkit/src/index.ts`. Everything else imports PathKit from that file.
  - After editing a `.ts` file, check the editor diagnostics for it (say so if they are not visible).
  - Before marking a task done, open every `.ts` file touched, check that each relative import ends in `.js`, and list the files checked.
- Tests use Vitest with hand-written expected values, never values computed by the code under test.
  - No browser, no network, no webcam, no random generators, no fast-check.
  - Exhaustive loops use plain comparisons that throw an Error naming the check, the index and the value. Call `expect` only for once-per-run checks.
  - Force the special cases. Keep each test file under 5 seconds.
  - Use `toThrow` with a SceneError instance for a SceneError. Never weaken a test to make it pass. Never freeze typed arrays; compare copies.
  - Each test task ends with "Source line it should catch": one concrete change to the source that must make a named test fail, so the User can break it once and confirm.
- If an exhaustive or table check fails, say whether the code or the check is wrong. Make at most 3 fix attempts, then stop and report the failing inputs.
- Do not say a task is done until the User has run the command and pasted passing output. Report the passed, failed and skipped counts from the pasted output only. If output is missing or cut off, ask again. If a task is blocked, stop and ask.
- After every task, add one short entry to `apps/skeleton-bench/docs/build-notes.md`: what was done, what broke, what Kiro got wrong, which PathKit feature was used.
- Do not edit anything under `packages/pathkit`, any other `package.json`, `scripts/guard-*`, `.kiro/hooks/guard-*`, `scripts/check-constraints*` or `scripts/setup*`. Name no file or hook with the prefix `guard-`.
  - New files go only inside `apps/skeleton-bench/` (plus this spec). The only existing file that may change is `apps/skeleton-bench/README.md`.
- Facts about Parts come from reputable sources found by search and recorded in `docs/sources.md` (part, claim, source, date checked). Write nothing from memory. The User checks the text before it ships.
- Fonts: use the system font stack and no web fonts, so no font licence is needed.
- Constants live in one file and tests import them. A consistency test checks the derived constants.
- At the end of each task, state what was NOT tested (look, WebGL, view offset, clicking, load time).
- Tier B tasks are optional (`*`) and blocked until the User says "go".
- A task marked "User checkpoint" needs the User's action or approval. Kiro does not do it.

## Overview

The plan follows the approved design (option A: four baked laps blended with `lerp` and `slerp`). Pure logic and PathKit scene builders come first and are tested. Rendering and the interface come after. Tier B (gestures) is last and blocked. Deploy is out of scope (decision 6).

## Tasks

### Phase A: Setup

- [x] 1. Terminal commands for the app
  - [x] 1.1 User checkpoint: add the command lines to the steering file
    - Done: the User added the line to `.kiro/steering/windows-terminal.md`.
    - The User adds to `.kiro/steering/windows-terminal.md` the three allowed commands for `apps/skeleton-bench`: `npm.cmd install`, `npm.cmd test` and `npm.cmd run build`, each on one line, each run from `apps/skeleton-bench`.
    - Kiro does not edit that file. Kiro asks for no command in the app folder until the User confirms.
    - _Requirements: 2.1, 2.2 (decision 1)_

- [x] 2. Scaffold the app
  - [x] 2.1 Create the app files
    - `package.json`: type module; exact versions with no `^` or `~`: runtime `three` 0.187.0; dev `@types/three` 0.187.0, `vite` 7.3.8, `vitest` 3.2.7, `typescript` 5.9.3; scripts `test` = `vitest run`, `build` = `vite build`, `dev` = `vite`, `preview` = `vite preview`.
    - Kiro never runs `dev` or `preview` and never asks the User for them. The User may start them in their own terminal to view the app.
    - `tsconfig.json`: strict, NodeNext, ES2023, noEmit, DOM lib, skipLibCheck, at least as strict as the PathKit tsconfig.
    - `vite.config.ts`: `base` `/PathKit/skeleton-bench/`; `server.fs.allow` includes the repository root.
    - `vitest.config.ts`: include `test/**/*.test.ts`, node environment.
    - `.gitignore` (node_modules, dist), a minimal `index.html`, `src/pathkit-api.ts` (the single re-export from `../../../packages/pathkit/src/index.js`).
    - `src/constants.ts` with every Tier A constant of the design's Constants section, with values exactly as in the design.
    - `THIRD_PARTY.md` (three MIT, @types/three MIT, Vite MIT, Vitest MIT, TypeScript Apache-2.0, pinned versions), and stubs for `docs/build-notes.md` and `docs/sources.md`.
    - Risk to confirm at the first build: Vite resolves the import from outside the app root, and the tsconfig type-checks PathKit source without new errors.
    - _Requirements: 1.1, 1.2, 1.7, 1.8, 2.3, 2.4, 2.6, 2.7, 2.10, 2.11, 3.1, 36.2, 36.3_
  - [x] 2.2 User checkpoint: install
    - Kiro gives the one line `npm.cmd install` (run from `apps/skeleton-bench`) and waits. The User runs it and pastes the output. Kiro keeps `package-lock.json`.
    - _Requirements: 2.3, 2.6_

- [x] 3. Constants consistency test
  - [x] 3.1 Write `test/constants.test.ts`
    - R = sqrt(1.2^2 + 0.6^2 + 0.4^2) = 1.4. `ORBIT_SPEED_DEG_PER_S` = 360 * 30 / 360 = 30.
    - For each lap, r = d * 12/13 and h = d * 5/13 (6.0 / 2.5, 4.8 / 2.0, 3.6 / 1.5, 2.4 / 1.0) and r^2 + h^2 = d^2.
    - `LAP_DISTANCES` strictly decreasing, and every d - R >= `CAMERA_MIN_CLEARANCE_M`. Sin^2 + cos^2 of the elevation = 1.
    - The User runs `npm.cmd test` (expected: this file passes; report the counts).
    - Source line it should catch: change one `LAP_DISTANCES` entry or `EXPLODED_BOX_HALF_Y`.
    - _Requirements: 35.1, 35.9, 35.10_

### Phase 0: Spike (stop and ask the User if any check fails; record results in docs/build-notes.md)

- [x] 4. Frame_Mapper, angle half
  - [x] 4.1 Implement `angleToFrame` in `src/logic`
    - Wrap into 0 to 360, round half up, wrap again, return a whole frame 0 to 359. Non-finite input throws an Error that names the value. Pure and independent of the zoom.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  - [x] 4.2 Write the angle tests
    - Table: 0, 90, 180, 270, -90, 360, 359.9, 0.4, 0.5, 720 give 0, 90, 180, 270, 270, 0, 0, 0, 1, 0.
    - A sweep over -720 to 720 in steps of 0.25 gives only whole frames 0 to 359. NaN, Infinity and -Infinity throw with the value in the message. Same input gives the same output.
    - Source line it should catch: remove the final `% 360`, so 359.9 returns 360 (the 359.9 case fails).
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 35.2 (design Property 1, 2)_

- [x] 5. Frame_Mapper, zoom half
  - [x] 5.1 Implement `zoomSelection` and `zoomDistance`
    - Clamp Z to 0 to 1; p = Z * 3; lower lap = min(floor(p), 2); upper lap = lower + 1; weight = p - lower; distance = 6.5 - 3.9 * Z. Non-finite throws naming the value. Independent of the angle.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_
  - [x] 5.2 Write the zoom tests
    - Design table: Z of -0.2, 0, 0.25, 0.5, 0.75, 1, 1.5 give (0,1,0), (0,1,0), (0,1,0.75), (1,2,0.5), (2,3,0.25), (2,3,1), (2,3,1).
    - Weight in [0, 1]; lap indices valid; distance never increases over a sweep of Z from -0.5 to 1.5 in steps of 1/120; Z = 0.5 gives 4.55 m. Independent of the angle (loop over 360 angles and the 13-point grid).
    - Source line it should catch: change `min(floor(p), 2)` to `min(floor(p), 3)`.
    - _Requirements: 6.1 to 6.10, 5.8, 35.3, 35.15 (design Property 3, 4)_

- [x] 6. Lap scene builder (Spike S1)
  - [x] 6.1 Build and bake the four lap scenes in the PathKit adapter
    - Each scene: fps 30, 360 frames, one entity `cam`, forward -Z and up +Y from constants. `orbitAround` order 0, `aimAt` order 1, static targets `orbitCentre` (0, h, 0) and `machineCentre` (0, 0, 0), a dummy 2-point path. Bake all four at load, not during interaction.
    - _Requirements: 4.2, 5.1, 10.4, 10.5, 11.5, 11.6, 2.10_
  - [x] 6.2 Write the Spike S1 tests
    - `validateScene` passes. `orbitAround` order is below `aimAt` order. Forward and up lie on different axes.
    - Every frame is readable with `evaluateEntity`. Frames 0, 90, 180, 270 give (0, h, r), (r, h, 0), (0, h, -r), (-r, h, 0) within 1e-9 for each lap. For all 360 frames the Bearing (atan2 of x, z) equals the frame number in degrees within `BEARING_TOLERANCE_DEG`.
    - The User pastes the bake time per lap; Kiro records it in the build notes. No timing assertion.
    - Source line it should catch: change the orbit speed or `startAngle` in the lap builder.
    - _Requirements: 4.2, 4.6, 4.10, 5.1, 10.4, 35.7, 35.8 (design Property 7, 8)_

- [x] 7. Camera blend (Spike S2)
  - [x] 7.1 Implement the blend with preallocated buffers
    - Read two laps with `evaluateEntity` at the same whole frame; `lerp` the positions and `slerp` the rotations into caller buffers. No per-frame allocation.
    - _Requirements: 4.3, 10.2, 11.1, 11.2, 11.5, 11.6_
  - [x] 7.2 Write the Spike S2 and View_Pair tests
    - Over every frame 0 to 359 crossed with Z = k/12 for k = 0 to 12 (joints accepted either way): Bearing within tolerance; camera aims at the centre within `AIM_TOLERANCE_DEG` (compare the rotated -Z forward vector with the direction to the centre, not raw quaternion components); distance equals 6.5 - 3.9 * Z within 1e-9.
    - Clearance (Euclidean distance to the nearest point of the box, corners included) is at least `CAMERA_MIN_CLEARANCE_M` and at least d - R - 1e-9.
    - At Z = 1 the minimum clearance over all 360 frames is 1.2035 m (tolerance 0.001) near frame 72. Assert the all-bearing minimum is below 1.2649 - 0.05, so a four-bearing check cannot pass.
    - Z = 0.5: frame 0 position (0, 1.75, 4.2), frame 90 (4.2, 1.75, 0), frame 45 (2.9698, 1.75, 2.9698), each within 1e-3; forward vectors (0, -5/13, -12/13) and (-12/13, -5/13, 0).
    - Distance never increases with Z at each bearing. Zooming never changes the Bearing; the angle never changes the distance.
    - Source line it should catch: replace the lerp weight `w` with `1 - w`, or set a lap distance below R.
    - _Requirements: 4.3, 4.4, 6.10, 11.2, 11.3, 11.4, 11.11, 35.15 (design Property 5, 6, 9)_

- [x] 8. Tour scene builder (Spike S3)
  - [x] 8.1 Implement the tour builder and the finding text mapping
    - Generic: takes a list of Part rest positions. Closed ring of 12 points at radius 3.6 m and height 1.5 m; `followPath` at constant speed, one turn over frameCount = parts * 90; `aimAt` a keyframed target with one keyframe per Part at the middle of its 90-frame slot (strictly increasing integer frames).
    - Plain-words mapping for the linter codes `path-end-reached`, `rotation-conflict`, `aim-vertical`, `speed-spike`, `roll-change`; an unknown code falls back to the finding's own message; an empty list gives "No findings reported."
    - _Requirements: 4.5, 16.3, 16.5, 16.7, 16.8_
  - [x] 8.2 Write the Spike S3 tests
    - Fixtures of 8 and of 6 rest positions: `validateScene` passes; bake succeeds; `motionLinter(scene, baked)` does not throw and returns an array; every baked frame has clearance at least `CAMERA_MIN_CLEARANCE_M` and lies outside the envelope; `followPath` order is below `aimAt` order.
    - Finding text table: the five codes, one unknown code, and the empty list.
    - Source line it should catch: set the ring radius below 1.5.
    - _Requirements: 4.5, 4.6, 16.3, 16.5, 16.7, 16.8, 35.7, 35.8 (design Property 7, 10, 21)_

- [x] 9. Spike S4: view offset
  - [x] 9.1 Write the S4 check page
    - A tiny, clearly named page in a spike folder inside `apps/skeleton-bench`: a few Three.js shapes, orbit through the baked camera, a `setViewOffset` move, and a raycast click on a shape.
    - _Requirements: 4.7, 12.6_
  - [x] 9.2 User checkpoint: run the S4 check
    - The User opens the page in a browser in their own way and answers: does the Machine move on screen with the offset sign as designed; do orbit, zoom and clicking a shape still work while offset; does the shift direction match.
    - Kiro records the result in the build notes. If it fails, stop and ask (fallback: move the Machine and re-bake when the drag ends).
    - _Requirements: 4.7, 4.8, 4.10, 4.11, 12.7_

### Phase 1: Tier A logic (pure, tested)

- [x] 10. Drag_Range and Fraction_To_Pixels
  - [x] 10.1 Implement them in `src/logic`
    - L(e) = 0.25 - 0.15 * e / 100, using the named constants; clamp each axis independently; reset gives (0, 0); `fractionToPixels` multiplies with no rounding. Non-finite input throws naming the value.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12_
  - [x] 10.2 Write the tests
    - Limits 0.25, 0.175, 0.10 at 0, 50, 100 percent. 1000 x 800 px table: 250 / 200, 175 / 140, 100 / 80.
    - Inside unchanged; on the edge unchanged; outside gives the nearest edge; axes independent; reset gives zero; the area shrinks as e grows (loop 0 to 100); an offset outside the new area is re-clamped when e changes; non-finite throws with the value.
    - Source line it should catch: use 0.25 instead of 0.15 in the shrink slope.
    - _Requirements: 7.1 to 7.12, 35.4 (design Property 14, 15)_

- [x] 11. Explode_Easing and Part path points
  - [x] 11.1 Implement `explodeFrame` and the path-point function
    - Smoothstep; frame = floor(eased * 59 + 0.5); clamp to 0 to 100; non-finite throws.
    - Points: P0, P1 = P0 + v/3 + b, P2 = P0 + 2v/3 + b, P3 = P0 + v, with b = 0.15 * |v| * u; u is the perpendicular closest to +Y; use +Z when |unit(v) x Y| < 0.1. |v| below 0.1 throws.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 13.3_
  - [x] 11.2 Write the tests
    - Frames at 0, 25, 50, 75, 100 percent are 0, 9, 30, 50, 59. Monotone non-decreasing over 0 to 100 step 1. Inputs -5 and 105 clamp. Frames are whole and inside 0 to 59. Non-finite throws.
    - P0 = (0, 0, 0), v = (0.6, 0, 0): b = (0, 0.09, 0); points (0,0,0), (0.2,0.09,0), (0.4,0.09,0), (0.6,0,0).
    - v = (0, 0.6, 0) uses +Z: b = (0, 0, 0.09); points (0,0,0), (0,0.2,0.09), (0,0.4,0.09), (0,0.6,0). |v| below 0.1 throws.
    - Source line it should catch: swap the +Z fallback for +Y.
    - _Requirements: 8.1 to 8.7, 13.3, 35.5 (design Property 12)_

- [x] 12. Pointer, shortcut guard, contrast function and storage helpers
  - [x] 12.1 Implement them
    - `classifyPointer` (5 px click, more is drag, stays a drag once exceeded); `shouldHandleShortcut` (false for text input, textarea, select, range input); `contrastRatio`; storage helpers with the `skeletonBench.` key prefix and try/catch around every read and write.
    - _Requirements: 12.9, 14.6, 17.5, 17.6, 21.4, 22.2, 23.1, 23.3_
  - [x] 12.2 Write the tests
    - Click at 5 px, drag at 5.1 and 6 px; out to 6 and back to 2 stays a drag.
    - Guard ignores a text input, textarea, select and range input; accepts a button and no focus.
    - Contrast: black on white 21; same colour 1; #767676 on white about 4.54 (within 0.01); argument order does not matter.
    - Storage: get and set never throw when `localStorage` throws or is missing (four failure modes with a fake storage); keys start with `skeletonBench.`.
    - Source line it should catch: change `<=` to `<` in the click test.
    - _Requirements: 12.9, 14.6, 17.6, 22.2, 23.3, 35.16 (design Property 16, 17, 20, 22)_

### Phase 2: Data and one machine end to end

- [x] 13. Part_Catalogue structure and checks
  - [x] 13.1 Define the types and data layout (no facts yet)
    - Machines and Parts with id, name, job, material, position text, source id, rest position, explode vector, extents, and keyboard order. This task adds only the layout and a one-Part fixture. The Pump entries are written in Task 14.
    - _Requirements: 9.1, 9.4, 9.6, 18.5_
  - [x] 13.2 Write the catalogue checks
    - Every field present; ids unique across all Machines; keyboard order lists each Part once; every source id exists in `docs/sources.md` (read with `node:fs`); |explode vector| >= 0.1; rest position, end position and extents inside the envelope.
    - A "lists exactly the named Parts" check against the brief (Pump 8, Heat_Exchanger 6, Desk_Lamp 6). Run it against the fixture now; it covers the real catalogue as Tasks 14 and 18 fill it. A failing check names the Part.
    - Source line it should catch: delete one source id from `docs/sources.md`, or duplicate a Part id.
    - Added by a spec change: `checkExplodedClearance(catalogue, minGap = PART_MIN_CLEARANCE_M)` with `PART_MIN_CLEARANCE_M` = 0.08 m. At Explode_Amount 100, every two Parts of the same Machine must be at least 0.08 m apart. Gap = largest over x, y, z of |centre A - centre B| - (extents A + extents B) / 2, with centre = rest position + explode vector. A pair fails when gap < minGap - 1e-9, and the message names both Parts and the gap. Parts of different Machines are never compared. Tests: the real catalogue returns no failures, plus synthetic cases at gaps 0.1, 0.05, 0.08, 0.07, overlap, apart on y only, end position used, different Machines.
    - _Requirements: 9.1 to 9.7, 13.3, 13.8, 18.1, 18.2, 18.3, 35.6 (design Property 11, 18)_

- [x] 14. Pump facts and catalogue entries
  - [x] 14.1 Research and write the Pump entries
    - Search for reputable sources on the eight Pump parts (casing, impeller, shaft, bearing housing, mechanical seal, flange, bolts as one group, motor): job, material, typical position.
    - Write `docs/sources.md` entries (part, claim, source URL, date checked) and the catalogue entries. Invented sample specifications are labelled "sample data". Rest and explode vectors fit the envelope.
    - Changed by a spec change (clearance, Requirement 13.8): the Pump explode vectors are now motor [-0.17, 0, 0]; bearing housing [-0.06, -0.2, 0]; shaft [0, 0, 0.36]; mechanical seal [-0.03, -0.44, 0]; bolts [-0.08, -0.05, 0.04]; casing [0.07, -0.13, -0.14]; impeller [0.2, 0.39, -0.18]; flange [0, 0.27, 0.19]. Every two Pump Parts are at least 0.08 m apart at Explode_Amount 100 (smallest gap 0.09 m). Rest positions and text are unchanged.
    - _Requirements: 18.1, 19.1, 19.2, 19.3, 19.5, 9.1_
  - [x] 14.2 User checkpoint: approve the Pump text
    - The User reads and approves every Pump text and source before it is kept.
    - _Requirements: 19.4_
  - [x] 14.3 Run the catalogue tests
    - The User runs `npm.cmd test`. Report the counts.
    - _Requirements: 9.5, 35.6, 35.14_

- [x] 15. Part scenes
  - [x] 15.1 Build and bake one scene per Part
    - Fps 30, 60 frames, one `followPath`, speed = path length * 30 / 59, no `aimAt`, empty targets, forward +Z and up +Y from constants. Path length from PathKit's curve and arc-length functions. Bake all Parts at load.
    - _Requirements: 13.2, 13.3, 13.4, 2.10_
  - [x] 15.2 Write the tests
    - `validateScene` passes; frame 0 equals the rest position within 1e-9; the last frame equals rest + v within 1e-6; travelled distance non-decreasing; all 60 frames inside the envelope; frame 30 is at the hand-checked fraction 30/59 of the path; entity ids unique.
    - Source line it should catch: use 60 instead of 59 in the speed (the end is not reached).
    - _Requirements: 8.1, 8.2, 13.2, 13.3, 13.4, 35.5, 35.7 (design Property 7, 11, 13)_

- [x] 16. App state module
  - [x] 16.1 Implement the state functions
    - Set machine (resets explode 0, offset 0, no selection), orbit angle, zoom (clamped), explode (re-clamps the offset), offset (clamped by Drag_Range), mode toggle, select Part, look.
    - Tour start resets explode and offset to 0 and saves angle and zoom; stop or end restores them. While the Tour plays, the orbit, zoom, explode and move setters are rejected with no change. Initial values from constants (angle 30, zoom 0.25, explode 0, Pump).
    - _Requirements: 7.9, 12.4, 13.6, 15.3, 15.4, 16.2, 16.6, 16.11_
  - [x] 16.2 Write the tests
    - Each setter; the reset on machine switch; re-clamp on explode change; Tour start and stop table over several start states; setters rejected while playing; initial values.
    - Source line it should catch: forget to restore the saved zoom on stop.
    - _Requirements: 15.3, 15.4, 16.2, 16.6, 16.11, 35.17 (design Property 19)_

- [ ] 17. Render core
  - [x] 17.1 Renderer, stage, camera and view offset
    - Renderer with a WebGL-failure message; stage and bench grid at y = -0.6; camera from the blend (`position.set`, `quaternion.set`); view offset from the offset fraction; render-on-change loop.
    - _Requirements: 10.1, 10.2, 11.1, 12.2, 12.6, 21.5, 20.4_
  - [x] 17.2 User checkpoint: view the empty stage
    - The User views the empty stage in a browser in their own way: the grid, the camera orbit and zoom, and that the view offset moves the stage. Kiro states what was not tested.
    - _Requirements: 37.1, 37.2_
  - [x] 17.3 Pump model and Part placement
    - Pump model from shapes: eight named parts, each a named object with `userData.partId`. Parts placed from the baked Part scenes through Explode_Easing. Impeller spin (ordinary Three.js, stopped under reduced motion).
    - Shapes are drawn from scratch with Three.js (casing as a spiral volute with snout, flange ring, discharge neck and foot; impeller as back plate, hub and six curved vanes). Fit test (`test/pump-fit.test.ts`): with the impeller spinner at rotation.x 0, 0.3 and 1, the exact box of every Pump Part stays inside its catalogue extents (overshoot <= 1e-6, message names the Part and axis); a catalogue with the casing x extent 0.05 smaller must give an overshoot above 0.02.
    - _Requirements: 13.2, 13.5, 18.4, 18.5_
  - [x] 17.4 User checkpoint: view the Pump assembled and exploded
    - The User views the Pump assembled and exploded in a browser in their own way. Kiro states what was not tested.
    - _Requirements: 37.1, 37.2_
  - [x] 17.5 The two Looks
    - Palette objects and two material sets. X_Ray_Skeleton with cyan `EdgesGeometry` edges; Clean_Engineering with matte solids.
    - _Requirements: 17.1, 17.3, 17.4_
  - [-] 17.6 User checkpoint: view both Looks
    - The User views both Looks in a browser in their own way. Kiro states what was not tested.
    - User answers: (1) starts in X_Ray_Skeleton: yes; (2) X-ray background, translucent ivory Parts, cyan outlines, inner Parts visible: yes; (3) outlines stay on explode, orbit and zoom and turn with the impeller: yes; (4) Clean_Engineering background, matte grey, no outlines: yes, but assembled Parts were all one grey; (5) Look persists after reload: yes; (6) casing recognisable but the spiral is subtle; impeller recognisable.
    - Decisions: Clean_Engineering uses three greys A #7d8793, B #5f6974, C #444e59 (contrast against #eceff1: 3.16, 4.84, 7.33), assigned by catalogue index mod 3 (`cleanFillIndex`); volute radius is now 0.165 + 0.085 * (a / 2PI). Test: `test/looks.test.ts`.
    - _Requirements: 37.1, 37.2_
  - [~] 17.7 Picking and shells
    - Raycast on meshes only; the click rule (5 px); selection shell and focus shell.
    - _Requirements: 14.1, 14.6, 14.7, 14.9_
  - [~] 17.8 User checkpoint: click and focus a Part
    - The User clicks and focuses a Part in a browser and checks the selection cue. Kiro states what was not tested.
    - _Requirements: 37.1, 37.2_

### Phase 3: Rest of Tier A

- [ ] 18. Heat_Exchanger and Desk_Lamp
  - [~] 18.1 Research and write the facts
    - Search for reputable sources for the six Heat_Exchanger parts and the six Desk_Lamp parts. Write `docs/sources.md` entries and the catalogue entries.
    - _Requirements: 18.2, 18.3, 19.1, 19.2, 19.3, 19.5_
  - [~] 18.2 User checkpoint: approve the texts
    - The User reads and approves every text and source before it is kept.
    - _Requirements: 19.4_
  - [~] 18.3 Build the models and scenes
    - Shape models for both Machines (the tube bundle is one `InstancedMesh` Part), named objects, Part scenes baked at load, Inventory switching.
    - _Requirements: 15.1, 15.3, 18.2, 18.3, 18.4, 18.5_
  - [~] 18.4 Rerun the tests and User checkpoint: visual check
    - The User runs `npm.cmd test` and pastes the output (Tasks 13 and 15 checks now cover all 20 Parts). The User checks both Machines in a browser.
    - _Requirements: 9.5, 35.6, 37.1_

- [ ] 19. Tour for the real catalogue
  - [~] 19.1 Bake and wire the Tours
    - Bake all three Tours at load; run `motionLinter`; show findings in plain words in the Motion_Check; Tour start and stop wired to the state; Pause and Stop; controls disabled with the visible label "Stop the tour to use this" while playing; reduced-motion jumps with a 3000 ms hold per Part; an error message when baking or linting fails.
    - _Requirements: 16.1 to 16.11, 22.5_
  - [~] 19.2 Write the tests with the real catalogue
    - Clearance on every frame of every Tour; `motionLinter` does not throw; the Tour visits Parts in keyboard order (slot keyframes match the catalogue order); frame counts 720, 540 and 540.
    - Source line it should catch: reorder two Parts in a Machine's keyboard order only in the tour builder input.
    - _Requirements: 16.2, 16.5, 16.7, 35.7 (design Property 10, 19)_

- [ ] 20. UI shell
  - [~] 20.1 Implement and test the pure UI helpers
    - Key map (M, E, R, +, -, arrows, Escape) and the step functions (orbit key step, zoom step, wheel step, move step, `orbitAngleFromDrag`).
    - Tests with hand-written tables, including that shortcuts are ignored with text-field focus.
    - Source line it should catch: change the sign in `orbitAngleFromDrag`.
    - _Requirements: 10.3, 11.1, 12.1, 12.3, 12.5, 12.9, 13.1_
  - [~] 20.2 Layout and Inspector with Parts_List
    - Inventory (three cards, SVG thumbnails drawn by us), Stage, Inspector (empty state "Pick a part to read about it", "sample data" label), Parts_List buttons in catalogue order with focus highlight, Motion_Check region, Control_Bar region.
    - _Requirements: 14.2, 14.3, 14.4, 14.5, 14.8, 15.1, 15.2, 20.1, 21.1_
  - [~] 20.3 User checkpoint: view the layout, the Inspector and the Parts_List
    - The User views the layout, the Inspector and the Parts_List in a browser in their own way and reports problems. Kiro states what was not tested.
    - _Requirements: 21.3, 37.1_
  - [~] 20.4 Controls
    - Rotate / Move toggle (M), orbit scrub, zoom slider, keys and wheel, explode slider and key E (600 ms animation, jump under reduced motion), Reset position and key R, arrow keys per mode, key hints beside every control, "hint seen" flags. Gestures toggle absent or disabled with a label.
    - _Requirements: 10.1, 10.3, 10.6, 11.1, 12.1, 12.3, 12.5, 12.8, 13.1, 20.2, 20.3, 20.5, 21.2, 21.4_
  - [~] 20.5 User checkpoint: try the controls
    - The User tries the controls in a browser in their own way and reports problems. Kiro states what was not tested.
    - _Requirements: 21.3, 37.1_
  - [~] 20.6 Tour, Look toggle and About wiring
    - Tour with Pause and Stop wired to the state; Look toggle stored in try/catch; About_Panel access from the main screen; error messages that say what to do.
    - _Requirements: 17.5, 17.7, 21.5, 16.1 to 16.11, 22.5_
  - [~] 20.7 User checkpoint: try the Tour, the Look toggle and the About panel
    - The User tries the Tour, the Look toggle and the About panel in a browser in their own way and reports problems. Kiro states what was not tested.
    - _Requirements: 21.3, 37.1_

- [ ] 21. Accessibility pass
  - [~] 21.1 Choose the palettes and write the contrast test
    - Choose palette values for both Looks. Test every text and background pair, and non-text interface parts, at or above `CONTRAST_MIN`.
    - Source line it should catch: lighten one palette text colour until a pair drops below 4.5.
    - _Requirements: 17.3, 17.4, 22.1, 22.2 (design Property 17)_
  - [~] 21.2 Apply the accessibility rules
    - Focus rings; no meaning by colour alone (selection shell plus the Inspector name; Tour state in words); reduced motion; a keyboard path and a non-drag alternative for every mouse action (sliders, arrow keys, Reset); a visible button for every single-letter shortcut.
    - Write a WCAG 2.2 checklist (Dragging Movements, Character Key Shortcuts) in the build notes.
    - _Requirements: 12.8, 14.7, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8_
  - [~] 21.3 User checkpoint: keyboard-only walkthrough
    - The User does a keyboard-only walkthrough and sends screenshots of both Looks.
    - _Requirements: 22.6, 37.1, 37.2_

- [ ] 22. About_Panel and README
  - [~] 22.1 Write the honest limits and the README
    - About_Panel and README state: models are simplified and not to scale with each other; specifications are sample data; impeller spin, dragging and the cursor are not PathKit; PathKit cannot follow a live hand; gestures need a webcam, light and HTTPS; two-hand zoom is the least stable; moving the Machine has no gesture; the classifier is our own code over 21 points; MediaPipe sends usage metrics to Google.
    - README also lists every stored key, notes that "Skeleton Bench" is a working name not trademark-checked, and uses none of the names J.A.R.V.I.S., Marvel or Stark anywhere. The README is the only existing file edited.
    - _Requirements: 1.6, 3.8, 3.9, 23.2, 24.1 to 24.10_

- [ ] 23. Final Tier A checkpoint
  - [~] 23.1 Check imports and files
    - Open every `.ts` file in `apps/skeleton-bench` and check that each relative import ends in `.js`; list the files checked. Confirm nothing outside the allowed files changed.
    - _Requirements: 1.4, 1.6, 2.7, 2.9_
  - [~] 23.2 User checkpoint: final run and report
    - The User runs `npm.cmd test`, then `npm.cmd run build`, one at a time from `apps/skeleton-bench`, and pastes both outputs. Kiro reports counts only from that output.
    - The final report states plainly what was not tested (look, WebGL output, the view offset, clicking a Part, the webcam, real gestures, load time), which items the User checked, and the recorded bake times.
    - Deploy is out of scope (decision 6). Tier B starts only when the User says "go".
    - _Requirements: 1.8, 35.1, 35.14, 37.1, 37.2, 37.3, 37.4_

### Tier B (optional, blocked until the User says "go")

- [ ] 24. Tier B gestures (blocked until the User says "go"; all sub-tasks optional)
  - Do not start any sub-task of this task without the User's "go". Sub-tasks are labelled B1 to B8 as in the brief.

  - [ ]* 24.1 B1. Metrics check and dependency
    - Find out from primary sources whether MediaPipe Tasks usage metrics can be switched off. Record it in the build notes. Ask the User before changing the notice or the network rules.
    - Give the User one `npm.cmd install` line to add `@mediapipe/tasks-vision` 1.2.3 exactly; the User runs it.
    - _Requirements: 2.5, 25.1, 32.8_
  - [ ]* 24.2 B2. Spike S5 and licences
    - User checkpoint: the User checks that the wasm and the model load from the app's own folder in a built copy with the network off, and whether the metrics can be switched off.
    - Add the Apache-2.0 text; update `THIRD_PARTY.md` (model card, Zhang et al. 2020 arXiv:2006.10214, experimental, out-of-scope uses).
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 4.9, 33.2_

  - [ ]* 24.3 B3. Gesture_Lab page
    - Build a page that shows the 21 landmarks and the pose name live. The User tries it on their own webcam and light. If it fails, stop and ask.
    - _Requirements: 25.2, 25.3, 25.6_

  - [ ]* 24.4 B4. Pure gesture logic and tests
    - Pose classifier (fist, open palm, pinch), Openness 0 to 1, smoothing, mode by hand count, no-hand frames change nothing, pinch held 300 ms before rotate, two-hand ratio to Zoom_Value.
    - Arming state machine with timestamps as inputs: fist 299 ms does not arm and 300 ms arms; Openness 1, 0.5, 1 without a fist hold changes nothing; after arming Openness sets the Explode_Amount with dead zones; the disarm cases.
    - Tune the Tier B constants of the design from the Gesture_Lab. Fix `NO_HAND_DISARM_MS` with the User (open question 24). Hand-written landmark fixtures only.
    - Source line it should catch: change the hold test from `>=` to `>` for 300 ms.
    - _Requirements: 26.1 to 26.7, 27.1, 28.1 to 28.10, 29.1 to 29.3, 30.1 to 30.3, 34.1 to 34.13 (design Property 23 to 29)_

  - [ ]* 24.5 B5. Rotate gesture
    - Wire the pinch rotate to the same orbit setter as the mouse; User checkpoint.
    - _Requirements: 25.4, 25.5, 27.1, 27.2, 27.3_

  - [ ]* 24.6 B6. Explode gesture
    - Wire the armed explode to the same explode setter; use the trigger fallback if the continuous mapping is unstable; User checkpoint.
    - _Requirements: 25.4, 25.5, 28.1 to 28.10_

  - [ ]* 24.7 B7. Zoom gesture
    - Wire the two-hand zoom to the same zoom setter, with the orbit angle unchanged. First to drop if time is short; User checkpoint.
    - _Requirements: 25.4, 25.5, 29.1 to 29.5_

  - [ ]* 24.8 B8. Privacy notice, loading and Tier B report
    - Privacy notice before the camera starts (processed on the device and not sent anywhere; MediaPipe usage metrics to Google; the User can decline and keep mouse and keyboard; nothing recorded or stored). Lazy loading of the wasm and model only after the notice is accepted; loading state; camera tracks stopped on exit; status overlay in words and a drawn hand skeleton; error messages.
    - Enable the Gestures toggle; update the About_Panel and the README; final Tier B report.
    - _Requirements: 1.10, 20.3, 23.4, 23.5, 30.4, 31.1, 31.2, 31.3, 32.1 to 32.7, 33.1 to 33.4_

## Notes

- Tasks marked with `*` are optional Tier B tasks and stay blocked until the User says "go".
- Checkpoints marked "User checkpoint" need the User's action or approval.
- Tests use exhaustive loops and hand-written tables, not random generators, because the app has no fast-check dependency (decision 2).
- Each task references specific requirements for traceability.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2"] },
    { "id": 6, "tasks": ["5.1"] },
    { "id": 7, "tasks": ["5.2"] },
    { "id": 8, "tasks": ["6.1"] },
    { "id": 9, "tasks": ["6.2"] },
    { "id": 10, "tasks": ["7.1"] },
    { "id": 11, "tasks": ["7.2"] },
    { "id": 12, "tasks": ["8.1"] },
    { "id": 13, "tasks": ["8.2"] },
    { "id": 14, "tasks": ["9.1"] },
    { "id": 15, "tasks": ["9.2"] },
    { "id": 16, "tasks": ["10.1"] },
    { "id": 17, "tasks": ["10.2"] },
    { "id": 18, "tasks": ["11.1"] },
    { "id": 19, "tasks": ["11.2"] },
    { "id": 20, "tasks": ["12.1"] },
    { "id": 21, "tasks": ["12.2"] },
    { "id": 22, "tasks": ["13.1"] },
    { "id": 23, "tasks": ["13.2"] },
    { "id": 24, "tasks": ["14.1"] },
    { "id": 25, "tasks": ["14.2"] },
    { "id": 26, "tasks": ["14.3"] },
    { "id": 27, "tasks": ["15.1"] },
    { "id": 28, "tasks": ["15.2"] },
    { "id": 29, "tasks": ["16.1"] },
    { "id": 30, "tasks": ["16.2"] },
    { "id": 31, "tasks": ["17.1"] },
    { "id": 32, "tasks": ["17.2"] },
    { "id": 33, "tasks": ["17.3"] },
    { "id": 34, "tasks": ["17.4"] },
    { "id": 35, "tasks": ["17.5"] },
    { "id": 36, "tasks": ["17.6"] },
    { "id": 37, "tasks": ["17.7"] },
    { "id": 38, "tasks": ["17.8"] },
    { "id": 39, "tasks": ["18.1"] },
    { "id": 40, "tasks": ["18.2"] },
    { "id": 41, "tasks": ["18.3"] },
    { "id": 42, "tasks": ["18.4"] },
    { "id": 43, "tasks": ["19.1"] },
    { "id": 44, "tasks": ["19.2"] },
    { "id": 45, "tasks": ["20.1"] },
    { "id": 46, "tasks": ["20.2"] },
    { "id": 47, "tasks": ["20.3"] },
    { "id": 48, "tasks": ["20.4"] },
    { "id": 49, "tasks": ["20.5"] },
    { "id": 50, "tasks": ["20.6"] },
    { "id": 51, "tasks": ["20.7"] },
    { "id": 52, "tasks": ["21.1"] },
    { "id": 53, "tasks": ["21.2"] },
    { "id": 54, "tasks": ["21.3"] },
    { "id": 55, "tasks": ["22.1"] },
    { "id": 56, "tasks": ["23.1"] },
    { "id": 57, "tasks": ["23.2"] },
    { "id": 58, "tasks": ["24.1"] },
    { "id": 59, "tasks": ["24.2"] },
    { "id": 60, "tasks": ["24.3"] },
    { "id": 61, "tasks": ["24.4"] },
    { "id": 62, "tasks": ["24.5"] },
    { "id": 63, "tasks": ["24.6"] },
    { "id": 64, "tasks": ["24.7"] },
    { "id": 65, "tasks": ["24.8"] }
  ]
}
```
