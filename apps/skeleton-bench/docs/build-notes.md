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
