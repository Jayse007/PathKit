# Implementation Plan: setup-scripts

## Overview

Build `scripts/setup.mjs` in four groups, each with its tests in `scripts/setup.test.mjs`, then add the launchers and `.gitattributes` with their tests, run the real setup once, and finish with the README line and the final report. Group 1 writes the small pure functions. Group 2 writes the step descriptions and the two functions around `spawnSync`. Group 3 writes `runSetup`. Group 4 writes the real parts (`runStep`, `createEnv`, the command-line part). Group 5 writes the launchers. Each group ends with a checkpoint where the user runs the whole test file and pastes the output.

The real run `node scripts/setup.mjs` happens once, in group 6, after every test passes. It installs packages with `npm ci` and takes a minute or more. README.md is the only existing file that changes, in group 7, the last group that changes a file.

Nothing under `packages/pathkit` changes. The language is JavaScript (ES modules, `.mjs`) with Node built-in modules only. Tests use `node --test` and `node:assert/strict`. Test ids (T01 to T27) and decision ids (D1 to D19) refer to `design.md`. Test titles start with their id, so the pasted output shows which test ran. "R40" means requirement 40 in `requirements.md` in this folder.

## Execution Rules

These rules apply to every task below.

### Terminal and verification

- Kiro cannot run terminal commands (a project hook blocks them). At a checkpoint task and at task 6.1, give the user the command named in the task on one line, say it runs from the repository root (`c:\Users\JAMES\PathKit\PathKit`), and wait for the pasted output. Between checkpoints, do not ask for a test run. Continue with the next task. Only the checkpoint tasks (1.4, 2.3, 3.3, 4.2 and 5.2) and task 6.1 ask for a run.
- The test command is exactly `node --test scripts/setup.test.mjs`. The one real run is exactly `node scripts/setup.mjs`, in task 6.1 only. Ask for no other command, no extra arguments, no watch mode, never `npx` and never `tsc`. Never ask for `npm.cmd test`: it runs only the Vitest suite under `packages/pathkit` and does not run these tests. Never ask for `.\setup.bat` or `sh setup.sh`: the user may run them, and Kiro reports what was pasted and nothing else.
- Neither the script's tests nor any change to the script may start a real `npm`, install anything or use the network. A test calls `runStep` or `runSetup(createEnv())` never. Only task 6.1 runs the real script.
- The line allowing the two commands is already in `.kiro/steering/windows-terminal.md`. Do not edit that file.
- Do not mark a task done until the pasted output shows the results. Report passed, failed and skipped counts from the pasted output only. If the output is missing or cut off, ask for it again.
- If a write is blocked by a hook, stop and tell the user what was blocked. Never look for another way.

### Scope

- Change only the files a task names. The files this work may create are `scripts/setup.mjs`, `scripts/setup.test.mjs`, `setup.bat`, `setup.sh`, `.gitattributes`, the spec files in `.kiro/specs/setup-scripts/`, and any task-record file Kiro creates by itself in this spec folder. The only existing file that may be edited is `README.md` (task 7.1). Marking checkboxes in this `tasks.md` is allowed.
- Do not create `doctor.mjs`. Do not edit anything under `packages/pathkit`, any `package.json` or `package-lock.json`, `scripts/guard-*`, `.kiro/hooks/guard-*`, or `scripts/check-constraints*`. Name no new file and no hook id with the prefix `guard-`.
- Add no dependency. The script imports only `node:child_process`, `node:fs`, `node:path` and `node:url`. The test file imports only `node:test`, `node:assert/strict`, `node:fs`, `node:path`, `node:url` and `node:child_process` (used for `spawnSync(process.execPath, ...)` in T23 only), plus the script.
- Nothing in this work may call a model at run time, use the network itself, ask for administrator rights, change the execution policy or any system or environment setting, or write outside the repository folder (R13, R14).

### Code style

- Every function in the script and in the test file has one comment line above it saying what it does (R63). The script's header comment says: the script only checks and builds nothing; the steps in order; the minimum Node version comes from the lock file (Vite 7.3.8, `^20.19.0 || >=22.12.0`); captured output is all of standard output followed by all of standard error; on Windows a timed-out step may leave the programs it started running.
- The text `process.stdout` appears nowhere in `scripts/setup.mjs`, not even in a comment (R52, T27). The file never calls `process.exit` (R61). Lines are written only through `writeSync(1, ...)` (task 4.1).
- Paths are built from `import.meta.url` with `node:path`. Never type a slash or backslash in a path the script uses (R62).
- Keep the script short and neat. Do not add features the design does not name.

### Tests

- Execute tasks one at a time, strictly in list order, never in parallel. Say which task is starting. When it is finished, report the result in one or two sentences.
- Write every expected result by hand. Build every fake as a small object. Never take an expected answer from the output of the script. Use the fake root `'ROOT'` and the fake `execPath` `'NODE_EXE'` of the design.
- The test file writes no file and runs no `npm`. Only T23 starts a process, and it starts `process.execPath` (Node) only.
- Every `runSetup` test calls the same small helper that fails when any written line contains the escape character `\u001b`, so T20 covers T12 to T19 as well.
- When a test is finished, tell the user which source line, if broken, it should catch (each task names that line, from the table in section 6 of `design.md`), so the user can break it once and confirm the test fails, then restore it. No change may make importing the script or running a test start a real `npm`; the user breaks one change at a time and runs only `node --test scripts/setup.test.mjs`.
- If a test fails, state first whether the script or the test is wrong, then fix that one. Make at most 3 fix attempts, then stop and report the failing test name and its output. Never weaken a test to make it pass.
- If T24 reports a carriage return in `setup.sh`, that is a real defect in `setup.sh` (R82). Say so, fix the file, and never change the test to allow it.
- A test file that takes more than 5 seconds on the user's machine is a defect. Report it and find the cause before moving on.

## Tasks

- [x] 1. Group 1: small pure functions
  - [x] 1.1 Create the files with `checkNodeVersion` and `npmCommand`
    - Create `scripts/setup.mjs` and `scripts/setup.test.mjs`
    - Script: the header comment (see Code style), then export `checkNodeVersion(version)` and `npmCommand(platform)` as the design describes. `checkNodeVersion` returns `{ level, message }` and never throws: a value that is not a string or does not match `/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/` is `fail`; below 20.19.0, any 21.x and 22.x below 22.12.0 are `fail`; major 24 is `ok`; everything else is `warn`; the messages are the ones in the design. `npmCommand('win32')` is `{ command: 'npm.cmd', shell: true }`, any other platform `{ command: 'npm', shell: false }`
    - Test file: a header comment with the run command, imports of `node:test` and `node:assert/strict` and the script
    - Tests: T01 the twelve rows of R67 (18.20.0 fail; 20.18.0 fail; 20.19.0 warn; 21.7.0 fail; 22.11.0 fail; 22.12.0 warn; 23.0.0 warn; 24.0.0 ok; 24.11.1 ok; 25.1.0 warn; `''` fail; `'abc'` fail). T02 `undefined`, `null`, `24`, `{}`, `'24.0'` and `'v24.0.0'` give `fail` with a non-empty message and do not throw. T03 `win32`, `linux` and `darwin`
    - Source lines it should catch: `minor < 12` in the 22.x rule changed to `minor < 11` (fails T01); the `^` removed from the version pattern (fails T02); the compared platform `'win32'` changed to `'linux'` in `npmCommand` (fails T03)
    - _Requirements: 18, 19, 20, 21, 22, 34, 35, 63, 64, 67, 68_

  - [x] 1.2 Add `stripEscapes`, `lastLines` and `combineOutput`
    - Change only the two files of task 1.1
    - Script: export the three pure functions as the design describes. `stripEscapes` applies, in order, the OSC, CSI and two-character replacements and then removes any remaining `\u001b`. `lastLines(text, count)` splits on `/\r?\n/`, drops one final empty element, keeps the last `count` and joins with `\n`. `combineOutput(stdout, stderr)` turns `null` and `undefined` into `''` and returns stdout text followed by stderr text. Add the constant `MAX_OUTPUT_LINES = 30`
    - Tests: T04 a colour sequence, a cursor sequence, an OSC title sequence and a lone escape character are removed, text without escapes comes back identical. T05 40 lines with count 30 give lines 11 to 40, 3 lines give all 3, a final newline adds no empty line, `\r\n` splits, `''` gives `''`. T06 `combineOutput('a\n', 'b\n')` is `'a\nb\n'`, `null` and `undefined` count as `''`, a `Buffer` is converted
    - Source lines it should catch: the last replacement (remaining `\u001b`) deleted from `stripEscapes` (fails T04); `slice(-count)` changed to `slice(-count + 1)` in `lastLines` (fails T05); `combineOutput` returning stderr text first (fails T06)
    - _Requirements: 38, 41, 40, 63, 64_

  - [x] 1.3 Add `formatVerdict` and `describeLimit`
    - Change only the two files of task 1.1
    - Script: export `formatVerdict(failed, skipped)` (no failure gives `setup: all 6 steps passed.`; otherwise `setup: <failed> of 6 steps failed.` plus ` <skipped> skipped.` when `skipped > 0`) and `describeLimit(ms)` (`ms >= 120000` and a whole number of minutes gives `<n> minutes`, otherwise `<n> seconds`). Add the constant `TOTAL_STEPS = 6` and use it in the text
    - Tests: T11 `formatVerdict(0, 0)`, `(0, 3)`, `(2, 0)`, `(2, 1)` and `(1, 5)` give the exact lines written by hand; `describeLimit(60000)` is `60 seconds` and `describeLimit(300000)` is `5 minutes`
    - Source line it should catch: the `skipped > 0` condition removed from `formatVerdict` (fails T11)
    - _Requirements: 45, 53, 54, 55, 63, 64_

  - [x] 1.4 Checkpoint 1
    - Run: `node --test scripts/setup.test.mjs`. Expect T01 to T06 and T11 to pass with 0 failed
    - Mark tasks 1.1 to 1.3 done only from that output. Tell the user the source lines named in 1.1, 1.2 and 1.3, so they can break each once

- [x] 2. Group 2: step descriptions and the spawn helpers
  - [x] 2.1 Add `buildSteps` and `skipReason`
    - Change only the two files of task 1.1
    - Script: add the constants `MINUTE`, `LIMIT_LONG_MS` (5 minutes) and `LIMIT_SHORT_MS` (60 seconds) and the import of `node:path`. Export `buildSteps({ platform, root, execPath })` returning the five step descriptions of the design (steps 2 to 6) with `id`, `label`, `command`, `args`, `cwd`, `shell` and `timeoutMs`. For steps 2 to 4 with `npmCommand(platform).shell` true, `command` is the one string (`'npm.cmd --version'`, `'npm.cmd ci'`, `'npm.cmd test'`) and `args` is `[]`; otherwise `command` is `'npm'` and `args` holds the arguments. Steps 5 and 6 use `execPath`, `shell: false` and arguments built with `path.join('scripts', ...)`; `cwd` is built with `path.join`. Export `skipReason(id, levels)` with the three rules and texts of the design
    - Tests: T09 `buildSteps` for `win32` and for `linux` with root `'ROOT'` and execPath `'NODE_EXE'`: the exact objects of steps 2 to 6, in order, written by hand with `path.join` for the paths. T10 `skipReason` for each pair of id and earlier levels: step 1 failed gives a reason for 2 to 6; step 2 failed gives a reason for 3 to 6 and `null` for 2; step 3 failed gives a reason for 4 and `null` for 5 and 6; step 4 failed gives `null` for 5 and 6; step 5 failed gives `null` for 6; `warn` and `skip` levels never skip
    - Source lines it should catch: the entries of steps 5 and 6 swapped in `buildSteps` (fails T09); the step 3 rule of `skipReason` changed from `id === 4` to `id >= 4` (fails T10)
    - _Requirements: 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 36, 44, 62, 63, 64_

  - [x] 2.2 Add `spawnOptions` and `resultFromSpawn`
    - Change only the two files of task 1.1
    - Script: add the constant `MAX_BUFFER = 64 * 1024 * 1024`. Export `spawnOptions(step, baseEnv)` returning `{ cwd, shell, timeout, maxBuffer, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, env }` with `env` a new object that is `baseEnv` plus `NO_COLOR: '1'`. Export `resultFromSpawn(spawned)` returning `{ status, detail, output }` in the order of the design: `ETIMEDOUT` is `timeout`, `ENOBUFS` is `too-large`, any other error is `failed` with `could not start: <code or message>`, status `null` is `failed` with `ended by signal <signal>`, a non-zero status is `failed` with `exit code <status>`, otherwise `ok`; `output` is `combineOutput(stdout, stderr)`
    - Tests: T08 for a step with `shell: false` and for a step with `shell: true` (`command: 'npm.cmd ci'`, `args: []`): the `stdio` array, `maxBuffer` 67108864, `timeout`, `shell` and `cwd` from the step, `env` equal to the base environment plus `NO_COLOR: '1'`, and the base environment object unchanged. T07 hand-made `spawnSync` result objects for status 0, status 1, `ETIMEDOUT`, `ENOBUFS`, `ENOENT` and a signal, with the status, the detail and the output (stdout then stderr) written by hand
    - Source lines it should catch: `'ignore'` changed to `'pipe'` as the first `stdio` entry (fails T08); the `ETIMEDOUT` branch returning `status: 'failed'` (fails T07)
    - _Requirements: 36, 37, 38, 42, 43, 44, 45, 46, 47, 60, 63, 64_

  - [x] 2.3 Checkpoint 2
    - Run: `node --test scripts/setup.test.mjs`. Expect T01 to T11 to pass with 0 failed
    - Mark tasks 2.1 and 2.2 done only from that output. Tell the user the source lines named in 2.1 and 2.2

- [x] 3. Group 3: runSetup
  - [x] 3.1 Add `runSetup` with the step lines, skips and verdict
    - Change only the two files of task 1.1
    - Test file first: add the helpers `makeEnv(overrides)` (`platform: 'linux'`, `nodeVersion: '24.0.0'`, `root: 'ROOT'`, `execPath: 'NODE_EXE'`, a fake `run` and a `write` that pushes to an array), `makeRun(table)` (records each step in `calls`, answers `table[step.id]` or an `ok` result with empty output), `stepLines(lines)` (lines starting with `PASS`, `WARN`, `FAIL` or `SKIP`, nothing else) and `assertNoEscape(lines)` (fails when a line contains `\u001b`)
    - Script: export `runSetup(env)` and the helper `failText(result, step)`. Follow the design: write `Step 1/6: Node version ...`, run `checkNodeVersion(env.nodeVersion)`, then for steps 2 to 6 ask `skipReason`, print a `SKIP <id>/6 <label>: <reason>` line or write the "before" line, call `env.run(step)` and print `PASS` or `FAIL` with `failText` (`detail`, `timed out after <describeLimit>` or `output was too large (over 64 MiB)`). A private `record` function stores the level, counts failed and skipped steps and writes the step line. End with the verdict line and return 0 when nothing failed, otherwise 1. `runSetup` does not set `process.exitCode`. It prints no path, user name or machine name. Captured output is printed in task 3.2, not here
    - Tests: T12 everything passes: `calls` is the five steps in order with the hand-written commands and folders, six step lines with ids 1 to 6 in order starting with `PASS`, one "before" line per step that does not start with the four words, last line `setup: all 6 steps passed.`, return value 0, no line contains `ROOT`. T13 `nodeVersion: '23.0.0'`: the first step line starts with `WARN`, the verdict is `setup: all 6 steps passed.`, the return value is 0. T14 `nodeVersion: '18.20.0'`: `calls` is empty, step line 1 is `FAIL`, steps 2 to 6 are `SKIP` with a reason, verdict `setup: 1 of 6 steps failed. 5 skipped.`, return value 1. T15 step 2 answers `failed`: `calls` has only step 2, steps 3 to 6 are `SKIP`, verdict `setup: 1 of 6 steps failed. 4 skipped.`, return value 1. T16 step 3 answers `failed`: step 4 is `SKIP` and its line contains `install`, steps 5 and 6 are in `calls` and `PASS`, verdict `setup: 1 of 6 steps failed. 1 skipped.`, return value 1. T18 step 4 answers `timeout`: the `FAIL` line contains `timed out after 5 minutes` and not `exit code`; step 5 answers `timeout` and its line contains `60 seconds`. T19 step 4 answers `too-large`: the `FAIL` line contains `output was too large`. Every test here calls `assertNoEscape`
    - Source lines it should catch: the `write` of the "before" line deleted (fails T12); `warn` counted as a failure in `record` (fails T13); the step 1 rule deleted from `skipReason` (fails T14); the step 2 rule deleted from `skipReason` (fails T15); a skipped step handled without calling `record`, so no `SKIP` line (fails T16); `failText` returning `result.detail` for `timeout` (fails T18); the `too-large` text changed to `exit code 1` in `failText` (fails T19)
    - _Requirements: 16, 17, 23, 25, 27, 31, 32, 45, 46, 48, 49, 50, 53, 54, 55, 56, 57, 58, 59, 63, 64, 65, 69, 70, 71, 73_

  - [x] 3.2 Print the captured output of a failed step
    - Change only the two files of task 1.1
    - Script: add the constant `OUTPUT_INDENT` (four spaces). After the `FAIL` line, when the result's output is not empty, write `OUTPUT_INDENT + line` for each of the last `MAX_OUTPUT_LINES` lines of `stripEscapes(result.output)`. This applies to `failed`, `timeout` and `too-large`
    - Tests: T17 for step 4, then step 5, then step 6 answering `failed` with 40 output lines `out 1` to `out 40`, where line 20 is `FAIL in suite` instead: the later steps still run; the lines written after the `FAIL` step line are exactly `    out 11` to `    out 40` with four spaces in front (line 20 is `    FAIL in suite`); no written line contains `out 10`; `stepLines` finds exactly six lines; the return value is 1. T20 a failing step whose output has a colour sequence, a cursor sequence, an OSC title sequence and a lone escape character: no written line contains `\u001b`, and the text between the sequences is written with its four-space indent. T21 the calls for steps 5 and 6 have `command` `'NODE_EXE'` and `shell` false, also with `platform: 'win32'`; with `platform: 'win32'` the calls for steps 2 to 4 have a one-string `command` and `args: []`
    - Source lines it should catch: `line` written instead of `OUTPUT_INDENT + line`, or the whole output written instead of `lastLines(..., 30)` (fails T17); the call to `stripEscapes` around the output removed (fails T20); `'node'` used instead of `execPath` for step 5 in `buildSteps` (fails T21 and T09)
    - _Requirements: 32, 33, 36, 37, 38, 40, 41, 51, 65, 72, 74_

  - [x] 3.3 Checkpoint 3
    - Run: `node --test scripts/setup.test.mjs`. Expect T01 to T21 to pass with 0 failed
    - Mark tasks 3.1 and 3.2 done only from that output. Tell the user the source lines named in 3.1 and 3.2

- [x] 4. Group 4: the real parts
  - [x] 4.1 Add `runStep`, `createEnv` and the command-line part
    - Change only the two files of task 1.1
    - Script: add the imports of `spawnSync`, `writeSync`, `realpathSync`, `fileURLToPath` and `pathToFileURL`. Add `const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')`. Export `runStep(step)`: `resultFromSpawn(spawnSync(step.command, step.args, spawnOptions(step, process.env)))` inside a `try`, with a `catch` that returns `{ status: 'failed', detail: 'could not start: <message>', output: '' }`. Export `createEnv()` returning `platform: process.platform`, `nodeVersion: process.versions.node`, `root: ROOT`, `execPath: process.execPath`, `run: runStep` and `write: (line) => { try { writeSync(1, line + '\n'); } catch { /* ... */ } }`. Add `isMain()` exactly as in `scripts/check-constraints.mjs` and, below it, `if (isMain()) { process.exitCode = runSetup(createEnv()); }`. No `process.exit`, no `process.stdout`, anywhere in the file, comments included
    - Tests: T22 `createEnv()` has `platform === process.platform`, `nodeVersion === process.versions.node`, `execPath === process.execPath`, `root` equal to the parent folder of the test file's folder (computed in the test with `fileURLToPath` and `path`), and function values for `run` and `write`; the test does not call them. T23 `spawnSync(process.execPath, ['--input-type=module', '-e', code])` where `code` imports `scripts/setup.mjs` by its `pathToFileURL` and then writes `String(process.exitCode)`: stdout is exactly `undefined` and stderr is empty. T27 the test reads `scripts/setup.mjs` (path from `import.meta.url`): the text contains `writeSync(1` and does not contain `process.stdout`
    - No test calls `runStep` or the function returned as `run`
    - Source lines it should catch: `process.execPath` changed to `'node'` in `createEnv` (fails T22); a top-level `process.stdout.write('loaded\n')` added (fails T23 and T27); `writeSync(1, line + '\n')` replaced by `process.stdout.write(line + '\n')` in `createEnv` (fails T27). None of these starts `npm`
    - _Requirements: 33, 52, 59, 60, 61, 62, 63, 75, 76_

  - [x] 4.2 Checkpoint 4
    - Run: `node --test scripts/setup.test.mjs`. Expect T01 to T23 and T27 to pass with 0 failed
    - Mark task 4.1 done only from that output. Tell the user the source lines named in 4.1

- [x] 5. Group 5: launchers and `.gitattributes`
  - [x] 5.1 Create `setup.sh`, `setup.bat` and `.gitattributes`
    - Create only these three files in the repository root, and change only the test file otherwise. Write `setup.sh` with LF line endings and no carriage return anywhere
    - `setup.sh`: the five lines of the design (`#!/bin/sh`, `cd "$(dirname "$0")" || exit 1`, the `command -v node` check with a plain message and `exit 1`, `node scripts/setup.mjs`, `exit $?`). `setup.bat`: the five lines of the design (`@echo off`, `cd /d "%~dp0"`, `where node >nul 2>nul`, the one-line `if errorlevel 1 echo ...& exit /b 1`, `node scripts\setup.mjs`, `exit /b %errorlevel%`). It has no `goto`, no label line and no `(` character. `.gitattributes`: exactly the two lines `setup.sh text eol=lf` and `setup.bat text eol=crlf`. The launchers contain nothing else: no download, no administrator request, no setting change
    - Tests: T24 `setup.sh` starts with `#!/bin/sh`, contains no `\r`, and contains `command -v node` and `scripts/setup.mjs`. T25 `setup.bat` contains `where node` and `scripts\setup.mjs`; the text is split with `/\r?\n/` and no line, after optional leading spaces, starts with `:`; it contains no `goto` (any case) and no `(`. T26 the non-empty trimmed lines of `.gitattributes` are exactly `['setup.sh text eol=lf', 'setup.bat text eol=crlf']`. All three read the files with paths built from `import.meta.url`
    - If T24 fails because of a carriage return, report it as a defect in `setup.sh`, fix the file and never weaken the test (R82)
    - Source lines it should catch: the `command -v node` line deleted from `setup.sh` (fails T24); a line `:done` added to `setup.bat` (fails T25); a third rule added to `.gitattributes` (fails T26)
    - _Requirements: 2, 3, 7, 14, 64, 77, 82_

  - [x] 5.2 Checkpoint 5: all tests
    - Run: `node --test scripts/setup.test.mjs`. Expect T01 to T27 all to be present and passing, with 0 failed and 0 skipped. A test id may be split into several tests, so the total count can be higher than 27. Report the counts exactly as pasted
    - Do not start group 6 until the pasted output shows a pass. Mark tasks 5.1 done only from that output. Tell the user the source lines named in 5.1

- [x] 6. Group 6: the real run
  - [x] 6.1 Run the real setup once
    - Precondition: the pasted output of task 5.2 shows 27 passed and 0 failed
    - Run: `node scripts/setup.mjs`. Tell the user it installs the PathKit packages with `npm ci`, runs every check, and takes a minute or more, and that nothing is printed while a step runs except the "before" line. Ask for the whole output pasted
    - Report only what the pasted output shows: the six step lines, the verdict line and which warnings or failures there are. Do not call the run good unless the verdict is `setup: all 6 steps passed.`
    - If a step fails, say whether the script or the machine is the cause, using the printed captured output. A cause in the script follows the test rules above (at most 3 fix attempts, then stop). A cause in the machine (for example a missing `npm`) is reported and not worked around
    - _Requirements: 15, 53, 56, 80, 81, 84_

- [x] 7. Group 7: README and final report
  - [x] 7.1 Add the Quick start to `README.md`
    - Change only `README.md`, in the section "## Run the tests" only. Directly under that heading, before the line "Tested with Node.js 24.", add a heading `### Quick start`, these two bullets, and one sentence, with a blank line between each part:
      - Bullet 1, as it appears in the README: - Windows, in PowerShell: `.\setup.bat`
      - Bullet 2: - macOS and Linux: `sh setup.sh`
      - Sentence: It installs the PathKit packages with `npm ci`, runs every check and prints PASS or FAIL for each step. It builds nothing.
    - Read the file back with `read_file` and confirm that only those lines were added and no other line changed. No command to run
    - _Requirements: 9_

  - [x] 7.2 Write the final report
    - List every file created and every file edited: `scripts/setup.mjs`, `scripts/setup.test.mjs`, `setup.bat`, `setup.sh`, `.gitattributes`, the spec files in `.kiro/specs/setup-scripts/` (`brief.md`, `requirements.md`, `design.md`, `tasks.md`, and any task-record file Kiro created), and the one edit to `README.md`. State that `doctor.mjs` was not created
    - Give the counts of tests passed, failed and skipped from the last pasted output of `node --test scripts/setup.test.mjs`, and the last pasted output of `node scripts/setup.mjs` (the six step lines and the verdict)
    - Say plainly what was not tested: the real run of `node scripts/setup.mjs` was done once by the user, on one machine, with one Node version; `setup.bat` on Windows is run by the user; `setup.sh` and the "Node missing" messages are run by the reviewer on Linux; no other operating system and no other Node version was tried, so the checks do not prove the project works on every machine; on Windows a timed-out step may leave the programs it started running, and this was not tested; the lost-line case of `writeSync` (D18), a `spawnSync` that throws (D13) and the 64 MiB limit with a real process were not tested; Kiro did not check the file footprint (nothing under `packages/pathkit`, no `package.json`, no `package-lock.json`, no `guard-` file changed): the reviewer checks it from the pushed commit
    - Say which source lines the user broke and confirmed, from the pasted results, and which were not tried
    - _Requirements: 83, 84_
