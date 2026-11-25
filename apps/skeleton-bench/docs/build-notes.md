# Build notes

## Task 2.1: Create the app files
- Done: created package.json (exact pins), tsconfig.json, vite.config.ts, vitest.config.ts, .gitignore, index.html, src/pathkit-api.ts, src/constants.ts, THIRD_PARTY.md and the two docs stubs. Config files follow apps/shot-rail.
- Broke: nothing known. Nothing has been run (no terminal, install not yet done).
- Kiro got wrong: nothing known yet.
- PathKit feature used: none yet, only the re-export in src/pathkit-api.ts.
- Risk still open: Vite resolving the import from outside the app root, and type-checking PathKit source, are confirmed only at the first build.
