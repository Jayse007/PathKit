# Implementation Plan: constraint-checklist

## Overview

Build `scripts/check-constraints.mjs` in five groups, each with its tests in `scripts/check-constraints.test.mjs`, then add the hook, one docs line, a check of what the hook delivers, and the final report. Group 1 writes the small text helpers. Group 2 writes `findTypes`. Group 3 writes `findGaps`, one set of places at a time. Group 4 writes `formatReport` and `runChecker`. Group 5 writes `readSources` and the command-line part, and runs the real program. Each group ends with a checkpoint where the user runs the whole test file and pastes the output.

The hook file `.kiro/hooks/constraint-checklist.json` is created only after the script is complete and every test passes (group 6). A hook that points to a missing or broken script could fail before each task. After the hook exists, it runs before every later task. That is expected.

Nothing under `packages/pathkit` changes. The language is JavaScript (ES modules, `.mjs`) with Node built-in modules only. Tests use `node --test` and `node:assert/strict`. Test ids (H1 to H5, F1 to F5, T1 to T20) refer to `design.md`. Test titles start with their id, so the pasted output shows which test ran. Requirement numbers refer to `requirements.md` in this folder.

Two small differences from `design.md`, both for testing and both visible in the tasks:

- The six helpers are exported from the script, so tests H1 to H5 can call them directly. The design lists five exports (`findTypes`, `findGaps`, `formatReport`, `readSources`, `runChecker`). The helpers are pure and add no behaviour.
- The design's T8 says "each of the four anchors". There are five: the union, `checkConstraintOfType`, `bakeEntity`, `drivesRotation` and the export block. T8 covers all five.

## Execution Rules

These rules apply to every task below.

### Terminal and verification

- Kiro cannot run terminal commands (a project hook blocks them). At a checkpoint task and at task 6.1, give the user the command named in the task on one line, say it runs from the repository root (`c:\Users\JAMES\PathKit\PathKit`), and wait for the pasted output. Between checkpoints, do not ask for a test run. Continue with the next task. Only the checkpoint tasks (1.3, 2.2, 3.6, 4.3 and 5.4) and 6.1 ask for a run.
- The test command is exactly `node --test scripts/check-constraints.test.mjs`. The final check is exactly `node scripts/check-constraints.mjs --strict`. Ask for no other command, no extra arguments, no watch mode, never `npx` and never `tsc`. Never ask for `npm.cmd test`: it runs only the Vitest suite under `packages/pathkit` and does not run these tests.
- Do not mark a task done until the pasted output shows the results. Report passed, failed and skipped counts from the pasted output only. If the output is missing or cut off, ask for it again.
- If a write is blocked by a hook, stop and tell the user what was blocked. Never look for another way.

### Scope

- Change only the files a task names. The files this work may create are `scripts/check-constraints.mjs`, `scripts/check-constraints.test.mjs`, `.kiro/hooks/constraint-checklist.json`, the three spec files, any task-record file Kiro creates by itself in this spec folder, and the temporary `.kiro/probe/checklist-received.txt`. The only existing file that may be edited is `docs/adding-a-constraint.md` (task 7.1). Marking checkboxes in this `tasks.md` is allowed.
- Do not edit anything under `packages/pathkit`, any `package.json` or `package-lock.json`, `scripts/guard-*`, `.kiro/hooks/guard-*` or `.kiro/specs/orbit-around/`. Name no new file and no hook id with the prefix `guard-`.
- Add no dependency. The script imports only `node:fs`, `node:path` and `node:url`. The test file imports only `node:test`, `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `node:url` and `node:child_process`, plus the script.
- Nothing in this work may call a model, a network service or another program at run time. The script never reads standard input and never writes a file.

### Code style

- Every function in the script and in the test file has one comment line above it saying what it does. The script's header comment states the limits from the design: the two test checks show that a file mentions a type and not that the type is tested well (a name in a comment also counts), and brace counting is not aware of strings or comments.
- Paths are built from `import.meta.url` with `node:path`. Never type a slash or backslash in a path used to read a file. Repository paths in messages are display text.
- Keep the script short and neat. Do not add features the design does not name.

### Tests

- Execute tasks one at a time, strictly in list order, never in parallel. Say which task is starting. When it is finished, report the result in one or two sentences.
- Write every expected result by hand. Build every fixture as a small string. Never take an expected answer from the output of the script. Fixture type names are `alpha`, `beta`, `gamma` and `delta`, never the real type names, except in the real-repository tests T13 and T14.
- Only the tests T15 and T16 write files, and only inside a temporary folder under `os.tmpdir()` that the test removes afterwards.
- When a test is finished, tell the user which source line, if broken, it should catch (each task names that line), so the user can break it once and confirm the test fails, then restore it.
- If a test fails, state first whether the script or the test is wrong, then fix that one. Make at most 3 fix attempts, then stop and report the failing test name and its output. Never weaken a test to make it pass.
- A test file that takes more than 5 seconds on the user's machine is a defect. Report it and find the cause before moving on.

## Tasks

- [x] 1. Group 1: text helpers
  - [x] 1.1 Create the script with the word and case helpers
    - Create `scripts/check-constraints.mjs` and `scripts/check-constraints.test.mjs`
    - Script: the header comment (what the script does, report-only, the two limits above), the constants of the design (`SRC`, `SCENE_FILE`, `BAKE_FILE`, `INDEX_FILE`, `CHECKLIST`, `TYPE_PLACES`), and the exported helpers `escapeRegExp(text)`, `hasWord(text, word)` and `hasCase(body, type)` as the design describes. `hasWord` uses `(?<![A-Za-z0-9_])` and `(?![A-Za-z0-9_])` around the escaped word and is case-sensitive. `hasCase` accepts single or double quotes and optional spaces before the colon
    - Tests: H1 `hasWord`: a name alone, in a sentence, next to punctuation and at the start and end of the text counts. `alphaExtra`, `myalpha`, `alpha2`, `alpha_x` and `Alpha` do not count for `alpha`. A word with a regular-expression character (`a.b`) matches only itself. H2 `hasCase`: `case 'alpha':`, `case "alpha":` and `case 'alpha' :` count. `case 'alphaX':` and a bare `alpha` do not
    - Source line it should catch: `hasWord` changed to a plain `text.includes(word)` (fails H1)
    - _Requirements: 2.3, 2.7, 2.8, 2.9, 2.10, 6.5, 11.7_

  - [x] 1.2 Add the function-body, default-branch and export-block helpers
    - Change only the two files of task 1.1
    - Script: export `functionBody(text, name)`, `defaultBranch(body)` and `exportedNames(indexText)` as the design describes. `functionBody` finds `\bfunction\s+<name>\s*\(`, counts parentheses to skip the parameter list, then counts braces from the next `{`, and returns the text from that `{` to its matching `}`, or `null` when the function or the closing brace is not found. `defaultBranch` returns the text from the first `default` followed by `:` to the end of the body, or `null`. `exportedNames` returns the names inside every `export type { ... } from './scene.js'` block (both quote styles), or `null` when there is none
    - Tests: H3 `functionBody`: returns the body of a small function with nested braces and a template literal such as `` `${x}` ``. A parameter type written as `{ a: number }` does not start the count early. A name that is only a prefix of another function (`bake` and `bakeEntity`) is not matched. A missing function and a missing closing brace give `null` and do not throw. H4 `defaultBranch`: finds `default:` and `default :`, returns `null` when there is none. H5 `exportedNames`: reads names over several lines, ignores a `from './other.js'` block and a plain `export { ... }` block, returns `null` when nothing matches
    - Source line it should catch: `functionBody` changed to `throw` when the function is not found (fails H3)
    - _Requirements: 2.2, 2.4, 2.5, 2.6, 3.1, 3.2, 4.2, 4.3, 4.5_

  - [x] 1.3 Checkpoint 1
    - Ask the user to run `node --test scripts/check-constraints.test.mjs` from the repository root and paste the output. Expect H1 to H5 to pass with 0 failed
    - Mark tasks 1.1 and 1.2 done only from that output. Tell the user the source lines named in 1.1 and 1.2, so they can break each once

- [x] 2. Group 2: findTypes
  - [x] 2.1 Add `findTypes` and its tests
    - Change only the two files of task 1.1
    - Script: export `findTypes(sceneText)` returning `{ types, orphans, unionFound }` as the design describes: union by `/export\s+type\s+Constraint\s*=\s*([^;]+);/`, split on `|`, trimmed; interfaces by `/export\s+interface\s+(\w*Constraint)\s*\{([^}]*)\}/g` with the `type:` literal in either quote style; an interface without a literal is ignored; `types` holds `{ iface, type, listed }` in union order, then unlisted interfaces in file order; a union name with no interface goes to `orphans`; when the union is not found every interface is added with `listed` false and `unionFound` is false. The script contains no list of real type names
    - Tests: F1 three types in a one-line union. F2 an interface with a `type:` literal that is not in the union is added last with `listed` false (T5, first half). F3 a name with no interface goes to `orphans` and is not in `types`. F4 an interface with no `type:` literal is ignored. F5 no union in the text gives `unionFound` false and all interfaces in `types`. T6 a union over several lines, with CRLF line endings in one variant, gives the same result as the one-line union
    - Source line it should catch: `[^;]+` in the union regex changed to `[^;\n]+` (fails T6)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 12.7, 12.8_

  - [x] 2.2 Checkpoint 2
    - Ask the user to run `node --test scripts/check-constraints.test.mjs` and paste the output. Expect 0 failed
    - Mark task 2.1 done only from that output. Tell the user the source line named in 2.1

- [x] 3. Group 3: findGaps
  - [x] 3.1 Add the fixture helper and the checks in `scene.ts`
    - Change only the two files of task 1.1
    - Test file: add `makeSources(types)` as the design describes (interfaces, union entry, a `case` in `checkConstraintOfType`, `bakeEntity` and `drivesRotation`, the default message `(use alpha, beta or gamma)`, the export block, one test text per folder that mentions each name, both defaults calling `unknownConstraintType(`). Build it from small strings
    - Script: export `findGaps(sources)`. In this task it looks up the union and `checkConstraintOfType`, and runs `union`, `validate-case` and `validate-message` for every entry of `types`, and the orphan gap, with the exact `detail` strings of the design. A missing union or a missing `checkConstraintOfType` gives the `cannot find ...` finding with `place: 'anchor'` and skips only the checks that need it. Never throw
    - Tests: T1 the complete fixture with `alpha`, `beta` and `gamma` gives `[]`. T3 (first part) removing only `case 'beta'` from `checkConstraintOfType` gives exactly one `validate-case` gap for `beta`; removing only `beta` from the default message gives exactly one `validate-message` gap; removing only `BetaConstraint` from the union gives exactly one `union` gap. T5 (second half) the unlisted interface still gets the other checks. T7 a union name with no interface gives exactly one `union` gap with the interface name in `type`, the detail of Requirement 1.4, and no other gap. T8 (first part) no union, and no `checkConstraintOfType`, each give the `cannot find` finding, do not throw, and the other checks still run. T9 (first part) a default message that mentions only `betaExtra` gives a `validate-message` gap for `beta`. Expected arrays are written by hand
    - Source line it should catch: the orphan branch changed to guess `type` as the interface name without the `Constraint` suffix, lower-cased (fails T7)
    - _Requirements: 1.3, 1.4, 2.1, 2.2, 2.3, 2.11, 4.1, 4.2, 4.4, 4.5, 5.1, 5.2, 5.5, 12.3, 12.5, 12.7, 12.9, 12.17_

  - [x] 3.2 Add the checks in `bake.ts` and `index.ts`
    - Change only the two files of task 1.1
    - Script: look up `bakeEntity` and `drivesRotation` in `bake` and the export block in `index`. Run `bake-case`, `rotation-case` and `export` per type, in `TYPE_PLACES` order, with the exact `detail` strings of the design. Missing anchors give the `cannot find` findings and skip only the checks that need them
    - Tests: T3 (second part) removing only `case 'beta'` from `bakeEntity` gives exactly one `bake-case` gap for `beta`, the same for `drivesRotation` and `rotation-case`, and removing only `BetaConstraint` from the export block gives exactly one `export` gap. T8 (rest) no `bakeEntity`, no `drivesRotation` and no export block each give their `cannot find` finding, do not throw, and the other checks still run (all five anchors are now covered). An `export type { ... } from './other.js'` block does not satisfy `export`
    - Source line it should catch: `bakeEntity` looked up as `bakeEntry` (fails T3 and T8)
    - _Requirements: 2.4, 2.5, 2.6, 2.11, 4.2, 4.3, 4.4, 4.5, 12.5, 12.9_

  - [x] 3.3 Add the test-file checks
    - Change only the two files of task 1.1
    - Script: run `scene-test` and `bake-test` per type with `hasWord` over the `text` of each file in `sceneTests` and `bakeTests`, with the exact `detail` strings of the design
    - Tests: T3 (third part) removing the only mention of `beta` from the scene test text gives exactly one `scene-test` gap for `beta`, the same for `bake-test`. A mention in only one of two files counts. T9 (second part) a test text with only `alphaExtra` does not satisfy `alpha`, and a text with `alpha` in a comment does. T2 a fourth type `delta` added only to the union and its interface gives exactly seven gaps for `delta`, in the order `validate-case`, `validate-message`, `bake-case`, `rotation-case`, `export`, `scene-test`, `bake-test`, and none for `alpha`, `beta` and `gamma`
    - Source line it should catch: the `validate-message` check removed from the per-type loop (fails T2: six gaps instead of seven)
    - _Requirements: 2.7, 2.8, 2.9, 2.11, 12.4, 12.5, 12.10_

  - [x] 3.4 Add the default checks
    - Change only the two files of task 1.1
    - Script: run `bake-default` and `rotation-default` once, after the per-type checks, with `defaultBranch` and a search for `unknownConstraintType(` in the text it returns. A missing branch and a branch without the call are both gaps. Use the exact `detail` strings of the design. A missing function skips its default check
    - Tests: T3 (last part) removing only the `default` branch of `bakeEntity` gives exactly one `bake-default` gap, the same for `drivesRotation`. T4 a `default` branch that does not call `unknownConstraintType(` gives the gap for each function. With a fourth type `delta` added to the whole fixture, there is still exactly one `bake-default` gap and one `rotation-default` gap, not one per type. A default gap has `type` equal to `''`
    - Source line it should catch: the default check changed to test only for `default`, not for `unknownConstraintType(` (fails T4)
    - _Requirements: 3.1, 3.2, 3.3, 12.5, 12.6_

  - [x] 3.5 Fix the order of the findings and check that inputs are not modified
    - Change only the two files of task 1.1
    - Script: make the result follow Requirement 7.5: per type (and orphan) in union order, unlisted interfaces last, per-type places in `TYPE_PLACES` order; then `bake-default`, `rotation-default`; then the missing anchors in the order union, `checkConstraintOfType`, `bakeEntity`, `drivesRotation`, export block. `findGaps` creates new arrays and strings and writes nothing into `sources`
    - Tests: T10 a deeply frozen `Sources` (freeze the object, the arrays and each `{ name, text }`) gives no throw and equal arrays on two calls. T11 a fixture with gaps in several places, including a default gap and a missing anchor, gives the findings in the hand-written order
    - Source lines it should catch: the missing anchors moved before the default checks (fails T11), and `sources.sceneTests.sort()` added to `findGaps` (fails T10)
    - _Requirements: 5.2, 5.3, 5.4, 7.5, 12.11_

  - [x] 3.6 Checkpoint 3
    - Ask the user to run `node --test scripts/check-constraints.test.mjs` and paste the output. Expect 0 failed
    - Mark tasks 3.1 to 3.5 done only from that output. Tell the user the source lines named in each of them

- [x] 4. Group 4: report text and runChecker
  - [x] 4.1 Add `formatReport` and its tests
    - Change only the two files of task 1.1
    - Script: export `formatReport(sceneText, findings)` as the design describes. `n` counts the types from `findTypes` (orphans excluded) and `k` counts every finding. No findings gives the single OK line with the names in union order. Otherwise the header `constraint-checklist: <k> gaps for <n> constraint types.`, one line per finding (`  - <type>: <place> (<detail>)`, or `  - <place> (<detail>)` when `type` is empty), and the line `Checklist: docs/adding-a-constraint.md`. Plain text, no colour codes
    - Tests: T12 the exact OK line for three fixture types; the exact header, gap lines and `Checklist:` line for a fixture with two gaps (written out by hand); the line form for a default place and for a missing anchor; an orphan prints the interface name where the type would be; a missing anchor counts in `k`; no output contains an escape character (`\u001b`)
    - Source line it should catch: the `Checklist:` line removed, or `gaps for` changed to `gap for` (fails T12)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 4.2 Add `runChecker` and its tests
    - Change only the two files of task 1.1
    - Script: export `runChecker(strict, load)` returning `{ text, code }`. In a `try`: `sources = load()`, `findings = findGaps(sources)`, `text = formatReport(sources.scene, findings)`, `code = strict && findings.length > 0 ? 1 : 0`. In the `catch`: `text` is `constraint-checklist: cannot run (<reason>)` with the first line of the error message (or `String(error)` when there is none), and `code` is 1 with `strict`, otherwise 0. The default `load = readSources` is added in task 5.1
    - Tests: T18 `runChecker(true, () => { throw new Error('boom') })` gives the line `constraint-checklist: cannot run (boom)` and code 1; with `false` the code is 0 and the text is the same. T18b in-process exit codes with a loader that returns fixtures: a complete fixture gives the OK line and code 0 with and without strict; a fixture with a gap gives the gap text, code 0 without strict and code 1 with strict
    - Source lines it should catch: the `catch` branch changed to ignore `strict` (fails T18), and `code` set to 1 when `strict` is false and there are findings (fails T18b)
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 9.1, 9.5, 12.13_

  - [x] 4.3 Checkpoint 4
    - Ask the user to run `node --test scripts/check-constraints.test.mjs` and paste the output. Expect 0 failed
    - Mark tasks 4.1 and 4.2 done only from that output. Tell the user the source lines named in each of them

- [x] 5. Group 5: reading the real files and the command line
  - [x] 5.1 Add `readSources` and the real-repository test
    - Change only the two files of task 1.1
    - Script: export `readSources()`. Compute `root` from `import.meta.url` with `node:url` and `node:path` (`path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')`). Read `scene.ts`, `bake.ts` and `index.ts` from `packages/pathkit/src` and every `.ts` file, sorted by name and not recursive, in `packages/pathkit/test/scene` and `packages/pathkit/test/bake`, as UTF-8 `{ name, text }`. Use only `readFileSync` and `readdirSync`. A file or folder that cannot be read throws. Change `runChecker` to `load = readSources`
    - Tests: T13 `findGaps(readSources())` is `[]`, and `runChecker(false).text` equals `constraint-checklist: 3 constraint types (followPath, aimAt, orbitAround), every place covered.` Put this comment line directly above the test: `// Update these three type names (and the expected count) when a constraint type is added to PathKit.`
    - If T13 reports a gap (it first runs at checkpoint 5.4, because no run is asked before it), do not work around it. Say whether it is a false gap caused by the script (for example a real test in a subfolder) or a real missing place, report the finding text, and ask the user before changing the design
    - Source line it should catch: the `export` check changed to look in `scene` instead of `index` (fails T13)
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 12.12_

  - [x] 5.2 Add the command-line part and the real-program tests
    - Change only the two files of task 1.1
    - Script: add `isMain()` as the design describes (`process.argv[1]` defined and `import.meta.url` equal to `pathToFileURL(path.resolve(process.argv[1])).href`). When it is true, call `runChecker(process.argv.slice(2).includes('--strict'))`, write `text + '\n'` to standard output and set `process.exitCode` to `code`. Do not call `process.exit`. Do not touch `process.stdin`
    - Tests: T14 run `process.execPath` on `scripts/check-constraints.mjs` with `spawnSync`, in the real repository: the OK line is printed and the exit code is 0, with and without `--strict`, from the repository root and with `cwd` set to `os.tmpdir()`. T17 the same run with unreadable text (`\u0000{{not json`) given as standard input: the same OK line, exit code 0. T19 importing the script in the test printed nothing and left `process.exitCode` unchanged (checked by comparing it before and after a dynamic `import()` of the script with a query string, so the module is evaluated again)
    - Source lines it should catch: a path built with `process.cwd()` instead of `import.meta.url` (fails T14), a `process.stdin.read()` added (fails T17), and `isMain()` changed to always return `true` (fails T19)
    - _Requirements: 6.3, 8.1, 8.3, 8.4, 8.6, 12.13_

  - [x] 5.3 Add the temporary-tree tests
    - Change only the test file
    - Test file: add a helper that creates a folder under `os.tmpdir()` with `scripts/check-constraints.mjs` (a copy of the real script) and a fake `packages/pathkit/src/*.ts` and `packages/pathkit/test/{scene,bake}/*.ts` tree written from the fixtures of task 3.1, and removes the folder in an `after` hook. The tests write nothing else
    - Tests: T15 a tree whose fixtures have one gap: the output has the header and the gap line and the `Checklist:` line, exit code 0 without `--strict` and 1 with it. T16 a tree with no `packages` folder: one line that starts with `constraint-checklist: cannot run (`, no line that starts with `at `, exit code 0, and 1 with `--strict`
    - Source lines it should catch: the `try` and `catch` in `runChecker` removed (fails T16), and `runChecker` returning code 1 without `--strict` (fails T15)
    - _Requirements: 8.1, 8.2, 8.5, 12.13_

  - [x] 5.4 Checkpoint 5: the script is complete
    - Ask the user to run `node --test scripts/check-constraints.test.mjs` and paste the whole output. Expect H1 to H5, F1 to F5 and T1 to T19 to pass (T20 comes in task 6.1) with 0 failed and 0 skipped. Report the counts from the pasted output only
    - Ask the user to run `node scripts/check-constraints.mjs --strict` and paste the output. Expect the single OK line and no error
    - Do not start group 6 until both pasted outputs show a pass. If any test fails, fix it under the rules above first. A failure of T13 follows the rule in task 5.1 instead: do not change the script to make it pass. Report the finding text and ask the user
    - Mark tasks 5.1 to 5.3 done only from that output

- [ ] 6. Group 6: the hook
  - [ ] 6.1 Create the hook file and its test
    - Precondition: the pasted output of task 5.4 shows 0 failed and the OK line from `--strict`
    - Create only `.kiro/hooks/constraint-checklist.json` with exactly the definition in `design.md` (version `v1`, name `Constraint checklist`, trigger `PreTaskExec`, matcher `.*`, command action `node scripts/check-constraints.mjs`). Create it with the file-write tool, not with the `createHook` tool. The command has no `--strict`. The file name and the name have no `guard-` prefix
    - Add test T20 to the test file: the hook file parses as JSON and equals the object in the brief, the command does not contain `--strict`, and neither the file name nor the `name` starts with `guard-`. Read the hook with `import.meta.url`-based paths
    - The hook goes live at once and runs before each later task. Tell the user this. If the hook fails or blocks a later task, stop and tell the user
    - Run: `node --test scripts/check-constraints.test.mjs`. Expect H1 to H5, F1 to F5 and T1 to T20 to pass
    - Source line it should catch: `--strict` added to the hook command (fails T20)
    - _Requirements: 9.2, 9.3, 10.1, 10.2, 10.3, 10.4, 12.14_

- [ ] 7. Group 7: the docs line
  - [ ] 7.1 Add one line to `docs/adding-a-constraint.md`
    - Change only `docs/adding-a-constraint.md`. Add one line after `- [ ] Flag file deleted.`, the last item of the section "Checklist for the next constraint", in the same style: ``- [ ] `node scripts/check-constraints.mjs --strict` run before declaring the constraint finished. It prints one line and every place is covered.``
    - Read the file back with `read_file` and confirm that only that line was added. No other line changes. No command to run
    - _Requirements: 11.2_

- [ ] 8. Group 8: check what the hook delivers
  - [ ] 8.1 Hook delivery probe
    - This task exists to find out what the agent that does it receives from the `PreTaskExec` hook. The hook fires before this task starts
    - The agent doing this task creates only the file `.kiro/probe/checklist-received.txt` and writes into it the exact text it received from the hook, copied character for character, with nothing added, nothing removed and no explanation. If it received nothing from the hook, it writes exactly `NOTHING RECEIVED`. It does not run, edit or open the script to produce the text, and it does not write the text from memory of what the script prints
    - After writing the file, tell the user the file exists and stop. Do not delete it
    - _Requirements: 13.1_

  - [ ] 8.2 The user checks the probe file
    - Ask the user to open `.kiro/probe/checklist-received.txt` and compare it with the output of `node scripts/check-constraints.mjs --strict`, run from the repository root. Ask for the file's content and the command's output pasted
    - If the file holds the single OK line, say that this supports delivery of the hook output to the agent that did task 8.1, and nothing more. The OK line is predictable, so a matching file does not rule out a guess. The earlier 22 November marker probe (a made-up string the sub-agent could not have guessed) is the stronger evidence. Say that delivery to the main agent is not shown either way
    - If the file is missing, holds `NOTHING RECEIVED`, or differs from the output, say that delivery is not proven, and do not claim that the agent sees the result
    - Ask the user to delete `.kiro/probe/checklist-received.txt` and the folder `.kiro/probe/` (Kiro has no delete tool here) and to confirm. Wait for the confirmation before going on
    - _Requirements: 13.2, 13.3, 13.4_

- [ ] 9. Group 9: final report
  - [ ] 9.1 Write the final report
    - List every file created and every file edited: `scripts/check-constraints.mjs`, `scripts/check-constraints.test.mjs`, `.kiro/hooks/constraint-checklist.json`, `requirements.md`, `design.md` and `tasks.md` in `.kiro/specs/constraint-checklist/` (and any task-record file Kiro created), and the one edit to `docs/adding-a-constraint.md`. State that `.kiro/probe/` was created and deleted
    - Give the counts of tests passed, failed and skipped from the last pasted output of `node --test scripts/check-constraints.test.mjs`, and the last pasted output of `node scripts/check-constraints.mjs --strict`
    - Say plainly what was not tested: Kiro did not check the file footprint (nothing under `packages/pathkit`, no `package.json`, no `guard-` file changed). The reviewer checks it from the pushed commit. The hook delivery to the main agent is not shown by the probe, which shows only what the agent that did task 8.1 received. The OK line is predictable, so a matching probe file supports delivery to that agent but does not rule out a guess. The earlier 22 November marker probe (a made-up string the sub-agent could not have guessed) is the stronger evidence. If the probe failed, say that delivery is not proven. The two test checks show that a file mentions a type, not that the type is tested well. The script was run on Windows only, and only against the current repository. The checks are text matches and can be fooled by unusual formatting
    - Say which source lines the user broke and confirmed, from the pasted results, and which were not tried
    - _Requirements: 14.1, 14.2, 14.3, 14.4_
