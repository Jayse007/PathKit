# Implementation Plan: path-core

## Overview

Implement the dependency-free TypeScript library in `spikes/path-core` bottom-up: project setup, math, curve, arc-length, frames, scene validation, bake, evaluate, linter, then public exports. Each module is followed by its tests. The language is TypeScript (Node 24, ESM, strict). Property tests use `fast-check` with at least 100 runs and the tag `Feature: path-core, Property N: <title>`.

## Execution Rules

These rules apply to every task below.

- Create and edit files only with the file tools. Never write files from the terminal (no redirection, heredocs, `Set-Content`, `Out-File` or multi-line strings).
- Every terminal command must be a single line.
- The shell is Windows PowerShell. Use `cwd` to select `spikes/path-core` instead of chaining `cd`.
- Run tests only with `npm test` or `vitest run` (optionally with a file path argument). Never use watch mode or any command that does not exit.
- `npm install` is allowed as a single-line command. Dev dependencies are only `vitest` and `fast-check`. Add no runtime dependencies and no other dev dependencies.
- If a terminal command seems stuck for more than 60 seconds, stop and tell the user.
- Follow `.kiro/steering/coordinate-conventions.md`: Y-up right-handed, metres, radians internally, integer frames, pure functions, no per-frame allocation in the evaluation path, and no mention of cameras anywhere in `src`.
- Do not overwrite `.kiro/specs/path-core/.config.kiro`.
- Property test files are named `test/<module>/property-<N>.test.ts`. Unit tests are named `test/<module>/unit.test.ts` (or as stated in the task).
- Execute tasks one at a time, never in parallel. The Task Dependency Graph is strictly sequential, one task per wave, in list order.
- If a property test fails, make at most 3 fix attempts, then stop and report to the user.
- When a test fails, first state whether the code or the property is wrong, then fix that one.
- Never weaken a test just to make it pass.
- Object.freeze throws on typed arrays that have elements, so never freeze typed arrays; compare copies of their contents before and after instead. Freeze only plain objects and arrays.
- When a property test fails, report the seed and the counterexample that fast-check prints.
- Every fast-check numeric arbitrary (`fc.double`, `fc.float`) uses `noNaN: true`, `noDefaultInfinity: true` and explicit `min` and `max` bounds. NaN and Infinity appear only in the explicit invalid-scene variants.
- Execute tasks strictly in the order they appear in the Tasks list, one at a time.
- Inside a property test, any check that runs once per frame or per sample must use plain comparisons that throw a descriptive Error when violated; call expect only for once-per-run checks. Reason: hundreds of thousands of expect calls made one test take 15 seconds against a 30-second timeout.

## Tasks

- [x] 1. Set up the project
  - [x] 1.1 Create project configuration files
    - Create `spikes/path-core/package.json` with `"type": "module"`, script `"test": "vitest run"`, no `dependencies`, and `devDependencies` of only `vitest` and `fast-check` (do not add `typescript`; vitest transpiles TypeScript itself)
    - Create `spikes/path-core/tsconfig.json` with `strict: true`, `module`/`moduleResolution` `NodeNext`, `target` `ES2023`, `noEmit: true`, and `include` of `src` and `test`
    - Create `spikes/path-core/vitest.config.ts` including `test/**/*.test.ts` and setting `testTimeout` to 30000
    - Create `spikes/path-core/.gitignore` ignoring `node_modules`
    - _Requirements: 10.6, 10.8, 10.9_

  - [x] 1.2 Install dev dependencies
    - Run the single-line command `npm install` with `cwd` set to `spikes/path-core`
    - Confirm `node_modules` exists and `package.json` still lists only `vitest` and `fast-check`
    - _Requirements: 10.6_

  - [x] 1.3 Write unit tests for project constraints
    - Create `test/project/unit.test.ts`
    - Assert `package.json` has script `test` equal to `vitest run`, no `dependencies`, and dev dependencies exactly `vitest` and `fast-check`
    - Scan every file under `src` and assert the word "camera" (case-insensitive) never appears. Check that `src` exists first: when the folder is missing or empty, the scan passes trivially (this task runs before `src` exists and becomes meaningful when re-run at the checkpoints)
    - Scan `src` for hard-coded axis use outside `scene.ts` `axisVector` where practical (no literal forward/up axis defaults), with the same existence check
    - _Requirements: 10.4, 10.5, 10.6, 10.7, 10.8_

  - [x] 1.4 Create shared test generators for math, curves and axes
    - Create `test/helpers/basic-generators.ts` with fast-check arbitraries: bounded Vec3 (coordinates in [-100, 100]), unit quaternion, point lists with distinct consecutive points (minimum spacing 0.1 by construction), open/closed flag
    - Axis-token pairs: all 36 pairs, of which 12 are invalid (both tokens on the same coordinate axis, including opposite tokens such as +Z and -Z) and 24 are valid
    - _Requirements: 10.12_

- [x] 2. Implement math
  - [x] 2.1 Implement `src/math.ts`
    - Implement `Vec3`, `Quat`, `add`, `sub`, `scale`, `dot`, `cross`, `length`, `normalize` (below 1e-12 returns zero), `lerp`, `quatFromBasis`, `quatMul`, `quatInverse`, `rotateVec`, `slerp` (shorter arc, near-parallel fallback to normalised lerp) and `quatAngle`
    - Optional `out` argument writes and returns that object; safe when `out` aliases an input; inputs never mutated
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 10.10_

  - [x] 2.2 Write property test for input immutability
    - **Property 1: Math functions do not mutate inputs**
    - **Validates: Requirements 1.6, 10.10**

  - [x] 2.3 Write property test for output arguments
    - **Property 2: Output arguments are written and returned**
    - **Validates: Requirements 1.7**

  - [x] 2.4 Write property test for normalize
    - **Property 3: Normalize yields unit or zero**
    - **Validates: Requirements 1.4**

  - [x] 2.5 Write property test for quaternion from basis
    - **Property 4: Quaternion from orthonormal basis rotates the axes**
    - **Validates: Requirements 1.2**

  - [x] 2.6 Write property test for slerp
    - **Property 5: Slerp follows the shorter arc**
    - **Validates: Requirements 1.3, 1.5**

- [x] 3. Implement the curve
  - [x] 3.1 Implement `src/curve.ts`
    - Implement `createCurve(points, closed)` as a centripetal Catmull-Rom spline (knot spacing `|Pi+1 - Pi|^0.5`), reflected phantom endpoints for open curves, wrapped indices for closed curves
    - Implement `pointAt` and `tangentAt` with `out` support, no allocation when `out` is given, clamp for open and wrap for closed, unit tangent with chord fallback
    - Throw `Curve needs at least 2 points, got N` (checked first), `Closed curve needs at least 3 points, got N` (closed curves with exactly 2 points) and `Coincident points at indexes i and i+1` (closed curves also check `n-1` and `0`)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [x] 3.2 Write property test for interpolation and endpoints
    - **Property 6: Curve interpolates its points and endpoints**
    - **Validates: Requirements 2.1, 2.3, 2.4**

  - [x] 3.3 Write property test for closed curve continuity
    - **Property 7: Closed curve joins continuously**
    - Also check that the position at `t = 1 - 1e-9` is within 1e-6 of the position at `t = 0` for closed curves
    - Tangent check: with `T0 = tangentAt(0)`, `d9 = |tangentAt(1 - 1e-9) - T0|` and `d6 = |tangentAt(1 - 1e-6) - T0|`, assert `d9 <= d6 / 100 + 1e-12`. Skip curves that reverse direction at the first point (cusp): with `û` the unit vector of `points[0] - points[n-1]` and `v̂` the unit vector of `points[1] - points[0]`, skip when `û · v̂ <= -1 + 1e-9`. Count total and skipped curves and print one line `Property 7 reversal skip: <skipped> of <total> generated curves`
    - **Validates: Requirements 2.2**

  - [x] 3.4 Write property test for unit tangents
    - **Property 8: Tangents are unit length**
    - **Validates: Requirements 2.5**

  - [x] 3.5 Write property test for clamp and wrap
    - **Property 9: Out-of-range parameter clamps or wraps**
    - **Validates: Requirements 2.8**

  - [x] 3.6 Write property test for invalid curve inputs
    - **Property 10: Invalid curve inputs are rejected with informative errors**
    - Also cover closed curves with exactly 2 points: they are rejected with `Closed curve needs at least 3 points, got 2`
    - **Validates: Requirements 2.6, 2.7**

  - [x] 3.7 Write property test for reversal symmetry
    - **Property 45: Reversing an open curve reverses its parameter**
    - For any valid open point list, the curve built from the reversed list satisfies `pointAt(1 - t)` equal to the original `pointAt(t)` within 1e-6 for `t` in [0, 1]
    - **Validates: Requirements 2.9**

- [x] 4. Implement arc-length parameterisation
  - [x] 4.1 Implement `src/arclength.ts`
    - Implement `createArcLengthTable(curve)` whose total entry count, including the entry at t = 0, is always exactly 1024 (`t_i = i / 1023`, whatever the point count), stored in preallocated `Float64Array`s
    - Implement `length`, `entryCount`, `parameterAtDistance` (binary search plus monotone cubic Hermite interpolation of t as a function of distance, with node slopes precomputed at setup into a `Float64Array`; no allocation), `pointAtDistance` and `tangentAtDistance` writing into `out`
    - Clamp distance for open curves, wrap into `[0, length)` for closed curves
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 4.1a Create the smooth curve generator
    - Create `test/helpers/smooth-curve-generator.ts` exporting `smoothCurvePoints`, returning `{ points, rMin, N }` for open curves only
    - Build the points first: sample 8 to 20 points at equal parameter steps from a smooth parametric curve (sum of 2 to 3 sinusoids per axis, amplitude 20 to 100, each sinusoid 0.25 to 1 full cycle over the whole curve)
    - Build the real Catmull-Rom curve and arc-length table from those points, estimate the curve's minimum radius of curvature `rMin` from at least 4096 samples of that curve, and take `length` from the table
    - Let `nMin = max(50, ceil(3 * length / rMin))`. Reject the curve only if `ceil(3 * length / rMin) > 200`. Otherwise choose `N` uniformly in `[nMin, 200]` (chained after the curve), so `rMin >= 3 * length / N` always holds
    - All numbers come from `fc.integer` (no `fc.double`); consecutive points are never coincident. The raw arbitrary returns the candidate or `null` (rejected) so the rejection rate can be measured, and `smoothCurvePoints` filters out the nulls
    - A separate, deletable file `test/helpers/smooth-curve-generator.test.ts` draws 300 raw candidates with a fixed seed, prints the rejection count and elapsed time, and asserts that fewer than 60% are rejected
    - Properties 13, 17, 26 and 44 and any constant-speed test use this generator
    - _Requirements: 3.7, 10.12_

  - [x] 4.2 Write property test for table size and length
    - **Property 11: Arc-length table is bounded and consistent**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 4.3 Write property test for clamp and wrap
    - **Property 12: Arc-length clamp and wrap**
    - The test also checks that `parameterAtDistance` never decreases as `d` increases, for open and closed curves, and that the endpoints are exact (`d = 0` gives `t = 0`; on open curves `d = length` gives `t = 1`)
    - **Validates: Requirements 3.5, 3.6**

  - [x] 4.4 Write property test for equal chords
    - **Property 13: Equal distance steps give equal chords**
    - Use the `smoothCurvePoints` generator from task 4.1a (smooth curves only), N from 50 to 200, positions at distances `k * length / N`; each consecutive chord distance must be within 1 percent of `length / N`
    - **Validates: Requirements 3.3, 3.7**

  - [x] 4.5 Write property test for unit tangents and output reuse
    - **Property 14: Tangents at a distance are unit length and outputs are reused**
    - **Validates: Requirements 3.4, 3.8**

- [ ] 5. Implement frames
  - [x] 5.1 Implement `src/frames.ts`
    - Implement `Frame`, `rotationMinimizingFrames(curve, count, initialUp?)` using the double reflection method, and `frenetFrames(curve, count)` with the low-curvature fallback
    - Validate `count` first and throw `Frame count must be an integer >= 2, got <value>`
    - Frenet tangent derivative is the difference quotient `(tangentAt(min(1, t + h)) - tangentAt(max(0, t - h))) / (min(1, t + h) - max(0, t - h))` with `h = 1e-5`, one-sided at t = 0 and t = 1. The "curvature below 1e-9" test is applied to the length of this quotient
    - RMF reflections: if the squared length of a reflection vector (the chord between sample points, or the tangent difference in the second reflection) is below 1e-24, skip that reflection (identity), so no division by zero happens
    - First normal is the component of `initialUp` (default +Y) perpendicular to the first tangent, with the least-aligned-world-axis fallback when parallel
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [x] 5.2 Write property test for RMF orthonormality
    - **Property 15: RMF frames are orthonormal**
    - **Validates: Requirements 4.1, 4.2, 4.5, 4.6**

  - [x] 5.3 Write property test for first normal
    - **Property 16: RMF first normal follows the up vector**
    - **Validates: Requirements 4.3, 4.4**

  - [ ] 5.4 Write property test for twist comparison
    - **Property 17: RMF has less twist than Frenet frames**
    - Use the `smoothCurvePoints` generator from task 4.1a with open curves, and a frame count equal to the N returned by the generator (50 to 200)
    - Twist for consecutive frames i and i+1: the angle between the normal of frame i rotated by the minimal rotation that takes tangent i to tangent i+1, and the normal of frame i+1. Compare the sums of absolute twists: RMF total must be at most Frenet total plus 1e-4
    - **Validates: Requirements 4.2**

  - [ ] 5.5 Write property test for Frenet frames
    - **Property 18: Frenet frames are well-formed and continuous at low curvature**
    - **Validates: Requirements 4.7, 4.9**

  - [ ] 5.5a Write unit test for the Frenet flip
    - Create `test/frames/unit.test.ts` with a planar S-shaped curve that has an inflection point, sampled with count 200
    - Assert `frenetFrames` has a twist above 1 radian within one step, and `rotationMinimizingFrames` keeps every step's twist below 0.001
    - Twist uses the definition from task 5.4 (normal of frame i rotated by the minimal rotation taking tangent i to tangent i+1, compared with the normal of frame i+1)
    - _Requirements: 4.2, 4.7_

  - [ ] 5.6 Write property test for invalid counts
    - **Property 19: Invalid frame counts are rejected**
    - **Validates: Requirements 4.8**

- [ ] 6. Checkpoint - Ensure all tests pass
  - Run `npm test` with `cwd` set to `spikes/path-core`. Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement scene types and validation
  - [ ] 7.1 Implement `src/scene.ts`
    - Define `AxisToken`, constraint types (`alignToPath` optional, default false), `Entity`, `Keyframe`, `Target`, `Scene`, `SceneError`
    - Implement `axisVector(token, out)` as the single token-to-vector point
    - Implement `validateScene` in the designed order with the designed messages: fps/frameCount, duplicate ids, same-axis forward/up (naming both tokens), influence in [0,1] and finite, unknown aim target, integer keyframe frames; never mutate the scene
    - After the integer-frame check, add two keyframe checks: `Target "<name>": keyframes must not be empty` and `Target "<name>": keyframe frames must be strictly increasing, got <a> then <b>` (first offending consecutive pair)
    - After the keyframe checks, add the finite-number checks in this order with these messages: `Entity "<id>": speed must be a finite number, got <value>`, `Entity "<id>": startOffset must be a finite number, got <value>`, `Path point <i> must have finite coordinates`, `Target "<name>": position must have finite coordinates`, `Target "<name>": keyframe <i> position must have finite coordinates`
    - Do not check path geometry (point count or coincident points) in `validateScene`; those errors come from `createCurve`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13, 5.14, 10.5_

  - [ ] 7.2 Create shared test generators for scenes
    - Create `test/helpers/scene-generators.ts` with arbitraries for valid scenes (0 to 4 entities, mixed `followPath`/`aimAt` constraints, open or closed paths, keyframed and static targets, valid axis pairs) and for each kind of invalid scene
    - Bounds: `frameCount` at most 120, `fps` drawn from {24, 30, 60}, at most 12 path points, at most 4 entities
    - Provide variants for Properties 24, 25, 26, 27, 30 and 31 that enforce: the constraint under test has influence 1 and no later constraint drives the same channel (position or rotation). The variants for Properties 27 and 30 place the `aimAt` after any `followPath` in constraint order
    - Valid-scene generators produce only non-empty keyframe lists with strictly increasing integer frame numbers; invalid-scene generators include variants with an empty keyframe list and with non-increasing (equal or decreasing) frame numbers
    - Generators for Properties 38, 40 and 42 include scenes with several `followPath` constraints, scenes with and without `aimAt`, coincident aims, and constraints with influence 0 or below 1
    - Valid-scene generators produce only finite speed, startOffset, path point, target position and keyframe position values; invalid-scene generators include variants with NaN, Infinity and -Infinity in each of these fields
    - Provide a variant for Property 44: a path from `smoothCurvePoints` and an entity with a single `followPath` constraint (influence 1, `alignToPath` true, speed above 0, any valid axis pair), exposing `rMin`
    - _Requirements: 5.13, 5.14, 10.12_

  - [ ] 7.3 Write property test for axis validation
    - **Property 20: Axis validation rejects same or opposite axes**
    - Use all 36 axis-token pairs (12 invalid, 24 valid)
    - **Validates: Requirements 5.3, 5.4, 10.5**

  - [ ] 7.4 Write property test for numeric field validation
    - **Property 21: Scene validation rejects bad numeric fields**
    - Include empty keyframe lists and non-increasing (equal and decreasing) keyframe frames, checking the exact messages
    - Include NaN, Infinity and -Infinity in speed, startOffset, path point coordinates, static target coordinates and keyframe position coordinates, checking the exact Requirement 5.14 messages
    - **Validates: Requirements 5.2, 5.6, 5.7, 5.11, 5.13, 5.14**

  - [ ] 7.5 Write property test for reference and duplicate validation
    - **Property 22: Scene validation rejects bad references and duplicates**
    - **Validates: Requirements 5.5, 5.12**

  - [ ] 7.6 Write unit tests for scene validation messages
    - Create `test/scene/unit.test.ts` covering each exact error message, the `alignToPath` default, and that validation does not mutate the scene
    - Add cases for an empty keyframe list and for non-increasing keyframes (both equal and decreasing frame numbers), asserting the exact messages
    - Add one case per finite-number message (speed, startOffset, path point, static target position, keyframe position), each with NaN and with Infinity, asserting the exact messages
    - _Requirements: 5.1, 5.8, 5.9, 5.13, 5.14_

- [ ] 8. Implement baking
  - [ ] 8.1 Implement `src/bake.ts`
    - Implement `BakedData` and `bake(scene)`: call `validateScene`, stable-sort a copy of each entity's constraints by `order`, then per entity and frame apply constraints in order
    - Each frame's constraint stack starts from the rest pose (position at the origin, identity rotation). Previous-frame state is used only by the coincident-aim rule (6.9) and the near-vertical up rule (7.4), and never as the starting value of the stack
    - `followPath`: Travelled_Distance `startOffset + speed * frame / fps`, clamp (open) or wrap (closed), position from the arc-length table, `alignToPath` rotation from `forwardAxis`/`upAxis`: the forward direction is the exact `tangentAtDistance` of the arc-length table at the entity's distance; a 1024-sample RMF table is built once and supplies only the normal, interpolated at that distance (nearest lower and upper samples) and then re-orthogonalised against the exact tangent (remove the tangent component and normalise; if the remainder is shorter than 1e-9, use the guarded fallback of any unit vector perpendicular to the tangent); binormal is `tangent × normal`
    - `followPath` Travelled_Distance check: before using each Travelled_Distance (`startOffset + speed * frame / fps`), bake must check that it is a finite number and throw a clear error naming the entity and the frame if it is not, so the arc-length table is never the first place a bad value is caught. Suggested message, in the style of the existing validation messages: `Entity "<id>": travelled distance at frame <f> must be a finite number, got <value>`
    - `aimAt`: keyframe interpolation with hold, aim direction, coincident-position rule, +Y up. The entity position used is the position at that point in the stack (from earlier constraints in order, or the Rest_Pose origin if none) For f > 0 within 3 degrees of vertical, the up reference is the previous baked up direction projected perpendicular to the new aim direction and normalised; if the projection is shorter than 1e-9, use any unit vector perpendicular to the aim direction; the baked up axis equals the up reference within 1e-4
    - Blend with `lerp`/`slerp` by influence, record `heldFromFrame`, `travelled`, `rotationDrivers`, `aimDirections`
    - `travelled` and `heldFromFrame` come from the first `followPath` in constraint order; `aimDirections` holds the unit aim direction of the last `aimAt` in order, and the zero vector when there is no `aimAt` or the aim is coincident; `rotationDrivers` counts declared rotation-driving constraints (`aimAt`, or `followPath` with `alignToPath` true) regardless of influence
    - NaN-free output comes from the guarded fallbacks in the design (projection-length checks, zero-length guards in `normalize`, `slerp` near-parallel fallback). Do not replace non-finite values with the previous frame's value
    - Carry history in local variables only; leave the scene unmodified
    - Let `createCurve` errors (too few points, coincident points) propagate unchanged
    - _Requirements: 5.8, 5.10, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.14, 8.1, 8.2, 8.7, 10.11_

  - [ ] 8.2 Write property test for constraint order
    - **Property 23: Constraint order is by order value**
    - **Validates: Requirements 5.10**

  - [ ] 8.3 Write property test for followPath positions
    - **Property 24: followPath positions on the path**
    - Applies only to scenes where the constraint under test has influence 1 and no later constraint drives the same channel (position or rotation); the generator must enforce this
    - **Validates: Requirements 6.1, 8.2**

  - [ ] 8.4 Write property test for open-path hold
    - **Property 25: Open-path hold**
    - Applies only to scenes where the constraint under test has influence 1 and no later constraint drives the same channel (position or rotation); the generator must enforce this
    - **Validates: Requirements 8.1, 8.7**

  - [ ] 8.5 Write property test for alignToPath
    - **Property 26: alignToPath rotates the entity axes onto the path frame**
    - Applies only to scenes where the constraint under test has influence 1 and no later constraint drives the same channel (position or rotation); the generator must enforce this
    - Use `smoothCurvePoints` from task 4.1a for the path and any valid axis pair with `alignToPath` true
    - The baked rotation applied to `forwardAxis` equals the path tangent at that distance within 1e-4; applied to `upAxis` it is perpendicular to that tangent within 1e-6 and within 1e-2 of a dense RMF normal at that distance
    - With `alignToPath` false or omitted and a prior rotation, the rotation is unchanged
    - **Validates: Requirements 5.8, 6.2, 6.3**

  - [ ] 8.6 Write property test for aimAt
    - **Property 27: aimAt points the forward axis at the target**
    - Applies only to scenes where the constraint under test has influence 1 and no later constraint drives the same channel (position or rotation); the generator must enforce this
    - The entity position is the position at that point in the stack (from earlier constraints in order, or the Rest_Pose origin); the generator places the `aimAt` after any `followPath`
    - **Validates: Requirements 6.4, 6.5**

  - [ ] 8.7 Write property test for influence blending
    - **Property 28: Influence blends linearly**
    - Restrict to entities with a single constraint (state before is the rest pose), or compute the state before the constraint by baking a scene containing only that entity's earlier constraints
    - **Validates: Requirements 6.6, 6.7**

  - [ ] 8.8 Write property test for keyframed targets
    - **Property 29: Keyframed targets interpolate and hold**
    - **Validates: Requirements 6.8**

  - [ ] 8.9 Write property test for coincident aim
    - **Property 30: Coincident aim keeps previous rotation**
    - Applies only to scenes where the constraint under test has influence 1 and no later constraint drives the same channel (position or rotation); the generator must enforce this
    - The entity position is the position at that point in the stack (from earlier constraints in order, or the Rest_Pose origin); the generator places the `aimAt` after any `followPath`
    - **Validates: Requirements 6.9**

  - [ ] 8.10 Write property test for near-vertical aim
    - **Property 31: Near-vertical aim uses the projected previous up vector**
    - Applies only to scenes where the constraint under test has influence 1 and no later constraint drives the same channel (position or rotation); the generator must enforce this
    - For f > 0 with the aim within 3 degrees of vertical, let u be the previous baked up direction projected perpendicular to the new aim direction and normalised. When the projection length is at least 1e-9, the baked up axis equals u within 1e-4. Otherwise it equals a unit vector perpendicular to the aim direction within 1e-4. The baked rotation basis is orthonormal in both cases
    - **Validates: Requirements 7.4, 7.5, 7.6**

  - [ ] 8.11 Write property test for bake completeness and determinism
    - **Property 32: Bake is complete, deterministic and non-mutating**
    - Include the check that an entity whose only constraint has influence 0 bakes to the rest pose on every frame
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.7, 7.8, 10.10, 10.11**

  - [ ] 8.12 Write property test for invalid scenes in bake
    - **Property 33: Invalid scenes are rejected by bake**
    - Covers scene-level validation errors only (not path geometry errors from `createCurve`)
    - **Validates: Requirements 7.15**

  - [ ] 8.13 Write unit tests for bake edge cases
    - Create `test/bake/unit.test.ts` covering `alignToPath` default false, frame-0 coincident aim giving identity, vertical aim using the projected previous up vector (and the 1e-9 fallback), influence 0 giving the rest pose, zero speed
    - _Requirements: 5.8, 6.3, 6.7, 6.9, 7.4, 7.5, 7.7_

  - [ ] 8.14 Write property test for orientation smoothness
    - **Property 44: alignToPath orientation changes smoothly**
    - Use the Property 44 scene variant from task 7.2 (path from `smoothCurvePoints`, single `followPath`, influence 1, `alignToPath` true, speed above 0, any valid axis pair)
    - For every pair of consecutive frames where the earlier frame is not a held frame, `quatAngle` between the baked rotations is at most `2 * (speed / fps) / rMin + 0.001` radians, with `rMin` estimated from at least 4096 samples of the actual Catmull-Rom curve
    - **Validates: Requirements 6.10**

- [ ] 9. Implement evaluation
  - [ ] 9.1 Implement `src/evaluate.ts`
    - Implement `OutBuffer` and `evaluateEntity(baked, entityId, frame, out)`: map lookup, frame validation, then seven reads written into `out.position` and `out.rotation`
    - No objects, arrays or closures on the success path; build error strings only when throwing (`Unknown entity id "<id>"`, `Frame <frame> is outside the valid range [0, <frameCount-1>]`)
    - _Requirements: 7.9, 7.10, 7.11, 7.12, 7.13_

  - [ ] 9.2 Write property test for returned values
    - **Property 34: Evaluator returns baked values**
    - **Validates: Requirements 7.9**

  - [ ] 9.3 Write property test for read-only, allocation-free evaluation
    - **Property 35: Evaluator is read-only and allocation-free**
    - Freeze only the plain objects and arrays of the baked data (never its typed arrays, since `Object.freeze` throws on typed arrays with elements); compare copies of the typed-array contents taken before and after the calls
    - **Validates: Requirements 7.10, 7.11**

  - [ ] 9.4 Write property test for invalid arguments
    - **Property 36: Evaluator rejects invalid arguments**
    - **Validates: Requirements 7.12, 7.13**

  - [ ] 9.5 Write unit tests for evaluator allocation
    - Create `test/evaluate/unit.test.ts` with the identity assertion on the returned `out`, a source check on the success path of `evaluateEntity` that flags `new` expressions, array literals and object literals used as values, and arrow functions, but does not flag index access (such as `t[i]`) or code blocks, and a 100,000-call heap growth check below 1 MB when `gc` is available (skip the heap check otherwise)
    - _Requirements: 7.9, 7.11_

- [ ] 10. Implement the motion linter
  - [ ] 10.1 Implement `src/linter.ts`
    - Implement `Severity`, `Finding`, `motionLinter(scene, baked, options?)` with codes `path-end-reached` (info, once, `>=`, using `travelled` from the first `followPath` in constraint order), `roll-change` (warning, threshold in degrees per frame converted to radians once), `speed-spike` (warning, 3x median excluding held frames, none when median is 0), `aim-vertical`, `rotation-conflict` (frame 0)
    - Roll change between f-1 and f: F is the rotated `forwardAxis` at frame f; project the rotated `upAxis` of f-1 and of f onto the plane perpendicular to F and normalise each; the angle between them in [0, pi]; 0 if either projection is shorter than 1e-9
    - `aim-vertical` is emitted only on frames where the stored `aimDirections` vector is non-zero and within 3 degrees of ±Y
    - `rotation-conflict` is emitted when `rotationDrivers >= 2` (declared `aimAt` or `followPath` with `alignToPath` true, regardless of influence)
    - Sort by frame, entity index, then code; never mutate inputs
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11_

  - [ ] 10.2 Write property test for path-end-reached on open paths
    - **Property 38: path-end-reached is emitted exactly once on open paths, inclusively**
    - `travelled` is taken from the first `followPath` in the entity's constraint order; the generator includes scenes with several `followPath` constraints
    - **Validates: Requirements 8.3, 8.4, 8.6**

  - [ ] 10.3 Write property test for closed paths
    - **Property 39: path-end-reached is never emitted on closed paths**
    - **Validates: Requirements 8.5**

  - [ ] 10.4 Write property test for roll and vertical findings
    - **Property 40: Roll change and aim-vertical findings match their thresholds**
    - Compute roll change as in the design: F is the rotated `forwardAxis` at frame f; project the rotated `upAxis` of f-1 and of f onto the plane perpendicular to F, normalise each; angle in [0, pi]; 0 if either projection is shorter than 1e-9
    - `aim-vertical` appears exactly on frames where the stored aim direction (last `aimAt` in order; zero when no `aimAt` or coincident) is non-zero and within 3 degrees of ±Y; generators include scenes with and without `aimAt` and with coincident aims
    - **Validates: Requirements 9.2, 9.5, 9.11**

  - [ ] 10.5 Write property test for speed spikes
    - **Property 41: Speed spike uses the median of non-held frames**
    - Constant-speed path following cannot trigger `speed-spike`, so this property is expected to hold without exercising the emitting branch (see the design note)
    - **Validates: Requirements 9.3, 9.4, 9.9**

  - [ ] 10.6 Write property test for rotation conflict
    - **Property 42: Rotation conflict is reported on frame 0**
    - Count declared rotation-driving constraints (`aimAt`, or `followPath` with `alignToPath` true) regardless of influence; generators include constraints with influence 0 and below 1
    - **Validates: Requirements 9.6**

  - [ ] 10.7 Write property test for finding shape and ordering
    - **Property 43: Findings are well-formed, ordered and non-mutating**
    - **Validates: Requirements 9.1, 9.7, 9.8, 9.10**

  - [ ] 10.8 Write unit tests for linter edge cases
    - Create `test/linter/unit.test.ts` covering zero median speed, equality of travelled distance and path length on the last frame, and an entity that never reaches the end
    - For the exact-equality case use `fps = frameCount - 1`, `startOffset` 0 and speed equal to the path length, so the last frame's distance equals the length exactly
    - _Requirements: 8.4, 8.6, 9.9_

- [ ] 11. Wire the public API
  - [ ] 11.1 Implement `src/index.ts`
    - Re-export the public types and functions from `math`, `curve`, `arclength`, `frames`, `scene`, `bake`, `evaluate` and `linter`
    - _Requirements: 7.1, 7.9, 9.1, 10.12_

  - [ ] 11.2 Write property test for NaN-free output
    - **Property 37: No NaN in any output**
    - Import only from `src/index.ts`; cover coincident aim, near-vertical aim, zero influence, zero speed, held frames, closed paths and varied linter thresholds
    - **Validates: Requirements 7.14**

- [ ] 12. Checkpoint - Ensure all tests pass
  - Run `npm test` with `cwd` set to `spikes/path-core`. Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Final verification
  - [ ] 13.1 Run the full test suite and report results
    - Run the single-line command `npm test` with `cwd` set to `spikes/path-core` (never watch mode)
    - Report the number of test files and tests passed, failed and skipped, and quote the failing test names and messages if any
    - Do not change code in this task beyond reporting. If tests fail, tell the user what failed
    - _Requirements: 10.8, 10.12_

## Notes

- All tasks, including test tasks, are required.
- Each task references specific requirements for traceability.
- Property tests validate the universal correctness properties in the design. Unit tests validate specific examples and edge cases.
- `package.json` must not list `typescript`. `tsconfig.json` is for editor type checking, and vitest transpiles TypeScript itself.
- Tasks run one at a time, strictly in list order. The dependency graph has one task per wave in that order.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["2.1"] },
    { "id": 5, "tasks": ["2.2"] },
    { "id": 6, "tasks": ["2.3"] },
    { "id": 7, "tasks": ["2.4"] },
    { "id": 8, "tasks": ["2.5"] },
    { "id": 9, "tasks": ["2.6"] },
    { "id": 10, "tasks": ["3.1"] },
    { "id": 11, "tasks": ["3.2"] },
    { "id": 12, "tasks": ["3.3"] },
    { "id": 13, "tasks": ["3.4"] },
    { "id": 14, "tasks": ["3.5"] },
    { "id": 15, "tasks": ["3.6"] },
    { "id": 16, "tasks": ["3.7"] },
    { "id": 17, "tasks": ["4.1"] },
    { "id": 18, "tasks": ["4.1a"] },
    { "id": 19, "tasks": ["4.2"] },
    { "id": 20, "tasks": ["4.3"] },
    { "id": 21, "tasks": ["4.4"] },
    { "id": 22, "tasks": ["4.5"] },
    { "id": 23, "tasks": ["5.1"] },
    { "id": 24, "tasks": ["5.2"] },
    { "id": 25, "tasks": ["5.3"] },
    { "id": 26, "tasks": ["5.4"] },
    { "id": 27, "tasks": ["5.5"] },
    { "id": 28, "tasks": ["5.5a"] },
    { "id": 29, "tasks": ["5.6"] },
    { "id": 30, "tasks": ["6"] },
    { "id": 31, "tasks": ["7.1"] },
    { "id": 32, "tasks": ["7.2"] },
    { "id": 33, "tasks": ["7.3"] },
    { "id": 34, "tasks": ["7.4"] },
    { "id": 35, "tasks": ["7.5"] },
    { "id": 36, "tasks": ["7.6"] },
    { "id": 37, "tasks": ["8.1"] },
    { "id": 38, "tasks": ["8.2"] },
    { "id": 39, "tasks": ["8.3"] },
    { "id": 40, "tasks": ["8.4"] },
    { "id": 41, "tasks": ["8.5"] },
    { "id": 42, "tasks": ["8.6"] },
    { "id": 43, "tasks": ["8.7"] },
    { "id": 44, "tasks": ["8.8"] },
    { "id": 45, "tasks": ["8.9"] },
    { "id": 46, "tasks": ["8.10"] },
    { "id": 47, "tasks": ["8.11"] },
    { "id": 48, "tasks": ["8.12"] },
    { "id": 49, "tasks": ["8.13"] },
    { "id": 50, "tasks": ["8.14"] },
    { "id": 51, "tasks": ["9.1"] },
    { "id": 52, "tasks": ["9.2"] },
    { "id": 53, "tasks": ["9.3"] },
    { "id": 54, "tasks": ["9.4"] },
    { "id": 55, "tasks": ["9.5"] },
    { "id": 56, "tasks": ["10.1"] },
    { "id": 57, "tasks": ["10.2"] },
    { "id": 58, "tasks": ["10.3"] },
    { "id": 59, "tasks": ["10.4"] },
    { "id": 60, "tasks": ["10.5"] },
    { "id": 61, "tasks": ["10.6"] },
    { "id": 62, "tasks": ["10.7"] },
    { "id": 63, "tasks": ["10.8"] },
    { "id": 64, "tasks": ["11.1"] },
    { "id": 65, "tasks": ["11.2"] },
    { "id": 66, "tasks": ["12"] },
    { "id": 67, "tasks": ["13.1"] }
  ]
}
```
