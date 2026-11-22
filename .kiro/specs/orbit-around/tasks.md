# Implementation Plan: orbit-around

## Overview

Add the `orbitAround` constraint to the frozen core in `packages/pathkit` in three groups. Group 1 changes `src/scene.ts` and `src/index.ts` (interface, union, per-type validation, type export) and tests them. Group 2 changes `src/bake.ts` (explicit dispatch, `applyOrbitAround`, angle guard) and tests the geometry. Group 3 adds tests only: stack behaviour (influence, order, aim, bookkeeping, determinism) and the linter. Each code change is followed by its tests, and each group ends with a checkpoint where the user runs `npm.cmd test` from `packages/pathkit` and pastes the output.

Under `packages/pathkit/src` only `scene.ts`, `bake.ts` and `index.ts` change. `src/linter.ts` is expected to need no change, and a test shows it. The language is TypeScript (ESM, strict). Property tests use `fast-check` with at least 100 runs and the tag `Feature: orbit-around, Property O<N>: <title>`. Property O<N> lives in `test/bake/orbit-property-<N>.test.ts`. Criterion numbers and Property names refer to `requirements.md` and `design.md` in this folder.

## Execution Rules

These rules apply to every task below.

### Terminal and verification

- Kiro cannot run terminal commands (a project hook blocks them). After a task that changes code, ask the user to run `npm.cmd test` from `packages/pathkit` and paste the output. Give the command on one line and wait. For test tasks inside a group, Kiro may ask once at the group's checkpoint and then mark every task of the group done from that one output. Do not mark a task done until the pasted output shows the results. Report passed, failed and skipped counts from the pasted output only. If the output is missing or cut off, ask for it again.
- Ask for exactly `npm.cmd test`, with no extra arguments, never watch mode, and never `npx` or `tsc`.
- The frozen core is locked by a hook and the user unlocks it for the whole spec. If a write under `packages/pathkit/src` or `packages/pathkit/test` is blocked, stop and tell the user. Never look for another way.
- If an install is needed, give the user the command and wait. No dev dependency may be added. Dev dependencies stay `vitest` and `fast-check`. Keep `package-lock.json`.

### Scope

- Change only the files a task names.
- No existing test file may be edited. All 348 existing tests must keep passing. `test/bake/property-37.test.ts` must pass untouched. If it does not, stop and report the failing test name and its output (Requirement 1.6). If any other existing test fails, stop and report it. Never edit an existing test to make it pass.
- Do not overwrite any `.config.kiro` file. Do not change anything in `.kiro/specs/path-core/`.
- No mention of cameras anywhere in `src` (identifiers, types, comments, error messages). Follow `.kiro/steering/coordinate-conventions.md`: Y-up right-handed, metres, radians internally (degrees only in `speed` and `startAngle`), integer frames, pure functions, no per-frame allocation.

### Imports

- Every relative import ends in `.js` (`.kiro/steering/typescript-imports.md`), in `src/` and `test/`, for `import`, `import type`, `export ... from` and dynamic `import()`. Never write `.ts` in an import path. Never change `module` or `moduleResolution`.
- After editing a `.ts` file, check the editor diagnostics for it. If diagnostics are not visible, say so in the report.
- Before marking a task done, open each `.ts` file the task touched with `read_file` and check every relative import. List the files checked in the report.

### Tests

- Execute tasks one at a time, strictly in list order, never in parallel. Say which task is starting. When it is finished, report the result in one or two sentences.
- Property test files are named `test/bake/orbit-property-<N>.test.ts`. Unit tests are named as each task states.
- Follow `.kiro/steering/testing-conventions.md`. When a property test is finished, tell the user which source line, if broken, it should catch (each task names that line), so the user can break it once and confirm the test fails.
- A new test file that takes more than 5 seconds on the user's machine is a defect (Requirement 8.18). Report it and find the cause before moving on.
- If a property test fails, state first whether the code or the property is wrong, then fix that one. Make at most 3 fix attempts, then stop and report the seed and the counterexample that fast-check prints. Never weaken a test to make it pass.
- Never freeze typed arrays (`Object.freeze` throws on them). Compare copies of their contents before and after. Freeze only plain objects and arrays.
- Inside a property test, any check that runs once per frame or per sample uses plain comparisons that throw an `Error` naming the property, the frame and the values compared. Call `expect` only for once-per-run checks (Requirement 8.19).
- Generate geometry and scalar inputs with `fc.integer(...)` mapped onto a range, never with `fc.double` (Requirement 8.20). If a `fc.double` or `fc.float` is truly unavoidable, use `noNaN: true`, `noDefaultInfinity: true` and explicit `min` and `max`. NaN and Infinity appear only in the explicit invalid-input variants.
- Expected values come only from Scene numbers, hand calculation, or plain arithmetic written in the test file. No test calls the baker's own maths to produce an expected value (Requirement 8.1).
- Tests that assert a thrown `SceneError` pass a `SceneError` instance to `toThrow`, with the exact message string. Tests that need an invalid constraint build it with `as unknown as Constraint`.
- Hand-computed position tests compare with a tolerance (1e-12), never `Object.is`, because `-0` can appear.
- Force the special cases in at least one test each (Requirement 8.21): radius 0, startAngle 0, a turn of exactly 90 degrees, a turn of exactly 360 degrees, the first frame and the last frame.

## Tasks

- [ ] 1. Group 1: scene.ts and index.ts
  - [x] 1.1 Add the constraint type and per-type validation in `src/scene.ts`
    - Change only `packages/pathkit/src/scene.ts`
    - Add `OrbitAroundConstraint` with the fields `type`, `order`, `influence`, `target`, `radius`, `axis`, `speed`, `startAngle` as in the design
    - Change `Constraint` to `FollowPathConstraint | AimAtConstraint | OrbitAroundConstraint`
    - Restructure step 6 of `validateScene`: keep the influence check and the order check and their messages, then call `checkConstraintOfType`, a `switch (c.type)` with `followPath` (no check), `aimAt` (unknown target), `orbitAround` (`checkOrbitAround`) and a `default` that throws the unknown-type `SceneError`
    - Add `hasTarget` (own-property test, so `toString` is an unknown target) and `checkOrbitAround` with the order target, axis, radius, speed, startAngle
    - Radius, speed and startAngle test `typeof !== 'number'` first, then `Number.isFinite` (never the global `isFinite`), and radius also `< 0`. Messages use `String(value)` and are exactly the strings in Requirements 4.3 to 4.7 and 5.5
    - The new code only reads the Scene
    - Check diagnostics and every relative import, then ask the user to run `npm.cmd test` from `packages/pathkit`. All 348 existing tests must pass. Vitest does not type-check, so `bake.ts` is not affected at run time
    - Source line the later tests should catch: `typeof c.radius !== 'number' ||` in `checkOrbitAround`
    - _Requirements: 1.1, 1.2, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 5.5, 5.6, 5.7, 7.1, 7.6, 7.7, 7.8_

  - [x] 1.2 Export the new type from `src/index.ts`
    - Change only `packages/pathkit/src/index.ts`
    - Add the name `OrbitAroundConstraint` to the existing `export type { ... } from './scene.js'` block. Add no other export name and no runtime export
    - Ask the user to run `npm.cmd test` from `packages/pathkit`. `test/bake/property-37.test.ts` must pass untouched. If it fails, stop and report the failing test name and output, and make no edit to it
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 7.6_

  - [ ] 1.3 Create the shared orbit test helper
    - Create `test/helpers/orbit-generators.ts` (the only new helper, Requirement 8.3). Imports use `.js`
    - Export `AXIS_UNIT` (six tokens to plain `[x, y, z]` unit vectors, written independently of `src`), `dot3`, `cross3`, `sub3`, `len3`, `arbOrbitCase(opts)`, `FORCED_ORBIT_CASES`, `buildOrbitScene(c, extra?)`, `centreAt(c, frame)`, `scaleOf(c)` and `bakedPosition(baked, entityIndex, frame, out)` as the design describes
    - `OrbitCase`: fps from 24, 30, 60; frameCount 1 to 120; six axes; radius an integer 0 to 300 divided by 10 (1 to 300 when above 0 is needed); speed an integer (`-720 * fps` to `720 * fps`, or `-179 * fps` to `179 * fps` when capped); startAngle an integer -720 to 720; centre static or linear, coordinates from integers divided by 10
    - Use `fc.integer` mapped onto ranges only. No `fc.double`
    - `FORCED_ORBIT_CASES` holds radius 0, startAngle 0, a 90-degree turn (`speed = 90 * fps`), a 360-degree turn, `frameCount = 1`, and one case per axis token
    - Add a small self-check test file `test/helpers/orbit-generators.test.ts` that checks the helper values (the six unit vectors have length 1 and satisfy side1 x side2 = axis written out in the test, `centreAt` of a linear case, `scaleOf`)
    - _Requirements: 8.1, 8.3, 8.20, 8.21_

  - [ ] 1.4 Write the scene validation unit tests
    - Create `test/scene/orbit-unit.test.ts`
    - One test per message, each asserting the exact string with `toThrow(new SceneError(...))`: unknown target (including the inherited name `toString`), axis not a token, radius NaN, Infinity, -Infinity and negative, speed NaN and Infinity, startAngle NaN and Infinity (Requirements 4.3 to 4.7)
    - Radius given as the string `"5"` (built with a cast) is rejected with the radius message ending `got 5` (Requirements 4.5, 8.25)
    - A constraint with two or more defects reports only the first in the order target, axis, radius, speed, startAngle (4.2, 4.8)
    - Unknown type `'mystery'` and a missing `type` via `as unknown as Constraint`: exact message `Entity "<id>": unknown constraint type "<value>" (use followPath, aimAt or orbitAround)` (5.5)
    - A bad influence plus an unknown type reports the influence error. A bad order plus an unknown type reports the order error. A bad influence plus a bad orbit axis reports the influence error. An unknown type with valid influence and order reports the type error. Each run throws exactly one error (4.1, 5.6, 5.7)
    - `bake` rejects an invalid orbit Scene and an unknown-type Scene with the same `SceneError` and produces no Baked_Data (4.11, 5.8, 5.11)
    - Radius 0 is accepted (4.9). A Scene with a valid path and no Entity that follows it is accepted (3.12)
    - `validateScene` leaves a valid Scene and an invalid Scene deeply equal to a copy taken before (4.10, 7.1)
    - Source line it should catch: the `typeof c.radius !== 'number'` test in `checkOrbitAround`, and the order of the checks inside `checkOrbitAround`
    - _Requirements: 3.12, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 5.5, 5.6, 5.7, 5.8, 5.11, 7.1, 8.14, 8.24, 8.25_

  - [ ] 1.5 Write property test for the order of defects
    - Create `test/bake/orbit-property-11.test.ts`
    - **Property O11: The first defect wins**
    - Generate a valid orbit Scene, then choose at least two defects from {unknown target, bad axis, bad radius, bad speed, bad startAngle} with `fc.subarray` or a bitmask over `fc.integer`. Assert that `validateScene` throws a `SceneError` with the message of the first defect only. Influence and order are always valid. Force all five defects together and each adjacent pair
    - Source line it should catch: moving the radius check above the axis check in `checkOrbitAround`
    - **Validates: Requirements 4.1, 4.2, 4.8**
    - _Requirements: 4.1, 4.2, 4.8, 8.14_

  - [ ] 1.6 Write property test for invalid values
    - Create `test/bake/orbit-property-12.test.ts`
    - **Property O12: Every invalid value is rejected with its exact message**
    - Generate a valid orbit Scene with one bad value in one field: target name (including `toString`), axis, radius (NaN, Infinity, -Infinity, a negative integer, the string `"5"`), speed and startAngle (NaN, Infinity, -Infinity, a non-number). Assert that both `validateScene` and `bake` throw a `SceneError` with the exact message for that field. Force radius exactly 0 (accepted) and the string `"5"`
    - Source line it should catch: removing `typeof c.radius !== 'number' ||`, or replacing `Number.isFinite` with the global `isFinite`
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7, 4.9, 4.11, 8.14, 8.25**
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 4.9, 4.11, 8.14, 8.25_

- [ ] 2. Checkpoint 1: scene validation and exports
  - Ask the user to run `npm.cmd test` from `packages/pathkit` and paste the full output
  - Expected to pass: `test/scene/orbit-unit.test.ts`, `test/bake/orbit-property-11.test.ts`, `test/bake/orbit-property-12.test.ts`, `test/helpers/orbit-generators.test.ts`, `test/bake/property-37.test.ts` (untouched) and all 348 existing tests
  - Report passed, failed and skipped counts from the pasted output. Report any new file that took more than 5 seconds. If anything fails, follow the failure rules above. Ask the user if questions arise
  - _Requirements: 1.5, 7.7, 8.18_

- [ ] 3. Group 2: bake.ts
  - [ ] 3.1 Implement the dispatch and `applyOrbitAround` in `src/bake.ts`
    - Change only `packages/pathkit/src/bake.ts`. Add no export. Add `OrbitAroundConstraint` to the type import from `./scene.js`
    - Add `unknownConstraintType(c: never): Error` returning `new Error('Unknown constraint type "<value>"')` through `String(...)`
    - Add `checkOrbitAngle(entityId, frame, angleDeg)` throwing the `SceneError` `Entity "<id>": orbitAround angle at frame <f> must be a finite number, got <value>`
    - Add an `axis: Vec3` field to `EntityWork` and to `createEntityWork`
    - Add `applyOrbitAround`: `angleDeg = startAngle + (speed * frame) / fps`, then the guard, then one conversion `(angleDeg / 180) * Math.PI` into `angle`, then `Math.cos(angle)` and `Math.sin(angle)`. Read the axis through `axisVector(c.axis, work.axis)` and the centre through `targetPositionAt(target, frame, work.targetPosition)`. Derive the side vectors with the cyclic rule on the axis components (sign test `a.x + a.y + a.z > 0`, no quoted axis token, no table). Write the result into `work.candidatePosition` and call `blendCandidate(work, c.influence, false)`. No object, array, closure, spread or template literal in this function
    - Replace the `isAimAt` / else-is-`followPath` branch in `bakeEntity` with `switch (c.type)`: `aimAt` and `followPath` keep their existing statements unchanged, `orbitAround` calls `applyOrbitAround` and writes none of `travelled`, `heldFromFrame`, `aimDirections`, and `default: throw unknownConstraintType(c)`
    - Make `drivesRotation` a `switch`: `aimAt` true, `followPath` returns `alignsToPath(c)`, `orbitAround` false, `default: throw unknownConstraintType(c)`
    - Leave `sceneNeedsFrames` testing `isFollowPath(c) && alignsToPath(c)` so an orbit never needs frames. Do not add an `isOrbitAround` guard
    - Check diagnostics and every relative import, then ask the user to run `npm.cmd test` from `packages/pathkit`. All 348 existing tests must pass
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.19, 3.1, 3.6, 3.9, 3.10, 3.11, 3.13, 5.1, 5.2, 5.3, 5.4, 5.9, 5.12, 7.2, 7.3, 7.4, 7.6, 7.8_

  - [ ] 3.2 Write hand-computed and dispatch unit tests
    - Create `test/bake/orbit-unit.test.ts`
    - The four brief examples (Requirements 2.8 to 2.11): `+Y` radius 5 at 0 degrees gives (0, 0, 5) and at 90 degrees gives (5, 0, 0); `+X` radius 2 at 90 degrees gives (0, 0, 2); `+Z` radius 3 at 90 degrees gives (0, 3, 0)
    - One test case per Axis_Token at 0 and 90 degrees, expected positions hand-computed from the Glossary table and written as literals, tolerance 1e-12 (2.4, 2.12, 8.6)
    - Angle example: `speed 90`, `fps 30`, frame 30 is at 90 degrees (2.1). A keyframed centre example with hand-computed offsets (2.5, 2.18)
    - Radius 0 puts the Entity on the centre at every frame, including the first and last (2.6). A negative speed turns the opposite way from the same positive speed, by hand example (2.7). A 360-degree lap by hand example (2.16)
    - Angle guard: `speed 1e308`, `fps 30`, `frameCount 3` throws `SceneError` `Entity "<id>": orbitAround angle at frame 2 must be a finite number, got Infinity` (2.19, 8.26)
    - Dispatch evidence, one test per type (5.10, 8.16): `followPath` only, at a path start of (1, 2, 3) is at (1, 2, 3) with `travelled[0] = 0`; `aimAt` only at target (0, 0, 5) stores aim direction (0, 0, 1); `orbitAround` only (`+Y`, radius 5, centre origin, startAngle 90) is at (5, 0, 0), which is not a path point
    - A typed literal `const c: OrbitAroundConstraint = {...}` held in a `Constraint[]` (1.1, 1.2)
    - Export surface: read `src/index.ts` with `readFileSync`, check `OrbitAroundConstraint` appears once, inside the `export type { ... } from './scene.js'` block (1.3, 1.4)
    - Source lines it should catch: swapping the two side vectors of the negative-axis branch, and `(speed * frame) / fps` changed to `speed * frame`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.16, 2.18, 2.19, 5.1, 5.10, 8.6, 8.16, 8.21, 8.26_

  - [ ] 3.3 Write source-text structure tests
    - Append to `test/bake/orbit-unit.test.ts` (use `fs_append`, do not rewrite the file)
    - Read `src/bake.ts` with `readFileSync`. Extract the `switch` of `bakeEntity` and the body of `drivesRotation` by brace counting. Assert each contains `case 'aimAt'`, `case 'followPath'`, `case 'orbitAround'` and a `default:` containing `unknownConstraintType(`, and that there is no `else` fall-through that treats a non-`aimAt` as `followPath` (5.1, 5.3, 5.4, 5.12)
    - Assert `sceneNeedsFrames` still tests `isFollowPath(c)` and `alignsToPath(c)` and contains no `orbitAround` (5.9)
    - Allocation check of `applyOrbitAround` exactly as the design's Allocation check section specifies: extract the body by counting parentheses then braces, strip comments, and fail with the offending text on `\bnew\s`, `=>`, `\bfunction\b`, a backtick, `...`, `.map(`, `.filter(`, `.slice(`, `.concat(`, `.reduce(`, `.forEach(`, an array literal used as a value, or an object literal used as a value (7.3)
    - Self-test the checker on known-bad strings (`new Foo()`, `[1, 2]`, `{ x: 1 }`, `() => 1`) and known-good strings (`t[i]`, `if (a) { b = 1; }`)
    - Assert the body of `applyOrbitAround` contains exactly one `Math.PI`, that `Math.cos(` and `Math.sin(` are both applied to `angle`, and that `Math.PI` appears nowhere else in it (2.2, 7.8)
    - Assert `applyOrbitAround` contains no quoted axis token and no `camera` (case-insensitive) (7.4)
    - Source line it should catch: adding `new` or `[...]` inside `applyOrbitAround`, or a second `Math.PI`
    - _Requirements: 2.2, 5.1, 5.3, 5.4, 5.9, 5.12, 7.3, 7.4, 7.8, 8.16_

  - [ ] 3.4 Write the defensive branch test
    - Create `test/bake/orbit-defensive.test.ts` containing only these tests
    - Use `vi.mock('../../src/scene.js', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../src/scene.js')>()), validateScene: () => {} }))`, then import `bake` from `../../src/index.js`. Add no export to any source file
    - Build the constraint as `{ type: 'mystery', order: 0, influence: 1 } as unknown as Constraint` and assert `bake(scene)` throws `new Error('Unknown constraint type "mystery"')`. Add a case with a missing `type` (message with `"undefined"`)
    - The `drivesRotation` branch cannot be reached through `bake()`. It is covered by the source-text check in task 3.3 and by the reviewer's type check. State this in a comment in the file
    - Source line it should catch: `default: throw unknownConstraintType(c)` in `bakeEntity` removed, or the message text changed
    - _Requirements: 5.2, 5.4, 5.12, 8.3, 8.16, 8.24_

  - [ ] 3.5 Write property test for distance from the centre
    - Create `test/bake/orbit-property-1.test.ts`
    - **Property O1: Distance from the centre equals the radius**
    - Use `arbOrbitCase` with influence 1, static or linear centre, all six axes. At every frame compare the distance from `centreAt(c, frame)` with `radius` within `1e-9 * scaleOf(c)`, using a plain comparison that throws an `Error` naming the frame and values. Radius 0 must place the position on the centre. Force radius 0, startAngle 0, `frameCount = 1`, one case per axis, and the last frame. Finish with one `expect(framesChecked).toBe(frameCount)`
    - Source line it should catch: `cos * a.z + sin * a.y` changed to `cos * a.z + cos * a.y`, or `r *` removed
    - **Validates: Requirements 2.1, 2.3, 2.5, 2.6, 2.13, 8.4**
    - _Requirements: 2.1, 2.3, 2.5, 2.6, 2.13, 8.4, 8.21_

  - [ ] 3.6 Write property test for perpendicular offset
    - Create `test/bake/orbit-property-2.test.ts`
    - **Property O2: The offset is perpendicular to the axis**
    - At every frame the dot product of the offset with the unit vector from the test's own `AXIS_UNIT` is 0 within the O1 tolerance. Force one case per axis, radius 0 and startAngle 0
    - Source line it should catch: a wrong side vector, for example the `p.z` line using `a.z` instead of `a.y`, which adds a component along the axis
    - **Validates: Requirements 2.3, 2.4, 2.14, 8.5**
    - _Requirements: 2.3, 2.4, 2.14, 8.5, 8.21_

  - [ ] 3.7 Write property test for the angular step
    - Create `test/bake/orbit-property-3.test.ts`
    - **Property O3: Consecutive frames differ by speed / fps degrees**
    - Radius 1 to 30 (tenths 10 to 300), `|speed / fps| <= 179`. For every pair of consecutive frames the signed angle `Math.atan2(dot(cross(a, b), axis), dot(a, b))` equals `speed / fps` degrees in radians, within 1e-9. Force a turn of exactly 90 degrees per frame (`speed = 90 * fps`), startAngle 0, and `frameCount = 2` (first and last pair)
    - Source line it should catch: `(c.speed * frame) / fps` changed to `c.speed * frame`, or the `/ 180` removed
    - **Validates: Requirements 2.1, 2.15, 8.8**
    - _Requirements: 2.1, 2.15, 8.8, 8.21_

  - [ ] 3.8 Write property test for turning direction
    - Create `test/bake/orbit-property-4.test.ts`
    - **Property O4: The sign of speed gives the turning direction**
    - Radius 1 to 30, non-zero `speed`, `|speed / fps| <= 179`. For every consecutive pair the dot product of `cross(offset at f, offset at f+1)` with the axis is positive for positive speed and negative for negative speed. Repeat with the sign of `speed` reversed and require the reversed sign. Force one case per axis and a 90-degree turn per frame
    - Source line it should catch: swapping side1 and side2 in the negative-axis branch (mirror), or flipping the sign of `sin`
    - **Validates: Requirements 2.4, 2.7, 2.17, 8.7**
    - _Requirements: 2.4, 2.7, 2.17, 8.7, 8.21_

  - [ ] 3.9 Write property test for a full lap
    - Create `test/bake/orbit-property-5.test.ts`
    - **Property O5: A full lap returns to the start**
    - Pick N from the divisors of 360 that are at most 119, laps L from 1 to 3, either direction, any axis, fps and startAngle, with `speed = +/- L * 360 * fps / N`. The position at frame N equals the position at frame 0 within the O1 tolerance. Force N = 1 with `speed = 360 * fps`, and the case `frameCount = N + 1` where N is the last frame
    - Source line it should catch: `frame` replaced by `frame - 1` in the angle, or `startAngle` applied in a way that depends on the frame
    - **Validates: Requirements 2.16, 8.9**
    - _Requirements: 2.16, 8.9, 8.21_

  - [ ] 3.10 Write property test for a keyframed centre
    - Create `test/bake/orbit-property-6.test.ts`
    - **Property O6: A moving centre carries the offset with it**
    - Linearly keyframed centre (keyframes at frame 0 and `frameCount`). At every frame the offset from `c0 + frame * step` equals, within the O1 tolerance, the offset from the same constraint baked with a static centre at the origin. Force radius 0, startAngle 0, first and last frame. Note in a comment that this compares two bakes and is valid because Properties O1 to O4 and the hand-computed unit tests pin the static case
    - Source line it should catch: `targetPositionAt(target, frame, ...)` changed to `targetPositionAt(target, 0, ...)`
    - **Validates: Requirements 2.5, 2.18, 8.10**
    - _Requirements: 2.5, 2.18, 8.10, 8.21_

- [ ] 4. Checkpoint 2: bake.ts and geometry
  - Ask the user to run `npm.cmd test` from `packages/pathkit` and paste the full output
  - Expected to pass: `test/bake/orbit-unit.test.ts`, `test/bake/orbit-defensive.test.ts`, `test/bake/orbit-property-1.test.ts` to `orbit-property-6.test.ts`, everything from checkpoint 1, `test/bake/property-37.test.ts` (untouched) and all 348 existing tests
  - Report passed, failed and skipped counts from the pasted output. Report any new file that took more than 5 seconds. If anything fails, follow the failure rules above. Ask the user if questions arise
  - _Requirements: 5.12, 7.7, 8.18_

- [ ] 5. Group 3: stack behaviour and linter (tests only)
  - [ ] 5.1 Write property test for influence blending
    - Create `test/bake/orbit-property-7.test.ts`
    - **Property O7: Influence blends the position**
    - An Entity with a radius-0 `orbitAround` at static target `anchor` T (order 0, influence 1), then the orbit constraint (order 1, influence lambda from {0, 0.25, 0.5, 0.75, 1}, radius 1 to 30). At every frame `|R - ((1 - lambda) T + lambda C)| = lambda * radius` and the dot product with the axis is 0, within the O1 tolerance. Lambda 0 gives T within tolerance (not exact equality). Lambda 1 gives distance `radius` from C. Rotation is the identity (exact). Force lambda 0, 0.5 and 1, and the first and last frame. Also a unit-level case in this file: influence 0 with no earlier constraint leaves the Rest_Pose (0, 0, 0)
    - Source line it should catch: `blendCandidate(work, c.influence, false)` replaced by a direct write into `work.position`
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 8.11**
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.11, 8.21_

  - [ ] 5.2 Write property test for aimAt after orbit
    - Create `test/bake/orbit-property-8.test.ts`
    - **Property O8: An aimAt with a higher order faces the centre**
    - Radius 1 to 30, influence 1, an `aimAt` on the same target with a higher `order`. At every frame the stored aim direction equals the unit vector from the baked position to the centre within 1e-9, computed with plain arithmetic in the test. Force the first and last frame and a keyframed centre
    - Source line it should catch: running the `orbitAround` after the `aimAt` (order handling), or `applyOrbitAround` writing to a buffer that `aimAt` does not read
    - **Validates: Requirements 3.7, 3.8, 8.12**
    - _Requirements: 3.7, 3.8, 8.12, 8.21_

  - [ ] 5.3 Write property test for rotation and bookkeeping
    - Create `test/bake/orbit-property-9.test.ts`
    - **Property O9: An orbit changes no rotation or bookkeeping**
    - An orbit-only Entity has the identity rotation (exact) at every frame, `travelled` all 0, `heldFromFrame` -1, `aimDirections` all 0 and `rotationDrivers` 0. Orbit plus `aimAt` gives `rotationDrivers` 1, `travelled` all 0, `heldFromFrame` -1. Orbit plus `aimAt` plus aligned `followPath` gives `rotationDrivers` 2. Compare typed arrays through copies, never freeze them
    - Source line it should catch: `blendCandidate(work, c.influence, true)` in `applyOrbitAround`, or the `orbitAround` case writing `output.travelled`, or `drivesRotation` returning true for `orbitAround`
    - **Validates: Requirements 3.9, 3.10, 3.11, 5.3, 5.9, 8.13**
    - _Requirements: 3.9, 3.10, 3.11, 5.3, 5.9, 8.13_

  - [ ] 5.4 Write property test for purity and repeatability
    - Create `test/bake/orbit-property-10.test.ts`
    - **Property O10: Baking and validating do not modify the scene, and baking is repeatable**
    - Valid orbit Scenes with one to three Entities (orbit with optional `aimAt` and `followPath`). A deep copy taken before `validateScene` and `bake` equals the Scene afterwards. Two `bake` calls return transforms, `travelled`, `aimDirections`, `heldFromFrame` and `rotationDrivers` equal element by element with exact equality. Copy typed array contents for the comparison, never freeze them. Do not freeze the Scene objects of the Scene under test if that would stop the copy comparison from being meaningful. Freezing plain Scene objects and arrays is allowed
    - Source line it should catch: `constraints.sort(...)` on `entity.constraints` instead of the copy, or any `Math.random` use
    - **Validates: Requirements 4.10, 7.1, 7.2, 8.15**
    - _Requirements: 4.10, 7.1, 7.2, 8.15_

  - [ ] 5.5 Write property test for equal and distinct order
    - Create `test/bake/orbit-property-13.test.ts`
    - **Property O13: Equal orders run in list order, and list order is irrelevant otherwise**
    - A is a radius-0 orbit at static target T with influence 1. B is an orbit with radius r above 0 at centre C with influence 0.5. With equal `order`, the list [A, B] gives a position at distance `r / 2` from `(T + C) / 2` at every frame, and [B, A] gives T at every frame, within the O1 tolerance. With distinct orders (A lower), both list orders give the same positions within tolerance and the identity rotation. Expected values are hand-derived in the test from T, C and r
    - Source line it should catch: the comparator in `sortedCopy` changed so equal orders reverse, or the sort made unstable
    - **Validates: Requirements 3.6, 3.13, 8.22**
    - _Requirements: 3.6, 3.13, 8.22_

  - [ ] 5.6 Write stack behaviour unit tests
    - Append to `test/bake/orbit-unit.test.ts` (use `fs_append`, do not rewrite the file)
    - Influence by hand example: 0 with an earlier constraint keeps the earlier position, 0 with none leaves (0, 0, 0), 1 gives the full orbit, 0.5 after another position constraint gives the hand-computed midpoint (3.2 to 3.5, 8.11)
    - Order trap: an `aimAt` with a lower `order` than the orbit aims from the origin, and an `aimAt` with a higher `order` faces the centre, both by hand numbers (3.7)
    - Equal `order` by hand: an orbit with influence 0.5 and a second position-setting constraint, run in both list orders, each with its own hand-computed expected position (3.13, 8.22)
    - `sceneNeedsFrames` behaviour (5.9, 8.23): a Scene whose only constraint is an orbit bakes correctly, and a Scene that mixes an orbit with a `followPath` with `alignToPath` true still bakes the aligned rotation
    - Orbit-only Entity: identity rotation, `rotationDrivers` 0 (3.10, 3.11, 8.13). `travelled`, `heldFromFrame` and `aimDirections` are untouched (3.9)
    - Scene and baked output are unchanged by `bake`, and two bakes are identical, by one concrete example (7.1, 7.2, 8.15)
    - Source line it should catch: `sceneNeedsFrames` counting an orbit, or `sortedCopy` reversing equal orders
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.7, 3.9, 3.10, 3.11, 3.13, 5.9, 7.1, 7.2, 8.11, 8.13, 8.15, 8.22, 8.23_

  - [ ] 5.7 Write the linter tests
    - First read `src/linter.ts` with `read_file` (reading only, never editing) and confirm it names no constraint type. Say so in the report. Do not edit `src/linter.ts`
    - Append to `test/bake/orbit-unit.test.ts` (use `fs_append`, do not rewrite the file) a describe block for the linter
    - Scene: one Entity `orbiter` (`forwardAxis '+Z'`, `upAxis '+Y'`), one `orbitAround` with influence 1, order 0, axis `+Y`, radius 4, startAngle 0, target `centre` static at (10, 2, -3), fps 30, frameCount 60, a valid open path
    - Very fast: `speed 3000` (100 degrees per frame, at least 90 and not a multiple of 360). Gentle: `speed 30` (1 degree per frame). Bake each, run `motionLinter(scene, baked)` with default options and again with `{ rollThresholdDegPerFrame: 0 }`, and expect `[]` both times (6.2 to 6.5)
    - If a Finding appears, the test fails with a message listing every Finding (frame, entityId, code, message). Then stop and report before any change to `src/linter.ts` (6.6, 6.7). Do not weaken the expectation
    - Source line it should catch: `blendCandidate(work, c.influence, true)` (a roll or rotation change would show as a `roll-change` Finding)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 8.17_

- [ ] 6. Checkpoint 3: stack behaviour and linter
  - Ask the user to run `npm.cmd test` from `packages/pathkit` and paste the full output
  - Expected to pass: `test/bake/orbit-property-7.test.ts` to `orbit-property-13.test.ts`, the extended `test/bake/orbit-unit.test.ts` (including the linter tests), everything from checkpoints 1 and 2, `test/bake/property-37.test.ts` (untouched) and all 348 existing tests
  - Report passed, failed and skipped counts from the pasted output. Report any new file that took more than 5 seconds. If anything fails, follow the failure rules above. Ask the user if questions arise
  - _Requirements: 6.1, 7.7, 8.18_

- [ ] 7. Final verification
  - [ ] 7.1 Collect the full test output and report
    - Ask the user to run `npm.cmd test` from `packages/pathkit` and paste the full output. Wait
    - Report the totals (passed, failed, skipped) from the pasted output only. State whether all 348 existing tests plus the new tests passed, and whether `test/bake/property-37.test.ts` passed untouched, as the pasted output shows. If the output does not show a result, say so and do not claim it
    - List the files this spec changed under `packages/pathkit/src`: `scene.ts`, `bake.ts` and `index.ts`. State that `src/linter.ts` was only read. List the new test files created: `test/helpers/orbit-generators.ts`, `test/helpers/orbit-generators.test.ts`, `test/scene/orbit-unit.test.ts`, `test/bake/orbit-unit.test.ts`, `test/bake/orbit-defensive.test.ts` and `test/bake/orbit-property-1.test.ts` to `orbit-property-13.test.ts`
    - Claim only what Kiro did and can check: Kiro made no edit to an existing test file, and the files above are the ones it wrote. Kiro cannot run `git diff`, so ask the user to confirm with `git diff --stat` (one line) that only the three `src` files changed, that `.kiro/specs/path-core/` is unchanged and that `package.json` is unchanged (Requirements 7.5, 7.6, 7.9)
    - State that the reviewer will run a type check, which Kiro cannot. The type check covers the `never` exhaustiveness in the `default` branches of `bakeEntity` and `drivesRotation` (5.4, 5.12) and the typed literals (1.1, 1.2)
    - _Requirements: 1.5, 1.6, 5.4, 5.12, 6.1, 7.4, 7.5, 7.6, 7.7, 7.9, 8.2, 8.18_

## Notes

- All tasks, including test tasks, are required. No task is optional.
- Each task references specific criteria from `requirements.md`. Property names O1 to O13 are from `design.md`.
- Kiro cannot run commands. Test results are reported only from output the user pastes.
- Tasks run one at a time, strictly in list order. The dependency graph has one task per wave in that order. Checkpoints and top-level parent tasks are not in the graph.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["1.5"] },
    { "id": 5, "tasks": ["1.6"] },
    { "id": 6, "tasks": ["3.1"] },
    { "id": 7, "tasks": ["3.2"] },
    { "id": 8, "tasks": ["3.3"] },
    { "id": 9, "tasks": ["3.4"] },
    { "id": 10, "tasks": ["3.5"] },
    { "id": 11, "tasks": ["3.6"] },
    { "id": 12, "tasks": ["3.7"] },
    { "id": 13, "tasks": ["3.8"] },
    { "id": 14, "tasks": ["3.9"] },
    { "id": 15, "tasks": ["3.10"] },
    { "id": 16, "tasks": ["5.1"] },
    { "id": 17, "tasks": ["5.2"] },
    { "id": 18, "tasks": ["5.3"] },
    { "id": 19, "tasks": ["5.4"] },
    { "id": 20, "tasks": ["5.5"] },
    { "id": 21, "tasks": ["5.6"] },
    { "id": 22, "tasks": ["5.7"] },
    { "id": 23, "tasks": ["7.1"] }
  ]
}
```
