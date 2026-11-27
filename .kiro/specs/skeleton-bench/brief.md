# Brief: Skeleton Bench (demo app 2), a 3D equipment workbench

Written by the reviewer for Kiro to turn into requirements, design and tasks. It is a brief, not a spec.
Status: DRAFT 2, 2026-11-24 (gestures changed). It sits beside the project document "Demo app 2 pitch" (v2), which holds the research.
If anything here is unclear or conflicts with the repository, stop and ask before building on it.

## Goal

A browser workbench where a person turns a machine, zooms in, drags it across the screen, takes it apart and reads about each part.
It works with mouse and keyboard first. Webcam gestures are a later upgrade, never a dependency.
Three machines: a centrifugal pump, a shell-and-tube heat exchanger, a desk lamp. All built in code from Three.js shapes.

PathKit is used for: the orbit camera (`orbitAround` plus `aimAt`), the zoom rails and zoom-to-part rails (`followPath` plus `aimAt`),
curved eased part paths for the exploded view, and the motion linter on the guided tour.
PathKit is NOT used for: spinning a part in place (the impeller), dragging the machine, or the cursor. Do not claim otherwise.
PathKit cannot follow a live hand: it bakes ahead of time. The hand only chooses a frame number on a baked, checked path.

## Structure and scope

- Folder: `apps/skeleton-bench/`, self-contained (own `package.json`, lock file, `tsconfig.json`, `vite.config.ts`, `.gitignore`).
  No code is shared with `apps/shot-rail/`.
- The app imports PathKit only through `packages/pathkit/src/index.ts`.
- Do not edit anything under `packages/pathkit`, any other `package.json`, `scripts/guard-*`, `.kiro/hooks/guard-*`,
  `scripts/check-constraints*` or `scripts/setup*`. Name no new file or hook with the prefix `guard-`.
- New files only inside `apps/skeleton-bench/`, plus the spec in `.kiro/specs/skeleton-bench/`. The one existing file that may change is its README.
- Vite `base` is `/PathKit/skeleton-bench/`. The deploy workflow is a later, separate task.
- No network calls at run time except the webcam model files, which are self-hosted in the app folder (Tier B only). No analytics, no paid service.
- Kiro cannot run terminal commands here. Same one-line-command rule as the Shot Rail brief.

## Build order (one phase at a time, spec first)

0. **Spike** (tests and one manual check). Write results in `docs/build-notes.md`. If one fails, stop and ask.
   - S1: bake one full orbit lap (`orbitAround`, axis +Y, `aimAt` the machine centre); read any whole frame with `evaluateEntity`.
   - S2: bake a zoom rail (`followPath` plus `aimAt`); the last frame is not inside the machine's bounding box.
   - S3: `motionLinter` on the guided tour returns a findings list without errors.
   - S4 (manual, by the user): `PerspectiveCamera.setViewOffset` moves the machine on screen without breaking orbit, zoom or clicking a part.
     If it does not, the fallback is to move the machine and re-bake the rails when the drag ends (3 to 12 ms per bake).
   - S5 (manual, Tier B only): the MediaPipe wasm and model load from the app's own folder in a built copy, with the network off.
1. Tier A logic (pure, tested): frame mapping, drag range, explode easing, part list and data checks.
2. One machine end to end (pump), then the other two and the inventory.
3. Interface and the two looks, accessibility pass (about a third of the work).
4. Deploy Tier A. Only then start Tier B.
5. Tier B: first the **gesture lab** (a check page showing the 21 hand points and the pose name live, tried by the user on their own webcam and light). Then the gestures one at a time: rotate, explode, zoom.
6. Manual and notes.

## Features, in priority order

**Tier A (must ship)**
1. Orbit: drag on the empty bench or on the machine, or arrow keys, scrubs the baked lap (angle becomes a whole frame number).
2. Zoom: scroll wheel, `+` and `-`, or a slider scrubs a baked zoom rail. The rail never enters the machine.
3. **Move across the screen:** a visible Rotate / Move toggle (key `M`). In Move mode a drag, or the arrow keys, slides the machine inside a
   bounded "bench area". The range is clamped, a `Reset position` button and key `R` return it, and it is tied to the explode amount so
   exploded parts cannot leave the screen. Implemented as a view offset (see S4), not by PathKit. A non-drag way to move is required
   (accessibility: WCAG 2.2 "Dragging Movements").
4. Explode: slider (0 to 100%) and key `E`. Each part follows its own short curved, eased path, one PathKit scene per part, all baked at load.
5. Inspect: click, or Tab then Enter, on a part. The inspector shows name, job, material, and typical position. Sample specifications
   are invented and labelled "sample data".
6. Inventory: three machine cards (pump, heat exchanger, desk lamp), each with a thumbnail drawn in SVG by us.
7. Guided tour: a Tour button plays a camera path that visits the parts (`followPath` plus `aimAt`). The motion check panel lists linter findings.
8. Theme toggle: **X-ray skeleton** (default) and **Clean engineering**. Same layout, two sets of colour settings and two material sets. Remembered in `localStorage` inside try/catch.

**Tier B (after Tier A is deployed)**
9. Webcam hand tracking with three gestures, each with a mouse or keyboard twin that already exists. **The number of hands in view picks the mode.**
   - One hand, thumb and index finger touching (a pinch), then drag: **rotate**.
   - One hand, a closed fist opening to an open palm: **explode**. The amount follows how open the hand is (0 for a fist, 1 for an open palm),
     smoothed, with a small dead zone at both ends so a fully open hand always reads 100%. If the continuous version proves unstable in the gesture lab,
     fall back to a trigger: opening plays the full explode, closing reassembles. Pinch is NOT used for explode.
   - Two hands in view, moving apart: **zoom in**; moving together: **zoom out**. The change in distance between the two palm centres (a ratio, like a phone pinch)
     picks the frame on the baked zoom rail. This is the first gesture to drop if time is short. While two hands are in view, rotate and explode are paused.
10. Live status overlay: a small drawn hand skeleton and the words for the gesture being read ("Pinching: rotating").
11. Gesture rules: smooth the landmarks, require a held pose of about 300 ms, ignore frames with no hand, stop the camera tracks on exit.
12. Before the camera starts, show a plain notice: images are processed on the device and not sent anywhere; MediaPipe Tasks sends usage metrics to Google;
    the user can decline and keep using mouse and keyboard. No recording, no storing.
13. Load the model and wasm only when the user turns gestures on (about 15 MB of wasm plus the model).

**Cut:** flow mode, parametric edit, voice, a language model at run time, CAD kernels, imported models, a gesture for Move, a wrist-flick gesture, pinch-to-explode, index-finger zoom.

## Machines (parts are named objects, shared by the explode path, the inspector and the keyboard order)

- Pump: casing, impeller, shaft, bearing housing, mechanical seal, flange, bolts (one group), motor.
- Heat exchanger: bonnet (front head), tube sheet, shell, U-tube bundle (many U-shaped tubes merged into one mesh, one part), baffles and tie rods, shell nozzles.
- Desk lamp: base, upper arm, spring, elbow joint, forearm, shade (lamp head), bulb holder.
- **Accuracy rule:** every fact shown for a part is checked against at least one reputable source and recorded in `docs/sources.md`
  (part, claim, source, date checked). Nothing is shown from memory. The user checks the text before it ships.

## Interface

| Region | Contents |
| --- | --- |
| Stage (centre) | The machine on a faint bench grid. Selected part highlighted |
| Inventory (left) | Three machine cards |
| Inspector (right) | Part name, job, material, position, "sample data" label. Empty state: "Pick a part to read about it" |
| Control bar (bottom) | Rotate / Move toggle, Explode slider, Orbit scrub, Zoom, Tour, Reset position, Gestures toggle, Theme toggle |
| Motion check (small) | Linter findings in plain words |

Looks: **X-ray skeleton**: near-black background, bone-ivory translucent fills, thin cyan edges (Three.js `EdgesGeometry`), one orange accent for the selected part;
no bats, cobwebs or stock horror. **Clean engineering**: light neutral background, solid matte parts, one blue accent.
Intuitive-use rules and accessibility: the same as the Shot Rail brief (sample loaded at start, visible labels and key hints, first action works within about ten seconds,
contrast at least 4.5 to 1 in BOTH looks, focus ring, no meaning by colour alone, reduced motion respected, a keyboard path for every mouse action).
Mouse conventions: left-drag rotates (Rotate mode), left-drag moves (Move mode), wheel zooms, click selects.

## Honest limits (shown in an About panel and the README)

- Machines are simplified models built from shapes. Specifications are invented sample data.
- The impeller spin, dragging and the cursor are ordinary Three.js, not PathKit.
- Gestures need a webcam, light, and a page served over HTTPS. Two-hand zoom is the least stable gesture. Moving the machine has no gesture. The pose classifier is our own code over the 21 hand points; no second model is used.
- MediaPipe sends usage metrics to Google (see the notice above).

## Tests (Vitest, in the app folder, run with `npm.cmd test`)

Hand-written expected values. No browser, no network, no webcam.
1. Angle to frame number: 0, 90, 180, 359.9 and 360 degrees give the exact frames; negative angles wrap; never fractional.
2. Zoom value (0 to 1) to frame: both ends, the middle, clamped outside the range.
3. Drag range: inside, on the edge, outside (clamped), reset, and the range shrinks as the explode amount grows.
4. Explode easing: at 0 and 100% every part is at its rest and end position; never a frame outside the baked range.
5. Part data: every part has an id, name, job, material and a source id that exists in `docs/sources.md`; ids are unique; keyboard order lists every part once.
6. Scenes pass `validateScene`; `orbitAround` has a lower `order` than `aimAt`.
7. Gesture logic (Tier B, pure functions, with hand-written landmark fixtures): the pose classifier (fist, open palm, pinch), openness from 0 to 1, mode picked by hand count (one hand: rotate or explode, two hands: zoom), two-hand distance ratio to zoom frame, smoothing, no hand means no change, a pinch must be held about 300 ms before rotate starts.
8. Spike results S1 to S3 kept as tests. Each task names a "source line it should catch".

## What Kiro cannot test (say so in the final report)

How it looks, WebGL output, the view offset, clicking a part, the webcam and the real gestures, load time. The user checks these;
the reviewer renders screenshots in a clean copy. Say plainly what was not tested.

## Notes and manual (deliverable)

Keep `apps/skeleton-bench/docs/build-notes.md` (one short entry per task: what was done, what broke, what Kiro got wrong, which PathKit feature was used)
and `docs/sources.md`. The reviewer later merges the notes into `docs/building-an-app-on-pathkit.md`.

## Licences (checked 2026-11-24 from primary sources; add to `THIRD_PARTY.md` when used)

- three MIT; `@types/three` MIT; Vite MIT; Vitest MIT; TypeScript Apache-2.0 (npm registry).
- `@mediapipe/tasks-vision` 1.2.3: Apache-2.0, but the package contains **no LICENSE or NOTICE file**. If we self-host its wasm files we must add the Apache-2.0 text ourselves.
- Hand Landmarker model: Apache-2.0 per Google's model card (experimental; out of scope: surveillance or identity recognition). Cite Zhang et al. 2020, arXiv:2006.10214, as the model card asks.
- Fonts: none chosen; the user checks each licence first. No images, icons or sounds from outside.
- The name "Skeleton Bench" is a working name and is not trademark-checked. Never use J.A.R.V.I.S., Marvel or Stark names.
