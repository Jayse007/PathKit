# PathKit

A small, dependency-free TypeScript library in which things (cameras, vehicles, props, anything with a
position and a rotation) follow paths and aim at targets. It bakes the motion into frames and checks it
for problems. Built for the Kiroween 2026 hackathon, Skeleton Crew category.

**Status: work in progress.** Finished and tested: vector and quaternion maths, centripetal Catmull-Rom
curves, an arc-length table (constant-speed travel along a path), and rotation-minimizing frames.
In progress: scene validation, baking, evaluation and a motion linter. The two demo apps are not built yet.

## Run the tests

### Quick start

- Windows, in PowerShell: `.\setup.bat`
- macOS and Linux: `sh setup.sh`

It installs the PathKit packages with `npm ci`, runs every check and prints PASS or FAIL for each step. It builds nothing.

If a step fails, run its command yourself to see the full output. The setup script shows only the last 30 lines of a failing step. The commands are `npm test` (inside `packages/pathkit`), `node --test scripts/check-constraints.test.mjs` and `node scripts/check-constraints.mjs --strict` (both from the repository root).

Tested with Node.js 24.

```
cd packages/pathkit
npm install
npm test
```

## Layout

- `packages/pathkit/src` the library
- `packages/pathkit/test` property-based and unit tests
- `.kiro/specs/path-core` requirements, design and task list written with Kiro
- `.kiro/steering` rules Kiro follows when working on this project
- `.kiro/docs/known-issues.md` problems found during development and how they were fixed
- `THIRD_PARTY.md` every outside library, method and tool, with its licence

## How it was built

Specs written first (requirements, design, tasks), then built task by task in Kiro. Behaviour is checked with
property-based tests. Many of the tests were also checked by deliberately breaking the code to confirm they fail.

## Originality

All code was written during the Kiroween 2026 submission period. There is no pre-existing code.

## Licence

MIT. See `LICENSE`.
