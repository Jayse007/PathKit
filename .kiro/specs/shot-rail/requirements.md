# Requirements Document

## Introduction

Shot Rail is a demo app in `apps/shot-rail/` that answers one question: "If I film this subject from here, with this lens and this movement, what will it look like?" A user places cameras around a moving subject, sees what each camera sees, picks one as the main camera, gives it a move, and gets a motion check. It is a rough planning tool and says so.

The app uses PathKit for the work a plain camera cannot do: the subject follows a path and aligns to it with eased speed, several cameras sit around the subject and keep aiming at it, the main camera can follow its own path, and the motion linter checks the camera move.

This document is derived from `.kiro/specs/shot-rail/brief.md` (DRAFT 1, 2026-11-24) and the steering files `agent-workflow`, `coordinate-conventions`, `testing-conventions`, `typescript-imports` and `windows-terminal`. Each requirement is marked P1 (must ship), P2 or P3 (only if time remains), or "All" for rules that apply across priorities. The brief's build order has phases 0 to 5 (Spike, Pure logic, Stage and views, Modes and timeline, Design pass, Manual and deploy). Phases appear here only as context. This document contains no tasks.

## Open questions and conflicts

Each item states the issue, the assumption used in this document, and who must decide. Requirements below follow the assumptions. If a decision changes an assumption, the affected requirements must be revised.

1. **Terminal commands.**
   - Issue: the `windows-terminal` rule allows only `npm.cmd test` from `packages/pathkit`. The brief needs `npm.cmd install`, `npm.cmd test` and `npm.cmd run build` from `apps/shot-rail`.
   - Assumption: Kiro asks for none of these in `apps/shot-rail` until the user adds the matching lines to `.kiro/steering/windows-terminal.md`.
   - Decision: the user.
2. **Dependency rule scope.**
   - Issue: `coordinate-conventions` says the only dev dependencies are `vitest` and `fast-check` and that there are no runtime dependencies, for "all code". The app needs `three` (runtime), plus `vite`, `typescript` and `@types/three`.
   - Assumption: that rule applies to `packages/pathkit` only. `fast-check` is not used in the app unless the user says so.
   - Decision: the user confirms.
3. **Module settings.**
   - Issue: `typescript-imports` requires NodeNext and `.js` relative imports. Vite apps usually use Bundler resolution.
   - Assumption: the app `tsconfig.json` uses NodeNext and `.js` relative imports, like the rest of the repository.
   - Decision: the user confirms.
4. **Test conventions scope.**
   - Issue: `testing-conventions` auto-applies only to `packages/pathkit/test`.
   - Assumption: its rules also apply to app tests: plain checks inside loops, forced edge cases, naming the source line a test should catch, a 5 second limit per test file, and `SceneError` instances in thrown-error assertions.
   - Decision: the user confirms.
5. **Frame rate and lengths.**
   - Issue: the fixed frames per second (fps), the default shot length and the subject path length are not given. Time must be whole frames.
   - Assumption: none. These values are left open and are named as required configuration constants in Requirement 11.
   - Decision: the user decides before the design phase.
6. **Label boundaries.**
   - Issue: the brief's angle bands ("below -10", "-10 to 10", "above 10", "above 60") overlap at 10 and 60 and leave the edges undefined. The framing bands ("above 70%", "35 to 70%", "below 35%") leave the edges undefined.
   - Assumption: overhead takes precedence over high angle. The values -10, 10, 35 and 70 belong to the middle band (eye level, medium). The value 60 belongs to high angle, so overhead is strictly above 60.
   - Decision: the user confirms.
7. **Subject fill definition.**
   - Issue: "how much of the frame height the subject fills" does not say which bounding shape or projection is measured.
   - Assumption: none. Requirement 6 requires a written definition before design.
   - Decision: the user, with the design phase proposing candidates.
8. **Camera height by shifting the target.**
   - Issue: spike S4 shifts the aim target up or down to make a camera higher or lower. That also changes where the camera aims, not only its height. The angle label is measured to the subject centre.
   - Assumption: none. Spike S4 decides it, and the result is recorded in `docs/build-notes.md`.
   - Decision: the user, using the S4 result.
9. **Coverage grid refresh during playback.**
   - Issue: "rendered only when something changes" conflicts with a moving subject during playback.
   - Assumption: while playing, the coverage grid also re-renders, at a reduced rate. The rate is a named constant and is not yet chosen.
   - Decision: the user confirms and chooses the rate.
10. **One path per scene.**
    - Issue: PathKit allows one path per scene. Push-in and crane need a path for the main camera, while the other cameras use orbit and aim.
    - Assumption: none. The spike must show whether the camera scene can hold one path camera plus orbiting cameras. If not, a separate scene or another arrangement is a design decision.
    - Decision: the user, using the spike result.
11. **Stored settings.**
    - Issue: "nothing is stored except simple view settings" conflicts with "a hint the first time each mode opens", which needs a seen flag.
    - Assumption: seen flags count as view settings. All storage is inside try/catch. The exact list of stored keys is documented in the README.
    - Decision: the user confirms.
12. **Documentation file locations.**
    - Issue: the brief names `docs/build-notes.md`, `docs/sources.md` and `THIRD_PARTY.md` without a folder.
    - Assumption: `build-notes.md` and `sources.md` live in `apps/shot-rail/docs/`. `THIRD_PARTY.md` lives in `apps/shot-rail/`. A root `THIRD_PARTY.md` would break the rule that new files go only inside `apps/shot-rail/`.
    - Decision: the user confirms.
13. **Deploy.**
    - Issue: build-order phase 5 says "then deploy", while the brief says the deploy workflow is a later, separate task.
    - Assumption: deploy is out of scope. Only the Vite `base` setting and a working build are in scope.
    - Decision: the user confirms.
14. **Package versions and fonts.**
    - Issue: the brief gives no exact package versions, and no font is chosen.
    - Assumption: per `agent-workflow`, Kiro gives the user one exact `npm.cmd install` line with pinned versions. Kiro does not guess versions. The user supplies or approves them. Fonts are proposed as open-licence candidates and the user checks each licence.
    - Decision: the user.
15. **Bake timing (S5).**
    - Issue: "under 100 ms" depends on the machine.
    - Assumption: the spike test records and prints the bake time for the user to report. It does not fail on timing, to avoid a flaky test.
    - Decision: the user confirms.
16. **Contrast checking.**
    - Issue: contrast must be "checked, not guessed", and Kiro cannot inspect rendering.
    - Assumption: a pure contrast-ratio function is tested over the palette's text and background pairs.
    - Decision: the user confirms.
17. **Constraint names.**
    - Issue: the brief names `followPath`, `alignToPath`, `orbitAround` and `aimAt`. PathKit's `index.ts` exports the types `FollowPathConstraint`, `AimAtConstraint` and `OrbitAroundConstraint`.
    - Assumption: requirements use the brief's names. The design must confirm the exact option names, for example how `alignToPath` is set.
    - Decision: the design phase.
18. **Lens table check.**
    - Issue: the table was checked by hand against 2 x atan(18 / f) and 2 x atan(10.125 / f), and all eight values round correctly to 1 decimal place. The vertical angle at 24 mm is about 45.747 degrees before rounding, so it rounds to 45.7, not 45.8.
    - Assumption: tests use hand-computed expectations, with 45.747 (not 45.75) as the unrounded 24 mm vertical value.
    - Decision: none needed. Recorded for the test author.
19. **Reduced motion.**
    - Issue: "`prefers-reduced-motion` replaces playback easing" is ambiguous, because the subject's eased speed is PathKit data.
    - Assumption: reduced motion removes interface transitions and makes interface changes jump. The subject's speed profile during playback is unchanged unless the user decides otherwise.
    - Decision: the user.

## Glossary

- **Shot_Rail_App**: The browser app in `apps/shot-rail/`.
- **PathKit**: The library in `packages/pathkit`, imported only through `packages/pathkit/src/index.ts`.
- **Subject**: The moving thing being filmed. The car (P1), the walking figure (P2) or the abstract object (P3).
- **Camera**: A virtual camera placed around the Subject with bearing, height, distance and lens.
- **Main_Camera**: The one Camera whose view fills the main camera view.
- **Coverage_Grid**: The grid of up to 6 small Camera views.
- **Angle_Mode**: The mode for placing and comparing Cameras.
- **Move_Mode**: The mode for giving the Main_Camera a Shot_Type.
- **Shot_Type**: One of push-in, orbit, tracking (fixed offset from the Subject) or crane (rises).
- **Shot_Length**: The number of whole frames in a shot.
- **Lens_Module**: The pure logic that converts a lens focal length to fields of view.
- **Label_Module**: The pure logic that produces the Angle_Label and Framing_Label.
- **Angle_Label**: One of "low angle", "eye level", "high angle" or "overhead".
- **Framing_Label**: One of "close-up", "medium" or "wide".
- **Elevation**: The angle in degrees of the Camera above or below the Subject centre, as seen from the Subject centre.
- **Fill_Fraction**: The share of the frame height that the Subject fills, as a percentage. Its exact definition is open (item 7).
- **Frame_Mapper**: The pure logic that converts between frame numbers, time and the scrub value.
- **Shot_Builder**: The pure logic that creates a PathKit scene for a Shot_Type.
- **Target_Converter**: The pure logic that turns the Subject's baked positions into a keyframed target.
- **Motion_Check**: The list of findings produced by PathKit's `motionLinter` on the camera scene, shown in plain words.
- **Finding**: One item returned by `motionLinter`.
- **Timeline**: The bottom control with play, pause, scrub, frame counter and Finding marks.
- **Shot_Strip**: Six small pictures taken along the shot (P2).
- **Capture**: Saving the current frame as a PNG (P2).
- **Stage_Overview**: The small top-down 3D view of Subject, road, Cameras and Camera paths.
- **About_Panel**: The panel that shows the honest limits.
- **Thirds_Guide**: The rule-of-thirds overlay. **Safe_Area_Guide**: The safe-area overlay.
- **Spike**: Phase 0 tests S1 to S5 that prove facts about PathKit before any interface is built.
- **Build_Notes**: The file `apps/shot-rail/docs/build-notes.md`.
- **Sources_File**: The file `apps/shot-rail/docs/sources.md`.
- **Third_Party_File**: The file `apps/shot-rail/THIRD_PARTY.md`.
- **Test_Suite**: The Vitest tests in `apps/shot-rail/`, run with `npm.cmd test`.
- **Kiro**: The AI agent that builds the app. Kiro cannot run terminal commands in this workspace.
- **User**: The person who runs commands, pastes the output back and reviews the app.
- **Reviewer**: The person who reviews the work and renders screenshots in a clean copy.
- **Stored_Setting**: A view setting or "hint seen" flag saved in `localStorage`.

## Requirements

### Requirement 1: Project folder, scope and protected files (All)

**User Story:** As the Reviewer, I want the app self-contained and PathKit untouched, so that the demo cannot break the library or the guards.

#### Acceptance Criteria

1. THE Shot_Rail_App SHALL reside in `apps/shot-rail/` with its own `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts` and `.gitignore`.
2. THE Shot_Rail_App SHALL import PathKit only through `packages/pathkit/src/index.ts`.
3. THE Shot_Rail_App SHALL share no code with `apps/skeleton-bench/`.
4. WHERE a small helper from `apps/skeleton-bench/` is needed, THE Shot_Rail_App SHALL contain a copy of that helper inside `apps/shot-rail/`.
5. IF a change would alter any file under `packages/pathkit`, any other `package.json`, `scripts/guard-*`, `.kiro/hooks/guard-*`, `scripts/check-constraints*` or `scripts/setup*`, THEN Kiro SHALL stop and ask the User instead of making that change.
6. THE Shot_Rail_App work SHALL create new files only inside `apps/shot-rail/` and `.kiro/specs/shot-rail/`.
7. THE Shot_Rail_App work SHALL change only one existing file, `apps/shot-rail/README.md`.
8. THE Shot_Rail_App work SHALL give no new file or hook a name that begins with `guard-`.
9. THE Shot_Rail_App `vite.config.ts` SHALL set the Vite `base` option to `/PathKit/shot-rail/`.
10. THE Shot_Rail_App SHALL produce a successful build with `npm.cmd run build` from `apps/shot-rail`, and the deploy workflow SHALL remain out of scope (open question 13).

### Requirement 2: Dependencies and licences (All)

**User Story:** As the Reviewer, I want pinned, licence-checked dependencies, so that the app can be published safely.

#### Acceptance Criteria

1. THE Shot_Rail_App SHALL use only `three`, `@types/three`, `vite`, `vitest` and `typescript` as dependencies, with exact pinned versions.
2. THE Shot_Rail_App SHALL make no network call at run time and send no analytics.
3. THE Shot_Rail_App SHALL use no paid service.
4. THE Shot_Rail_App SHALL use no image, icon or sound from outside the repository.
5. THE Third_Party_File SHALL list `three` (MIT), `@types/three` (MIT), Vite (MIT), Vitest (MIT) and TypeScript (Apache-2.0), each with its version.
6. WHEN the app adopts a font, THE Third_Party_File SHALL list that font with its licence, after the User has checked the licence.
7. IF a new major version of TypeScript or Vite would be adopted after the Spike, THEN Kiro SHALL ask the User before adopting it.
8. WHEN dependencies must be installed, Kiro SHALL give the User one exact `npm.cmd install` command with pinned versions and wait for the User to run it, per open questions 1 and 14.
9. THE Shot_Rail_App SHALL keep `package-lock.json` in `apps/shot-rail/`.
10. THE Shot_Rail_App SHALL use the working name "Shot Rail" and SHALL state in the README that the name is not trademark-checked.

### Requirement 3: Car subject on an eased closed road path (P1)

**User Story:** As a planner, I want a car that drives a closed road with eased speed, so that I can see how cameras follow a moving subject.

#### Acceptance Criteria

1. THE Shot_Rail_App SHALL draw the car from boxes and cylinders only.
2. THE Shot_Rail_App SHALL draw the car with no real brand, logo or licence plate text.
3. THE Shot_Rail_App SHALL move the car along a closed road path with PathKit `followPath` and `alignToPath`.
4. WHILE the car moves along the road path, THE Shot_Rail_App SHALL vary the car's speed with easing, so that the car speeds up and slows down along the path.
5. WHEN the Timeline frame equals the last frame of the shot, THE Shot_Rail_App SHALL show the car at a position on the closed road path that is a valid position for the same path.
6. THE Shot_Rail_App SHALL express all coordinates in a Y-up, right-handed system with distances in metres and internal angles in radians.
7. THE Shot_Rail_App SHALL declare the car's `forwardAxis` and `upAxis` on the car entity and SHALL NOT hard-code them in shared logic.

### Requirement 4: Lens maths (P1)

**User Story:** As a planner, I want the field of view to follow the lens, so that a 24 mm view looks wider than an 85 mm view.

#### Acceptance Criteria

1. THE Lens_Module SHALL calculate the horizontal field of view as 2 x atan(18 / focal length in mm), for a 16:9 frame cut from a 36 mm wide sensor with a height of 20.25 mm.
2. THE Lens_Module SHALL calculate the vertical field of view as 2 x atan(10.125 / focal length in mm).
3. THE Lens_Module SHALL return these values, rounded to 1 decimal place, for the preset lenses:

   | Lens | Horizontal | Vertical |
   | --- | --- | --- |
   | 24 mm | 73.7 degrees | 45.7 degrees |
   | 35 mm | 54.4 degrees | 32.3 degrees |
   | 50 mm | 39.6 degrees | 22.9 degrees |
   | 85 mm | 23.9 degrees | 13.6 degrees |

4. THE Shot_Rail_App SHALL offer the lens presets 24, 35, 50 and 85 mm.
5. THE Shot_Rail_App SHALL set the Three.js camera `filmGauge` to 36 so that its focal-length helper matches the Lens_Module.
6. IF a focal length of 0 or less is given, THEN THE Lens_Module SHALL fail with an error message that names the invalid value.
7. IF a focal length is not a finite number, THEN THE Lens_Module SHALL fail with an error message that names the invalid value.
8. THE Lens_Module SHALL work in radians internally and SHALL convert to degrees only at the output boundary.
9. THE Lens_Module SHALL be pure: the same input SHALL always give the same output.

### Requirement 5: Angle label (P1)

**User Story:** As a planner, I want each camera labelled with its angle, so that I can compare viewpoints by name.

#### Acceptance Criteria

1. WHEN the Elevation is below -10 degrees, THE Label_Module SHALL return "low angle".
2. WHEN the Elevation is from -10 degrees up to and including 10 degrees, THE Label_Module SHALL return "eye level".
3. WHEN the Elevation is above 10 degrees and up to and including 60 degrees, THE Label_Module SHALL return "high angle".
4. WHEN the Elevation is above 60 degrees, THE Label_Module SHALL return "overhead".
5. THE Label_Module SHALL define the thresholds -10, 10 and 60 as named constants in one file.
6. THE Shot_Rail_App SHALL show each threshold next to its label and describe the thresholds as "commonly used".
7. THE Shot_Rail_App SHALL NOT state as fact what an angle does to the viewer.
8. WHERE a note about the effect of an angle is shown, THE Shot_Rail_App SHALL mark it "commonly said" and the Sources_File SHALL record its source.
9. THE Label_Module SHALL calculate Elevation from the Camera position to the Subject centre.

### Requirement 6: Framing label (P1)

**User Story:** As a planner, I want each camera labelled with its framing, so that I can tell close-ups from wide shots.

#### Acceptance Criteria

1. WHEN the Fill_Fraction is above 70 percent, THE Label_Module SHALL return "close-up".
2. WHEN the Fill_Fraction is from 35 percent up to and including 70 percent, THE Label_Module SHALL return "medium".
3. WHEN the Fill_Fraction is below 35 percent, THE Label_Module SHALL return "wide".
4. THE Label_Module SHALL define the thresholds 35 and 70 as named constants in the same file as the angle thresholds.
5. THE Shot_Rail_App SHALL show each threshold next to its label and describe the thresholds as "commonly used".
6. THE design phase SHALL define in writing, before any code, which bounding shape and projection give the Fill_Fraction (open question 7).
7. IF the Fill_Fraction is below 0 or above 100 percent, or is not a finite number, THEN THE Label_Module SHALL fail with an error message that names the invalid value.

### Requirement 7: Angle mode and coverage grid (P1)

**User Story:** As a planner, I want several cameras around the subject shown at once, so that I can pick the best angle.

#### Acceptance Criteria

1. WHILE Angle_Mode is active, THE Shot_Rail_App SHALL show a Coverage_Grid of up to 6 small Camera views.
2. THE Shot_Rail_App SHALL let the User set each Camera's bearing, height, distance and lens.
3. THE Shot_Rail_App SHALL show the Angle_Label and the Framing_Label on each Camera view in the Coverage_Grid.
4. WHEN the User clicks a Camera view, THE Shot_Rail_App SHALL make that Camera the Main_Camera.
5. THE Shot_Rail_App SHALL keep each Camera aimed at the Subject with PathKit `orbitAround` and `aimAt`, with `orbitAround` listed before `aimAt` in the constraint order.
6. WHEN a Camera setting changes, THE Shot_Rail_App SHALL re-render the Coverage_Grid.
7. WHILE the Timeline is playing, THE Shot_Rail_App SHALL re-render the Coverage_Grid at a reduced rate defined as a named constant (open question 9).
8. WHILE nothing changes and the Timeline is stopped, THE Shot_Rail_App SHALL NOT re-render the Coverage_Grid.
9. IF the User tries to add a seventh Camera, THEN THE Shot_Rail_App SHALL refuse and show a message that states the limit of 6 Cameras.
10. WHERE the User cannot drag, THE Shot_Rail_App SHALL offer the same placement by typing values or using keys.

### Requirement 8: Move mode and shot types (P1)

**User Story:** As a planner, I want to give the main camera a move, so that I can see how a push-in, orbit, tracking shot or crane would run.

#### Acceptance Criteria

1. WHILE Move_Mode is active, THE Shot_Rail_App SHALL let the User choose a Shot_Type for the Main_Camera from push-in, orbit, tracking and crane.
2. WHEN the User selects push-in, THE Shot_Builder SHALL create a scene in which the Main_Camera moves along a path toward the Subject.
3. WHEN the User selects orbit, THE Shot_Builder SHALL create a scene in which the Main_Camera circles the Subject.
4. WHEN the User selects tracking, THE Shot_Builder SHALL create a scene in which the Main_Camera keeps a fixed offset from the Subject.
5. WHEN the User selects crane, THE Shot_Builder SHALL create a scene in which the Main_Camera rises along a path.
6. THE Shot_Builder SHALL create, for each Shot_Type, a scene that `validateScene` accepts.
7. THE Shot_Builder SHALL list the entities and the constraints of each scene in a fixed, documented order, with `orbitAround` before `aimAt`.
8. THE Shot_Rail_App SHALL let the User set the Shot_Length in whole frames.
9. IF the Shot_Length is not a whole number of at least 1, THEN THE Shot_Rail_App SHALL refuse the value and show a message that states the valid range.
10. THE Shot_Rail_App SHALL bake the Subject and the Cameras in two PathKit scenes, because PathKit allows one path per scene (open question 10).
11. THE Target_Converter SHALL turn the Subject's baked positions into a keyframed target with exactly one keyframe per frame, each equal to the baked position at that frame.
12. WHEN the Shot_Type or its settings change, THE Shot_Rail_App SHALL re-bake the Cameras before the next frame is shown.

### Requirement 9: Motion check (P1)

**User Story:** As a planner, I want the camera move checked, so that I find rough or impossible moves before I film.

#### Acceptance Criteria

1. WHEN the Main_Camera scene is baked, THE Shot_Rail_App SHALL run PathKit `motionLinter` on it.
2. THE Shot_Rail_App SHALL list each Finding in plain words, without jargon that lacks a one-line explanation.
3. WHEN the User activates a Finding, THE Shot_Rail_App SHALL move the Timeline to the frame of that Finding.
4. THE Shot_Rail_App SHALL allow activating a Finding with the keyboard.
5. THE Shot_Rail_App SHALL show each Finding's severity with text, not with colour alone.
6. WHERE a Finding is a warning, THE Shot_Rail_App SHALL use the amber accent together with a text label.
7. IF `motionLinter` returns no Findings, THEN THE Shot_Rail_App SHALL show a message that states that no problems were found and that the check is rough.
8. IF the baking or the linting fails, THEN THE Shot_Rail_App SHALL show a message that states what failed and what the User can do next.

### Requirement 10: Sample shots (P1)

**User Story:** As a first-time user, I want a sample shot loaded at start, so that my first action has a visible result.

#### Acceptance Criteria

1. WHEN the Shot_Rail_App starts, THE Shot_Rail_App SHALL load a sample shot that contains the car, Cameras and a Main_Camera.
2. THE Shot_Rail_App SHALL provide three sample shots.
3. WHEN the User selects a sample shot, THE Shot_Rail_App SHALL replace the current shot with the sample within one frame update.
4. WHEN the Shot_Rail_App starts, THE Shot_Rail_App SHALL show a visible result for the first action within about ten seconds of the page opening.
5. THE three sample shots SHALL each produce a scene that `validateScene` accepts.

### Requirement 11: Timeline and frame mapping (P1)

**User Story:** As a planner, I want to play, pause and scrub, so that I can inspect any frame of the shot.

#### Acceptance Criteria

1. THE Shot_Rail_App SHALL use a fixed frame rate in frames per second, defined as a named constant, with the value decided by the User (open question 5).
2. THE Frame_Mapper SHALL represent time only as whole frames.
3. WHEN the User moves the scrub control, THE Frame_Mapper SHALL convert the scrub value to a whole frame number, never a fractional one.
4. IF the scrub value is below 0 or above the last frame, THEN THE Frame_Mapper SHALL clamp the frame number to the range from 0 to the last frame.
5. IF the scrub value is not a finite number, THEN THE Frame_Mapper SHALL return an error that names the invalid value.
6. THE Frame_Mapper SHALL convert a frame number to time in seconds, and the time in seconds back to the same frame number, without loss for every whole frame in the shot.
7. THE Timeline SHALL provide play, pause, scrub, a frame counter, and marks at the frames of the Findings.
8. WHEN the User presses play, THE Timeline SHALL advance one whole frame per frame interval.
9. WHEN playback reaches the last frame, THE Timeline SHALL stop at the last frame.
10. WHILE the Timeline is playing, THE Shot_Rail_App SHALL evaluate baked data only and SHALL NOT bake.
11. THE Shot_Rail_App SHALL perform no memory allocation per frame in the evaluation path, by writing into preallocated output buffers.
12. THE Timeline SHALL be operable from the keyboard, with the key shown beside each control.

### Requirement 12: Shot strip (P2)

**User Story:** As a planner, I want six small pictures along the shot, so that I can see the whole move at a glance.

#### Acceptance Criteria

1. WHERE the Shot_Strip is provided, THE Shot_Rail_App SHALL show six small pictures of the Main_Camera view along the shot.
2. WHERE the Shot_Strip is provided, THE Shot_Rail_App SHALL take the six pictures at whole frame numbers spread from the first frame to the last frame.
3. WHERE the Shot_Strip is provided, THE Shot_Rail_App SHALL label each picture with its frame number.
4. WHEN the User activates a picture, THE Timeline SHALL move to that frame.
5. WHERE the Shot_Length is less than 6 frames, THE Shot_Rail_App SHALL show one picture per frame instead of six.
6. WHEN the shot changes, THE Shot_Rail_App SHALL redraw the Shot_Strip.

### Requirement 13: Capture (P2)

**User Story:** As a planner, I want to save the current frame as a PNG, so that I can share or keep a reference.

#### Acceptance Criteria

1. WHERE Capture is provided, WHEN the User activates Capture, THE Shot_Rail_App SHALL save the Main_Camera view of the current frame as a PNG file through a plain download link.
2. WHERE Capture is provided, THE Shot_Rail_App SHALL use the browser canvas-to-blob function and no library.
3. WHERE Capture is provided, THE Shot_Rail_App SHALL name the file with the shot name and the frame number.
4. IF the PNG cannot be created, THEN THE Shot_Rail_App SHALL show a message that states what failed and what the User can do next.
5. WHERE Capture is provided, THE Shot_Rail_App SHALL create no network request.

### Requirement 14: Walking figure subject (P2)

**User Story:** As a planner, I want a walking figure as a second subject, so that I can try shots on a person-sized subject.

#### Acceptance Criteria

1. WHERE the walking figure is provided, THE Shot_Rail_App SHALL draw it from capsules.
2. WHERE the walking figure is provided, THE Shot_Rail_App SHALL show the text "stand-in" next to the figure in the interface.
3. WHERE the walking figure is provided, THE Shot_Rail_App SHALL move the figure along a path without a walking animation.
4. WHERE the walking figure is provided, THE Shot_Rail_App SHALL let the User switch between the car and the figure.
5. WHEN the User switches Subject, THE Shot_Rail_App SHALL re-bake the Subject and the Cameras.

### Requirement 15: Abstract subject (P3)

**User Story:** As a planner, I want an abstract subject, so that I can test a shot without a recognisable object.

#### Acceptance Criteria

1. WHERE the abstract subject is provided, THE Shot_Rail_App SHALL draw a glowing ball or a paper plane.
2. WHERE the abstract subject is provided, THE Shot_Rail_App SHALL let the User select it like any other Subject.
3. THE Shot_Rail_App SHALL ship without the abstract subject when time does not remain after all P1 and P2 requirements are met.

### Requirement 16: Compare two takes (P3)

**User Story:** As a planner, I want to compare two takes of the same shot side by side, so that I can choose between two moves.

#### Acceptance Criteria

1. WHERE compare is provided, THE Shot_Rail_App SHALL show two takes of the same shot side by side.
2. WHERE compare is provided, WHEN the User moves the Timeline, THE Shot_Rail_App SHALL show the same frame number in both takes.
3. WHERE compare is provided, THE Shot_Rail_App SHALL show the Motion_Check of each take.
4. THE Shot_Rail_App SHALL ship without compare when time does not remain after all P1 and P2 requirements are met.

### Requirement 17: Interface layout and guides (P1)

**User Story:** As a planner, I want a clear desk layout in a dark theme, so that I can find each control and readout.

#### Acceptance Criteria

1. THE Shot_Rail_App SHALL show a main camera view in a 16:9 frame, as the largest region.
2. THE Shot_Rail_App SHALL show a Stage_Overview as a small top-down 3D view with the Subject, road, Cameras and Camera paths.
3. THE Shot_Rail_App SHALL show controls on the left: mode tabs (Angle, Move), camera list, bearing, height, distance, lens, Shot_Type and Shot_Length.
4. THE Shot_Rail_App SHALL show a readout on the right: Angle_Label, Framing_Label, field of view and the Motion_Check list.
5. THE Shot_Rail_App SHALL show the Timeline at the bottom.
6. THE Shot_Rail_App SHALL use a dark "previz desk" look with one warm amber accent reserved for warnings.
7. WHEN the User toggles the Thirds_Guide, THE Shot_Rail_App SHALL show or hide the thirds lines on the main camera view.
8. WHEN the User toggles the Safe_Area_Guide, THE Shot_Rail_App SHALL show or hide the safe-area outline on the main camera view.
9. THE Shot_Rail_App SHALL use plain labels.
10. WHERE a term needs explaining, THE Shot_Rail_App SHALL show a one-line explanation on hover and on keyboard focus.

### Requirement 18: Intuitive use (P1)

**User Story:** As a first-time user, I want guidance and clear states, so that I can use the app without a manual.

#### Acceptance Criteria

1. THE Shot_Rail_App SHALL show a visible text label and a tooltip on every control.
2. THE Shot_Rail_App SHALL make every control operable from the keyboard, with the key shown beside it.
3. WHEN a mode opens for the first time, THE Shot_Rail_App SHALL show a one-line hint for that mode.
4. WHEN the User dismisses a hint, THE Shot_Rail_App SHALL store a seen flag for that mode, and SHALL NOT show the hint again for that mode.
5. WHERE a list or region is empty, THE Shot_Rail_App SHALL show a message that states what the User can do next.
6. IF an error occurs, THEN THE Shot_Rail_App SHALL show a message that states what went wrong and what the User can do next.

### Requirement 19: Accessibility (P1)

**User Story:** As a user with low vision or motion sensitivity, I want readable, keyboard-friendly, motion-safe controls, so that I can use the app.

#### Acceptance Criteria

1. THE Shot_Rail_App SHALL use text and background colour pairs with a contrast ratio of at least 4.5 to 1.
2. THE Shot_Rail_App SHALL provide a pure contrast-ratio function, and the Test_Suite SHALL check every text and background pair in the palette against 4.5 to 1 (open question 16).
3. THE Shot_Rail_App SHALL show a visible focus ring on every focusable control.
4. THE Shot_Rail_App SHALL convey no meaning by colour alone.
5. WHILE the User's system setting `prefers-reduced-motion` is "reduce", THE Shot_Rail_App SHALL replace animated interface transitions with jumps.
6. WHILE `prefers-reduced-motion` is "reduce", THE Shot_Rail_App SHALL keep the Subject's speed profile unchanged during playback (open question 19).
7. THE Shot_Rail_App SHALL offer a non-drag alternative for every drag action.

### Requirement 20: Stored settings and privacy (All)

**User Story:** As a user, I want the app to store almost nothing, so that my data stays on my machine.

#### Acceptance Criteria

1. THE Shot_Rail_App SHALL store only Stored_Settings in `localStorage`.
2. THE Shot_Rail_App SHALL perform every `localStorage` read and write inside try/catch.
3. IF `localStorage` is unavailable or throws, THEN THE Shot_Rail_App SHALL continue with default settings and SHALL show no error that blocks use.
4. THE README SHALL list every key that the Shot_Rail_App stores.
5. THE Shot_Rail_App SHALL make no network call and send no analytics.

### Requirement 21: Honest limits (All)

**User Story:** As a user, I want the app to say what it cannot do, so that I do not trust it too far.

#### Acceptance Criteria

1. THE About_Panel SHALL state that the Subject is a stand-in drawn from shapes and that there is no lighting, exposure or depth-of-field simulation.
2. THE About_Panel SHALL state that angles are measured from the world axes and not from the car's heading, so a turning car changes its relation to a fixed-bearing Camera, unless Spike S3 shows otherwise.
3. THE About_Panel SHALL state that PathKit allows one path per scene, so the Subject and the Cameras are baked in two scenes.
4. THE About_Panel SHALL state that the lens maths assumes the 36 mm sensor and that another sensor changes the angles.
5. THE About_Panel SHALL state that the app is rough planning and not a prediction of real footage.
6. THE README SHALL repeat the same limits as the About_Panel.
7. THE Shot_Rail_App SHALL give the User access to the About_Panel from the main screen.

### Requirement 22: Spike (P1, phase 0)

**User Story:** As the Reviewer, I want the PathKit facts proved before the interface is built, so that the design rests on tested behaviour.

#### Acceptance Criteria

1. THE Test_Suite SHALL contain the Spike tests S1 to S5 as tests only, without an interface.
2. THE Spike test S1 SHALL bake a Subject scene (a car on a road path with `followPath` and `alignToPath`) and read it back with `evaluateEntity`.
3. THE Spike test S2 SHALL turn the Subject's baked positions into a keyframed target and aim a Camera at it with `aimAt`.
4. THE Spike test S3 SHALL show that `orbitAround` with a keyframed target and speed 0 keeps a fixed offset that moves with the Subject.
5. THE Spike test S4 SHALL show whether shifting the target up or down makes a Camera higher or lower, and SHALL check the resulting height (open question 8).
6. THE Spike test S5 SHALL bake the Subject plus six Cameras, measure the bake time, and print it for the User to report, without failing on timing (open question 15). The target is under 100 ms on the User's machine.
7. THE Spike results SHALL be written in `apps/shot-rail/docs/build-notes.md`.
8. IF a Spike test fails, THEN Kiro SHALL stop and ask the User and SHALL NOT invent a workaround.
9. THE Spike results SHALL show whether the camera scene can hold one path camera plus orbiting Cameras (open question 10).

### Requirement 23: Tests (P1)

**User Story:** As the Reviewer, I want tests with hand-computed expectations, so that a passing test means something.

#### Acceptance Criteria

1. THE Test_Suite SHALL run with `npm.cmd test` from `apps/shot-rail`, once the User has added that command to the steering file (open question 1).
2. THE Test_Suite SHALL write every expected value by hand and SHALL NOT read expected values from the code under test.
3. THE Test_Suite SHALL make no network call and SHALL NOT touch the browser.
4. THE Test_Suite SHALL check the lens table to 1 decimal place, using the unrounded 24 mm vertical value 45.747 degrees (open question 18).
5. THE Test_Suite SHALL check that a focal length of 0 or less fails with a clear message.
6. THE Test_Suite SHALL check every label threshold with one value on each side, and the values -10, 10, 35, 60 and 70 on the boundary.
7. THE Test_Suite SHALL check that the Frame_Mapper converts a scrub value to a whole frame number, clamps it, and never returns a fractional one.
8. THE Test_Suite SHALL check that each Shot_Builder result passes `validateScene`, with the exact entity list and constraint order (`orbitAround` before `aimAt`).
9. THE Test_Suite SHALL check that the Target_Converter gives one keyframe per frame, equal to the baked position.
10. THE Test_Suite SHALL keep the Spike results S1 to S5 as tests.
11. THE Test_Suite SHALL give each task a "source line it should catch": one change that makes a named test fail.
12. THE Test_Suite SHALL use plain checks inside loops, force edge cases on purpose, finish each test file in 5 seconds or less, and use `SceneError` instances in thrown-error assertions (open question 4).
13. THE Test_Suite SHALL use `.js` on every relative import, per the TypeScript import rules (open question 3).
14. IF a property test fails, THEN Kiro SHALL say whether the code or the property is wrong, SHALL make at most 3 fix attempts, and SHALL then stop and report the seed and counterexample.
15. THE Test_Suite SHALL NOT be weakened to make a test pass.

### Requirement 24: Notes and manual (All)

**User Story:** As the Reviewer, I want a short build note after each task, so that I can later merge them into the building guide.

#### Acceptance Criteria

1. WHEN a task is finished, Kiro SHALL add one short entry to `apps/shot-rail/docs/build-notes.md`.
2. THE entry SHALL state what was done, what broke, what Kiro got wrong, and which PathKit feature was used.
3. THE README SHALL describe the app, the honest limits and the stored keys.
4. THE Sources_File SHALL record the source of every "commonly said" note.

### Requirement 25: Verification limits and reporting (All)

**User Story:** As the Reviewer, I want a plain statement of what was and was not tested, so that I know what to check by hand.

#### Acceptance Criteria

1. THE final report SHALL state that Kiro did not test how the app looks, the WebGL output, the real browser, the PNG download, or the feel of the controls.
2. THE final report SHALL state that the User checks those items and that the Reviewer renders screenshots in a clean copy.
3. WHEN Kiro finishes a task, Kiro SHALL name the command to run and the tests expected to pass, and SHALL NOT say the task is done until the User has pasted passing results.
4. WHEN the User pastes test output, Kiro SHALL report the counts of tests passed, failed and skipped.
5. IF the pasted output is missing or cut off, THEN Kiro SHALL ask the User to paste it again.
6. WHEN a step needs a terminal command, Kiro SHALL give the exact command on one line, name the folder to run it in, and wait.
7. Kiro SHALL give no command for watch mode or any command that does not exit.
8. IF a hook blocks a tool, THEN Kiro SHALL stop and tell the User what was blocked.

### Requirement 26: Cut features (All)

**User Story:** As the Reviewer, I want the cut list written down, so that scope does not grow.

#### Acceptance Criteria

1. THE Shot_Rail_App SHALL include no equipment limits (slider speed, pan rate), lighting, depth of field, physics, imported models or export to video.
2. IF a request asks for a cut feature, THEN Kiro SHALL ask the User before adding it.
