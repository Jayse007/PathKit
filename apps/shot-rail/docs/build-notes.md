# Build notes

One short entry per task: what was done, what broke, what Kiro got wrong, which PathKit feature was used.

## Task 2.1: Create the app files

- Done: created package.json, tsconfig.json, vite.config.ts, vitest.config.ts, .gitignore, index.html, src/logic/pathkit.ts, src/logic/constants.ts, THIRD_PARTY.md, and the docs stubs.
- Broke: nothing known. No command has been run yet.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none yet (only the re-export file exists).
- Open risk for the first build: Vite resolving the import from outside the app root, and the tsconfig type-checking PathKit source without new errors.
- Follow-up fix to 2.1: PLACEHOLDER_PATH in constants.ts was `as const` (readonly points). It now has the explicit type `{ points: Vec3[]; closed: boolean }`, with `Vec3` imported from './pathkit.js', so it fits PathKit's Scene['path'].

## Task 3.1: constants consistency test
- Done: wrote `test/logic/constants.test.ts` (derived values, ordered ranges and thresholds, CAMERA_IDS length, axis pairs on different axes). Awaiting the User's `npm.cmd test` output.
- Broke: nothing known yet.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none (constants only).

## Task 4.1 Default Road points
- Done: added `src/logic/default-road.ts` with 12 hand-placed points on a 44 m by 32 m oval (y = SUBJECT_CENTRE_HEIGHT), closed. Hand estimate: about 120 m round, tightest bend radius about 12 m.
- Broke: nothing known. Not run yet; the length and radius are checked in task 4.2.
- Kiro got wrong: nothing yet.
- PathKit feature used: only the `Vec3` type (through `pathkit.ts`).

### Task 4.2: default Road tests
- Done: added `test/logic/default-road.test.ts` (count 12, every y, no equal consecutive points, length 110 to 130 m printed, bend radius at least 8 m by a hand-written circle formula).
- Broke: nothing known yet; tests not run by Kiro.
- Kiro got wrong: nothing known yet.
- PathKit used: `createCurve`, `createArcLengthTable` (length only).

### Task 5.1: frame-remap.ts
- Done: added `src/logic/frame-remap.ts` with `remapDisplayedFrame` (remainder first, ease, `min` guard, whole-number check that names the value). Not run yet; tests come in 5.2.
- Broke: nothing known. Kiro normalises `-0` to `0` in the result.
- Kiro got wrong: nothing yet.
- PathKit feature used: none (pure app-side function).

## Task 5.2: Frame_Remap tests
- Done: added `test/logic/frame-remap.test.ts` (worked table, 0 to 599 sweep, invalid-value throws). Not yet run by the User.
- What broke: nothing known yet.
- What Kiro got wrong: nothing known yet.
- PathKit feature used: none (pure remap only).

## Task 6.3: S1 tolerance
- Done: added the agreed tolerances to `test/spike/s1.test.ts` part (a), with a comment holding the measured values. Date: 2026-11-24. Not yet run by the User.
- Agreed tolerances (User): each step's relative deviation from the mean at most 2% (0.02); absolute difference between the sum of all 1920 steps and the road length at most 0.001 m.
- Measured values: road length 120.0016939269426 m; sum of steps 120.00182472320051 m; mean step 0.06250095037666693 m; min step 0.061645873853354564 m; max step 0.06335471825121827 m; largest relative deviation 0.013681016339098564 at step 138; sum minus road length about 0.000131 m; remap step ratio 2.9999836394771395.
- Broke: nothing known.
- Kiro got wrong: nothing known yet.
- PathKit feature used: `bake`, `evaluateEntity`, `createArcLengthTable`, `followPath`.

## Task 8.1: S3 test (orbitAround, speed 0, keyframed target)
- Done: wrote `test/spike/s3.test.ts`. Target runs a straight line over 60 frames. Camera orbits it (axis +Y, radius 8, speed 0, startAngle 30). Test checks camera minus target equals (4, 0, 6.9282032) within 1e-9 on every frame, and that the camera moves 118 m in x.
- Broke: not run yet (Kiro cannot run commands).
- Kiro got wrong: nothing known yet.
- PathKit feature used: `orbitAround` with a keyframed target.
- Fix attempt 1: the test's expected z was the rounded literal 6.9282032 (true 6.92820323027551), so the 1e-9 check failed by 3.03e-8; the baked value was correct. The expected offset is now computed as radius*sin and radius*cos of the start angle in radians (30 degrees converted once). Tolerance unchanged. Not yet re-run by the User.
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 9.1: S4 test (two targets, height and aim)
- Done: wrote `test/spike/s4.test.ts` (5 cases of (h, r), plus a wrong-target check with aimAt on `centre`). Not yet run by the User.
- What broke: nothing known yet.
- What Kiro got wrong: nothing known yet.
- PathKit feature used: `orbitAround` (speed 0) then `aimAt`, `rotateVec`, keyframed targets.

## Task 10.1: S5 test written
- Done: `test/spike/s5.test.ts` bakes the subject (1920 frames at 240 fps) and six orbiting cameras (240 frames, orbitAround then aimAt), prints the bake time and `S5_TARGET_MS`, asserts six ids `cam-1` to `cam-6` in order. Time is never asserted. Not yet run.
- Broke: Kiro sent an edit call to a frozen PathKit file by mistake (meant to read it). The hook blocked it and nothing changed.
- PathKit features used: `bake`, `followPath`, `orbitAround`, `aimAt`, keyframed target.

## Extra test: CAMERA_IDS literal check (user request, outside task 10.1)
- Done: added one test to `test/logic/constants.test.ts` checking `CAMERA_IDS` equals `cam-1` to `cam-6` in order, written as literal text. No source file changed. Not yet run by the User.
- Broke: nothing known.
- PathKit feature used: none.

## Task 10.2: S5 bake time measurement
- Measured: S5 bake time (subject + 6 cameras) was 155.03 ms in the Vitest Node process, one run. The target is 100 ms (`S5_TARGET_MS`).
- Result: OVER the target by about 55 ms.
- The test does not fail on timing. It only prints the time and the target; it asserts the six camera ids, not the duration.
- This is one run only and may vary between runs and machines. The run had 45 tests passed, 0 failed, 0 skipped.
- Broke: nothing. No code changed in this step.
- PathKit features used: `bake`, `followPath`, `orbitAround`, `aimAt`.

## Extra change: S5 timing split (user request, outside task 11.1)
- Done: `test/spike/s5.test.ts` now times the subject bake and the camera bake separately. Each runs 5 times through one helper (`timeBake`). Run 1 is printed as cold (includes JavaScript warm-up); the median of runs 2 to 5 is printed as warm. Four lines are printed: subject, cameras, total cold, total warm (target `S5_TARGET_MS`, printed, not asserted).
- Why: the first measurement (task 10.2) was 155.03 ms as one number, so it did not show which bake is slow or how much was warm-up. This split shows both.
- Assertions unchanged (frame counts, ids `cam-1` to `cam-6`, constants test); they run on the first run's result. Time is never asserted. No source or packages/ file changed. Not yet run by the User.

## Task 11.2: S6 outcome and S5 re-measurement (user checkpoint)
- Outcome recorded: **S6 Outcome A**. One combined scene gives the same baked values as separate scenes. Task 22 hard-codes Outcome A: one scene with every camera.
- S6 measured result: cam-1 to cam-4 each compared 1920 frames x 7 values = 13440 values. Largest difference per camera 0; largest difference over all cameras 0; mismatching values 0; tolerance 1e-9.
- Run: `npm.cmd test` from apps/shot-rail, 47 passed, 0 failed, 0 skipped (pasted by the User).
- S5 re-measurement (timing split from the extra change above):
  - Subject bake (1920 frames): cold 56.65 ms, warm median 15.03 ms.
  - Camera bake (6 cameras, 240 frames): cold 26.23 ms, warm median 5.30 ms.
  - Total cold: 82.88 ms; total warm: 20.33 ms; target 100 ms (printed, not asserted).
  - Both totals are under 100 ms. The earlier single-number run (task 10.2) measured 155.03 ms. Timing varies between runs (machine load). Only one run of each is recorded, so neither figure is a stable average.
- Broke: nothing. No code changed in this step; no task status changed.
- Kiro got wrong: nothing known.
- PathKit features used: `bake` (combined scene vs separate scenes), `followPath`, `orbitAround`, `aimAt`.

## Task 12.1: Lap seam test
- Done: `apps/shot-rail/test/spike/lap-seam.test.ts` (2 tests).
  - Part (a): default Road seam angle 0.41563695642562715 degrees (limit 2 degrees).
  - Part (b): hand-written twisted 3D figure-eight (12 points, x = 20 sin t, y = 8 cos t, z = 10 sin 2t, every 30 degrees), checked with `bake` directly, no Road validation. Seam angle 166.95837288576024 degrees (must exceed 40).
- Run: `npm.cmd test` from apps/shot-rail, 49 passed, 0 failed, 0 skipped (pasted by the User).
- S5 timing in that same run:
  - Subject bake: cold 70.17 ms, warm median 17.37 ms.
  - Cameras bake: cold 84.11 ms, warm median 9.64 ms.
  - Total cold: 154.28 ms (over the 100 ms target); total warm: 27.01 ms.
  - The cold total varies between runs (82.88 ms in task 11.2, 154.28 ms here) and can exceed 100 ms. The warm total stays well under 100 ms.
- Broke: nothing. Only this file changed; no code, nothing under packages/, no task status changed.
- Kiro got wrong: nothing known.
- PathKit features used: `bake` (seam check on the baked data).

## Task 14.1: Implement lens.ts
- Done: wrote `src/logic/lens.ts` with `FieldOfView` and `fieldOfViewForFocalLengthMm`. It uses `SENSOR_WIDTH_MM / 2` (18) and `SENSOR_HEIGHT_MM / 2` (10.125) from constants, works in radians and converts to degrees at the output. It throws an Error naming the value for 0 or less, NaN and Infinity.
- Broke: nothing known. No command has been run; the lens tests (14.2) do not exist yet.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none (pure maths, no PathKit import).

## Task 14.2: Lens tests

- Done: added `test/logic/lens.test.ts` (5 tests): hand-written table at 24/35/50/85 mm within 0.05 (1-decimal rounding), unrounded 24 mm vertical 45.747 within 0.001 and not 45.75, an independent `atan2` check against the sensor constants for 8 focal lengths, throws naming the value for 0, -1, -0.001, NaN, Infinity, and same input gives same output.
- Broke: nothing known. Not run by Kiro; awaiting the User's `npm.cmd test` output.
- Kiro note: I checked the 45.747 figure by hand series (about 45.748), inside the 0.001 band.
- PathKit feature used: none (pure lens function).
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 15.1: Implement labels.ts

- Done: wrote `src/logic/labels.ts` with `angleLabel` (overhead checked first; above 60 overhead, above 10 high angle, -10 to 10 eye level, below -10 low angle) and `framingLabel` (above 70 close-up, 35 to 70 medium, below 35 wide). Thresholds come from `constants.ts`. `framingLabel` throws an Error naming the value for NaN, Infinity, below 0 or above 100.
- Broke: nothing known. No command has been run; the label tests (15.2) do not exist yet.
- Kiro got wrong: nothing known.
- PathKit feature used: none (pure logic, no PathKit import).

## Task 15.2: Label tests

- Done: added `test/logic/labels.test.ts` (6 tests): the 9-row elevation table, an explicit `angleLabel(10)` eye-level check, 90 and -90, the 6-row fill table, 0 and 100 accepted, and throws naming the value for -0.1, 100.1, NaN, Infinity. Not yet run by the User.
- Broke: nothing known.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none (pure labels).
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.
