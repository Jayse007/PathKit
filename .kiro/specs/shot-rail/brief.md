# Brief: Shot Rail (demo app 1), a camera-angle and camera-move simulator

Written by the reviewer for Kiro to turn into requirements, design and tasks. It is a brief, not a spec.
Status: DRAFT 1, 2026-11-24. If anything here is unclear or conflicts with the repository, stop and ask before building on it.

## Goal

Answer one question: "If I film this subject from here, with this lens and this movement, what will it look like?"
A user places cameras around a moving subject, sees what each camera sees, picks a camera, gives it a move, and gets
a motion check. It is a rough planning tool. It does not show realistic footage, and it says so.

PathKit does the work that a plain camera cannot:
- the subject follows a path (`followPath`, `alignToPath`) and speeds up and slows down along it;
- several cameras sit around the subject at once (`orbitAround`, `aimAt`) and keep aiming at it;
- a chosen camera can follow its own path;
- the motion linter checks the camera move.

## Structure and scope

- Folder: `apps/shot-rail/`, self-contained (own `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`).
  No code is shared with `apps/skeleton-bench/`. A small helper may be copied.
- The app imports PathKit only through `packages/pathkit/src/index.ts`.
- Do not edit anything under `packages/pathkit`, any other `package.json`, `scripts/guard-*`, `.kiro/hooks/guard-*`,
  `scripts/check-constraints*` or `scripts/setup*`. Name no new file or hook with the prefix `guard-`.
- New files only inside `apps/shot-rail/`, plus the spec in `.kiro/specs/shot-rail/`. The one existing file that may change
  is `apps/shot-rail/README.md`.
- Vite `base` is `/PathKit/shot-rail/` so the build works on GitHub Pages. The deploy workflow is a later, separate task.
- No network calls at run time. No analytics. No paid service. Nothing is stored except simple view settings in `localStorage`, always inside try/catch.
- Kiro cannot run terminal commands here. For every checkpoint give the user the exact one-line command and ask for the pasted output.
  Commands: `npm.cmd install` (once, by the user), `npm.cmd test`, `npm.cmd run build`. The user adds the matching line to `.kiro/steering/windows-terminal.md`.

## Build order (one phase at a time, spec first)

0. **Spike** (tests only, no interface). Prove the five facts below with small tests and write the results in `docs/build-notes.md`.
   If one fails, stop and ask. Do not invent a workaround.
   - S1: bake a subject scene (car on a road path, `followPath` with `alignToPath`) and read it back with `evaluateEntity`.
   - S2: turn the subject's baked positions into a keyframed target and aim a camera at it with `aimAt`.
   - S3: `orbitAround` with a keyframed target and speed 0 keeps a fixed offset that moves with the subject.
   - S4: a camera higher or lower than the subject can be made by shifting the target up or down. Check the resulting height.
   - S5: bake the subject plus six cameras and report the time. Target: under 100 ms on the user's machine.
1. Pure logic with tests (lens maths, labels, frame mapping, shot builders).
2. Stage, camera view and coverage grid.
3. Modes, timeline, motion check, shot strip, capture.
4. Design pass (about a third of the work).
5. Manual and build notes, then deploy.

## Features, in priority order

**P1 (must ship)**
1. Subject: a car drawn from boxes and cylinders, no real brand, logo or licence plate text. It drives a closed road path with eased speed.
2. **Angle mode:** a grid of up to 6 small camera views around the subject. Each camera has bearing, height, distance and lens.
   Each view carries a label (see "Labels"). Click one to make it the main camera.
3. **Move mode:** the main camera gets a shot type: push-in, orbit, tracking (fixed offset from the subject), crane (rises). Scrub and play.
4. Lens presets 24, 35, 50, 85 mm. Camera field of view comes from the lens (see "Lens maths").
5. Motion check: PathKit's `motionLinter` on the camera scene, listed in plain words, each finding clickable to jump to its frame.
6. Three sample shots load on start so the first action works at once.
7. Timeline: play, pause, scrub, frame counter, marks for findings.

**P2**
8. Shot strip: six small pictures along the shot.
9. Capture: save the current frame as a PNG (canvas to blob, a plain download link, no library).
10. Second subject: a walking figure drawn from capsules. It has no walking animation, so say "stand-in" in the interface.

**P3 (only if time remains)**
11. Third subject: an abstract one (a glowing ball or a paper plane).
12. Compare two takes of the same shot side by side.

**Cut:** equipment limits (slider speed, pan rate), lighting, depth of field, physics, imported models, export to video.

## Interface

Dark "previz desk" look. One warm accent (amber) for warnings. Plain labels, no jargon without a one-line explanation on hover and focus.

| Region | Contents |
| --- | --- |
| Main camera view (largest) | 16:9 frame, thirds guides (toggle), safe-area guide (toggle) |
| Coverage grid | Up to 6 small views, each with its label. Rendered only when something changes, not every frame, to keep weak laptops smooth |
| Stage overview (small) | Top-down 3D view: subject, road, cameras, camera paths |
| Controls (left) | Mode tabs (Angle, Move), camera list, bearing, height, distance, lens, shot type, shot length |
| Readout (right) | Angle label, framing label, field of view, motion check list |
| Timeline (bottom) | Play, scrub, frame counter, finding marks |

Intuitive-use rules (a judging criterion): a sample shot is loaded at start; every control has a visible text label and a tooltip;
every control works from the keyboard with the key shown beside it; empty and error states say what to do next;
a one-line hint appears the first time each mode opens; the first action produces a visible result within about ten seconds.
Accessibility: text contrast at least 4.5 to 1 (checked, not guessed), visible focus ring, no meaning by colour alone,
`prefers-reduced-motion` replaces playback easing and animated transitions with jumps, and a non-drag alternative for every drag.

## Lens maths (hand-computed, to be used as test expectations)

Frame is 16:9 cut from a 36 mm wide sensor (height 20.25 mm). Horizontal field of view = 2 x atan(18 / focal length).
Vertical = 2 x atan(10.125 / focal length). Set the Three.js camera `filmGauge` to 36 so its focal-length helper matches.

| Lens | Horizontal | Vertical |
| --- | --- | --- |
| 24 mm | 73.7 degrees | 45.7 degrees |
| 35 mm | 54.4 degrees | 32.3 degrees |
| 50 mm | 39.6 degrees | 22.9 degrees |
| 85 mm | 23.9 degrees | 13.6 degrees |

## Labels (app rules, not film standards)

Thresholds are named constants in one file, shown to the user next to each label, and described as this app's own cut-offs.
- Angle label from the camera's elevation above or below the subject centre: below -10 degrees "low angle", -10 to 10 "eye level",
  above 10 "high angle", above 60 "overhead". (Starting values, to be tuned and shown.)
- Framing label from how much of the frame height the subject fills: above 70% "close-up", 35 to 70% "medium", below 35% "wide".
- Do not state what an angle "does" to the viewer as a fact. If a note is shown, mark it "commonly said" and record its source in `docs/sources.md`.

## Honest limits (shown in an About panel and in the README)

- The subject is a stand-in drawn from shapes. No lighting, exposure or depth-of-field simulation.
- Angles are measured from the world axes, not from the car's heading, so a turning car changes its relation to a fixed-bearing camera. (Unless S3 shows otherwise.)
- PathKit allows one path per scene, so the subject and the cameras are baked in two scenes.
- Lens maths assumes the 36 mm sensor. Another sensor changes the angles.
- This is rough planning, not a prediction of real footage.

## Tests (Vitest, in the app folder, run with `npm.cmd test`)

Expected values are written by hand, never read from the code under test. Nothing in a test touches the network or the browser.
1. Lens table above (to 1 decimal place), plus a 0 or negative lens fails with a clear message.
2. Label boundaries: every threshold, one value either side.
3. Frame and time conversion; scrub value to whole frame number, clamped, never fractional.
4. Shot builders (push-in, orbit, tracking, crane) produce scenes that `validateScene` accepts, with the exact entity list and constraint order (`orbitAround` before `aimAt`).
5. Subject-to-target conversion: one keyframe per frame, equal to the baked position.
6. Spike results S1 to S5 kept as tests.
7. Each task names a "source line it should catch": one change that makes a named test fail.

## What Kiro cannot test (say so in the final report)

How it looks, WebGL output, the real browser, PNG download, the feel of the controls. The user checks these, and the reviewer
renders screenshots in a clean copy. Say plainly what was not tested.

## Notes and manual (deliverable)

Keep `apps/shot-rail/docs/build-notes.md`: after each task one short entry (what was done, what broke, what Kiro got wrong, which
PathKit feature was used). The reviewer later merges these into `docs/building-an-app-on-pathkit.md`.

## Licences (checked 2026-11-24 from the npm registry; add to `THIRD_PARTY.md` when the app uses them)

three MIT, `@types/three` MIT, Vite MIT, Vitest MIT, TypeScript Apache-2.0. Pin exact versions at install. Do not take a new major version
of TypeScript or Vite late in the project without asking. Fonts: none chosen; propose open-licence candidates and the user checks each licence first.
No images, icons or sounds from outside. The name "Shot Rail" is a working name and is not trademark-checked.
