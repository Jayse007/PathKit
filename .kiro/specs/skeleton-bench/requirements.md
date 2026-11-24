# Requirements Document

## Introduction

Skeleton Bench is a demo app in `apps/skeleton-bench/`. It is a browser workbench where a person turns a machine, zooms in, drags it across the screen, takes it apart and reads about each part. It works with mouse and keyboard first. Webcam gestures are a later upgrade and never a dependency. Three machines are built in code from Three.js shapes: a centrifugal pump, a shell-and-tube heat exchanger and a desk lamp.

PathKit is used for the orbit camera (`orbitAround` plus `aimAt`), the zoom rails (`followPath` plus `aimAt`), the curved part paths of the exploded view (one PathKit scene per part), and the motion linter on the guided tour. PathKit is not used for spinning a part in place (the impeller), dragging the machine, easing, or the cursor. PathKit cannot follow a live hand because it bakes ahead of time. A hand only chooses a frame number on a baked, checked path.

This document is derived from `.kiro/specs/skeleton-bench/brief.md` (DRAFT 2, 2026-11-24) and the steering files `agent-workflow`, `coordinate-conventions`, `testing-conventions`, `typescript-imports` and `windows-terminal`. Each requirement is marked Tier A (must ship), Tier B (after Tier A is deployed) or All (applies across tiers). Tier B requirements are blocked until the User says Tier A is deployed. The brief's build order has phases 0 to 6 (Spike, Tier A logic, One machine then three, Interface and looks, Deploy Tier A, Tier B, Manual and notes). Phases appear here only as context. This document contains no tasks.

The brief refers to a "Demo app 2 pitch" (v2) document that holds the research. That document is not in the repository. These requirements rest on the brief alone.

## Open questions and conflicts

Each item states the issue, the assumption used in this document, and who must decide. Requirements below follow the assumptions. If a decision changes an assumption, the affected requirements must be revised.

1. **Terminal commands.**
   - Issue: the `windows-terminal` rule allows only `npm.cmd test` from `packages/pathkit`. The app needs `npm.cmd install`, `npm.cmd test` and `npm.cmd run build` from `apps/skeleton-bench`.
   - Assumption: Kiro asks for none of these in `apps/skeleton-bench` until the User adds the matching lines to `.kiro/steering/windows-terminal.md`.
   - Decision: the User.
2. **Dependency rule scope.**
   - Issue: `coordinate-conventions` says there are no runtime dependencies and the only dev dependencies are `vitest` and `fast-check`. The app needs `three` (runtime), `vite`, `typescript`, `@types/three` and, in Tier B, `@mediapipe/tasks-vision`.
   - Assumption: that rule applies to `packages/pathkit` only. Exact versions are supplied or approved by the User in one `npm.cmd install` line. Kiro does not guess versions.
   - Decision: the User.
3. **Module settings.**
   - Issue: `typescript-imports` requires NodeNext and `.js` relative imports. Vite apps usually use Bundler resolution.
   - Assumption: the app `tsconfig.json` uses NodeNext and `.js` relative imports, like the rest of the repository.
   - Decision: the User confirms.
4. **Test conventions scope.**
   - Issue: `testing-conventions` auto-applies only to `packages/pathkit/test`.
   - Assumption: its rules also apply to app tests: plain checks inside loops, forced edge cases, naming the source line a test should catch, a 5 second limit per test file, and `SceneError` instances in thrown-error assertions.
   - Decision: the User confirms.
5. **File locations.**
   - Issue: a root `THIRD_PARTY.md` already exists, but the brief allows new files only inside `apps/skeleton-bench/`.
   - Assumption: `THIRD_PARTY.md` lives in `apps/skeleton-bench/`. `build-notes.md` and `sources.md` live in `apps/skeleton-bench/docs/`.
   - Decision: the User confirms.
6. **Deploy.**
   - Issue: build-order phase 4 says deploy Tier A and Tier B waits for it, yet the brief calls the deploy workflow a later, separate task.
   - Assumption: deploy is out of scope. Only the Vite `base` setting `/PathKit/skeleton-bench/` and a working build are in scope. Tier B starts only when the User says Tier A is deployed.
   - Decision: the User.
7. **Missing pitch document.**
   - Issue: the "Demo app 2 pitch" (v2) is not in the repository.
   - Assumption: requirements rest on the brief alone.
   - Decision: none needed. Recorded for the Reviewer.
8. **Easing.**
   - Issue: PathKit has no easing. `followPath` has constant speed and a `startOffset`.
   - Assumption: explode easing is app code that maps the explode amount to a baked frame. No requirement credits PathKit with easing.
   - Decision: none needed. Recorded for the design phase.
9. **Network and analytics.**
   - Issue: the brief says no analytics and no run-time network except self-hosted model files, but also says MediaPipe Tasks sends usage metrics to Google.
   - Assumption: "no analytics" means no analytics in our code. The pre-camera notice discloses the MediaPipe metrics. Whether the metrics call can be disabled is unknown, and Spike S5 (network off) may be affected by it.
   - Decision: the User.
10. **Zoom-to-part rails.**
    - Issue: the Goal names zoom-to-part rails, but no feature or test in the brief uses them.
    - Assumption: zoom-to-part rails are out of Tier A.
    - Decision: the User.
11. **Zoom rail clearance.**
    - Issue: Spike S2 checks only the last frame against the machine's bounding box. A middle frame could still enter the machine. It is also open whether the box is the assembled or the exploded box.
    - Assumption: every frame of the zoom rail is checked. The box choice is open.
    - Decision: the User.
12. **Reading choices in the brief.**
    - Issue: several phrases in the brief need a reading.
    - Assumption:
      - Spike S3 "without errors" means `motionLinter` does not throw and returns a findings list, because the linter severities are only `info` and `warning`.
      - The Gestures toggle is listed in the control bar but is Tier B, so it is absent or disabled in Tier A.
      - Sample specification values are invented and need no source. Job, material and position facts need a source id.
      - "Typical position" is a text description, not coordinates.
    - Decision: the User confirms.
13. **Open values.**
    - Issue: the frames per second (fps), the orbit lap frame count and the zoom rail frame count are not chosen. It is unclear whether 360 degrees wraps to frame 0 or gives the last frame. Negative angles wrap.
    - Assumption: the three values are named configuration constants, and tests use hand-computed expectations from the chosen values. 360 degrees gives the same frame as 0 degrees (wrap).
    - Decision: the User, before the design phase.
14. **Drag range.**
    - Issue: the unit (pixels or fraction of the viewport) and the formula for shrinking the range as the explode amount grows are not given. `setViewOffset` works in pixels, while the steering unit is metres.
    - Assumption: none.
    - Decision: the User, before the design phase.
15. **Click versus drag.**
    - Issue: the movement threshold that separates a click from a drag is not given.
    - Assumption: none. It is a named constant.
    - Decision: the User.
16. **Tour.**
    - Issue: which parts the tour visits and how it is paused or stopped are not given.
    - Assumption: the tour visits all parts of the current machine in keyboard order, with Pause and Stop controls (WCAG 2.2.2).
    - Decision: the User.
17. **Single-letter keys.**
    - Issue: the keys `M`, `E`, `R`, `+` and `-` fall under WCAG 2.1.4 (character key shortcuts).
    - Assumption: each key is active only when no text field or slider has focus, and each key has a visible button.
    - Decision: the User.
18. **Selected part cue.**
    - Issue: the orange accent alone is meaning by colour.
    - Assumption: the selected part also gets a second cue, such as a thicker outline, and its name appears in the inspector.
    - Decision: the User.
19. **Reduced motion.**
    - Issue: the effect of `prefers-reduced-motion` is not stated.
    - Assumption: it stops the impeller spin and replaces the tour and explode animation with jumps.
    - Decision: the User.
20. **Webcam consent.**
    - Issue: the brief does not say whether webcam consent is remembered.
    - Assumption: consent is not stored. `localStorage` holds only the theme and any "hint seen" flags, all listed in the README and all inside try/catch.
    - Decision: the User confirms.

## Glossary

- **Skeleton_Bench_App**: The browser app in `apps/skeleton-bench/`.
- **PathKit**: The library in `packages/pathkit`, imported only through `packages/pathkit/src/index.ts`.
- **Machine**: One of the three models: Pump, Heat_Exchanger or Desk_Lamp.
- **Part**: A named object of a Machine, with an id, name, job, material, position text and source id. The Part list is shared by the explode path, the inspector and the keyboard order.
- **Part_Catalogue**: The data module that lists every Machine and its Parts.
- **Stage**: The centre region that shows the Machine on a faint bench grid.
- **Inventory**: The left region with three Machine cards.
- **Inspector**: The right region that shows details of the selected Part.
- **Control_Bar**: The bottom region with the controls.
- **Motion_Check**: The small region that lists linter findings in plain words.
- **Finding**: One item returned by `motionLinter`.
- **Orbit_Lap**: The baked scene of one full turn around the Machine, made with `orbitAround` (axis +Y) and `aimAt` the Machine centre.
- **Zoom_Rail**: The baked scene that moves the camera toward the Machine, made with `followPath` and `aimAt`.
- **Part_Path**: The short, curved, baked PathKit scene of one Part for the exploded view.
- **Explode_Amount**: A value from 0 to 100 percent set by the explode slider.
- **Explode_Easing**: The app function that maps Explode_Amount to a frame of the Part_Paths.
- **Bench_Area**: The bounded region inside which the Machine can be moved on screen.
- **View_Offset**: The Three.js `PerspectiveCamera.setViewOffset` setting that shifts the Machine on screen.
- **Rotate_Mode** and **Move_Mode**: The two drag modes, switched by the Rotate / Move toggle.
- **Tour**: The guided camera path that visits the Parts, made with `followPath` and `aimAt`.
- **Look**: One of two colour and material sets: **X_Ray_Skeleton** (default) or **Clean_Engineering**.
- **Contrast_Function**: The pure function that returns the contrast ratio of two colours.
- **About_Panel**: The panel that shows the honest limits.
- **Frame_Mapper**: The pure logic that converts angle, zoom value and Explode_Amount to whole frame numbers.
- **Drag_Range**: The pure logic that clamps the Machine's offset inside the Bench_Area.
- **Sources_File**: The file `apps/skeleton-bench/docs/sources.md`.
- **Build_Notes**: The file `apps/skeleton-bench/docs/build-notes.md`.
- **Third_Party_File**: The file `apps/skeleton-bench/THIRD_PARTY.md`.
- **Spike**: Phase 0 checks S1 to S5 that prove facts before any interface is built.
- **Test_Suite**: The Vitest tests in `apps/skeleton-bench/`, run with `npm.cmd test`.
- **Stored_Setting**: A view setting or "hint seen" flag saved in `localStorage`.
- **Gesture_Lab**: The check page that shows the 21 hand points and the pose name live (Tier B).
- **Hand_Landmarks**: The 21 points per hand returned by the hand model (Tier B).
- **Pose_Classifier**: Our own pure code over the Hand_Landmarks that names a pose: fist, open palm or pinch (Tier B).
- **Openness**: A value from 0 (fist) to 1 (open palm) computed from the Hand_Landmarks (Tier B).
- **Gesture_Mode**: The mode picked by the number of hands in view: rotate or explode (one hand), zoom (two hands) (Tier B).
- **Kiro**: The AI agent that builds the app. Kiro cannot run terminal commands in this workspace.
- **User**: The person who runs commands, pastes the output back and reviews the app.
- **Reviewer**: The person who reviews the work and renders screenshots in a clean copy.

## Requirements

### Requirement 1: Project folder, scope and protected files (All)

**User Story:** As the Reviewer, I want the app self-contained and PathKit and the guards untouched, so that the demo cannot break the library or the checks.

#### Acceptance Criteria

1. THE Skeleton_Bench_App SHALL reside in `apps/skeleton-bench/` with its own `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts` and `.gitignore`.
2. THE Skeleton_Bench_App SHALL import PathKit only through `packages/pathkit/src/index.ts`.
3. THE Skeleton_Bench_App SHALL share no code with `apps/shot-rail/`.
4. THE Skeleton_Bench_App SHALL leave unchanged everything under `packages/pathkit`, every other `package.json`, `scripts/guard-*`, `.kiro/hooks/guard-*`, `scripts/check-constraints*` and `scripts/setup*`.
5. THE Skeleton_Bench_App SHALL name no new file or hook with the prefix `guard-`.
6. THE Skeleton_Bench_App SHALL add new files only inside `apps/skeleton-bench/` and `.kiro/specs/skeleton-bench/`, and the one existing file that may change SHALL be `apps/skeleton-bench/README.md`.
7. THE Skeleton_Bench_App SHALL set the Vite `base` option to `/PathKit/skeleton-bench/`.
8. THE Skeleton_Bench_App SHALL produce a successful build with `npm.cmd run build` from `apps/skeleton-bench`, and the deploy workflow SHALL remain out of scope (open question 6).
9. THE Skeleton_Bench_App SHALL make no network request at run time in Tier A.
10. WHERE Tier B gestures are turned on, THE Skeleton_Bench_App SHALL make network requests only to the app's own origin for the self-hosted wasm and model files.
11. THE Skeleton_Bench_App SHALL include no analytics code and no paid service.
12. IF a hook blocks a tool, THEN Kiro SHALL stop and tell the User what was blocked.

### Requirement 2: Commands, dependencies and imports (All)

**User Story:** As the User, I want commands and dependencies kept to what I approved, so that nothing is installed or run without my knowledge.

#### Acceptance Criteria

1. THE Kiro SHALL run no terminal command, and SHALL give the User the exact one-line command and the folder to run it in when a step needs one.
2. THE Kiro SHALL ask the User for no command in `apps/skeleton-bench` until the User has added the matching lines to `.kiro/steering/windows-terminal.md` (open question 1).
3. WHEN the app needs packages, THE Kiro SHALL give the User one `npm.cmd install` line with the exact versions that the User supplied or approved, and SHALL wait.
4. THE Skeleton_Bench_App SHALL use `three` as a runtime dependency and `vite`, `typescript`, `vitest` and `@types/three` as dev dependencies.
5. WHERE Tier B is unlocked, THE Skeleton_Bench_App SHALL add `@mediapipe/tasks-vision` as a dependency.
6. THE Skeleton_Bench_App SHALL keep `package-lock.json`.
7. THE Skeleton_Bench_App SHALL use `"module": "NodeNext"` in `tsconfig.json` and SHALL end every relative import in `.js`, in `src/` and in `test/` (open question 3).
8. THE Kiro SHALL NOT change `module` or `moduleResolution` to make an error go away.
9. WHEN Kiro creates or edits a `.ts` file, THE Kiro SHALL check the editor diagnostics for that file and SHALL report when the diagnostics are not visible.
10. THE Skeleton_Bench_App SHALL declare, for any entity it passes to PathKit, a `forwardAxis` and an `upAxis` on different coordinate axes, and SHALL NOT hard-code them in shared logic.
11. THE Skeleton_Bench_App SHALL use Y-up, right-handed coordinates, metres for distances, radians internally, and whole-number frames at a fixed fps.

### Requirement 3: Licences and third-party material (All)

**User Story:** As the Reviewer, I want licences recorded, so that the app can be published safely.

#### Acceptance Criteria

1. THE Third_Party_File SHALL list each dependency that the app uses, with its licence: `three` MIT, `@types/three` MIT, Vite MIT, Vitest MIT and TypeScript Apache-2.0.
2. WHERE the app uses `@mediapipe/tasks-vision` 1.2.3, THE Third_Party_File SHALL list it as Apache-2.0.
3. WHERE the app self-hosts the wasm files of `@mediapipe/tasks-vision`, THE Skeleton_Bench_App SHALL include the Apache-2.0 licence text in its own files, because the package contains no LICENSE or NOTICE file.
4. WHERE the app uses the Hand Landmarker model, THE Third_Party_File SHALL list it as Apache-2.0 per Google's model card and SHALL cite Zhang et al. 2020, arXiv:2006.10214.
5. WHERE the app uses the Hand Landmarker model, THE About_Panel and the README SHALL state that the model card marks it experimental and excludes surveillance and identity recognition.
6. WHEN a font is proposed, THE Kiro SHALL propose only open-licence candidates and the User SHALL check each licence before the font is added.
7. THE Skeleton_Bench_App SHALL use no image, icon or sound from outside the repository.
8. THE Skeleton_Bench_App SHALL use the working name "Skeleton Bench" and SHALL state in the README that the name is not trademark-checked.
9. THE Skeleton_Bench_App SHALL use none of the names J.A.R.V.I.S., Marvel or Stark in code, text, file names or comments.

### Requirement 4: Spike (Tier A, phase 0)

**User Story:** As the Reviewer, I want PathKit facts proved before the interface is built, so that the design rests on tested behaviour.

#### Acceptance Criteria

1. THE Spike SHALL run before any interface work begins.
2. THE Spike S1 SHALL bake one full Orbit_Lap with `orbitAround` (axis +Y) and `aimAt` the Machine centre, and SHALL read every whole frame of the lap with `evaluateEntity` without error.
3. THE Spike S2 SHALL bake a Zoom_Rail with `followPath` and `aimAt`, and SHALL check that every frame of the rail lies outside the Machine's bounding box (open question 11).
4. THE Spike S3 SHALL run `motionLinter` on the Tour and SHALL pass WHEN `motionLinter` does not throw and returns a findings list (open question 12).
5. THE Spike S1 to S3 SHALL be kept as tests in the Test_Suite.
6. THE Spike S4 SHALL be a manual check by the User of whether `PerspectiveCamera.setViewOffset` moves the Machine on screen without breaking orbit, zoom or clicking a Part.
7. IF Spike S4 fails, THEN THE Skeleton_Bench_App SHALL use the fallback of moving the Machine and re-baking the rails when the drag ends (3 to 12 ms per bake).
8. WHERE Tier B is unlocked, THE Spike S5 SHALL be a manual check by the User that the MediaPipe wasm and model load from the app's own folder in a built copy with the network off (open question 9).
9. THE Kiro SHALL record each Spike result in the Build_Notes.
10. IF a Spike check fails, THEN THE Kiro SHALL stop and ask the User before continuing.

### Requirement 5: Orbit angle to frame (Tier A)

**User Story:** As a user, I want an angle turned into a whole frame of the baked lap, so that dragging scrubs the orbit exactly.

#### Acceptance Criteria

1. WHEN an angle is given in degrees, THE Frame_Mapper SHALL return a whole frame number from 0 to the Orbit_Lap frame count minus 1.
2. THE Frame_Mapper SHALL return the same frame for 0 degrees and 360 degrees (open question 13).
3. WHEN the angle is 90 degrees and the Orbit_Lap has N frames with N divisible by 4, THE Frame_Mapper SHALL return frame N / 4. The same check SHALL hold for 180 degrees (N / 2).
4. WHEN the angle is 359.9 degrees, THE Frame_Mapper SHALL return a whole frame that is not fractional and is not outside the lap.
5. WHEN the angle is negative, THE Frame_Mapper SHALL wrap it into 0 to 360 degrees first, so that -90 degrees gives the same frame as 270 degrees.
6. IF the angle is not a finite number, THEN THE Frame_Mapper SHALL fail with an error message that names the invalid value.
7. THE Frame_Mapper SHALL be pure: the same input SHALL always give the same output.

### Requirement 6: Zoom value to frame (Tier A)

**User Story:** As a user, I want a zoom value turned into a frame of the baked rail, so that the slider, wheel and keys reach exact frames.

#### Acceptance Criteria

1. WHEN the zoom value is 0, THE Frame_Mapper SHALL return frame 0.
2. WHEN the zoom value is 1, THE Frame_Mapper SHALL return the last frame of the Zoom_Rail.
3. WHEN the zoom value is 0.5 and the Zoom_Rail has M frames with M odd, THE Frame_Mapper SHALL return frame (M - 1) / 2.
4. WHEN the zoom value is below 0 or above 1, THE Frame_Mapper SHALL clamp it to 0 or 1.
5. IF the zoom value is not a finite number, THEN THE Frame_Mapper SHALL fail with an error message that names the invalid value.
6. THE Frame_Mapper SHALL return only whole frame numbers inside the baked range.

### Requirement 7: Drag range (Tier A)

**User Story:** As a user, I want the move range bounded, so that the Machine and its exploded Parts cannot leave the screen.

#### Acceptance Criteria

1. WHEN a requested offset lies inside the Bench_Area, THE Drag_Range SHALL return it unchanged.
2. WHEN a requested offset lies on the edge of the Bench_Area, THE Drag_Range SHALL return it unchanged.
3. WHEN a requested offset lies outside the Bench_Area, THE Drag_Range SHALL return the nearest offset on the edge.
4. WHEN a reset is requested, THE Drag_Range SHALL return the zero offset.
5. WHEN the Explode_Amount grows, THE Drag_Range SHALL shrink the Bench_Area, and the Bench_Area at 100 percent SHALL be no larger than the Bench_Area at 0 percent.
6. IF the Explode_Amount changes so that the current offset lies outside the new Bench_Area, THEN THE Skeleton_Bench_App SHALL clamp the offset to the new Bench_Area.
7. IF the offset or the Explode_Amount is not a finite number, THEN THE Drag_Range SHALL fail with an error message that names the invalid value.
8. THE Drag_Range SHALL be pure, and its unit and shrink formula SHALL be fixed before the design phase (open question 14).

### Requirement 8: Explode easing (Tier A)

**User Story:** As a user, I want the explode amount turned into an eased frame of each Part_Path, so that Parts leave and return smoothly.

#### Acceptance Criteria

1. WHEN the Explode_Amount is 0 percent, THE Explode_Easing SHALL return the first frame of every Part_Path, which is the rest position.
2. WHEN the Explode_Amount is 100 percent, THE Explode_Easing SHALL return the last frame of every Part_Path, which is the end position.
3. WHEN the Explode_Amount increases, THE Explode_Easing SHALL return a frame that is greater than or equal to the frame returned for the smaller amount.
4. WHEN the Explode_Amount is below 0 or above 100 percent, THE Explode_Easing SHALL clamp it to 0 or 100.
5. THE Explode_Easing SHALL return only whole frame numbers inside the baked range of the Part_Path.
6. IF the Explode_Amount is not a finite number, THEN THE Explode_Easing SHALL fail with an error message that names the invalid value.
7. THE Explode_Easing SHALL be app code, and the Skeleton_Bench_App SHALL NOT describe PathKit as providing easing (open question 8).

### Requirement 9: Part data checks (Tier A)

**User Story:** As the Reviewer, I want every Part's data checked by tests, so that a missing or wrong entry fails early.

#### Acceptance Criteria

1. THE Part_Catalogue SHALL give every Part an id, name, job, material, position text and source id.
2. THE Part_Catalogue SHALL give every id a value that is unique across all Machines.
3. THE Part_Catalogue SHALL give every source id a value that exists in the Sources_File.
4. THE Part_Catalogue SHALL list every Part of a Machine exactly once in the keyboard order of that Machine.
5. IF a Part lacks a field, repeats an id, or has a source id that is missing from the Sources_File, THEN THE Test_Suite SHALL fail and name the Part.
6. THE Part_Catalogue SHALL be the single source for the explode paths, the Inspector and the keyboard order.

### Requirement 10: Orbit (Tier A)

**User Story:** As a user, I want to turn the Machine by dragging or with the arrow keys, so that I can see it from every side.

#### Acceptance Criteria

1. WHILE the Skeleton_Bench_App is in Rotate_Mode, WHEN the User drags on the empty bench or on the Machine, THE Skeleton_Bench_App SHALL convert the drag angle to a whole frame number and show that frame of the Orbit_Lap.
2. WHEN the User presses the left or right arrow key, THE Skeleton_Bench_App SHALL move the Orbit_Lap by a fixed whole number of frames.
3. THE Skeleton_Bench_App SHALL build the Orbit_Lap with `orbitAround` and `aimAt`, with `orbitAround` having a lower `order` than `aimAt`.
4. THE Skeleton_Bench_App SHALL bake the Orbit_Lap once per Machine at load and SHALL NOT bake during dragging.
5. THE Skeleton_Bench_App SHALL show each key beside its control.

### Requirement 11: Zoom (Tier A)

**User Story:** As a user, I want to zoom with the wheel, keys or a slider, so that I can look closer without entering the Machine.

#### Acceptance Criteria

1. WHEN the User scrolls the wheel, presses `+` or `-`, or moves the zoom slider, THE Skeleton_Bench_App SHALL convert the zoom value to a whole frame and show that frame of the Zoom_Rail.
2. THE Skeleton_Bench_App SHALL build the Zoom_Rail with `followPath` and `aimAt`.
3. THE Skeleton_Bench_App SHALL keep every frame of the Zoom_Rail outside the Machine's bounding box (open question 11).
4. IF a Zoom_Rail frame lies inside the bounding box, THEN THE Test_Suite SHALL fail.
5. THE Skeleton_Bench_App SHALL bake the Zoom_Rail at load.

### Requirement 12: Move across the screen (Tier A)

**User Story:** As a user, I want to slide the Machine across the screen, so that I can make room for the Inspector or compare Parts.

#### Acceptance Criteria

1. THE Control_Bar SHALL show a Rotate / Move toggle and the key `M` SHALL switch between the two modes.
2. WHILE the Skeleton_Bench_App is in Move_Mode, WHEN the User drags, THE Skeleton_Bench_App SHALL slide the Machine inside the Bench_Area.
3. WHILE the Skeleton_Bench_App is in Move_Mode, WHEN the User presses an arrow key, THE Skeleton_Bench_App SHALL slide the Machine by a fixed step inside the Bench_Area.
4. THE Skeleton_Bench_App SHALL clamp every offset with the Drag_Range.
5. THE Control_Bar SHALL show a `Reset position` button, and the key `R` SHALL return the Machine to the zero offset.
6. THE Skeleton_Bench_App SHALL implement Move_Mode as a View_Offset and SHALL NOT use PathKit for it.
7. IF Spike S4 fails, THEN THE Skeleton_Bench_App SHALL use the fallback of Requirement 4.7.
8. THE Skeleton_Bench_App SHALL provide a way to move the Machine that needs no drag, to meet WCAG 2.2 Dragging Movements.
9. WHEN the User presses a key shortcut while a text field or a slider has focus, THE Skeleton_Bench_App SHALL ignore the shortcut (open question 17).

### Requirement 13: Explode (Tier A)

**User Story:** As a user, I want to take the Machine apart with a slider, so that I can see its Parts separately.

#### Acceptance Criteria

1. THE Control_Bar SHALL show an explode slider from 0 to 100 percent, and the key `E` SHALL toggle between 0 and 100 percent.
2. WHEN the Explode_Amount changes, THE Skeleton_Bench_App SHALL show the frame that the Explode_Easing returns for every Part_Path.
3. THE Skeleton_Bench_App SHALL build one PathKit scene per Part, and each scene SHALL give that Part a short, curved path.
4. THE Skeleton_Bench_App SHALL bake all Part_Paths at load and SHALL NOT bake while the slider moves.
5. THE Skeleton_Bench_App SHALL spin the impeller of the Pump with ordinary Three.js code and SHALL NOT use PathKit for the spin.
6. WHEN the Explode_Amount changes, THE Skeleton_Bench_App SHALL apply the Drag_Range clamp of Requirement 7.6.
7. WHERE the User has asked for reduced motion, THE Skeleton_Bench_App SHALL jump to the new explode state without animation (open question 19).

### Requirement 14: Inspect (Tier A)

**User Story:** As a learner, I want to pick a Part and read about it, so that I understand what it does.

#### Acceptance Criteria

1. WHEN the User clicks a Part, THE Skeleton_Bench_App SHALL select it.
2. WHEN the User presses Tab to focus a Part and then presses Enter, THE Skeleton_Bench_App SHALL select it.
3. WHEN a Part is selected, THE Inspector SHALL show its name, job, material and typical position (as text).
4. THE Inspector SHALL label the sample specifications "sample data".
5. WHILE no Part is selected, THE Inspector SHALL show the text "Pick a part to read about it".
6. THE Skeleton_Bench_App SHALL treat a pointer movement below the click threshold as a click and above it as a drag (open question 15).
7. WHEN a Part is selected, THE Skeleton_Bench_App SHALL show a second cue besides colour on that Part, such as a thicker outline (open question 18).
8. THE Skeleton_Bench_App SHALL move keyboard focus through the Parts in the order of the Part_Catalogue.

### Requirement 15: Inventory (Tier A)

**User Story:** As a user, I want to choose between three Machines, so that I can explore each.

#### Acceptance Criteria

1. THE Inventory SHALL show three Machine cards: pump, heat exchanger and desk lamp.
2. THE Inventory SHALL show on each card a thumbnail drawn in SVG by the project.
3. WHEN the User activates a card by click or by Enter, THE Skeleton_Bench_App SHALL show that Machine on the Stage with the Explode_Amount at 0, the zero offset and no selected Part.
4. THE Skeleton_Bench_App SHALL show the Pump on the Stage at start.

### Requirement 16: Guided tour and motion check (Tier A)

**User Story:** As a learner, I want a guided tour of the Parts, so that I see each Part without steering.

#### Acceptance Criteria

1. THE Control_Bar SHALL show a Tour button.
2. WHEN the User activates the Tour button, THE Skeleton_Bench_App SHALL play a camera path that visits every Part of the current Machine in keyboard order (open question 16).
3. THE Skeleton_Bench_App SHALL build the Tour with `followPath` and `aimAt`.
4. THE Control_Bar SHALL show Pause and Stop controls while the Tour plays.
5. WHEN the Tour is baked, THE Skeleton_Bench_App SHALL run `motionLinter` on it and SHALL show the Findings in the Motion_Check in plain words.
6. WHILE the linter returns no Findings, THE Motion_Check SHALL state that no findings were reported.
7. IF the baking or the linting fails, THEN THE Skeleton_Bench_App SHALL show a message that states what failed and what the User can do next.
8. WHERE the User has asked for reduced motion, THE Skeleton_Bench_App SHALL replace the Tour animation with a jump from one Part to the next (open question 19).

### Requirement 17: Theme toggle (Tier A)

**User Story:** As a user, I want two looks, so that I can pick the one I read best.

#### Acceptance Criteria

1. THE Skeleton_Bench_App SHALL offer the Looks X_Ray_Skeleton and Clean_Engineering with the same layout and two sets of colour settings and two sets of materials.
2. THE Skeleton_Bench_App SHALL start in X_Ray_Skeleton.
3. THE X_Ray_Skeleton Look SHALL use a near-black background, bone-ivory translucent fills, thin cyan edges made with `EdgesGeometry` and one orange accent for the selected Part, and SHALL use no bats, cobwebs or stock horror imagery.
4. THE Clean_Engineering Look SHALL use a light neutral background, solid matte Parts and one blue accent.
5. WHEN the User switches the Look, THE Skeleton_Bench_App SHALL store the choice as a Stored_Setting inside try/catch.
6. IF reading or writing the Stored_Setting fails, THEN THE Skeleton_Bench_App SHALL continue with the default Look and SHALL show no error.
7. WHEN the app starts and a stored Look exists, THE Skeleton_Bench_App SHALL use the stored Look.

### Requirement 18: Machines and parts (Tier A)

**User Story:** As a learner, I want each Machine to have the named Parts of a real one, so that what I read matches what I see.

#### Acceptance Criteria

1. THE Part_Catalogue SHALL list for the Pump these Parts: casing, impeller, shaft, bearing housing, mechanical seal, flange, bolts (one group) and motor.
2. THE Part_Catalogue SHALL list for the Heat_Exchanger these Parts: shell, tube bundle (instanced cylinders, one Part), tube sheet, baffles, channel head and nozzles.
3. THE Part_Catalogue SHALL list for the Desk_Lamp these Parts: base, lower arm, upper arm, joint, shade and bulb holder.
4. THE Skeleton_Bench_App SHALL build every Machine in code from Three.js shapes and SHALL import no model file.
5. THE Skeleton_Bench_App SHALL make each Part a named object.

### Requirement 19: Accuracy and sources (Tier A)

**User Story:** As the Reviewer, I want every fact checked against a source, so that the app teaches nothing wrong.

#### Acceptance Criteria

1. THE Sources_File SHALL record for each fact about a Part its part, claim, source and date checked.
2. THE Skeleton_Bench_App SHALL show a job, material or position fact for a Part only WHEN the fact is checked against at least one reputable source and recorded in the Sources_File.
3. THE Kiro SHALL write no fact from memory.
4. THE User SHALL check the Part text before it ships.
5. THE Skeleton_Bench_App SHALL mark invented sample specification values as "sample data", and those values SHALL need no source (open question 12).

### Requirement 20: Interface layout and looks (Tier A)

**User Story:** As a user, I want a clear layout, so that I find each control and readout.

#### Acceptance Criteria

1. THE Skeleton_Bench_App SHALL show the Stage in the centre, the Inventory on the left, the Inspector on the right, the Control_Bar at the bottom and the Motion_Check as a small region.
2. THE Control_Bar SHALL hold the Rotate / Move toggle, the explode slider, the orbit scrub, the zoom control, the Tour button, the `Reset position` button and the Theme toggle.
3. WHILE Tier B is not unlocked, THE Control_Bar SHALL omit the Gestures toggle or show it disabled with a label that gestures are not available yet (open question 12).
4. THE Stage SHALL show the Machine on a faint bench grid.
5. THE Skeleton_Bench_App SHALL use left-drag to rotate in Rotate_Mode, left-drag to move in Move_Mode, the wheel to zoom and a click to select.

### Requirement 21: Intuitive use (Tier A)

**User Story:** As a first-time user, I want guidance and clear states, so that I can use the app without a manual.

#### Acceptance Criteria

1. THE Skeleton_Bench_App SHALL load the Pump at start so that the Stage is not empty.
2. THE Skeleton_Bench_App SHALL show a visible label and a key hint on every control.
3. WHEN a new user opens the app, THE Skeleton_Bench_App SHALL let the user perform a first action, such as turning the Machine, within about ten seconds.
4. WHERE a hint is shown the first time a mode opens, THE Skeleton_Bench_App SHALL store a "hint seen" flag as a Stored_Setting inside try/catch.
5. IF an error occurs, THEN THE Skeleton_Bench_App SHALL show a message that states what went wrong and what the User can do next.

### Requirement 22: Accessibility (Tier A)

**User Story:** As a user with low vision or motion sensitivity, I want readable, keyboard-friendly, motion-safe controls, so that I can use the app.

#### Acceptance Criteria

1. THE Skeleton_Bench_App SHALL show text and interface parts with a contrast ratio of at least 4.5 to 1 in both Looks.
2. THE Contrast_Function SHALL be pure, and the Test_Suite SHALL check it with hand-computed expected values and SHALL check every text and background pair of both Looks.
3. THE Skeleton_Bench_App SHALL show a visible focus ring on every focusable control.
4. THE Skeleton_Bench_App SHALL convey no meaning by colour alone.
5. WHILE the User has set `prefers-reduced-motion`, THE Skeleton_Bench_App SHALL stop the impeller spin and replace the Tour and explode animation with jumps (open question 19).
6. THE Skeleton_Bench_App SHALL provide a keyboard path for every mouse action.
7. THE Skeleton_Bench_App SHALL provide a non-drag alternative for every drag action, to meet WCAG 2.2 Dragging Movements.
8. THE Skeleton_Bench_App SHALL give each single-letter shortcut a visible button (open question 17).

### Requirement 23: Stored settings and privacy (All)

**User Story:** As a user, I want the app to store almost nothing, so that my data stays on my machine.

#### Acceptance Criteria

1. THE Skeleton_Bench_App SHALL store only the Look and any "hint seen" flags in `localStorage`.
2. THE README SHALL list every stored key.
3. THE Skeleton_Bench_App SHALL wrap every `localStorage` read and write in try/catch.
4. THE Skeleton_Bench_App SHALL NOT store webcam consent (open question 20).
5. THE Skeleton_Bench_App SHALL record no webcam image and store no webcam image.

### Requirement 24: Honest limits (All)

**User Story:** As a user, I want the app to say what it cannot do, so that I do not trust it too far.

#### Acceptance Criteria

1. THE About_Panel and the README SHALL state that the Machines are simplified models built from shapes.
2. THE About_Panel and the README SHALL state that specifications are invented sample data.
3. THE About_Panel and the README SHALL state that the impeller spin, the dragging and the cursor are ordinary Three.js and not PathKit.
4. THE About_Panel and the README SHALL state that PathKit cannot follow a live hand because it bakes ahead of time.
5. THE About_Panel and the README SHALL state that gestures need a webcam, light and a page served over HTTPS.
6. THE About_Panel and the README SHALL state that two-hand zoom is the least stable gesture.
7. THE About_Panel and the README SHALL state that moving the Machine has no gesture.
8. THE About_Panel and the README SHALL state that the pose classifier is our own code over the 21 hand points and that no second model is used.
9. THE About_Panel and the README SHALL state that MediaPipe sends usage metrics to Google.
10. THE Skeleton_Bench_App SHALL give the User access to the About_Panel from the main screen.

### Requirement 25: Tier B gate and Gesture_Lab (Tier B)

**User Story:** As the User, I want to try the hand tracking on my own webcam and light first, so that I know it works before gestures are built.

#### Acceptance Criteria

1. THE Kiro SHALL start no Tier B work until the User says Tier A is deployed.
2. THE Gesture_Lab SHALL be built before any gesture.
3. THE Gesture_Lab SHALL show the 21 Hand_Landmarks live and SHALL show the pose name live.
4. THE Kiro SHALL build the gestures one at a time in this order: rotate, explode, zoom.
5. THE Skeleton_Bench_App SHALL keep a mouse or keyboard twin for every gesture, and each twin SHALL already exist from Tier A.
6. IF the User's webcam test in the Gesture_Lab fails, THEN THE Kiro SHALL stop and ask the User before building the gesture that depends on it.

### Requirement 26: Gesture modes and poses (Tier B)

**User Story:** As a user, I want the number of hands to pick the mode, so that gestures do not clash.

#### Acceptance Criteria

1. WHEN one hand is in view, THE Skeleton_Bench_App SHALL select rotate or explode according to the pose of that hand.
2. WHEN two hands are in view, THE Skeleton_Bench_App SHALL select zoom.
3. WHILE two hands are in view, THE Skeleton_Bench_App SHALL pause rotate and explode.
4. THE Pose_Classifier SHALL name a fist, an open palm and a pinch from the Hand_Landmarks.
5. THE Pose_Classifier SHALL compute Openness from 0 for a fist to 1 for an open palm.
6. THE Pose_Classifier SHALL be our own pure code, and the Skeleton_Bench_App SHALL use no second model.

### Requirement 27: Rotate gesture (Tier B)

**User Story:** As a user, I want to pinch and drag to turn the Machine, so that I can rotate without touching the mouse.

#### Acceptance Criteria

1. WHEN one hand holds a pinch (thumb and index finger touching) for about 300 ms, THE Skeleton_Bench_App SHALL start rotate.
2. WHILE rotate is active, WHEN the hand moves, THE Skeleton_Bench_App SHALL convert the movement to an angle and then to a whole frame of the Orbit_Lap.
3. WHEN the pinch ends, THE Skeleton_Bench_App SHALL stop rotate and keep the current frame.

### Requirement 28: Explode gesture (Tier B)

**User Story:** As a user, I want an opening hand to take the Machine apart, so that I can explode it without a slider.

#### Acceptance Criteria

1. WHILE one hand is in view and the pose is not a pinch, THE Skeleton_Bench_App SHALL set the Explode_Amount from the smoothed Openness.
2. THE Skeleton_Bench_App SHALL map Openness 0 (fist) to 0 percent and Openness 1 (open palm) to 100 percent.
3. THE Skeleton_Bench_App SHALL apply a dead zone at both ends of the Openness range, so that a fully open hand always reads 100 percent and a closed fist reads 0 percent.
4. IF the continuous mapping proves unstable in the Gesture_Lab, THEN THE Skeleton_Bench_App SHALL use a trigger: an opening hand SHALL play the full explode and a closing hand SHALL reassemble the Machine.
5. THE Skeleton_Bench_App SHALL NOT use a pinch for explode.

### Requirement 29: Zoom gesture (Tier B)

**User Story:** As a user, I want to move two hands apart to zoom in, so that zoom works like a phone pinch.

#### Acceptance Criteria

1. WHILE two hands are in view, THE Skeleton_Bench_App SHALL compute the ratio of the current distance between the two palm centres to the distance at the start of the gesture.
2. WHEN the ratio is above 1, THE Skeleton_Bench_App SHALL zoom in, and WHEN the ratio is below 1, THE Skeleton_Bench_App SHALL zoom out.
3. THE Skeleton_Bench_App SHALL convert the ratio to a zoom value and then to a frame of the Zoom_Rail with the Frame_Mapper.
4. WHERE time is short, THE Kiro SHALL drop the zoom gesture first.

### Requirement 30: Gesture rules (Tier B)

**User Story:** As a user, I want steady gestures, so that a shaky hand does not jerk the view.

#### Acceptance Criteria

1. THE Skeleton_Bench_App SHALL smooth the Hand_Landmarks before it uses them.
2. THE Skeleton_Bench_App SHALL require a pose to be held for about 300 ms before it starts a gesture.
3. WHEN a frame shows no hand, THE Skeleton_Bench_App SHALL ignore that frame and keep the current state.
4. WHEN the User turns gestures off or leaves the page, THE Skeleton_Bench_App SHALL stop every webcam track.

### Requirement 31: Live status overlay (Tier B)

**User Story:** As a user, I want to see what the app reads from my hand, so that I know why it acts.

#### Acceptance Criteria

1. WHILE gestures are on, THE Skeleton_Bench_App SHALL show a small drawn hand skeleton.
2. WHILE gestures are on, THE Skeleton_Bench_App SHALL show in words the gesture being read, for example "Pinching: rotating".
3. THE Skeleton_Bench_App SHALL NOT convey the gesture state by colour alone.

### Requirement 32: Webcam privacy notice (Tier B)

**User Story:** As a user, I want to know what happens to my camera images before the camera starts, so that I can decline.

#### Acceptance Criteria

1. WHEN the User turns gestures on, THE Skeleton_Bench_App SHALL show a plain notice before the webcam starts.
2. THE notice SHALL state that images are processed on the device and are not sent anywhere.
3. THE notice SHALL state that MediaPipe Tasks sends usage metrics to Google.
4. THE notice SHALL state that the User can decline and keep using the mouse and keyboard.
5. THE notice SHALL state that nothing is recorded and nothing is stored.
6. IF the User declines, THEN THE Skeleton_Bench_App SHALL NOT start the webcam and SHALL keep the mouse and keyboard controls working.
7. IF the webcam is unavailable or access is denied, THEN THE Skeleton_Bench_App SHALL show a message that states what failed and that the mouse and keyboard still work.

### Requirement 33: Lazy loading of the hand model (Tier B)

**User Story:** As a user, I want the large files loaded only when I ask for gestures, so that the app opens quickly.

#### Acceptance Criteria

1. THE Skeleton_Bench_App SHALL load the wasm files (about 15 MB) and the model only WHEN the User turns gestures on.
2. THE Skeleton_Bench_App SHALL self-host the wasm files and the model in the app folder.
3. WHILE the model loads, THE Skeleton_Bench_App SHALL show a loading state.
4. IF the model fails to load, THEN THE Skeleton_Bench_App SHALL show a message that states what failed and that the mouse and keyboard still work.

### Requirement 34: Gesture logic tests (Tier B)

**User Story:** As the Reviewer, I want the gesture logic tested without a webcam, so that a passing test means something.

#### Acceptance Criteria

1. THE Test_Suite SHALL test the Pose_Classifier with hand-written Hand_Landmarks fixtures for a fist, an open palm and a pinch.
2. THE Test_Suite SHALL test Openness from 0 to 1 with hand-written fixtures.
3. THE Test_Suite SHALL test that one hand picks rotate or explode and two hands pick zoom.
4. THE Test_Suite SHALL test the conversion of the two-hand distance ratio to a Zoom_Rail frame.
5. THE Test_Suite SHALL test the smoothing.
6. THE Test_Suite SHALL test that a frame with no hand gives no change.
7. THE Test_Suite SHALL test that a pinch must be held for about 300 ms before rotate starts.
8. THE Test_Suite SHALL need no browser, no network and no webcam.

### Requirement 35: Tests (Tier A)

**User Story:** As the Reviewer, I want tests with hand-written expectations, so that a passing test means something.

#### Acceptance Criteria

1. THE Test_Suite SHALL run with Vitest from `apps/skeleton-bench` with `npm.cmd test` and SHALL need no browser, no network and no webcam.
2. THE Test_Suite SHALL test the angle-to-frame mapping at 0, 90, 180, 359.9 and 360 degrees, with negative angles wrapping and results always whole (Requirement 5).
3. THE Test_Suite SHALL test the zoom value-to-frame mapping at both ends, the middle and clamped outside the range (Requirement 6).
4. THE Test_Suite SHALL test the Drag_Range inside, on the edge, outside, on reset, and with the range shrinking as the Explode_Amount grows (Requirement 7).
5. THE Test_Suite SHALL test the Explode_Easing at 0 and 100 percent with every Part at its rest and end position, and with no frame outside the baked range (Requirement 8).
6. THE Test_Suite SHALL test the Part_Catalogue checks of Requirement 9.
7. THE Test_Suite SHALL check that every scene passes `validateScene` and that `orbitAround` has a lower `order` than `aimAt`.
8. THE Test_Suite SHALL keep the Spike S1 to S3 results as tests.
9. THE Test_Suite SHALL use hand-written expected values and SHALL NOT compute expected values with the code under test.
10. THE Test_Suite SHALL follow the `testing-conventions` rules: plain checks inside loops, forced edge cases, `SceneError` instances in thrown-error assertions and a 5 second limit per test file (open question 4).
11. WHEN a task adds a test, THE task SHALL name the source line that the test should catch.
12. THE Test_Suite SHALL NOT be weakened to make a test pass.
13. IF a property test fails, THEN Kiro SHALL say whether the code or the property is wrong, SHALL make at most 3 fix attempts, and SHALL then stop and report the seed and the counterexample.
14. THE Kiro SHALL say that a task is done only after the User has pasted passing test results, and SHALL report the counts of tests passed, failed and skipped from that output.

### Requirement 36: Notes and sources (All)

**User Story:** As the Reviewer, I want a short build note after each task, so that I can later merge them into the building guide.

#### Acceptance Criteria

1. WHEN a task is finished, THE Kiro SHALL add one short entry to the Build_Notes that states what was done, what broke, what Kiro got wrong and which PathKit feature was used.
2. THE Build_Notes SHALL be kept in `apps/skeleton-bench/docs/build-notes.md` (open question 5).
3. THE Sources_File SHALL be kept in `apps/skeleton-bench/docs/sources.md`.
4. THE Skeleton_Bench_App SHALL leave the merge of the Build_Notes into `docs/building-an-app-on-pathkit.md` to the Reviewer.

### Requirement 37: Verification limits and reporting (All)

**User Story:** As the Reviewer, I want a plain statement of what was and was not tested, so that I know what to check by hand.

#### Acceptance Criteria

1. THE final report SHALL state plainly that Kiro did not test how the app looks, the WebGL output, the View_Offset, clicking a Part, the webcam, the real gestures or the load time.
2. THE final report SHALL state that the User checks those items and that the Reviewer renders screenshots in a clean copy.
3. THE Kiro SHALL report test counts only from output that the User has pasted.
4. IF pasted output is missing or cut off, THEN THE Kiro SHALL ask the User to paste it again.
5. THE Kiro SHALL execute one task at a time, in list order, and SHALL stop and ask the User when a task is blocked.

### Requirement 38: Cut features (All)

**User Story:** As the Reviewer, I want the cut features listed, so that no one builds them by accident.

#### Acceptance Criteria

1. THE Skeleton_Bench_App SHALL include none of these: flow mode, parametric edit, voice, a language model at run time, CAD kernels, imported models, a gesture for Move, a wrist-flick gesture, pinch-to-explode and index-finger zoom.
2. THE Skeleton_Bench_App SHALL leave zoom-to-part rails out of Tier A (open question 10).
