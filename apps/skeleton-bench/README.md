Skeleton Bench (working name): demo app 2 for PathKit (3D equipment workbench). It uses PathKit only through packages/pathkit/src/index.ts, imported in one file, src/pathkit-api.ts.

"Skeleton Bench" is a working name. It has not been checked against trademarks.

## What it is

A browser workbench with three simplified Machines: a Pump (8 Parts), a Heat_Exchanger (6 Parts) and a Desk_Lamp (7 Parts). You orbit and zoom the view, explode a Machine into its Parts, click a Part to read about it, and run a Tour that visits each Part. There are two Looks: X_Ray_Skeleton (the default) and Clean_Engineering.

## Run it

Run these from `apps/skeleton-bench`, one at a time:

- `npm.cmd install` (once)
- `npm.cmd test`
- `npm.cmd run build`

## Where PathKit is used

Four baked camera laps (`orbitAround` and `aimAt`) blended with `lerp` and `slerp` give the orbit and zoom view. One baked `followPath` scene per Part gives the explode motion. One baked Tour per Machine (`followPath` and `aimAt`) gives the Tour. The Tour is checked with `motionLinter`.

## Where PathKit is not used

The impeller spin is ordinary Three.js code. Dragging and the cursor are ordinary browser code. None of these use PathKit.

## Honest limits

- The Machines are simplified models built from shapes. They are not to scale with each other, because they share one stage box.
- The specifications are invented sample data. The facts about each Part are paraphrased from the web pages listed in `THIRD_PARTY.md` and `docs/sources.md`. Several of those pages are supplier or blog pages, not standards, and some claims are thinly sourced (see `docs/sources.md`).
- PathKit cannot follow a live hand, because it bakes ahead of time.
- Hand gestures are not available in this version (the Gestures button is disabled). When they are added, they will need a webcam, good light and a page served over HTTPS.
- Two-hand zoom is the least stable gesture.
- Moving the Machine has no gesture. Use the mouse or the arrow keys in Move mode.
- The pose classifier is our own code over the 21 hand points. No second model is used.
- Hand tracking will use MediaPipe, which sends usage metrics to Google.
- Move mode has arrow keys and mouse drag, and a Reset position button, but no on-screen buttons that move the Machine. A user with only a mouse can drag, but has no click-only way to move it in steps.
- The Inspector's open Part panel has a minimum height of `calc(100vh - 160px)`. The 160 px is an estimate, not a measured value.
- Colour contrast is tested, but the Stage graphics are held to 3 to 1, not 4.5 to 1. The Clean_Engineering fill #7d8793 is 3.16 to 1 and its accent #1f6feb is 4.02 to 1. The X_Ray_Skeleton translucent fill is about 1.7 to 1 against the background by design; the outlines and the accent carry the shape. That fill contrast is not tested.
- In Clean_Engineering the bulb holder of the Desk_Lamp is mostly hidden inside the shade (it shows when exploded, in X_Ray_Skeleton, or from below). The spring is thin and small at the default zoom. The pass partition, impingement plate, spacers, bulb and wiring are not drawn.
- The paths of the Parts bow sideways while exploding. The end positions are checked for gaps, but a Part might pass through another one part-way through the explode.
- The look of the app, WebGL output, the view offset, clicking a Part, the webcam, real gestures and load time are not covered by the automated tests. The User checked the Machines and the controls by eye in a browser at several checkpoints.

## Stored keys

The app stores these keys in the browser's `localStorage`. Every read and write is inside `try`/`catch`, so a blocked or full store falls back to defaults. No webcam image is stored.

- `skeletonBench.look`: the chosen Look, `X_Ray_Skeleton` or `Clean_Engineering`.
- `skeletonBench.hintSeen.rotate`: `1` once the Rotate mode hint has been shown.
- `skeletonBench.hintSeen.move`: `1` once the Move mode hint has been shown.
