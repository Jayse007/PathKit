# Implementation Plan: Shot Rail

## Execution Rules

Read this section first. Then read only the current task.

- Do one task at a time, in list order. Say which task is starting. Report the result in one or two sentences.
- Kiro runs no terminal command (a hook blocks them). At each checkpoint, give the User one exact one-line command and the folder, then wait.
  - Allowed commands, each on one line, run from `apps/shot-rail`, one at a time: `npm.cmd install` (once, run by the User, the exact line given in task 2.2), `npm.cmd test` and `npm.cmd run build`.
  - The steering line for `apps/shot-rail` already exists in `.kiro/steering/windows-terminal.md`. There is no task for adding it. Kiro does not edit that file.
  - Never ask for npx, tsc, watch mode, a dev server or anything that does not exit.
  - The `dev` and `preview` scripts exist only for the User to run in their own terminal. Kiro never runs them and never asks for them.
- Imports: every relative import ends in `.js`, in `src` and in `test`. Never write `.ts` in an import path. Never change `module` or `moduleResolution`.
  - PathKit is imported only through one re-export file, `apps/shot-rail/src/logic/pathkit.ts`, which re-exports from `../../../../packages/pathkit/src/index.js` (four `../`: out of `logic/`, out of `src/`, out of `shot-rail/`, out of `apps/`). Everything else imports PathKit from that file. If a file ever sits at a different depth, the count changes by one `../` per level: count it again, do not copy it.
  - After editing a `.ts` file, check the editor diagnostics for it (say so if they are not visible).
  - Before marking a task done, open every `.ts` file touched, check that each relative import ends in `.js`, and list the files checked.
- Tests use Vitest with hand-written expected values, never values computed by the code under test.
  - No browser, no network, no random generators, no fast-check (it is not a dependency).
  - Exhaustive loops use plain comparisons that throw an Error naming the check, the index and the value. Call `expect` only for once-per-run checks.
  - Force the special cases. Keep each test file under 5 seconds.
  - Use `toThrow` with a SceneError instance for a SceneError. Never weaken a test to make it pass. Never freeze typed arrays; compare copies.
  - Each test task ends with "Source line it should catch": one concrete change to the source that must make a named test fail, so the User can break it once and confirm.
- If a check fails, say whether the code or the check is wrong. Make at most 3 fix attempts, then stop and report the failing inputs.
- Do not say a task is done until the User has run the command and pasted passing output. Report the passed, failed and skipped counts from the pasted output only. If output is missing or cut off, ask again. If a task is blocked, stop and ask.
- After every task, add one short entry to `apps/shot-rail/docs/build-notes.md`: what was done, what broke, what Kiro got wrong, which PathKit feature was used.
- Do not edit anything under `packages/pathkit`, any other `package.json`, `scripts/guard-*`, `.kiro/hooks/guard-*`, `scripts/check-constraints*` or `scripts/setup*`. Name no file or hook with the prefix `guard-`.
  - New files go only inside `apps/shot-rail/` (plus this spec). The only existing file that may change is `apps/shot-rail/README.md`.
- Any "commonly said" note about an angle needs a source recorded in `docs/sources.md` (claim, source, date checked). Write nothing from memory. The User checks the text before it ships.
- Fonts: use the system font stack and no font files.
- Constants live in `src/logic/constants.ts`, with values exactly as in the design's Named constants table. Tests import them. A consistency test checks the derived constants.
- At the end of each task, state what was NOT tested (look, WebGL output, real browser, PNG download, feel of the controls, dev server).
- Spike rule: if S1 to S5 fails, stop and ask the User and invent no workaround. If S6 fails, use Outcome B without asking and record it in the build notes.
- A task marked "User checkpoint" needs the User's action or approval. Kiro does not do it.
- Tasks marked `*` (P3) are optional and blocked until the User says "go". Deploy is out of scope.

## Overview

The plan follows the approved design: the subject is baked for one lap at 240 fps, a pure Frame_Remap picks the baked frame for each displayed frame, and the cameras orbit or follow a rail with `aimAt` on the true subject position. The pure constants and two small pure pieces (the default Road points and `frame-remap.ts`) come first. The spikes S1 to S6 come next, with scenes built inline in `test/spike/` through `src/logic/pathkit.ts`, so they do not depend on later builders. The logic modules that depend on a spike (`target-converter`, `shot-builders`, `scene-set`) come after it. Stage and views follow, one item per task, each with its own User checkpoint. P2 features come after the P1 checkpoint. The design pass is about a third of the work. P3 is last and blocked.

Requirement and property numbers refer to `requirements.md` and to the Correctness Properties in `design.md`.

## Tasks

### Phase A: Setup

- [x] 1. Read-only checks before scaffolding
  - [x] 1.1 User checkpoint: confirm the steering line and the approved design
    - No file changes. The User confirms that `.kiro/steering/windows-terminal.md` already has the line for `apps/shot-rail` (`npm.cmd install`, `npm.cmd test`, `npm.cmd run build`, run from that folder), and that `requirements.md` and `design.md` are approved.
    - Kiro may read the steering file to check the line is there. Kiro does not edit it.
    - _Requirements: 1.5, 2.8, 23.1, 25.6_

- [x] 2. Scaffold the app
  - [x] 2.1 Create the app files
    - `package.json`: type module; exact versions with no `^` or `~`: runtime `three` 0.187.0; dev `@types/three` 0.187.0, `vite` 7.3.8, `vitest` 3.2.7, `typescript` 5.9.3; scripts `test` = `vitest run`, `build` = `vite build`, `dev` = `vite`, `preview` = `vite preview`.
    - Only the User runs `dev` and `preview`, in their own terminal. Kiro never runs them and never asks for them.
    - `tsconfig.json`: strict, NodeNext, noEmit, DOM lib, skipLibCheck, at least as strict as the PathKit tsconfig.
    - `vite.config.ts`: `base` `/PathKit/shot-rail/`; `server.fs.allow` includes the repository root.
    - `vitest.config.ts`: include `test/**/*.test.ts`, node environment.
    - `.gitignore` (node_modules, dist), a minimal `index.html` (system font stack, no font file).
    - `src/logic/pathkit.ts`: the single re-export from `../../../../packages/pathkit/src/index.js` (four `../`; count it again against the file's real depth).
    - `src/logic/constants.ts`: every constant of the design's Named constants table, with values exactly as in the design, and the derived ones computed from their sources (`BAKE_FPS`, `BAKED_LAP_FRAMES`, `LAP_SECONDS`, `SENSOR_HEIGHT_MM`, `FRAME_INTERVAL_MS`).
    - `THIRD_PARTY.md` (three 0.187.0 MIT, @types/three 0.187.0 MIT, Vite 7.3.8 MIT, Vitest 3.2.7 MIT, TypeScript 5.9.3 Apache-2.0), and stubs for `docs/build-notes.md` and `docs/sources.md`.
    - Risk to confirm at the first build: Vite resolves the import from outside the app root, and the tsconfig type-checks PathKit source without new errors.
    - _Requirements: 1.1, 1.2, 1.6, 1.8, 1.9, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.10_
  - [x] 2.2 User checkpoint: install
    - Kiro gives the one line `npm.cmd install` (run from `apps/shot-rail`; it installs the exact versions already pinned in `package.json`) and waits. No chained command. The User runs it and pastes the output. Kiro keeps `package-lock.json`.
    - _Requirements: 2.1, 2.8, 2.9_

- [x] 3. Constants consistency test
  - [x] 3.1 Write `test/logic/constants.test.ts`
    - `BAKE_FPS` = 240, `BAKED_LAP_FRAMES` = 1920, `LAP_SECONDS` = 8, `SENSOR_HEIGHT_MM` = 20.25, `FRAME_INTERVAL_MS` = 1000/30 (hand-written numbers).
    - Thresholds: -10 < 10 < 60 and 35 < 70. Ranges: `SHOT_LENGTH_MIN` < `SHOT_LENGTH_DEFAULT` < `SHOT_LENGTH_MAX`; `CAMERA_RADIUS_MIN` < `CAMERA_RADIUS_MAX`; `CAMERA_HEIGHT_MIN` < `CAMERA_HEIGHT_MAX`; `ROAD_POINTS_MIN` < `DEFAULT_ROAD_POINT_COUNT` < `ROAD_POINTS_MAX`. `CAMERA_IDS` has `MAX_CAMERAS` entries. Camera forward and up axes lie on different axes; car forward and up axes lie on different axes.
    - The User runs `npm.cmd test` (expected: this file passes; report the counts).
    - Source line it should catch: change `BAKE_OVERSAMPLE` from 8 to 4, or `SENSOR_WIDTH_MM` from 36 to 35.
    - _Requirements: 4.3, 5.5, 6.4, 8.8, 3.13, 23.2 (design Named constants)_

### Phase 0: Spike (stop and ask the User if S1 to S5 fails; record results in docs/build-notes.md)

- [x] 4. Default Road points
  - [x] 4.1 Add the default Road points
    - New file `src/logic/default-road.ts` (data only): 12 points, all with y = `SUBJECT_CENTRE_HEIGHT`, closed, about 120 m long, no bend tighter than about 8 m radius, no two consecutive points equal (including last to first). Hand-place the points on a smooth loop and write the coordinates in the file.
    - _Requirements: 3.11, 3.12 (design Property 13a)_
  - [x] 4.2 Write the default Road tests
    - Count is 12 (`DEFAULT_ROAD_POINT_COUNT`). Every y equals `SUBJECT_CENTRE_HEIGHT`. No two consecutive points are equal.
    - Length from `createCurve` and `createArcLengthTable` is printed and lies within 110 to 130 m.
    - Minimum bend radius from the points: for every three consecutive points (wrapping round), the radius of the circle through them is at least 8 m. The radius formula is written by hand in the test (side lengths a, b, c; area from the cross product; R = abc / 4 area).
    - Source line it should catch: move one point so two points sit 2 m apart at a sharp turn, or change one y value.
    - _Requirements: 3.11, 3.12 (design Property 13a)_

- [x] 5. Frame_Remap
  - [x] 5.1 Implement `src/logic/frame-remap.ts`
    - `remapDisplayedFrame(displayedFrame, lapFrames, bakedLapFrames, easeAmplitude)` as in the design: `u = (f mod lap) / lap` (remainder first), `s = u + A sin(2 pi u) / (2 pi)`, `b = min(round(s * baked), baked - 1)`. Pure. A value that is not a whole number of 0 or more throws an Error that names the value.
    - _Requirements: 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.17_
  - [x] 5.2 Write the Frame_Remap tests
    - Worked table (hand-written): f = 0, 1, 60, 120, 239, 240, 241, 599 give 0, 12, 633, 960, 1908, 0, 12, 956.
    - Sweep f = 0 to 599: called twice gives the same value; whole number; inside 0 to 1919; non-decreasing inside each 240-frame lap; at least two different step sizes occur. Throws naming the value for -1, 1.5, NaN, Infinity and -0.5.
    - Source line it should catch: remove the `min(..., baked - 1)` guard or take `(f / lap) mod 1` instead of the remainder first (the table fails at f = 240).
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.9, 3.17, 23.16 (design Property 6)_

- [x] 6. Spike S1: constant spacing and the remap
  - [x] 6.1 Write the S1 test, part (a) and part (b), with the spacing measured and printed
    - File `test/spike/s1.test.ts`, scene built inline through `src/logic/pathkit.ts`: the default Road, one entity `subject` (forward +Z, up +Y) with `followPath` (speed = road length / `LAP_SECONDS`, `alignToPath` true), fps `BAKE_FPS`, frameCount `BAKED_LAP_FRAMES`. `validateScene` passes. The baked data is read back with `evaluateEntity`.
    - Part (a): the distance between consecutive baked positions over all 1920 frames is measured. The largest relative deviation from the mean is printed. For now the test asserts only that every step is above 0 (the tolerance comes in 6.3).
    - Part (b): for displayed frames 0 to 599 the remapped baked frame is whole and inside 0 to 1919. Over one lap (displayed frames 0 to 240), the largest distance between the baked positions picked for consecutive displayed frames divided by the smallest is above 2. Hand check: the ideal steps are about 12 baked frames near f = 0 and about 4 near f = 120, a ratio of 3; rounding moves each step by at most one baked frame, so the worst case is 11 / 5 = 2.2. With `EASE_AMPLITUDE` 0 every step is 8 baked frames and the ratio is about 1, so a plain "not all equal" check would not catch it.
    - Source line it should catch: set `EASE_AMPLITUDE` to 0 in `constants.ts` (part b then finds equal steps and fails).
    - _Requirements: 22.2, 22.3, 22.4, 3.18, 23.10 (design Property 6)_
  - [x] 6.2 User checkpoint: record the measured deviation
    - The User runs `npm.cmd test` and pastes the output with the printed deviation. Kiro records the value in the build notes and proposes a tolerance. The User agrees or changes it. If the deviation looks wrong, stop and ask.
    - _Requirements: 22.3, 22.12_
  - [x] 6.3 Add the agreed tolerance to the S1 test
    - Assert that every baked step is within the agreed tolerance of the mean step, and that the sum of all 1920 steps (including frame 1919 back to frame 0) equals the Road length within the agreed tolerance. Write the numbers in the test with a comment giving the measured values and the date.
    - The User runs `npm.cmd test` (expected: S1 passes).
    - Source line it should catch: change `LAP_SECONDS` in `constants.ts` from 8 to 4 (the speed doubles and the sum of the steps becomes twice the Road length).
    - _Requirements: 22.3 (design Property 6)_

- [x] 7. Spike S2: keyframed target and aimAt
  - [x] 7.1 Write the S2 test
    - File `test/spike/s2.test.ts`, scene inline: bake the subject as in S1. For displayed frames 0 to 59 build a keyframed target (frame, position) by hand from the baked position at the remapped frame. A camera entity (forward -Z, up +Y) with `aimAt` on that target at a fixed position (0, 5, 0), fps 30, frameCount 60. `validateScene` passes; bake succeeds.
    - For every frame, the camera's forward vector (the -Z axis rotated by the baked quaternion, using `rotateVec`) matches the unit direction from the camera to the target position within 1e-9 (compare vectors, not raw quaternion components).
    - Target has exactly 60 keyframes with frames 0 to 59 in order.
    - Source line it should catch: use the baked position at displayed frame f instead of the remapped baked frame when building the keyframes.
    - _Requirements: 22.5, 8.11 (design Property 9)_

- [x] 8. Spike S3: orbitAround with speed 0 and a keyframed target
  - [x] 8.1 Write the S3 test
    - File `test/spike/s3.test.ts`, scene inline: a keyframed target moving along a straight line, and a camera with `orbitAround` (axis +Y, radius 8, speed 0, `startAngle` 30) on that target.
    - For every frame, camera minus target equals (8 sin 30 deg, 0, 8 cos 30 deg) = (4, 0, 6.9282032) within 1e-9 (hand-written numbers), and the camera position changes as the target moves.
    - Source line it should catch: set `speed` to 10 in the scene (the offset then changes with the frame).
    - _Requirements: 22.6, 7.6 (design Property 11)_

- [x] 9. Spike S4: two targets, height and aim
  - [x] 9.1 Write the S4 test
    - File `test/spike/s4.test.ts`, scene inline: a `subject` keyframed target on a straight line, and a `centre` target equal to it shifted by (0, h, 0). One camera: `orbitAround` order 0 on `centre` (radius r, axis +Y, speed 0), then `aimAt` order 1 on `subject`. Cases (h, r): (1.5, 8), (-0.3, 12), (0, 5), (40, 60), (-0.5, 3).
    - For every case and frame: camera y = subject y + h within 1e-9; horizontal distance to the subject = r within 1e-9; elevation atan2(h, r) in degrees matches hand-written values (10.6197, -1.4321, 0, 33.6901, -9.4623 degrees, each within 1e-3); the camera's forward vector points at the true subject position within 1e-9.
    - Include one wrong-target scene (aimAt on `centre`): for h = 1.5 its forward vector is level (y component 0) and the test checks that it differs from the correct one, so the check has teeth.
    - Source line it should catch: point `aimAt` at `centre` instead of `subject`, or `orbitAround` at `subject` instead of `centre`.
    - _Requirements: 22.7, 5.9, 7.7, 8.14 (design Property 11)_

- [x] 10. Spike S5: bake time for the subject plus six cameras
  - [x] 10.1 Write the S5 test
    - File `test/spike/s5.test.ts`, scene inline: the subject bake (1920 frames at 240 fps) and one camera scene with six orbiting cameras (`cam-1` to `cam-6`) at 240 frames, each with `orbitAround` then `aimAt`. Measure with a clock around the two `bake` calls. Print the time and `S5_TARGET_MS`. Assert that the bakes succeed and that the baked camera scene has exactly six entities with the ids `cam-1` to `cam-6` in that order. Never assert the time.
    - Source line it should catch: bake only five cameras (the test that counts six entities in the baked scene fails).
    - _Requirements: 22.8, 7.1 (design Property 12)_
  - [x] 10.2 User checkpoint: report the bake time
    - The User runs `npm.cmd test` and pastes the output with the printed time. Kiro records it in the build notes and says whether it is under 100 ms. No failure on timing.
    - _Requirements: 22.8_

- [x] 11. Spike S6: one scene or two
  - [x] 11.1 Write the S6 test
    - File `test/spike/s6.test.ts`, scene inline: a combined scene with one rail camera (`followPath` order 0, `alignToPath` false, then `aimAt` order 1) plus three orbiting cameras, with a two-point open rail path. The same cameras baked alone (rail camera alone with the rail; the three orbit cameras together with `PLACEHOLDER_PATH`).
    - For every camera and every frame, all 7 baked values (3 position, 4 rotation) in the combined bake equal the separate bake within 1e-9. Counts per camera are printed.
    - The test prints "S6 Outcome A" when all match. On a mismatch it fails with the camera, frame and component, and Kiro uses Outcome B (no question to the User).
    - Source line it should catch: give two cameras the same target name with different keyframes in the combined scene (the comparison fails).
    - _Requirements: 22.9, 22.10 (design Property 12)_
  - [x] 11.2 User checkpoint: record the S6 outcome
    - The User runs `npm.cmd test` and pastes the output. Kiro writes Outcome A or Outcome B, with the measured result, in the build notes. The recorded outcome is hard-coded in Task 22. If the test fails, Outcome B applies without asking.
    - _Requirements: 22.10, 22.11, 8.13_

- [x] 12. Lap seam check (KI-11 regression)
  - [x] 12.1 Write the seam test
    - File `test/spike/lap-seam.test.ts`, scene inline.
    - (a) Default Road, one-lap bake as in S1: the angle between the rotation at baked frame 1919 and baked frame 0 (`quatAngle` of `quatInverse(a)` times `b`) is at most 2 degrees.
    - (b) A twisted closed 3D loop (a 3D figure-eight with points of different y, hand-written, at least 8 points), baked directly with `bake` and bypassing Road validation (test only): the same angle is above 40 degrees.
    - Source line it should catch: give one default Road point a different y (part a fails); or make the figure-eight flat (part b fails).
    - _Requirements: 3.11, 3.4 (design Property 13)_

- [x] 13. Checkpoint: Phase 0 spike
  - Ensure all tests pass, ask the user if questions arise. The User runs `npm.cmd test` and pastes the output. Kiro reports the counts and the recorded results (S1 deviation, S5 time, S6 outcome).

### Phase 1: Pure logic (pure, tested)

- [x] 14. Lens_Module
  - [x] 14.1 Implement `src/logic/lens.ts`
    - `fieldOfViewForFocalLengthMm`: horizontal 2 atan(18 / f), vertical 2 atan(10.125 / f), work in radians, convert to degrees at the output. A value that is 0 or less, or not finite, throws an Error that names the value.
    - _Requirements: 4.1, 4.2, 4.4, 4.6, 4.7, 4.8, 4.9_
  - [x] 14.2 Write the lens tests
    - Table to 1 decimal place (hand-written): 24 mm 73.7 / 45.7, 35 mm 54.4 / 32.3, 50 mm 39.6 / 22.9, 85 mm 23.9 / 13.6. The unrounded 24 mm vertical value is 45.747 (within 0.001) and is not 45.75.
    - Throws naming the value for 0, -1, -0.001, NaN, Infinity. Same input gives the same output.
    - Source line it should catch: use 20 instead of 20.25 for the sensor height in the vertical formula (24 mm vertical becomes 45.2 and fails).
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 4.7, 23.4, 23.5 (design Property 1, 2)_

- [x] 15. Label_Module
  - [x] 15.1 Implement `src/logic/labels.ts`
    - `angleLabel` and `framingLabel` using the named thresholds from `constants.ts`. Overhead takes precedence over high angle. `framingLabel` throws naming the value when the input is not finite or outside 0 to 100.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.8_
  - [x] 15.2 Write the label tests
    - Elevation table: -10.1, -10, -9.9, 9.9, 10, 10.1, 59.9, 60, 60.1 give low angle, eye level, eye level, eye level, eye level, high angle, high angle, high angle, overhead.
    - Fill table: 34.9, 35, 35.1, 69.9, 70, 70.1 give wide, medium, medium, medium, medium, close-up. Fill of -0.1, 100.1, NaN, Infinity throws naming the value; 0 and 100 are accepted.
    - Source line it should catch: change `<= 10` to `< 10` for the eye-level upper bound.
    - _Requirements: 5.1 to 5.4, 6.1 to 6.3, 6.8, 23.6 (design Property 3)_

- [x] 16. Fill_Fraction
  - [x] 16.1 Implement `src/logic/fill.ts`
    - `subjectBoxCorners`, `projectToNdc`, `fillFractionPercent` and `framingPercent` as in the design. All write into caller-supplied buffers and allocate nothing per call. A non-finite coordinate or a count below 1 throws an Error that names the index and value. A point behind the camera makes `projectToNdc` return false and `framingPercent` return 100.
    - _Requirements: 6.6, 6.7, 6.8, 11.11_
  - [x] 16.2 Write the Fill_Fraction tests
    - Three NDC cases: height decides (x -0.2 to 0.2, y -0.5 to 0.5) gives 50 (medium); width decides (x -0.9 to 0.9, y -0.1 to 0.1) gives 90 (close-up); partly outside (x -1.5 to 0.5, y -0.2 to 0.2) gives 75.
    - Realistic pose: camera at (0, 0, 10), identity rotation, 50 mm lens, aspect 16/9, box at the origin with half-extents (0.9, 0.7, 2.2): all 8 corners match the design table to 5 decimals (for example (-0.320513, -0.443178) for corner 1 and (-0.204918, -0.283344) for corner 5), and the result is 44.3 to 1 decimal place, medium.
    - Behind the camera: a corner at z = 12 gives false and `framingPercent` returns 100. Throws for NaN and for count 0.
    - Source line it should catch: use `min(w, h)` instead of `max(w, h)` (the height-decides case fails), or drop the behind-camera short-circuit.
    - _Requirements: 6.6, 6.7, 6.8, 23.19 (design Property 4)_

- [x] 17. Frame_Mapper
  - [x] 17.1 Implement `src/logic/frame-mapper.ts`
    - `scrubToFrame` (clamp first, then round, return no -0), `frameToSeconds`, `secondsToFrame`. A scrub value that is not finite throws an Error that names the value.
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6_
  - [x] 17.2 Write the Frame_Mapper tests
    - Scrub table with lastFrame 239: -5, -0.4, -0, 0, 0.4, 238.5, 239, 239.5, 244 give 0, 0, 0, 0, 0, 239, 239, 239, 239 (hand-checked: 238.5 rounds to 239). Every result is whole and `Object.is(result, -0)` is false. NaN, Infinity, -Infinity throw naming the value.
    - Every whole frame 0 to 600: `secondsToFrame(frameToSeconds(f, 30), 30)` equals f.
    - Source line it should catch: round before clamping, or return `Math.round(x)` without adding 0 (the -0 check fails).
    - _Requirements: 11.3, 11.4, 11.5, 11.6, 23.7 (design Property 5)_

- [x] 18. Road validation
  - [x] 18.1 Implement `src/logic/road-validation.ts`
    - `validateRoad(points)` returns the road or a message. Refuses fewer than 3 or more than 100 points with a message that names the count and the range 3 to 100; refuses points whose y differ; refuses coincident consecutive points (including last to first). Wraps nothing from `createCurve` that it can check first.
    - _Requirements: 3.11, 3.13_
  - [x] 18.2 Write the Road validation tests
    - Flat, non-coincident closed candidates with 2, 3, 100, 101 points: 2 and 101 refused with the count and "3" and "100" in the message; 3 and 100 accepted. A flat road with one duplicated consecutive point is refused. A road with one point at a different y is refused.
    - Source line it should catch: change `> 100` to `>= 100` in the maximum check (the 100-point case fails).
    - _Requirements: 3.11, 3.13, 23.17 (design Property 7)_

- [x] 19. Shot_Length validation
  - [x] 19.1 Implement `src/logic/shot-length.ts`
    - `validateShotLength(value)`: whole number from 60 to 600, otherwise a message that states the range 60 to 600.
    - _Requirements: 8.8, 8.9_
  - [x] 19.2 Write the Shot_Length tests
    - 59 and 601 refused with the range in the message; 60, 240, 600 accepted. 240.5, NaN and Infinity refused.
    - Source line it should catch: change `SHOT_LENGTH_MAX` use to `<` instead of `<=` (600 fails).
    - _Requirements: 8.8, 8.9, 23.18 (design Property 8)_

- [x] 20. Target_Converter (after S2)
  - [x] 20.1 Implement `src/logic/target-converter.ts`
    - `buildKeyframedTarget` as in the design: exactly one keyframe per displayed frame, each equal to the baked position at the baked frame the remap picks, shifted by (0, heightOffsetM, 0). Pure; allocation is allowed here (setup code).
    - _Requirements: 8.11, 8.14, 3.4_
  - [x] 20.2 Write the Target_Converter tests
    - Small baked fixture (a straight-line subject, hand-written positions) and a hand-written remap table. For every displayed frame: exactly one keyframe at that frame index; its position equals the baked position at the table's baked frame; with a height offset of 1.5 the y is exactly 1.5 higher and x and z are equal. Offsets 0, 1.5, -0.3, 40.
    - Source line it should catch: read the baked frame f instead of remap(f), or forget the height shift.
    - _Requirements: 8.11, 8.14, 23.9 (design Property 9)_

- [x] 21. Shot_Builders (after S3 and S4)
  - [x] 21.1 Implement `src/logic/shot-builders.ts`
    - `buildCameraScene` for tracking, orbit, push-in and crane as in the design's table. Constraint order: `orbitAround` (or `followPath`) at order 0, `aimAt` at order 1. Orbit speed = `ORBIT_SWEEP_DEG` / (shot length / `FRAME_RATE`). Rails: push-in end at `PUSH_IN_END_RATIO` of the start offset; crane rises `CRANE_RISE_M`. Rail speed = rail length times `FRAME_RATE` / shot length, so `path-end-reached` never fires on a visible frame. Camera axes come from `constants.ts`.
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.14, 7.6, 7.7_
  - [x] 21.2 Write the Shot_Builder tests
    - For each of the 4 types: `validateScene` does not throw; exact entity id and exact constraint list in order (`orbitAround`, `aimAt` or `followPath`, `aimAt`), orders strictly increasing; camera forward -Z and up +Y.
    - Rail speed: for push-in and crane at lengths 60, 240, 600, the baked rail travelled distance at the last frame is below the rail length (hand-written: length times (N-1)/N), and `motionLinter` returns no `path-end-reached` finding.
    - Orbit: the angle at the last frame minus the start is 180 degrees times (N-1)/N within 1e-9.
    - Source line it should catch: swap the `order` values of `orbitAround` and `aimAt`, or use `railLength * FRAME_RATE / (N - 1)` for the speed (the no-finding check fails).
    - _Requirements: 8.2 to 8.7, 8.14, 23.8 (design Property 10, 11)_

- [x] 22. Scene_Set (after S6; the recorded outcome is hard-coded)
  - [x] 22.1 Implement `src/logic/scene-set.ts`
    - `buildSceneSet` with the S6 outcome recorded in Task 11.2 written in as a constant (not tested at runtime). Outcome A: one scene with every camera. Outcome B: scene 1 with the Main_Camera alone, scene 2 with the others. Write the outcome and the reason in a comment.
    - _Requirements: 8.10, 8.13, 22.10_
  - [x] 22.2 Write the Scene_Set tests (the S6 regression)
    - Three cameras plus one rail camera: the set has 1 scene (Outcome A) or 2 scenes (Outcome B) as recorded; every camera id appears exactly once; the Main_Camera is in scene 1 for Outcome B; every scene passes `validateScene`.
    - For every camera and frame, all 7 baked values from the set equal a separate solo bake within 1e-9.
    - Source line it should catch: add a camera to both scenes, or drop `cam-3` from the set.
    - _Requirements: 8.10, 8.13, 22.9, 22.10 (design Property 12)_

- [x] 23. Finding words
  - [x] 23.1 Implement `src/logic/findings.ts`
    - Plain-words table from the design for the five codes (`path-end-reached`, `rotation-conflict`, `aim-vertical`, `speed-spike`, `roll-change`): severity text, wording, one-line explanation. An unknown code falls back to the finding's own message. An empty list gives a message that says no problems were found and that the check is rough.
    - _Requirements: 9.2, 9.5, 9.6, 9.7_
  - [x] 23.2 Write the findings tests
    - The five codes give exactly the design wording and a severity text label ("Note" or "Warning"); an unknown code gives its own message; an empty list gives the no-problems text containing "rough".
    - Source line it should catch: swap the wording of `speed-spike` and `roll-change`.
    - _Requirements: 9.2, 9.5, 9.7 (design Plain-words findings table)_

- [x] 24. Contrast function
  - [x] 24.1 Implement `src/logic/contrast.ts`
    - `contrastRatio(fg, bg)` with the WCAG relative-luminance formula. Palette pairs come in Task 47.
    - _Requirements: 19.2_
  - [x] 24.2 Write the contrast function tests
    - Hand-written: black on white gives 21 (within 1e-9); white on white gives 1; #777777 on white gives about 4.48 (within 0.01, so below 4.5); #767676 on white gives about 4.54 (above 4.5). The order of the two colours does not change the result.
    - Source line it should catch: use 0.04045 as 0.4045 in the linearisation threshold, or drop the +0.05 terms.
    - _Requirements: 19.2 (design Property 14, function part)_

- [x] 25. Storage wrapper
  - [x] 25.1 Implement `src/logic/storage.ts`
    - `readSetting` and `writeSetting`, every access inside try/catch, keys prefixed with `STORAGE_KEY_PREFIX` (`shot-rail:`). Takes the storage object as a parameter with the browser one as default, so tests pass a mock.
    - _Requirements: 20.1, 20.2, 20.3_
  - [x] 25.2 Write the storage tests
    - Four failure modes with a mock: `getItem` throws; `setItem` throws; the storage object is missing; the stored text is not valid JSON. `readSetting` returns the fallback in each; `writeSetting` does not throw. A working mock round trip stores under `shot-rail:` plus the key.
    - Source line it should catch: remove the try/catch around `setItem`.
    - _Requirements: 20.1, 20.2, 20.3 (design Property 15)_

- [x] 26. Integration: the three sample shots
  - [x] 26.1 Write `test/logic/samples-integration.test.ts`
    - Define the three samples in `src/logic/samples.ts` first (values from the design's Samples table: orbit around the car; push-in from a low camera; crane up), each a `RigSettings`-shaped value with shot length 240. Each goes through the subject bake, `buildKeyframedTarget`, `buildSceneSet`, `bake`, `motionLinter`, and every scene passes `validateScene`.
    - Each sample's main camera evaluates at frames 0, 120 and 239 without throwing; the linter returns an array; a count of findings is printed.
    - Each sample's values lie inside the allowed ranges from `constants.ts`: horizontal distance 3 to 60 m, height -0.5 to 40 m, lens in `LENS_PRESETS_MM`, shot length 60 to 600 (checked with plain comparisons naming the sample and the field).
    - Source line it should catch: set one sample's `horizontalDistanceM` to 0 (the build throws or the radius check fails), or set a shot length of 59.
    - _Requirements: 10.2, 10.5, 8.6, 9.1 (design Testing Strategy, integration)_

- [x] 27. Checkpoint: Phase 1
  - Ensure all tests pass, ask the user if questions arise. The User runs `npm.cmd test` and pastes the output. Kiro reports the counts.

### Phase 2: Stage and views (each item is its own task with its own User checkpoint)

- [x] 28. CameraRig
  - [x] 28.1 Implement `src/view/camera-rig.ts`
    - Bake scheduling: a dirty flag; at most one re-bake per animation frame (changes in the same frame coalesce); the subject bake is cached and redone only when the subject kind or the Road changes. A re-bake never starts playback. Builds the Scene_Set, bakes each scene, runs `motionLinter` and keeps only the findings for the main camera. Errors from `bake`, `validateScene` or `motionLinter` are caught and returned as the plain messages in the design's Error Handling table.
    - `evaluate(cameraId, displayedFrame, out)` calls `evaluateEntity` only and writes into the caller's buffer. No object, array or closure is created per call.
    - The scheduler logic is a small pure function or class with no DOM, so it can be tested in Node.
    - _Requirements: 8.10, 8.12, 8.15, 9.1, 9.8, 11.10, 11.11, 11.14_
  - [x] 28.2 Write the CameraRig tests
    - Five `markDirty` calls in one animation frame give one bake. A camera-only change does not rebake the subject; a Road change does. After a bake the reported play state is paused and the frame is unchanged. `evaluate` returns the same buffer object it was given, for 1000 calls. A thrown error inside the bake comes back as a message that names what failed and what to do next. `motionLinter` findings for other cameras are dropped.
    - Source line it should catch: bake inside `markDirty` instead of at the frame tick, or create a new output object inside `evaluate`.
    - _Requirements: 8.12, 8.15, 9.1, 9.8, 11.10, 11.11, 11.14 (design Re-bake scheduling)_

- [x] 29. Main renderer and camera
  - [x] 29.1 Implement `src/view/main-view.ts` and wire `index.html`
    - One main `THREE.WebGLRenderer` (pixel ratio capped at `DEVICE_PIXEL_RATIO_CAP`), a `PerspectiveCamera` with aspect 16/9 set before `setFocalLength`, `filmGauge` 36, position and rotation from `evaluateEntity` through `position.set` and `quaternion.set` (no per-frame allocation). Renders on change, not on a free-running loop. A WebGL failure shows a message that says what failed and what the User can do next. The view is empty (a grid at the ground only).
    - _Requirements: 4.5, 11.11, 17.1, 18.6, 20.4_
  - [x] 29.2 User checkpoint: view the empty stage
    - The User opens the app in a browser in their own way (their own terminal, their own choice) and checks: the 16:9 frame, the ground grid, that a changed lens changes the field of view. Kiro states what was not tested.
    - _Requirements: 25.1, 25.2_
  - [x] 29.3 User checkpoint: approve the safe-area size and its source
    - The design names no safe-area size. Kiro searches for a reputable published value (for example a broadcast standard's action-safe or title-safe area), records claim, source and date checked in `docs/sources.md`, and proposes one fraction of the frame. The User approves it before it is written into `constants.ts` as `SAFE_AREA_FRACTION`. Write nothing from memory.
    - _Requirements: 17.8, 24.4_
  - [x] 29.4 Implement the guides
    - Pure `src/logic/guides.ts`: `thirdsLines(width, height)` gives the two vertical lines at 1/3 and 2/3 of the width and the two horizontal lines at 1/3 and 2/3 of the height; `safeAreaRect(width, height, fraction)` gives a centred rectangle of that fraction of each side. A 2D overlay canvas on the main view draws them. Toggles with visible labels, tooltips and the keys T and G; their on or off state is stored as `thirdsGuideOn` and `safeAreaGuideOn` through `storage.ts`.
    - _Requirements: 17.7, 17.8, 18.1, 18.2, 20.1_
  - [x] 29.5 Write the guides tests
    - Hand-written: for 1600 x 900, `thirdsLines` gives x = 533.333 and 1066.667 and y = 300 and 600 (within 1e-3); `safeAreaRect(1600, 900, 0.9)` gives x 80, y 45, width 1440, height 810. Toggling stores the matching key with a mock storage; a storage that throws still toggles the guide.
    - Source line it should catch: use 1/4 instead of 1/3 for the thirds, or forget to centre the safe-area rectangle.
    - _Requirements: 17.7, 17.8, 20.2, 20.3_
  - [x] 29.6 User checkpoint: view the guides
    - The User toggles both guides in a browser in their own way, with the mouse and with T and G. Kiro states what was not tested.
    - _Requirements: 17.7, 17.8, 25.1, 25.2_

- [x] 30. Subject and road drawing
  - [x] 30.1 Implement the car and the road in `src/view/subject-view.ts`
    - Car from boxes and cylinders only, no brand, logo or plate text, drawn offset down by `SUBJECT_CENTRE_HEIGHT` so the entity origin is the box centre. Road mesh at ground level from `ROAD_DRAW_SAMPLES` samples along the curve. The car pose comes from the baked subject at the remapped baked frame.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.12_
  - [x] 30.2 User checkpoint: view the car on the road
    - The User views the car and the road in a browser in their own way and scrubs through frames (without a dev-server request from Kiro). Check the car sits on the road, faces its direction of travel, and speeds up and slows down along a lap. Kiro states what was not tested.
    - _Requirements: 3.4, 3.9, 25.1, 25.2_

- [ ] 31. Stage_Overview
  - [-] 31.1 Implement `src/view/stage-overview.ts`
    - A small top-down view using the shared auxiliary renderer, drawing the car, the road, the camera positions and the camera rails (push-in and crane). After its render the image is copied into its own 2D canvas with `drawImage` before the shared renderer is reused.
    - _Requirements: 17.2_
  - [~] 31.2 User checkpoint: view the Stage_Overview
    - The User views the overview in a browser in their own way. Check the cameras and rails show in the right places. Kiro states what was not tested.
    - _Requirements: 17.2, 25.1, 25.2_

- [ ] 32. Coverage_Grid
  - [~] 32.1 Implement the grid rules in `src/view/coverage-grid-rules.ts` (pure)
    - `shouldRenderGrid(mode, changed, playing, msSinceLast)`: false outside Angle mode; true on change; while playing, true at `PLAYBACK_RATE_GRID` (every 100 ms); false when nothing changed and the Timeline is stopped. `addCamera(count)`: refuses a seventh camera with a message that states the limit of 6. `selectMain(id)`: returns the clicked camera as the Main_Camera.
    - _Requirements: 7.1, 7.5, 7.8, 7.9, 7.10, 7.11_
  - [~] 32.2 Write the grid rules tests
    - Table over mode (Angle, Move) x changed x playing x time (0, 99, 100, 250 ms): the render decision matches a hand-written table. Adding cameras 1 to 6 works; the seventh is refused with "6" in the message and the camera list unchanged. Click on tile 3 selects `cam-3`.
    - Source line it should catch: remove the Angle-mode check, or change the grid refresh interval to 1000 / 30.
    - _Requirements: 7.1, 7.5, 7.8, 7.9, 7.10, 7.11 (design Rendering layer)_
  - [~] 32.3 Implement the grid view in `src/view/coverage-grid.ts`
    - The shared auxiliary renderer draws each tile and copies it into a per-tile 2D canvas, with the Angle_Label and Framing_Label on each tile (text, from `labels.ts` and `fill.ts`). Click or Enter on a tile makes it the Main_Camera. Renders only in Angle mode.
    - _Requirements: 7.1, 7.4, 7.5, 7.8, 7.9, 7.10_
  - [~] 32.4 User checkpoint: view the Coverage_Grid
    - The User views the grid in a browser in their own way: up to six tiles, labels on each tile, click to make main, seventh camera refused. Kiro states what was not tested.
    - _Requirements: 7.1, 7.4, 7.5, 7.11, 25.1, 25.2_

### Phase 3: Modes, timeline and motion check

- [ ] 33. Playback stepping (pure)
  - [~] 33.1 Implement `src/logic/playback.ts`
    - A pure state: `{ playing, frame, accumulatorMs }` and `stepPlayback(state, elapsedMs, lastFrame)` that advances whole frames with an accumulator, caps at `PLAYBACK_MAX_CATCHUP_FRAMES` (drops the backlog), stops at the last frame. The state starts paused at frame 0. Only an explicit `play` action sets `playing`.
    - _Requirements: 11.8, 11.9, 11.13, 11.14_
  - [~] 33.2 Write the playback tests
    - Elapsed 33.34 ms advances 1 frame; 100 ms advances 3; 10 000 ms advances at most 5 and the backlog is dropped; the last frame stops playing; a paused state never moves. Frames are always whole.
    - Table of events that must not start playback: start, load a sample, change mode, change Shot_Type, change Subject, change Shot_Length, re-bake, scrub, keyboard step. Each leaves `playing` false. Only `play` sets it true.
    - Source line it should catch: remove the catch-up cap, or set `playing: true` in the load-sample action.
    - _Requirements: 11.8, 11.9, 11.13, 11.14, 8.15, 10.6 (design Rendering layer)_

- [ ] 34. Timeline UI
  - [~] 34.1 Implement `src/view/timeline.ts`
    - Play, pause, scrub, frame counter, finding marks at the frames of the findings. Play and pause use the pure state from Task 33. The scrub uses `scrubToFrame`. Labels and tooltips on every control. Starts paused at frame 0. Stops at the last frame. While playing it evaluates only and never bakes.
    - _Requirements: 11.7, 11.8, 11.9, 11.10, 11.12, 11.13, 18.1_
  - [~] 34.2 User checkpoint: try the Timeline
    - The User tries play, pause, scrub and the frame counter in a browser in their own way. Check the app opens paused at frame 0 and never starts by itself. Kiro states what was not tested.
    - _Requirements: 11.7, 11.13, 11.14, 25.1, 25.2_

- [ ] 35. Keyboard map (pure first)
  - [~] 35.1 Implement `src/logic/key-map.ts`
    - Pure `actionForKey(key, focusInTextField)` from the design's Keyboard map: Space, Left, Right, Home, End, A, M, 1 to 6, L, S, T, G, C, ?. No action while focus is in a text or number field. Each key is used once.
    - _Requirements: 11.12, 18.2_
  - [~] 35.2 Write the key map tests
    - Every key in the table gives its action (hand-written). Unknown keys give none. Every action appears for exactly one key. Typing "a" or "1" in a number field gives no action.
    - Source line it should catch: map `M` to the same action as `A`, or drop the text-field check.
    - _Requirements: 11.12, 18.2 (design Keyboard map)_

- [ ] 36. Interface layout
  - [~] 36.1 Implement the layout in `index.html` and `src/view/layout.ts`
    - Regions only: the main camera view (16:9, the largest region), the Stage_Overview, the controls column on the left, the readout column on the right, the Timeline at the bottom. Empty regions show a message that says what the User can do next. Plain labels. One-line explanations on hover and on keyboard focus for terms that need them.
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.9, 17.10, 18.5_
  - [~] 36.2 User checkpoint: view the layout
    - The User views the layout in a browser in their own way and reports problems. Kiro states what was not tested.
    - _Requirements: 17.1 to 17.5, 25.1, 25.2_

- [ ] 37. Controls and keyboard wiring
  - [~] 37.1 Implement `src/view/controls.ts`
    - Mode tabs (Angle, Move), camera list (up to 6), bearing, height, horizontal distance, lens presets, Shot_Type, Shot_Length. Each control has a visible text label, a tooltip and its key shown beside it. A non-drag alternative for every drag action (typed number fields and keys). Shot_Length refuses 59 or 601 with the message from Task 19. Changing any setting marks the rig dirty and never starts playback.
    - _Requirements: 7.2, 7.3, 7.12, 8.1, 8.8, 8.9, 8.12, 8.15, 17.3, 18.1, 18.2, 19.7_
  - [~] 37.2 Wire the keys in `src/view/keyboard.ts`
    - Attach one `keydown` handler that calls `actionForKey` and dispatches the action. Show the key beside each control.
    - _Requirements: 11.12, 18.2_
  - [~] 37.3 User checkpoint: try the controls
    - The User tries the controls and the keys in a browser in their own way and reports problems. Check typed values work as an alternative to dragging. Kiro states what was not tested.
    - _Requirements: 7.12, 18.2, 19.7, 25.1, 25.2_

- [ ] 38. Readout
  - [~] 38.1 Implement `src/view/readout.ts`
    - Angle_Label, Framing_Label, horizontal and vertical field of view, Straight_Line_Distance (read-only), each with a text label. Each threshold is shown next to its label and described as this app's own cut-offs (wording and hover lines from src/logic/term-text.ts). The angle effect notes, if any, are marked "commonly said" and each has its source in `docs/sources.md`; with no source found, no note is shown. Elevation uses the true subject position.
    - _Requirements: 5.6, 5.7, 5.8, 6.5, 7.3, 7.4, 17.4_
  - [~] 38.2 User checkpoint: view the readout and approve any angle notes
    - The User views the readout in a browser in their own way and approves every "commonly said" note and its source before it is kept. Kiro states what was not tested.
    - _Requirements: 5.8, 24.4, 25.1_

- [ ] 39. Motion check list
  - [~] 39.1 Implement `src/logic/motion-check-model.ts` (pure) and `src/view/motion-check.ts`
    - Pure model: findings to rows (wording, one-line explanation, text severity label, frame); activating a row returns that frame; empty list and error states give their messages. The view lists the rows as buttons that work with Enter and Space, uses the amber accent for warnings together with the text label, and moves the Timeline to the frame.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_
  - [~] 39.2 Write the motion check model tests
    - Two findings at frames 10 and 200 give two rows with the right words and the label "Warning" or "Note"; activating row 2 returns 200; an empty list gives the no-problems row; an error gives a row with "what failed" and "what to do".
    - Source line it should catch: return the row index instead of the finding frame, or omit the text severity label.
    - _Requirements: 9.2, 9.3, 9.5, 9.7, 9.8_
  - [~] 39.3 User checkpoint: try the Motion_Check
    - The User tries the list, activates a finding with the mouse and the keyboard, and checks the empty state. Kiro states what was not tested.
    - _Requirements: 9.3, 9.4, 25.1, 25.2_

- [ ] 40. Sample shots loading
  - [~] 40.1 Implement loading in `src/view/samples-menu.ts`
    - The first sample loads at start, paused at frame 0. Selecting a sample replaces the current shot within one frame update and leaves the Timeline paused.
    - _Requirements: 10.1, 10.2, 10.3, 10.6, 11.13_
  - [~] 40.2 Write the loading tests
    - Start state: first sample loaded, `playing` false, frame 0. Loading each of the three samples leaves `playing` false and frame 0, even when the state was playing at frame 100 before the load (that case is forced). The settings after load equal the hand-written sample values.
    - Source line it should catch: keep the old frame number on load, or start playing after load.
    - _Requirements: 10.1, 10.3, 10.6, 11.14_
  - [~] 40.3 User checkpoint: first-use check
    - The User opens the app and checks that a visible result appears within about ten seconds and that the three samples load. Kiro states what was not tested.
    - _Requirements: 10.4, 25.1, 25.2_

- [ ] 41. First-time hints
  - [~] 41.1 Implement `src/view/hints.ts`
    - One-line hint the first time Angle mode and Move mode open. Dismissing stores `hintSeenAngle` or `hintSeenMove` through `storage.ts`.
    - _Requirements: 18.3, 18.4, 20.1_
  - [~] 41.2 Write the hint tests
    - With a mock storage: first open shows the hint; after dismiss, the flag is stored and the second open shows none; a storage that throws still shows the hint the first time and does not block use.
    - Source line it should catch: store the flag under the wrong key, or never store it.
    - _Requirements: 18.3, 18.4, 20.3_

- [ ] 42. About_Panel
  - [~] 42.1 Implement `src/view/about-panel.ts`
    - Reachable from the main screen. Text states: the subject is a stand-in drawn from shapes and there is no lighting, exposure or depth-of-field simulation; angles are measured from the world axes, not from the car's heading; PathKit allows one path per scene, so subject and cameras are baked in separate scenes (and the Main_Camera has its own scene if S6 required it, per the recorded outcome); the lens maths assumes a 36 mm sensor; the app is rough planning, not a prediction of real footage; rail cameras (push-in and crane) move along a fixed rail, do not follow the car and only aim at it.
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.7, 21.8_
  - [~] 42.2 Write the About_Panel text tests
    - The text exported from the module contains each of the six statements (checked by a hand-written key phrase per statement, including "fixed rail" and "do not follow").
    - Source line it should catch: delete the rail-camera sentence.
    - _Requirements: 21.1 to 21.5, 21.8_
  - [~] 42.3 User checkpoint: approve the About text
    - The User reads the text and approves it before it ships.
    - _Requirements: 21.5, 25.1_

- [~] 43. Checkpoint: P1 complete
  - Ensure all tests pass, ask the user if questions arise. The User runs `npm.cmd test` and pastes the output. Kiro reports the counts.

### Phase P2: Extra features (regular tasks, after the P1 checkpoint)

- [ ] 44. Shot_Strip
  - [~] 44.1 Implement the picker in `src/logic/strip-frames.ts` (pure)
    - `stripFrames(shotLength)`: six whole frame numbers from 0 to `shotLength - 1`, increasing, spread evenly, distinct for every length 60 to 600.
    - _Requirements: 12.2, 12.6_
  - [~] 44.2 Write the picker tests
    - For every length 60 to 600: six values, whole, strictly increasing, first 0, last `length - 1`. Hand-written: length 60 gives 0, 12, 24, 35, 47, 59; length 240 gives 0, 48, 96, 143, 191, 239.
    - Source line it should catch: use `round(k * length / 5)` so the last value is the shot length (out of range).
    - _Requirements: 12.2, 12.6_
  - [~] 44.3 Implement the strip view in `src/view/shot-strip.ts`
    - Six pictures from the shared auxiliary renderer into per-picture 2D canvases, each labelled with its frame number; activating one moves the Timeline there; redraws when the shot changes.
    - _Requirements: 12.1, 12.3, 12.4, 12.5_
  - [~] 44.4 User checkpoint: view the Shot_Strip
    - The User views the strip in a browser in their own way. Kiro states what was not tested.
    - _Requirements: 12.1, 12.4, 25.1, 25.2_

- [ ] 45. Capture
  - [~] 45.1 Implement `src/view/capture.ts` and `src/logic/capture-name.ts`
    - Pure file name from the shot name and frame (for example `shot-orbit-around-the-car-frame-0120.png`, characters other than letters, digits and hyphens replaced). The view uses the canvas `toBlob` and a plain download link, no library and no network request. A failure shows a message that says what failed and what to do next.
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  - [~] 45.2 Write the file name tests
    - "Orbit around the car", frame 120 gives `shot-orbit-around-the-car-frame-0120.png`; frame 0 gives `...-frame-0000.png`; a name with `/`, `:` and spaces gives only allowed characters; an empty name gives `shot-frame-0120.png`.
    - Source line it should catch: remove the character replacement.
    - _Requirements: 13.3_
  - [~] 45.3 User checkpoint: try Capture
    - The User captures a frame in a browser in their own way and checks the file name and the picture. Kiro states that the PNG download was not tested.
    - _Requirements: 13.1, 13.4, 25.1, 25.2_

- [ ] 46. Walking figure stand-in
  - [~] 46.1 User checkpoint: approve the figure size
    - The design gives no figure dimensions. Kiro proposes half-extents and a centre height (for example 0.25 / 0.9 / 0.2 and 0.9 m) and a Road speed; the User approves or changes them before they are written in `constants.ts`.
    - _Requirements: 14.1, 14.3_
  - [~] 46.2 Implement the figure
    - Drawn from capsules, with the text "stand-in" next to it in the interface. A `subjectKind` switch between car and figure. No walking animation. Axes declared on the entity. Switching Subject re-bakes the subject and the cameras and leaves the Timeline paused.
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 3.16_
  - [~] 46.3 Write the Subject switch tests
    - Switching car to figure and back marks the rig dirty, rebakes the subject, and leaves `playing` false and the frame unchanged (forced from a playing state at frame 100). The figure entity declares its own forward and up axes on different axes.
    - Source line it should catch: start playing after the switch, or hard-code the car's axes for the figure.
    - _Requirements: 14.5, 11.14, 3.16_
  - [~] 46.4 User checkpoint: view the figure
    - The User views the figure in a browser in their own way. Kiro states what was not tested.
    - _Requirements: 14.1, 14.2, 25.1, 25.2_

### Phase 4: Design pass (about a third of the work)

- [ ] 47. Palette and contrast
  - [~] 47.1 Define the palette in `src/view/palette.ts`
    - Dark "previz desk" colours as named pairs (text, background) for every text use, with one warm amber accent reserved for warnings. The CSS reads the same values.
    - _Requirements: 17.6, 19.1_
  - [~] 47.2 Write the palette contrast test
    - Every declared text and background pair has a ratio of at least `CONTRAST_MIN_RATIO` (4.5). The amber on its background is included. The test names the pair on failure.
    - Source line it should catch: lighten a background colour so one pair falls below 4.5.
    - _Requirements: 19.1, 19.2 (design Property 14)_

- [ ] 48. Focus rings and colour-free meaning
  - [~] 48.1 Add focus rings and text labels
    - A visible focus ring on every focusable control. Severity, mode and selection are shown with text or shape as well as colour.
    - _Requirements: 19.3, 19.4, 9.5_
  - [~] 48.2 Write the stylesheet check
    - The test reads `src/view/styles.css` as text: it contains a `:focus-visible` rule with an outline, and no `outline: none` without a replacement; each severity label text appears in `motion-check.ts`.
    - Source line it should catch: delete the `:focus-visible` rule.
    - _Requirements: 19.3, 19.4_
  - [~] 48.3 User checkpoint: keyboard-only walkthrough
    - The User does a keyboard-only walkthrough and reports any control without a visible focus ring. Kiro states what was not tested.
    - _Requirements: 19.3, 18.2, 25.1_

- [ ] 49. Reduced motion
  - [~] 49.1 Implement `src/logic/motion-preference.ts` and wire it
    - Pure `transitionMs(base, reduced)` gives 0 when reduced. Interface transitions (mode switch, panel open and close) use it, and the CSS has a `prefers-reduced-motion: reduce` rule. The Frame_Remap and playback speed do not read it.
    - _Requirements: 19.5, 19.6, 3.4_
  - [~] 49.2 Write the reduced-motion tests
    - `transitionMs(200, true)` is 0 and `transitionMs(200, false)` is 200. The remap table of Task 5 gives the same values whether reduced is true or false (the remap function takes no such argument).
    - Source line it should catch: make `transitionMs` ignore `reduced`.
    - _Requirements: 19.5, 19.6_
  - [~] 49.3 User checkpoint: try reduced motion
    - The User turns on the system reduced-motion setting and checks that interface changes jump while the car's speed pattern stays the same. Kiro states what was not tested.
    - _Requirements: 19.5, 19.6, 25.1_

- [ ] 50. Visual polish rounds
  - [~] 50.1 User checkpoint: screenshots, round 1
    - The User sends screenshots of Angle mode and Move mode. Kiro lists what to improve.
    - _Requirements: 17.6, 25.2_
  - [~] 50.2 Apply round 1 changes
    - Change the stylesheet and layout only. Do not change logic.
    - _Requirements: 17.6, 17.9_
  - [~] 50.3 User checkpoint: screenshots, round 2
    - The User sends new screenshots and approves or asks for another round. Kiro states what was not tested.
    - _Requirements: 17.6, 25.1, 25.2_

### Phase 5: Manual and final

- [ ] 51. README
  - [~] 51.1 Write `apps/shot-rail/README.md` (the only existing file that changes)
    - Describe the app, repeat the same honest limits as the About_Panel, list every stored key (`shot-rail:hintSeenAngle`, `shot-rail:hintSeenMove`, `shot-rail:thirdsGuideOn`, `shot-rail:safeAreaGuideOn`), and say that "Shot Rail" is a working name that is not trademark-checked.
    - _Requirements: 2.10, 20.4, 21.6, 24.3_
  - [~] 51.2 User checkpoint: read the README
    - The User reads and approves the README.
    - _Requirements: 21.6, 24.3_

- [ ] 52. Sources and build notes
  - [~] 52.1 Complete `docs/sources.md` and `docs/build-notes.md`
    - Every "commonly said" note has its source (claim, source, date checked). The build notes have an entry per task, the S1 deviation, the S5 time and the S6 outcome.
    - _Requirements: 5.8, 22.11, 24.1, 24.2, 24.4_

- [ ] 53. Final check and report
  - [~] 53.1 Open every `.ts` file and check imports
    - Open every `.ts` file in `apps/shot-rail` and check that each relative import ends in `.js`; list the files checked. Confirm nothing outside the allowed files changed (nothing under `packages/pathkit`, no other `package.json`, no guard file).
    - _Requirements: 1.2, 1.5, 1.6, 1.7, 1.8_
  - [~] 53.2 User checkpoint: final run and report
    - The User runs `npm.cmd test`, then `npm.cmd run build`, one at a time from `apps/shot-rail`, and pastes both outputs. Kiro reports counts only from that output.
    - The final report states plainly what was not tested (how the app looks, the WebGL output, the real browser, the PNG download, the feel of the controls, the dev server and `fs.allow`), which items the User checked, and the recorded bake time. The Reviewer renders screenshots in a clean copy. Deploy is out of scope.
    - _Requirements: 1.10, 25.1, 25.2, 25.3, 25.4, 25.5_

### P3 (optional, blocked until the User says "go")

- [ ] 54. Abstract subject (blocked until the User says "go"; all sub-tasks optional)
  - [ ]* 54.1 Implement the abstract subject
    - A glowing ball or a paper plane, selectable like the other subjects, with axes declared on the entity.
    - _Requirements: 15.1, 15.2_
  - [ ]* 54.2 Write the abstract subject tests
    - Selecting it re-bakes and leaves the Timeline paused (forced from a playing state).
    - Source line it should catch: start playing after the switch.
    - _Requirements: 15.2, 11.14_

- [ ] 55. Compare two takes (blocked until the User says "go"; all sub-tasks optional)
  - [ ]* 55.1 Implement compare
    - Two takes of the same shot side by side, one shared frame number, the Motion_Check of each take.
    - _Requirements: 16.1, 16.2, 16.3_
  - [ ]* 55.2 Write the compare tests
    - Moving the Timeline gives the same frame number for both takes; each take has its own findings list.
    - Source line it should catch: keep a separate frame number per take.
    - _Requirements: 16.2, 16.3_

## Notes

- Tasks marked `*` are optional (P3) and blocked until the User says "go".
- Each task references the requirement numbers it covers and, for tests, the design Property number.
- Checkpoints ensure the User sees passing output before the next phase starts.
- Deploy is out of scope.

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
    { "id": 10, "tasks": ["6.3"] },
    { "id": 11, "tasks": ["7.1"] },
    { "id": 12, "tasks": ["8.1"] },
    { "id": 13, "tasks": ["9.1"] },
    { "id": 14, "tasks": ["10.1"] },
    { "id": 15, "tasks": ["10.2"] },
    { "id": 16, "tasks": ["11.1"] },
    { "id": 17, "tasks": ["11.2"] },
    { "id": 18, "tasks": ["12.1"] },
    { "id": 19, "tasks": ["14.1"] },
    { "id": 20, "tasks": ["14.2"] },
    { "id": 21, "tasks": ["15.1"] },
    { "id": 22, "tasks": ["15.2"] },
    { "id": 23, "tasks": ["16.1"] },
    { "id": 24, "tasks": ["16.2"] },
    { "id": 25, "tasks": ["17.1"] },
    { "id": 26, "tasks": ["17.2"] },
    { "id": 27, "tasks": ["18.1"] },
    { "id": 28, "tasks": ["18.2"] },
    { "id": 29, "tasks": ["19.1"] },
    { "id": 30, "tasks": ["19.2"] },
    { "id": 31, "tasks": ["20.1"] },
    { "id": 32, "tasks": ["20.2"] },
    { "id": 33, "tasks": ["21.1"] },
    { "id": 34, "tasks": ["21.2"] },
    { "id": 35, "tasks": ["22.1"] },
    { "id": 36, "tasks": ["22.2"] },
    { "id": 37, "tasks": ["23.1"] },
    { "id": 38, "tasks": ["23.2"] },
    { "id": 39, "tasks": ["24.1"] },
    { "id": 40, "tasks": ["24.2"] },
    { "id": 41, "tasks": ["25.1"] },
    { "id": 42, "tasks": ["25.2"] },
    { "id": 43, "tasks": ["26.1"] },
    { "id": 44, "tasks": ["28.1"] },
    { "id": 45, "tasks": ["28.2"] },
    { "id": 46, "tasks": ["29.1"] },
    { "id": 47, "tasks": ["29.2"] },
    { "id": 48, "tasks": ["29.3"] },
    { "id": 49, "tasks": ["29.4"] },
    { "id": 50, "tasks": ["29.5"] },
    { "id": 51, "tasks": ["29.6"] },
    { "id": 52, "tasks": ["30.1"] },
    { "id": 53, "tasks": ["30.2"] },
    { "id": 54, "tasks": ["31.1"] },
    { "id": 55, "tasks": ["31.2"] },
    { "id": 56, "tasks": ["32.1"] },
    { "id": 57, "tasks": ["32.2"] },
    { "id": 58, "tasks": ["32.3"] },
    { "id": 59, "tasks": ["32.4"] },
    { "id": 60, "tasks": ["33.1"] },
    { "id": 61, "tasks": ["33.2"] },
    { "id": 62, "tasks": ["34.1"] },
    { "id": 63, "tasks": ["34.2"] },
    { "id": 64, "tasks": ["35.1"] },
    { "id": 65, "tasks": ["35.2"] },
    { "id": 66, "tasks": ["36.1"] },
    { "id": 67, "tasks": ["36.2"] },
    { "id": 68, "tasks": ["37.1"] },
    { "id": 69, "tasks": ["37.2"] },
    { "id": 70, "tasks": ["37.3"] },
    { "id": 71, "tasks": ["38.1"] },
    { "id": 72, "tasks": ["38.2"] },
    { "id": 73, "tasks": ["39.1"] },
    { "id": 74, "tasks": ["39.2"] },
    { "id": 75, "tasks": ["39.3"] },
    { "id": 76, "tasks": ["40.1"] },
    { "id": 77, "tasks": ["40.2"] },
    { "id": 78, "tasks": ["40.3"] },
    { "id": 79, "tasks": ["41.1"] },
    { "id": 80, "tasks": ["41.2"] },
    { "id": 81, "tasks": ["42.1"] },
    { "id": 82, "tasks": ["42.2"] },
    { "id": 83, "tasks": ["42.3"] },
    { "id": 84, "tasks": ["44.1"] },
    { "id": 85, "tasks": ["44.2"] },
    { "id": 86, "tasks": ["44.3"] },
    { "id": 87, "tasks": ["44.4"] },
    { "id": 88, "tasks": ["45.1"] },
    { "id": 89, "tasks": ["45.2"] },
    { "id": 90, "tasks": ["45.3"] },
    { "id": 91, "tasks": ["46.1"] },
    { "id": 92, "tasks": ["46.2"] },
    { "id": 93, "tasks": ["46.3"] },
    { "id": 94, "tasks": ["46.4"] },
    { "id": 95, "tasks": ["47.1"] },
    { "id": 96, "tasks": ["47.2"] },
    { "id": 97, "tasks": ["48.1"] },
    { "id": 98, "tasks": ["48.2"] },
    { "id": 99, "tasks": ["48.3"] },
    { "id": 100, "tasks": ["49.1"] },
    { "id": 101, "tasks": ["49.2"] },
    { "id": 102, "tasks": ["49.3"] },
    { "id": 103, "tasks": ["50.1"] },
    { "id": 104, "tasks": ["50.2"] },
    { "id": 105, "tasks": ["50.3"] },
    { "id": 106, "tasks": ["51.1"] },
    { "id": 107, "tasks": ["51.2"] },
    { "id": 108, "tasks": ["52.1"] },
    { "id": 109, "tasks": ["53.1"] },
    { "id": 110, "tasks": ["53.2"] },
    { "id": 111, "tasks": ["54.1"] },
    { "id": 112, "tasks": ["54.2"] },
    { "id": 113, "tasks": ["55.1"] },
    { "id": 114, "tasks": ["55.2"] }
  ]
}
```
