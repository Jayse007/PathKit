# Requirements Document

## Introduction

Shot Rail is a demo app in `apps/shot-rail/` that answers one question: "If I film this subject from here, with this lens and this movement, what will it look like?" A user places cameras around a moving subject, sees what each camera sees, picks one as the main camera, gives it a move, and gets a motion check. It is a rough planning tool and says so.

The app uses PathKit for the work a plain camera cannot do: the subject follows a closed road path and aligns to it, several cameras sit around the subject and keep aiming at it, the main camera can follow its own path, and the motion linter checks the camera move. PathKit `followPath` moves an entity at constant speed. The car's speeding up and slowing down is app code: a pure frame remap converts each frame number into a position along the road, and the remapped positions are then fed to PathKit.

This document is derived from `.kiro/specs/shot-rail/brief.md` (DRAFT 1, 2026-11-24), the decisions the User gave for the open questions, and the steering files `agent-workflow`, `coordinate-conventions`, `testing-conventions`, `typescript-imports` and `windows-terminal`. Each requirement is marked P1 (must ship), P2 or P3 (only if time remains), or "All" for rules that apply across priorities. The brief's build order has phases 0 to 5 (Spike, Pure logic, Stage and views, Modes and timeline, Design pass, Manual and deploy). Phases appear here only as context. This document contains no tasks.

## Open questions and conflicts

Items 1 to 16 and 19 are decided. Items 17 and 18 remain as written.

1. **Terminal commands.** Decided: Kiro asks for no `npm.cmd` commands in `apps/shot-rail` until the User adds the matching lines to `.kiro/steering/windows-terminal.md`.
2. **Dependency rule scope.** Decided: the dependency rule in `coordinate-conventions` covers `packages/pathkit` only.
3. **Module settings.** Decided: the app `tsconfig.json` uses NodeNext and `.js` relative imports.
4. **Test conventions scope.** Decided: the `testing-conventions` rules also apply to app tests.
5. **Frame rate and lengths.** Decided: 30 fps; default Shot_Length 240 frames, allowed 60 to 600; the road is flat (y constant) with about 12 control points and about 120 m length; the car laps every 240 frames whatever the Shot_Length (a 600-frame shot is 2.5 laps, a 60-frame shot is a quarter lap).
6. **Label boundaries.** Decided: overhead takes precedence over high angle; -10, 10, 35 and 70 belong to the middle band (eye level, medium); 60 belongs to high angle; overhead is strictly above 60.
7. **Subject fill definition.** Decided: Fill_Fraction is the larger of (projected 3D bounding box height / frame height) and (projected width / frame width), as a percentage, computed by a pure function over projected points.
8. **Camera height by shifting the target.** Decided: two targets. The orbit centre is the Subject position shifted up or down by the camera height; `aimAt` uses the true Subject position. The UI "distance" is the horizontal distance (the orbit radius); the straight-line distance is shown read-only. Spike S4 verifies the resulting height and aim.
9. **Coverage grid refresh during playback.** Decided: while playing, the Coverage_Grid re-renders 10 times per second (named constant).
10. **One path per scene.** Decided: Spike S6 tests whether one scene can hold a path camera plus orbiting cameras. If not, the Main_Camera gets its own scene without asking the User, and the result is recorded in Build_Notes.
11. **Stored settings.** Decided: "hint seen" flags count as view settings; all storage is inside try/catch; the README lists every stored key.
12. **Documentation file locations.** Decided: `build-notes.md` and `sources.md` live in `apps/shot-rail/docs/`; `THIRD_PARTY.md` lives at app level only (`apps/shot-rail/THIRD_PARTY.md`); the repository root file is handled outside this spec.
13. **Deploy.** Decided: deploy is out of scope; only the Vite `base` setting and a working build are in scope.
14. **Package versions and fonts.** Decided: pinned versions are three 0.187.0, @types/three 0.187.0, vite 7.3.8, vitest 3.2.7 and typescript 5.9.3; no font is added, the app uses the system font stack.
15. **Bake timing (S5).** Decided: the spike records and prints the bake time and does not fail on timing.
16. **Contrast checking.** Decided: a pure contrast-ratio function is tested over the palette's text and background pairs.
17. **Constraint names.**
    - Issue: the brief names `followPath`, `alignToPath`, `orbitAround` and `aimAt`. PathKit's `index.ts` exports the types `FollowPathConstraint`, `AimAtConstraint` and `OrbitAroundConstraint`.
    - Assumption: requirements use the brief's names. The design must confirm the exact option names, for example how `alignToPath` is set.
    - Decision: the design phase.
18. **Lens table check.**
    - Issue: the table was checked by hand against 2 x atan(18 / f) and 2 x atan(10.125 / f), and all eight values round correctly to 1 decimal place. The vertical angle at 24 mm is about 45.747 degrees before rounding, so it rounds to 45.7, not 45.8.
    - Assumption: tests use hand-computed expectations, with 45.747 (not 45.75) as the unrounded 24 mm vertical value.
    - Decision: none needed. Recorded for the test author.
19. **Reduced motion.** Decided: reduced motion removes interface transitions and makes interface changes jump; the Subject's speed profile during playback is unchanged.

## Glossary

- **Shot_Rail_App**: The browser app in `apps/shot-rail/`.
- **PathKit**: The library in `packages/pathkit`, imported only through `packages/pathkit/src/index.ts`.
- **Subject**: The moving thing being filmed. The car (P1), the walking figure (P2) or the abstract object (P3).
- **Road**: The flat, closed path the car drives. All control points have the same y value.
- **Road_Point_Limits**: The named constants for the minimum (3) and maximum (100) number of Road control points (known issue KI-11).
- **Lap_Frames**: The named constant 240, the number of frames in one lap of the Road.
- **Frame_Remap**: The pure app function that converts a whole frame number into a position along the Road, with easing. PathKit `followPath` itself has constant speed and does no easing.
- **Camera**: A virtual camera placed around the Subject with bearing, height, distance and lens.
- **Main_Camera**: The one Camera whose view fills the main camera view.
- **Orbit_Centre**: The point a Camera orbits. It is the Subject position shifted up or down by the Camera height.
- **Horizontal_Distance**: The distance of the Camera from the Orbit_Centre in the horizontal plane (the orbit radius). It is the "distance" control in the UI.
- **Straight_Line_Distance**: The distance from the Camera to the true Subject position, shown read-only.
- **Coverage_Grid**: The grid of up to 6 small Camera views.
- **Angle_Mode**: The mode for placing and comparing Cameras.
- **Move_Mode**: The mode for giving the Main_Camera a Shot_Type.
- **Shot_Type**: One of push-in, orbit, tracking (fixed offset from the Subject) or crane (rises).
- **Shot_Length**: The number of whole frames in a shot, from 60 to 600, default 240.
- **Frame_Rate**: The named constant 30 frames per second.
- **Lens_Module**: The pure logic that converts a lens focal length to fields of view.
- **Label_Module**: The pure logic that produces the Angle_Label and Framing_Label.
- **Angle_Label**: One of "low angle", "eye level", "high angle" or "overhead".
- **Framing_Label**: One of "close-up", "medium" or "wide".
- **Elevation**: The angle in degrees of the Camera above or below the true Subject centre, as seen from the true Subject centre.
- **Fill_Fraction**: The larger of (projected 3D bounding box height / frame height) and (projected 3D bounding box width / frame width), as a percentage, computed by a pure function over projected points.
- **Frame_Mapper**: The pure logic that converts between frame numbers, time and the scrub value.
- **Shot_Builder**: The pure logic that creates a PathKit scene for a Shot_Type.
- **Target_Converter**: The pure logic that turns the Subject's baked positions into a keyframed target.
- **Motion_Check**: The list of findings produced by PathKit's `motionLinter` on the camera scene, shown in plain words.
- **Finding**: One item returned by `motionLinter`.
- **Timeline**: The bottom control with play, pause, scrub, frame counter and Finding marks.
- **Playback_Rate_Grid**: The named constant 10, the number of Coverage_Grid re-renders per second while the Timeline is playing.
- **Shot_Strip**: Six small pictures taken along the shot (P2).
- **Capture**: Saving the current frame as a PNG (P2).
- **Stage_Overview**: The small top-down 3D view of Subject, road, Cameras and Camera paths.
- **About_Panel**: The panel that shows the honest limits.
- **Thirds_Guide**: The rule-of-thirds overlay. **Safe_Area_Guide**: The safe-area overlay.
- **Spike**: Phase 0 tests S1 to S6 that prove facts about PathKit before any interface is built.
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

1. THE Shot_Rail_App SHALL use exactly these five dependencies, each pinned to an exact version: `three` 0.187.0, `@types/three` 0.187.0, `vite` 7.3.8, `vitest` 3.2.7 and `typescript` 5.9.3.
2. THE Shot_Rail_App SHALL make no network call at run time and send no analytics.
3. THE Shot_Rail_App SHALL use no paid service.
4. THE Shot_Rail_App SHALL use no image, icon or sound from outside the repository.
5. THE Third_Party_File SHALL list `three` 0.187.0 (MIT), `@types/three` 0.187.0 (MIT), Vite 7.3.8 (MIT), Vitest 3.2.7 (MIT) and TypeScript 5.9.3 (Apache-2.0).
6. THE Shot_Rail_App SHALL use the system font stack and SHALL add no font file.
7. IF a change of version of TypeScript or Vite would be adopted, THEN Kiro SHALL ask the User before adopting it.
8. WHEN dependencies must be installed and the User has added the matching line to `.kiro/steering/windows-terminal.md`, Kiro SHALL give the User one exact `npm.cmd install` command with the pinned versions and wait for the User to run it (open question 1).
9. THE Shot_Rail_App SHALL keep `package-lock.json` in `apps/shot-rail/`.
10. THE Shot_Rail_App SHALL use the working name "Shot Rail" and SHALL state in the README that the name is not trademark-checked.

### Requirement 3: Car subject on a closed road with eased speed (P1)

**User Story:** As a planner, I want a car that drives a closed road and speeds up and slows down, so that I can see how cameras follow a moving subject.

#### Acceptance Criteria

1. THE Shot_Rail_App SHALL draw the car from boxes and cylinders only.
2. THE Shot_Rail_App SHALL draw the car with no real brand, logo or licence plate text.
3. THE Shot_Rail_App SHALL move the car along the Road with PathKit `followPath` and `alignToPath`.
4. THE Frame_Remap SHALL convert each whole frame number into a position along the Road with easing, so that the car speeds up and slows down along the Road, and THE Shot_Rail_App SHALL feed the remapped positions to PathKit.
5. THE Frame_Remap SHALL be pure: the same frame number SHALL always give the same position.
6. THE Frame_Remap SHALL map frame 0 to the start of the Road.
7. THE Frame_Remap SHALL map frame `Lap_Frames` (240) to the start of the next lap, which is the same point on the Road as frame 0.
8. THE Frame_Remap SHALL never decrease the position along the Road as the frame number increases.
9. THE Frame_Remap SHALL give different speeds (position change per frame) at different frames of one lap.
10. THE Shot_Rail_App SHALL lap the Road every `Lap_Frames` (240) frames whatever the Shot_Length, so that a 600-frame shot is 2.5 laps and a 60-frame shot is a quarter lap.
11. THE Shot_Rail_App SHALL use a Road whose control points all have the same y value.
12. THE default Road SHALL have about 12 control points and a length of about 120 m.
13. IF the Road has fewer than the minimum of `Road_Point_Limits` (3) or more than the maximum (100) control points, THEN THE Shot_Rail_App SHALL refuse the Road and show a message that names the control point count and the allowed range (known issue KI-11).
14. THE Shot_Rail_App SHALL NOT describe PathKit as providing easing or changes of speed along the Road.
15. THE Shot_Rail_App SHALL express all coordinates in a Y-up, right-handed system with distances in metres and internal angles in radians.
16. THE Shot_Rail_App SHALL declare the car's `forwardAxis` and `upAxis` on the car entity and SHALL NOT hard-code them in shared logic.

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
9. THE Label_Module SHALL calculate Elevation from the Camera position to the true Subject centre, not to the shifted Orbit_Centre.

### Requirement 6: Framing label (P1)

**User Story:** As a planner, I want each camera labelled with its framing, so that I can tell close-ups from wide shots.

#### Acceptance Criteria

1. WHEN the Fill_Fraction is above 70 percent, THE Label_Module SHALL return "close-up".
2. WHEN the Fill_Fraction is from 35 percent up to and including 70 percent, THE Label_Module SHALL return "medium".
3. WHEN the Fill_Fraction is below 35 percent, THE Label_Module SHALL return "wide".
4. THE Label_Module SHALL define the thresholds 35 and 70 as named constants in the same file as the angle thresholds.
5. THE Shot_Rail_App SHALL show each threshold next to its label and describe the thresholds as "commonly used".
6. THE Fill_Fraction function SHALL return the larger of (projected 3D bounding box height / frame height) and (projected 3D bounding box width / frame width), as a percentage.
7. THE Fill_Fraction function SHALL be pure and SHALL work over projected points passed in as input.
8. IF the Fill_Fraction is below 0 or above 100 percent, or is not a finite number, THEN THE Label_Module SHALL fail with an error message that names the invalid value.

### Requirement 7: Angle mode and coverage grid (P1)

**User Story:** As a planner, I want several cameras around the subject shown at once, so that I can pick the best angle.

#### Acceptance Criteria

1. WHILE Angle_Mode is active, THE Shot_Rail_App SHALL show a Coverage_Grid of up to 6 small Camera views.
2. THE Shot_Rail_App SHALL let the User set each Camera's bearing, height, Horizontal_Distance and lens.
3. THE Shot_Rail_App SHALL label the distance control as the horizontal distance (the orbit radius) and SHALL show the Straight_Line_Distance as a read-only value.
4. THE Shot_Rail_App SHALL show the Angle_Label and the Framing_Label on each Camera view in the Coverage_Grid.
5. WHEN the User clicks a Camera view, THE Shot_Rail_App SHALL make that Camera the Main_Camera.
6. THE Shot_Rail_App SHALL keep each Camera aimed at the Subject with PathKit `orbitAround` and `aimAt`, with `orbitAround` listed before `aimAt` in the constraint order.
7. THE Shot_Rail_App SHALL orbit each Camera around the Orbit_Centre (the Subject position shifted up or down by the Camera height) and SHALL aim each Camera at the true Subject position.
8. WHEN a Camera setting changes, THE Shot_Rail_App SHALL re-render the Coverage_Grid.
9. WHILE the Timeline is playing, THE Shot_Rail_App SHALL re-render the Coverage_Grid 10 times per second, using the named constant `Playback_Rate_Grid`.
10. WHILE nothing changes and the Timeline is stopped, THE Shot_Rail_App SHALL NOT re-render the Coverage_Grid.
11. IF the User tries to add a seventh Camera, THEN THE Shot_Rail_App SHALL refuse and show a message that states the limit of 6 Cameras.
12. WHERE the User cannot drag, THE Shot_Rail_App SHALL offer the same placement by typing values or using keys.

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
8. THE Shot_Rail_App SHALL let the User set the Shot_Length as a whole number of frames from 60 to 600, with a default of 240.
9. IF the Shot_Length is not a whole number from 60 to 600, THEN THE Shot_Rail_App SHALL refuse the value and show a message that states the range 60 to 600.
10. THE Shot_Rail_App SHALL bake the Subject in its own scene, and SHALL bake the Cameras in a camera scene.
11. THE Target_Converter SHALL turn the Subject's baked positions into a keyframed target with exactly one keyframe per frame, each equal to the baked position at that frame.
12. WHEN the Shot_Type or its settings change, THE Shot_Rail_App SHALL re-bake the Cameras before the next frame is shown.
13. IF Spike S6 shows that one scene cannot hold a path camera plus orbiting Cameras, THEN THE Shot_Rail_App SHALL bake the Main_Camera in its own scene, without asking the User, and the result SHALL be recorded in Build_Notes.
14. THE Shot_Builder SHALL give each orbiting Camera an Orbit_Centre equal to the Subject position shifted up or down by the Camera height, and SHALL give `aimAt` the true Subject position.
15. WHEN the Shot_Type, its settings or the Shot_Length change, THE Shot_Rail_App SHALL leave the Timeline paused and SHALL NOT start playback after the re-bake.

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

1. WHEN the Shot_Rail_App starts, THE Shot_Rail_App SHALL load a sample shot that contains the car, Cameras and a Main_Camera, with the Timeline paused at frame 0.
2. THE Shot_Rail_App SHALL provide three sample shots.
3. WHEN the User selects a sample shot, THE Shot_Rail_App SHALL replace the current shot with the sample within one frame update and SHALL leave the Timeline paused.
4. WHEN the Shot_Rail_App starts, THE Shot_Rail_App SHALL show a visible result for the first action within about ten seconds of the page opening.
5. THE three sample shots SHALL each produce a scene that `validateScene` accepts.
6. THE Shot_Rail_App SHALL NOT start playback when a sample shot is loaded.

### Requirement 11: Timeline and frame mapping (P1)

**User Story:** As a planner, I want to play, pause and scrub, so that I can inspect any frame of the shot.

#### Acceptance Criteria

1. THE Shot_Rail_App SHALL use a fixed frame rate of 30 frames per second, defined as the named constant `Frame_Rate`.
2. THE Frame_Mapper SHALL represent time only as whole frames.
3. WHEN the User moves the scrub control, THE Frame_Mapper SHALL convert the scrub value to a whole frame number, never a fractional one.
4. IF the scrub value is below 0 or above the last frame, THEN THE Frame_Mapper SHALL clamp the frame number to the range from 0 to the last frame.
5. IF the scrub value is not a finite number, THEN THE Frame_Mapper SHALL return an error that names the invalid value.
6. THE Frame_Mapper SHALL convert a frame number to time in seconds at 30 frames per second, and the time in seconds back to the same frame number, without loss for every whole frame in the shot.
7. THE Timeline SHALL provide play, pause, scrub, a frame counter, and marks at the frames of the Findings.
8. WHEN the User presses play, THE Timeline SHALL advance one whole frame per frame interval.
9. WHEN playback reaches the last frame, THE Timeline SHALL stop at the last frame.
10. WHILE the Timeline is playing, THE Shot_Rail_App SHALL evaluate baked data only and SHALL NOT bake.
11. THE Shot_Rail_App SHALL perform no memory allocation per frame in the evaluation path, by writing into preallocated output buffers.
12. THE Timeline SHALL be operable from the keyboard, with the key shown beside each control.
13. WHEN the Shot_Rail_App starts, THE Timeline SHALL be paused at frame 0.
14. THE Timeline SHALL start playback only on an explicit User play action, and SHALL NOT start playback by itself at start, after loading a sample shot, after a change of mode, Shot_Type, Subject or Shot_Length, or after a re-bake.

### Requirement 12: Shot strip (P2)

**User Story:** As a planner, I want six small pictures along the shot, so that I can see the whole move at a glance.

#### Acceptance Criteria

1. WHERE the Shot_Strip is provided, THE Shot_Rail_App SHALL show six small pictures of the Main_Camera view along the shot.
2. WHERE the Shot_Strip is provided, THE Shot_Rail_App SHALL take the six pictures at whole frame numbers spread from the first frame to the last frame.
3. WHERE the Shot_Strip is provided, THE Shot_Rail_App SHALL label each picture with its frame number.
4. WHEN the User activates a picture, THE Timeline SHALL move to that frame.
5. WHEN the shot changes, THE Shot_Rail_App SHALL redraw the Shot_Strip.
6. THE Shot_Rail_App SHALL take the six pictures at distinct frame numbers for every Shot_Length from 60 to 600.

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
5. WHEN the User switches Subject, THE Shot_Rail_App SHALL re-bake the Subject and the Cameras and SHALL leave the Timeline paused.

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
3. THE Shot_Rail_App SHALL show controls on the left: mode tabs (Angle, Move), camera list, bearing, height, horizontal distance, lens, Shot_Type and Shot_Length.
4. THE Shot_Rail_App SHALL show a readout on the right: Angle_Label, Framing_Label, field of view, Straight_Line_Distance and the Motion_Check list.
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
2. THE Shot_Rail_App SHALL provide a pure contrast-ratio function, and the Test_Suite SHALL check every text and background pair in the palette against 4.5 to 1.
3. THE Shot_Rail_App SHALL show a visible focus ring on every focusable control.
4. THE Shot_Rail_App SHALL convey no meaning by colour alone.
5. WHILE the User's system setting `prefers-reduced-motion` is "reduce", THE Shot_Rail_App SHALL replace animated interface transitions with jumps.
6. WHILE `prefers-reduced-motion` is "reduce", THE Shot_Rail_App SHALL keep the Subject's speed profile unchanged during playback.
7. THE Shot_Rail_App SHALL offer a non-drag alternative for every drag action.

### Requirement 20: Stored settings and privacy (All)

**User Story:** As a user, I want the app to store almost nothing, so that my data stays on my machine.

#### Acceptance Criteria

1. THE Shot_Rail_App SHALL store only Stored_Settings in `localStorage`, and "hint seen" flags count as Stored_Settings.
2. THE Shot_Rail_App SHALL perform every `localStorage` read and write inside try/catch.
3. IF `localStorage` is unavailable or throws, THEN THE Shot_Rail_App SHALL continue with default settings and SHALL show no error that blocks use.
4. THE README SHALL list every key that the Shot_Rail_App stores.
5. THE Shot_Rail_App SHALL make no network call and send no analytics.

### Requirement 21: Honest limits (All)

**User Story:** As a user, I want the app to say what it cannot do, so that I do not trust it too far.

#### Acceptance Criteria

1. THE About_Panel SHALL state that the Subject is a stand-in drawn from shapes and that there is no lighting, exposure or depth-of-field simulation.
2. THE About_Panel SHALL state that angles are measured from the world axes and not from the car's heading, so a turning car changes its relation to a fixed-bearing Camera, unless Spike S3 shows otherwise.
3. THE About_Panel SHALL state that PathKit allows one path per scene, so the Subject and the Cameras are baked in separate scenes, and that the Main_Camera has its own scene if Spike S6 requires it.
4. THE About_Panel SHALL state that the lens maths assumes the 36 mm sensor and that another sensor changes the angles.
5. THE About_Panel SHALL state that the app is rough planning and not a prediction of real footage.
6. THE README SHALL repeat the same limits as the About_Panel.
7. THE Shot_Rail_App SHALL give the User access to the About_Panel from the main screen.

### Requirement 22: Spike (P1, phase 0)

**User Story:** As the Reviewer, I want the PathKit facts proved before the interface is built, so that the design rests on tested behaviour.

#### Acceptance Criteria

1. THE Test_Suite SHALL contain the Spike tests S1 to S6 as tests only, without an interface.
2. THE Spike test S1 SHALL bake a Subject scene (a car on a road path with `followPath` and `alignToPath`) and read it back with `evaluateEntity`.
3. THE Spike test S1 SHALL prove that PathKit `followPath` moves the car at constant speed, by showing equal distances between baked positions on equal steps of the path.
4. THE Spike test S1 SHALL prove that the Frame_Remap, fed to PathKit, produces the eased positions, by showing different speeds at different frames.
5. THE Spike test S2 SHALL turn the Subject's baked positions into a keyframed target and aim a Camera at it with `aimAt`.
6. THE Spike test S3 SHALL show that `orbitAround` with a keyframed target and speed 0 keeps a fixed offset that moves with the Subject.
7. THE Spike test S4 SHALL verify the two-target arrangement: the Orbit_Centre is the Subject position shifted up or down by the Camera height, and `aimAt` uses the true Subject position. It SHALL check the resulting Camera height and the aim direction.
8. THE Spike test S5 SHALL bake the Subject plus six Cameras, measure the bake time, and print it for the User to report, without failing on timing. The target is under 100 ms on the User's machine.
9. THE Spike test S6 SHALL test whether one scene can hold a path camera plus orbiting Cameras.
10. IF Spike S6 shows that one scene cannot hold a path camera plus orbiting Cameras, THEN THE Shot_Rail_App SHALL give the Main_Camera its own scene without asking the User.
11. THE Spike results, including the S6 result and the scene arrangement chosen, SHALL be written in `apps/shot-rail/docs/build-notes.md`.
12. IF a Spike test S1 to S5 fails, THEN Kiro SHALL stop and ask the User and SHALL NOT invent a workaround.

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
10. THE Test_Suite SHALL keep the Spike results S1 to S6 as tests.
11. THE Test_Suite SHALL give each task a "source line it should catch": one change that makes a named test fail.
12. THE Test_Suite SHALL use plain checks inside loops, force edge cases on purpose, finish each test file in 5 seconds or less, and use `SceneError` instances in thrown-error assertions.
13. THE Test_Suite SHALL use `.js` on every relative import, per the TypeScript import rules.
14. IF a property test fails, THEN Kiro SHALL say whether the code or the property is wrong, SHALL make at most 3 fix attempts, and SHALL then stop and report the seed and counterexample.
15. THE Test_Suite SHALL NOT be weakened to make a test pass.
16. THE Test_Suite SHALL check that the Frame_Remap is pure, maps frame 0 to the start of the Road, maps frame 240 to the start of the next lap, never decreases, and gives different speeds at different frames.
17. THE Test_Suite SHALL check that a Road with 2 control points and a Road with 101 control points are refused with a message that names the count, and that a Road with 3 and a Road with 100 control points are accepted.
18. THE Test_Suite SHALL check that the Shot_Length values 59 and 601 are refused with a message that states the range, and that 60, 240 and 600 are accepted.
19. THE Test_Suite SHALL check the Fill_Fraction function with hand-computed projected points, including a case where the width decides and a case where the height decides.

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
