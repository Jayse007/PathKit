# Brief: constraint checklist script and hook

Written by the reviewer for Kiro to turn into requirements, design and tasks. It is a brief, not a spec.
If anything here is unclear or conflicts with the repository, stop and ask before building on it.

## Goal

When someone adds a new constraint type to PathKit, several places must list it. `docs/adding-a-constraint.md`
describes them. This work makes that checklist automatic:

1. A script, `scripts/check-constraints.mjs`, reads the source files as text and reports, for every constraint
   type, which of those places forget it.
2. A hook, `.kiro/hooks/constraint-checklist.json`, runs the script before every spec task so the agent that does
   the task sees the result.

The script only reports. It never blocks anything, and it never edits any file.

## Why report-only

In the middle of a spec the code is meant to be inconsistent. While `orbitAround` was added, `scene.ts` knew the
new type after task 1.1 but `bake.ts` did not handle it until task 3.1. A blocking hook would have stopped
that spec halfway. Blocking is the job of the final check (`--strict`, below), run by a person.

## Scope: what may and may not change

- New files only: `scripts/check-constraints.mjs`, `scripts/check-constraints.test.mjs`,
  `.kiro/hooks/constraint-checklist.json`, and the spec files for this work.
- Do not edit anything under `packages/pathkit`. It is the frozen core, and this work only reads it.
- Do not name any new file or hook id with the prefix `guard-`. That prefix is protected by the guard hooks.
- No new dependencies and no changes to any `package.json`. Use only Node built-in modules.
- Kiro cannot run terminal commands in this project. For every task, give the user the exact one-line command to
  run and ask for the pasted output before calling the task done.

## What the script checks

The script finds the constraint types itself, so it keeps working when a fourth type is added. In
`packages/pathkit/src/scene.ts`:

- `export type Constraint = A | B | C;` lists interface names. It may span several lines.
- Each `export interface XConstraint { type: 'x'; ... }` gives the type literal `'x'`.
- An interface whose name ends in `Constraint` and has a `type:` literal, but is missing from the union, is a gap.

For every constraint type `t` the script then checks these places. Each place has a short id used in the output:

| Id | Where | The check passes when |
| --- | --- | --- |
| `union` | `scene.ts` | the interface is in the `Constraint` union |
| `validate-case` | `scene.ts`, function `checkConstraintOfType` | its body contains `case 't'` |
| `validate-message` | same function, the `default` branch | the message text mentions `t` (it ends with "use a, b or c") |
| `bake-case` | `bake.ts`, function `bakeEntity` | its body contains `case 't'` |
| `rotation-case` | `bake.ts`, function `drivesRotation` | its body contains `case 't'` |
| `bake-default` | `bakeEntity` | it has a `default:` branch that calls `unknownConstraintType(` |
| `rotation-default` | `drivesRotation` | same |
| `export` | `index.ts` | the interface name is inside the `export type { ... } from './scene.js'` block |
| `scene-test` | `packages/pathkit/test/scene/` | some `.ts` file there contains `'t'` in quotes |
| `bake-test` | `packages/pathkit/test/bake/` | some `.ts` file there contains `'t'` in quotes |

The `default` checks do not depend on the type. They are reported once, with the id and no type name.

To get a function body, find `function name(`, then count curly braces until they balance. Strings and template
literals in these functions contain balanced braces, so this is enough. If a function or the union cannot be
found, report `cannot find <anchor> in <file>`. That is a finding, not a crash.

## Output

Print plain text with no colours.

- Nothing missing, one line:
  `constraint-checklist: 3 constraint types (followPath, aimAt, orbitAround), every place covered.`
- Otherwise a header and one line per gap, then a pointer:
  ```
  constraint-checklist: 2 gaps for 3 constraint types.
    - orbitAround: bake-case (no case 'orbitAround' in bakeEntity, packages/pathkit/src/bake.ts)
    - orbitAround: export (OrbitAroundConstraint is not exported from packages/pathkit/src/index.ts)
  Checklist: docs/adding-a-constraint.md
  ```
- Exit code: 0 always, except with the flag `--strict`, where any gap or unfound anchor exits with code 1.
- The hook passes JSON on standard input. Ignore it and never read standard input.
- Wrap the run so that no failure ever prints a stack trace. Print one line and exit 0 (1 with `--strict`).

## Shape of the code

- ES module, `.mjs`, neat and short, with one comment line above each function saying what it does.
- Export a pure function, `findGaps(sources)`. `sources` is an object with the text of `scene`, `bake`, `index`,
  and arrays of `{ name, text }` for the scene and bake test files. It returns an array of
  `{ type, place, detail }`. It does no file reading, so tests can feed it fixture text.
- A separate function reads the real files, with paths computed from `import.meta.url` so it works from any
  folder and on Windows (use `node:path`, never hard-coded slashes).
- The command-line part runs only when the file is run directly, not when it is imported by the test.

## Tests

Use the built-in runner, `node --test`, with `node:assert/strict`, in `scripts/check-constraints.test.mjs`.
The Vitest setup only runs `.ts` files under `packages/pathkit/test`, so these tests do not run with
`npm.cmd test`. The command is `node --test scripts/check-constraints.test.mjs` from the repo root.

Write expected results by hand. Build the fixture text as small strings, and never derive the expected answer
from the script's own output.

1. A complete fixture with three types gives no gaps.
2. A fourth type added to the union and interface only gives exactly seven gaps for that type (`validate-case`,
   `validate-message`, `bake-case`, `rotation-case`, `export`, `scene-test`, `bake-test`), and none for the other
   three.
3. For each place id, remove just that place from a complete fixture and expect exactly that one gap.
4. A missing `default` branch in `bakeEntity` gives one `bake-default` gap, and the same for `drivesRotation`.
5. An interface with a `type:` literal that is not in the union gives a `union` gap.
6. A multi-line union is parsed.
7. Function not found gives a `cannot find` finding and does not throw.
8. Run against the real repository: no gaps today, and the output is the single OK line for the three real types.
9. The output text and exit codes: OK line, gap lines, `--strict` exit 1 with a gap and 0 without, exit 0 when
   standard input holds unreadable text.

Each task must name a "source line it should catch": one change to the script that makes a named test fail.

## Hook

`.kiro/hooks/constraint-checklist.json`:

```json
{
  "version": "v1",
  "hooks": [
    {
      "name": "Constraint checklist",
      "trigger": "PreTaskExec",
      "matcher": ".*",
      "action": { "type": "command", "command": "node scripts/check-constraints.mjs" }
    }
  ]
}
```

Facts measured on this Windows machine on 22 November 2026 (do not re-test them):

- `PreTaskExec` hooks fire before each spec task and receive `session_id`, `hook_event_name`, `cwd`,
  `spec_name` (the full path of `tasks.md`) and `task_name`.
- Exit 0 did not interrupt the task.
- Standard output printed by the hook was reported by the task's sub-agent as hook output. The main agent did not
  see it. This rests on the sub-agent's report.
- Hooks go live immediately and run from the repo root.

The last task of the spec checks the hook with a real task, and the proof must not rest on anyone's word. It asks
the sub-agent doing that task to write the exact text it received from the hook into a file named
`.kiro/probe/checklist-received.txt`. The user then reads that file. The file and its folder are deleted afterwards.

## Fixed constraints

- Command hooks cost no credits. Nothing in this work may call a model at run time.
- `docs/adding-a-constraint.md` gets one extra line at the end of its checklist pointing to the script
  (`node scripts/check-constraints.mjs --strict` before declaring a new constraint finished). That is the only
  edit to an existing file.
- The final report must list every file created or edited, and say plainly what was not tested.
