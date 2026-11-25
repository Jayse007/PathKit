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
