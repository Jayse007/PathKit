# Build notes

## Task 2.1: Create the app files
- Done: created package.json (exact pins), tsconfig.json, vite.config.ts, vitest.config.ts, .gitignore, index.html, src/pathkit-api.ts, src/constants.ts, THIRD_PARTY.md and the two docs stubs. Config files follow apps/shot-rail.
- Broke: nothing known. Nothing has been run (no terminal, install not yet done).
- Kiro got wrong: nothing known yet.
- PathKit feature used: none yet, only the re-export in src/pathkit-api.ts.
- Risk still open: Vite resolving the import from outside the app root, and type-checking PathKit source, are confirmed only at the first build.

## Task 3.1: Constants consistency test
- Done: wrote test/constants.test.ts (box radius 1.4, orbit speed 30, elevation sin/cos 5/13 and 12/13, lap r and h against hand-written values, r^2 + h^2 = d^2, distances strictly decreasing, clearance d - R >= 1.0). Expected values are typed in, not computed from the constants.
- Broke: nothing known. Not run yet (no terminal). If Vitest fails to start, esbuild's postinstall was not approved (allowScripts warning), which is a possible cause.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none.

## Task 4.1: Implement angleToFrame
- Done: added src/logic/frame-mapper.ts with `angleToFrame` (wrap with ((a % 360) + 360) % 360, floor(x + 0.5), then % 360; non-finite throws with the value in the message). No imports, no zoom input. `roundHalfUp` from the design table is not added yet (nothing needs it).
- Broke: nothing known. Not run (no terminal); tests are task 4.2.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none.

## Task 4.2: Angle tests
- Done: wrote test/angle-to-frame.test.ts (10-row table with hand-written frames, sweep -720 to 720 step 0.25 for whole frames 0 to 359, NaN/Infinity/-Infinity throw with the value in the message, repeat-call check).
- Broke: nothing known. Not run (no terminal). Mutation to try once: remove the final `% 360` in angleToFrame; the 359.9 table row must fail.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none.

## Task 5.1: Implement zoomSelection and zoomDistance
- Done: added `zoomSelection` (clamp 0 to 1, p = Z * 3, lower = min(floor(p), 2), upper = lower + 1, weight = p - lower) and `zoomDistance` (6.5 - 3.9 * Z, computed from LAP_DISTANCES first and last) to src/logic/frame-mapper.ts. Non-finite throws with the value in the message. No angle input. The file now imports LAP_COUNT and LAP_DISTANCES from '../constants.js'.
- Broke: nothing known. Not run (no terminal); tests are task 5.2.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none.

## Task 5.2: Zoom tests
- Done: wrote test/zoom.test.ts (7-row selection table, weight in [0, 1] and lap indices valid over Z -0.5 to 1.5 step 1/120, non-finite throws for both functions, distance table with 4.55 m at Z = 0.5 and clamping, monotonic distance sweep, independence loop over 13 zoom grid points x 360 angles). Distances use a 1e-9 tolerance because 6.5 - 3.9 * Z can differ by about 1e-16.
- Broke: nothing known. Not run (no terminal). Mutation to try once: change `Math.min(Math.floor(p), LAP_COUNT - 2)` to `LAP_COUNT - 1` in zoomSelection; the Z = 1 table row must fail.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none.
