# Design: check-only setup scripts

Requirements are numbered in `requirements.md`; "R40" means requirement 40. This file is written in sections:
1 Overview, 2 Data and pure functions, 3 `runSetup` and the real runner, 4 Launchers, 5 Tests, 6 Source-line
table, 7 Decisions on the open points.

## 1. Overview

Files created (R8): `scripts/setup.mjs`, `scripts/setup.test.mjs`, `setup.bat`, `setup.sh`, `.gitattributes`.
`README.md` is edited in the last task only (R9).

Flow of a run:

```
launcher (cd to own folder, check node) -> node scripts/setup.mjs
  -> isMain() -> runSetup(createEnv()) -> six steps -> step lines + verdict line -> process.exitCode
```

`scripts/setup.mjs` has three layers, so tests never need a real process except T23:

1. Pure functions (decisions and text): no clock, no I/O, no mutation of arguments.
2. `runSetup(env)`: the order of the steps, the skip rules and the output lines. It reaches the outside world
   only through `env.run` and `env.write`.
3. The real parts: `runStep(step)` (calls `spawnSync`), `createEnv()` and the `isMain()` block.

Only Node built-in modules are imported: `node:child_process` (`spawnSync`), `node:fs` (`realpathSync`, `writeSync`),
`node:path`, `node:url` (`fileURLToPath`, `pathToFileURL`). The file never uses `process.stdout`, not even in a
comment (R52, T27), and never calls `process.exit` (R61).

## 2. Data and pure functions

Every function has one comment line above it (R63). Paths use `import.meta.url` and `node:path` only (R62).

### Constants

```js
export const TOTAL_STEPS = 6;
export const MAX_OUTPUT_LINES = 30;               // R40
export const OUTPUT_INDENT = '    ';              // four spaces before each captured line (R40)
export const MAX_BUFFER = 64 * 1024 * 1024;       // R46, 64 MiB per stream
export const MINUTE = 60 * 1000;
export const LIMIT_LONG_MS = 5 * MINUTE;          // steps 3 and 4 (R44)
export const LIMIT_SHORT_MS = 60 * 1000;          // steps 2, 5 and 6 (R44)
```

### Step description (`step`)

A plain object built by `buildSteps`. Step 1 has no process, so it is not in this list. When `shell` is true the
command and its arguments are one string and `args` is empty (R36).

```js
// Windows (shell true)
{ id: 3, label: 'Install (npm ci)', command: 'npm.cmd ci', args: [], cwd: '<root>/packages/pathkit',
  shell: true, timeoutMs: 300000 }
// Linux and macOS (shell false)
{ id: 3, label: 'Install (npm ci)', command: 'npm', args: ['ci'], cwd: '<root>/packages/pathkit',
  shell: false, timeoutMs: 300000 }
```

### Run result (`result`), returned by every runner

```js
{ status: 'ok' | 'failed' | 'timeout' | 'too-large', detail: 'exit code 1', output: '<combined text>' }
```

`detail` is a short reason for the step line (`exit code 1`, `ended by signal SIGTERM`, `could not start: ENOENT`).
It is empty for `ok`, `timeout` and `too-large`. `output` is always a string (empty when nothing was captured).

### Pure functions

| Function | Input | Output | Requirements |
| --- | --- | --- | --- |
| `checkNodeVersion(version)` | any value | `{ level, message }`, never throws | R18 to R22 |
| `npmCommand(platform)` | platform string | `{ command, shell }` | R34 |
| `buildSteps({ platform, root, execPath })` | strings | array of five step descriptions (steps 2 to 6) | R24, R26, R28 to R30, R33, R35, R36, R44 |
| `skipReason(id, levels)` | step id, map of earlier levels | reason string or `null` | R23, R25, R27, R31, R32, R48 |
| `stripEscapes(text)` | string | string without escape sequences | R41 |
| `lastLines(text, count)` | string, number | the last `count` lines joined with `\n` | R40 |
| `combineOutput(stdout, stderr)` | string, Buffer, `null` or `undefined` each | stdout text followed by stderr text | R38 |
| `spawnOptions(step, baseEnv)` | step description, environment object | options object for `spawnSync` | R42, R43, R44, R46, R60 |
| `resultFromSpawn(spawned)` | the object `spawnSync` returns | run result | R38, R45, R46 |
| `formatVerdict(failed, skipped)` | two integers | verdict line | R53 to R55 |
| `describeLimit(ms)` | milliseconds | `'5 minutes'` or `'60 seconds'` | R45 |

#### `checkNodeVersion(version)`

1. If `version` is not a string or does not match `/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/`, return
   `{ level: 'fail', message: 'cannot read the Node version "<text>"' }` (R22). The text is `String(version)`, cut to 40 characters.
2. Let `major`, `minor` be the parsed numbers. It fails when `major < 20`, or `major === 20 && minor < 19`, or `major === 21`,
   or `major === 22 && minor < 12` (R19). The message names the minimum: `Node <v> is too old. PathKit needs 20.19.0 or later, or 22.12.0 or later.` (21.x uses the same text.)
3. Otherwise `major === 24` gives `ok` (`Node <v>`) and everything else gives `warn`
   (`Node <v> should work, but PathKit is tested with Node 24.`) (R20, R21).

The table in R67 is the specification. 20.19.0 is `warn` because 20 is not 24.

#### `npmCommand(platform)`

`platform === 'win32'` gives `{ command: 'npm.cmd', shell: true }`, anything else `{ command: 'npm', shell: false }` (R34).
`shell: true` is safe because every argument is a constant (R35).

#### `buildSteps({ platform, root, execPath })`

Returns the descriptions of steps 2 to 6 in order. `pathkit` is `path.join(root, 'packages', 'pathkit')`.
`n` is `npmCommand(platform)`. For steps 2 to 4 the description is made from a fixed argument list `A`:

- when `n.shell` is true: `command` is `[n.command, ...A].join(' ')` and `args` is `[]` (R36);
- otherwise: `command` is `n.command` and `args` is `A`.

| id | label | `A` or command | cwd | shell | timeoutMs |
| --- | --- | --- | --- | --- | --- |
| 2 | `npm` | `A = ['--version']` | `root` | `n.shell` | 60000 |
| 3 | `Install (npm ci)` | `A = ['ci']` | `pathkit` | `n.shell` | 300000 |
| 4 | `PathKit tests` | `A = ['test']` | `pathkit` | `n.shell` | 300000 |
| 5 | `Checklist tests` | `command: execPath`, `args: ['--test', path.join('scripts', 'check-constraints.test.mjs')]` | `root` | `false` | 60000 |
| 6 | `Constraint checklist` | `command: execPath`, `args: [path.join('scripts', 'check-constraints.mjs'), '--strict']` | `root` | `false` | 60000 |

Examples: on `win32`, step 2 is `{ command: 'npm.cmd --version', args: [], shell: true }`; on `linux`, it is
`{ command: 'npm', args: ['--version'], shell: false }`. The two script paths in steps 5 and 6 are relative to `cwd`
and are joined with `node:path`, so no typed slash appears (R62). On Windows they come out with a backslash, which
`node` accepts. Steps 5 and 6 never use a shell, so a `node` path with spaces is safe.

#### `skipReason(id, levels)`

`levels` maps a step id to `'ok'`, `'warn'`, `'fail'` or `'skip'` for the steps already finished. Returns:

- id 2 to 6 and `levels[1] === 'fail'`: `'not run because step 1 (Node version) failed'`
- id 3 to 6 and `levels[2] === 'fail'`: `'not run because step 2 (npm) failed'`
- id 4 and `levels[3] === 'fail'`: `'not run because step 3 (install) failed'`
- otherwise `null`.

Steps 5 and 6 are not skipped by step 3 or step 4 (R31, R32). A skipped step has level `'skip'`, which is none of the `'fail'` tests above.

#### `stripEscapes(text)`

Applies these replacements to `text`, in this order, each with a global flag and an empty replacement:

1. OSC sequences: `\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)`
2. CSI sequences: `\u001b\[[0-?]*[ -/]*[@-~]`
3. Two-character escapes: `\u001b[@-Z\\-_]`
4. Any remaining `\u001b`.

Step 4 guarantees that no escape character is left (R41, R74). Nothing else changes (no trimming, `\r` is kept).

#### `lastLines(text, count)`

Splits on `/\r?\n/`, drops one final empty element (the text ended with a newline), keeps the last `count` elements and
joins them with `\n`. Fewer than `count` lines gives all of them. Empty text gives `''`.

#### `combineOutput(stdout, stderr)`

Converts each value with `value == null ? '' : String(value)` and returns `stdoutText + stderrText` (R38). The two streams are
separate pipes, so the real order of interleaved lines cannot be recovered; the text is the whole of standard output, then the whole of standard error.

#### `spawnOptions(step, baseEnv)`

```js
{ cwd: step.cwd, shell: step.shell, timeout: step.timeoutMs, maxBuffer: MAX_BUFFER, encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, env: { ...baseEnv, NO_COLOR: '1' } }
```

`stdio[0] === 'ignore'` closes standard input (R42). `env` is a copy of `baseEnv` plus `NO_COLOR` (R43); `baseEnv` is not mutated.
`maxBuffer` limits each of the two streams to 64 MiB, which is how `spawnSync` counts it.

#### `resultFromSpawn(spawned)`

`output` is `combineOutput(spawned.stdout, spawned.stderr)`. The status is chosen in this order:

1. `spawned.error?.code === 'ETIMEDOUT'` gives `timeout` (R45).
2. `spawned.error?.code === 'ENOBUFS'` gives `too-large` (R46).
3. Any other `spawned.error` gives `failed` with detail `could not start: <code or message>`. This is how a missing `npm` shows up (`ENOENT`).
4. `spawned.status === null` gives `failed` with detail `ended by signal <signal>`.
5. `spawned.status !== 0` gives `failed` with detail `exit code <status>`.
6. Otherwise `ok`.

#### `formatVerdict(failed, skipped)`

- `failed === 0`: `setup: all 6 steps passed.` (R53; skips and warnings do not change it)
- otherwise `setup: <failed> of 6 steps failed.`, plus ` <skipped> skipped.` when `skipped > 0` (R54, R55).

#### `describeLimit(ms)`

`ms >= 120000 && ms % 60000 === 0` gives `<ms / 60000> minutes`, otherwise `<ms / 1000> seconds`. So 300000 gives `5 minutes` and 60000 gives `60 seconds`.

## 3. `runSetup` and the real runner

### Environment

```js
env = { platform, nodeVersion, root, execPath, run, write }
```

R59 names `platform`, `nodeVersion`, `run` and `write`. `root` and `execPath` are added so that the folders and the
`node` path in the commands are inputs too, and a test can give fake values (see D1).

### Lines the script writes

| Line | Format | Example |
| --- | --- | --- |
| Before a step (R16, R17) | `Step <id>/6: <label> ...` | `Step 3/6: Install (npm ci) ...` |
| Pass | `PASS <id>/6 <label>: <text>` | `PASS 4/6 PathKit tests: passed` |
| Warn | `WARN <id>/6 <label>: <text>` | `WARN 1/6 Node version: Node 23.0.0 should work, but PathKit is tested with Node 24.` |
| Fail | `FAIL <id>/6 <label>: <text>` | `FAIL 4/6 PathKit tests: exit code 1` |
| Skip (R48) | `SKIP <id>/6 <label>: <reason>` | `SKIP 4/6 PathKit tests: not run because step 3 (install) failed` |
| Captured output (R40) | `    <line>` (four spaces, then the line) | `    Test Files  1 failed (1)` |
| Verdict | `formatVerdict` | `setup: 1 of 6 steps failed. 1 skipped.` |

The text of a pass is `passed` for steps 2 to 6 and the `checkNodeVersion` message for step 1. The text of a fail is
`detail` for `failed`, `timed out after <describeLimit(step.timeoutMs)>` for `timeout` and
`output was too large (over 64 MiB)` for `too-large`. A skipped step prints no "before" line, because it does not start.
No line the script writes itself contains a path, the user name or the machine name (R58). After a `FAIL` line the captured
output follows (R40): the last 30 lines of the combined text after `stripEscapes` (R41), one `write` call per line, each
with `OUTPUT_INDENT` in front. An empty line of output becomes four spaces.

### `runSetup(env)` in order

```
steps  = buildSteps(env)
levels = {}; failed = 0; skipped = 0
step 1: write "Step 1/6: Node version ..."
        r = checkNodeVersion(env.nodeVersion)
        record(1, r.level, 'Node version', r.message)
for step of steps (ids 2 to 6):
    reason = skipReason(step.id, levels)
    if reason !== null: record(step.id, 'skip', step.label, reason); continue
    write "Step <id>/6: <label> ..."
    result = env.run(step)
    if result.status === 'ok': record(step.id, 'ok', step.label, 'passed')
    else: record(step.id, 'fail', step.label, failText(result, step))
          if result.output !== '':
              for line of lastLines(stripEscapes(result.output), MAX_OUTPUT_LINES).split('\n'):
                  write(OUTPUT_INDENT + line)
write(formatVerdict(failed, skipped))
return failed === 0 ? 0 : 1
```

`record(id, level, label, text)` stores `levels[id] = level`, adds to `failed` when the level is `fail` and to
`skipped` when it is `skip`, and writes the step line. `runSetup` returns the exit code (R56, R57); it does not set
`process.exitCode` itself, so a test can call it freely.

How the requirements are met:

- R23, R25, R27, R31, R32: only `skipReason` decides what is skipped. A failed step 4, 5 or 6 sets no skip rule for the later steps.
- R49: `skip` does not add to `failed`.
- R50: every step id from 1 to 6 reaches `record` exactly once, in order, so there are six step lines.
- R53 and R56: a `warn` is not `fail`, so the verdict is `all 6 steps passed.` and the code is 0.
- R65: every captured line starts with four spaces, so it can never start with `PASS`, `WARN`, `FAIL` or `SKIP`.

### The real runner

```js
// Runs one step with spawnSync and turns the outcome into a run result. Never throws.
export function runStep(step) {
  try { return resultFromSpawn(spawnSync(step.command, step.args, spawnOptions(step, process.env))); }
  catch (error) { return { status: 'failed', detail: `could not start: ${error.message}`, output: '' }; }
}
```

- Time limit, input closed, `NO_COLOR`, buffer size: all in `spawnOptions` (R42 to R44, R46, R60). Nothing can wait for input or run past its limit.
- With `shell: true` the step has `args: []`, so `spawnSync` gets no argument list together with a shell (R36).
- `spawnSync` blocks until the child ends, so the lines "before a step" appear before the slow step starts, and the
  step line appears after it. Nothing is printed while the child runs.
- On timeout `spawnSync` kills the child with `SIGTERM`. With `shell: true` on Windows the child is `cmd.exe`, and programs
  it started may keep running. This is reported as not tested (R84); no extra logic is added to kill them.

### `createEnv()` and the command-line part

```js
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');   // R62

// The real environment: this machine's values and the real runner. Starts nothing.
export function createEnv() {
  return {
    platform: process.platform, nodeVersion: process.versions.node, root: ROOT, execPath: process.execPath,
    run: runStep,
    write: (line) => { try { writeSync(1, line + '\n'); } catch { /* the output is gone; nothing to do */ } },   // R52
  };
}

// isMain(): copied from scripts/check-constraints.mjs (R61)
if (isMain()) { process.exitCode = runSetup(createEnv()); }
```

The script writes only through `writeSync(1, ...)` and never touches `process.stdout` (R52). A failed write is ignored
on purpose: if the reader has closed the pipe, nothing more can be done (see D18). Importing the file runs nothing
but the constant and function definitions (R75).

## 4. Launchers and `.gitattributes`

`setup.sh` (R2, R3, R77):

```sh
#!/bin/sh
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "setup: Node.js was not found. Install Node.js 24 from nodejs.org, then run this again."; exit 1; }
node scripts/setup.mjs
exit $?
```

`setup.bat` (R2, R3, R77). It has no `(`, no `goto` and no label, so a missing carriage return cannot break it:

```bat
@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 echo setup: Node.js was not found. Install Node.js 24 from nodejs.org, then run this again.& exit /b 1
node scripts\setup.mjs
exit /b %errorlevel%
```

In the `if` line both commands after `if errorlevel 1` run only when the test is true, so `exit /b 1` happens only when `node` is missing.
The messages only name a website; neither launcher downloads or runs anything (R14).

`.gitattributes` (R7), exactly two lines:

```
setup.sh text eol=lf
setup.bat text eol=crlf
```

Files written in the working tree before Git normalises them may have LF endings in `setup.bat`. The batch file
is written so that both endings work. `setup.sh` must have LF endings in the working tree; a carriage return in it
is a defect (see T24 and R82).

## 5. Tests

File `scripts/setup.test.mjs`, run with `node --test scripts/setup.test.mjs` from the repository root (R5). It uses
`node:test` and `node:assert/strict`, writes every expected value by hand (R64), and never runs `npm`, installs or
uses the network (R66). Expected paths are written with `path.join` in the test, with the fake root `'ROOT'`.

### Fakes

- `makeEnv(overrides)`: `{ platform: 'linux', nodeVersion: '24.0.0', root: 'ROOT', execPath: 'NODE_EXE', run, write }`.
- `makeRun(table)`: returns a `run` function that records each step it receives in `calls` and answers with `table[step.id]`, or an `ok` result with `output: ''` when the id is not in the table.
- `lines`: an array that `write` pushes to.
- `stepLines(lines)`: `lines.filter((line) => /^(PASS|WARN|FAIL|SKIP)\b/.test(line))` (R65).

### Test list

| Id | What it checks | Requirements |
| --- | --- | --- |
| T01 | `checkNodeVersion` gives the level in the hand-written table of R67, all twelve rows. | R19 to R21, R67 |
| T02 | `checkNodeVersion` returns `fail` with a non-empty message and does not throw for `undefined`, `null`, `24`, `{}`, `'24.0'` and `'v24.0.0'`. | R22 |
| T03 | `npmCommand` for `win32`, `linux`, `darwin`. | R34, R68 |
| T04 | `stripEscapes` removes a colour sequence, a cursor sequence, an OSC title sequence and a lone escape character; text without escapes comes back identical. | R41 |
| T05 | `lastLines`: 40 lines with count 30 gives lines 11 to 40; 3 lines gives all 3; a final newline adds no empty line; `\r\n` splits; `''` gives `''`. | R40 |
| T06 | `combineOutput('a\n', 'b\n')` is `'a\nb\n'`; `null` and `undefined` count as `''`; a `Buffer` is converted. | R38 |
| T07 | `resultFromSpawn` on hand-made objects: status 0 gives `ok`; status 1 gives `failed` with detail `exit code 1`; error code `ETIMEDOUT` gives `timeout`; `ENOBUFS` gives `too-large`; `ENOENT` gives `failed` with detail starting `could not start`; status `null` with a signal gives `failed`; output is stdout then stderr. | R37, R38, R45, R46 |
| T08 | `spawnOptions` for a step with `shell: false` and for a step with `shell: true` (`command: 'npm.cmd ci'`, `args: []`): `stdio` is `['ignore', 'pipe', 'pipe']`, `maxBuffer` is 67108864, `timeout`, `shell` and `cwd` come from the step, and `env` equals the base environment plus `NO_COLOR: '1'`; the base environment object is unchanged. | R36, R42 to R44, R46, R47, R60 |
| T09 | `buildSteps` for `win32` and for `linux`: the exact `command`, `args`, `cwd`, `shell` and `timeoutMs` of steps 2 to 6, in order. On `win32` steps 2 to 4 are `'npm.cmd --version'`, `'npm.cmd ci'` and `'npm.cmd test'` with `args: []`; on `linux` they are `'npm'` with `['--version']`, `['ci']` and `['test']`. | R24, R26, R28 to R30, R33, R35, R36, R44 |
| T10 | `skipReason` for each pair of step id and earlier levels, including: step 3 failed gives a reason for 4 and `null` for 5 and 6; step 4 failed gives `null` for 5 and 6; step 5 failed gives `null` for 6; `warn` never skips. | R23, R25, R27, R31, R32 |
| T11 | `formatVerdict(0, 0)`, `(0, 3)`, `(2, 0)`, `(2, 1)`, `(1, 5)` give the exact lines; `describeLimit(60000)` is `60 seconds` and `describeLimit(300000)` is `5 minutes`. | R45, R53 to R55 |
| T12 | Everything passes: `calls` is the five steps in order with the hand-written commands and folders; six step lines, ids 1 to 6 in order, the first four words are `PASS`; one "before" line per step, none starting with the four words; the last line is `setup: all 6 steps passed.`; the return value is 0; no written line contains `ROOT`. | R16, R17, R50, R53, R56, R58, R59, R65, R69 |
| T13 | Step 1 gives `warn` (`'23.0.0'`): the first step line starts with `WARN`, the verdict is `setup: all 6 steps passed.`, the return value is 0. | R53, R56, R69 |
| T14 | Node too old (`'18.20.0'`): `calls` is empty, step line 1 is `FAIL`, steps 2 to 6 are `SKIP` with a non-empty reason, the verdict is `setup: 1 of 6 steps failed. 5 skipped.`, the return value is 1. | R23, R48, R55, R57, R70 |
| T15 | npm missing (step 2 answers `failed`): `calls` has only step 2, steps 3 to 6 are `SKIP`, the verdict is `setup: 1 of 6 steps failed. 4 skipped.`, the return value is 1. | R25, R48, R57, R70 |
| T16 | Install fails: step 4 is `SKIP` and its line contains `install`, steps 5 and 6 are in `calls` and `PASS`, the verdict is `setup: 1 of 6 steps failed. 1 skipped.`, the return value is 1. | R27, R31, R48, R49, R71 |
| T17 | For step 4, then 5, then 6 failing with 40 output lines `out 1` to `out 40`, where line 20 is `FAIL in suite` instead: the later steps still run; the written lines after the `FAIL` step line are exactly `    out 11` to `    out 40` (four spaces in front, line 20 written as `    FAIL in suite`); no line contains `out 10`; `stepLines` finds exactly six lines; the return value is 1. | R32, R40, R65, R72 |
| T18 | A step 4 result with status `timeout` gives a `FAIL` line that contains `timed out after 5 minutes` and does not contain `exit code`; a step 5 timeout says `60 seconds`. | R45, R73 |
| T19 | A step 4 result with status `too-large` gives a `FAIL` line that contains `output was too large`. | R46 |
| T20 | A failing step whose output has colour, cursor and title sequences and a lone escape character: no written line, in this run or in T12 to T19, contains `\u001b`; the text between the sequences is still written, each line with its four-space indent. | R40, R41, R51, R74 |
| T21 | The commands in `calls` for steps 5 and 6 have `command` equal to the fake `execPath` (`'NODE_EXE'`) and `shell` false, also when `platform` is `win32`; on `win32` the calls for steps 2 to 4 have a one-string `command` and `args: []`. | R33, R36, R74 |
| T22 | `createEnv()` has `platform === process.platform`, `nodeVersion === process.versions.node`, `execPath === process.execPath`, `root` equal to the parent of the test file's folder computed in the test with `fileURLToPath`, and function values for `run` and `write`. It starts nothing and writes nothing. | R33, R59, R62 |
| T23 | In a separate process (`spawnSync(process.execPath, ['--input-type=module', '-e', code])`, `code` imports the file by `pathToFileURL` and then writes `String(process.exitCode)`): stdout is exactly `undefined`, stderr is empty. | R61, R75 |
| T24 | `setup.sh`: starts with `#!/bin/sh`; contains no `\r`; contains `command -v node` and `scripts/setup.mjs`. A carriage return found here is a defect in `setup.sh`: it is reported and fixed in the file, and the test is never changed to allow it (R82). | R2, R3, R77, R82 |
| T25 | `setup.bat`: contains `where node` and `scripts\setup.mjs`; the text is split into lines with `/\r?\n/`, and no line, after optional leading spaces, starts with `:`; it contains no `goto` (any case) and no `(` character. | R2, R3, R77 |
| T26 | `.gitattributes`: the non-empty lines, trimmed, are exactly `['setup.sh text eol=lf', 'setup.bat text eol=crlf']`. | R7, R77 |
| T27 | The test reads `scripts/setup.mjs` (path from `import.meta.url`): the text contains `writeSync(1` and does not contain `process.stdout`. | R52, R76 |

T02, T04 to T11, T21, T22 and T27 are not in the list of ten checks in the brief. T27 is asked for by R76; the others
test behaviour that R22, R33, R36, R38, R40 to R46 and R60 require, so each of those requirements has a test (see D11).

### Not tested by `node --test`

R1, R4, R5, R6, R8 to R15, R58 (partly), R63 and R78 to R84 are checked by reading files and by the final report.
The real run of `setup.mjs`, `setup.bat` on Windows, `setup.sh` and the "Node missing" messages are run by people (R84).

## 6. Source-line table

For each test, one change to `scripts/setup.mjs` or a launcher that makes the named test fail. Tasks reuse these
rows and replace the description with the real line number once the code exists (R78).

| Test | Source line it should catch (the change) | Fails |
| --- | --- | --- |
| T01 | In `checkNodeVersion`, change `minor < 12` (the 22.x rule) to `minor < 11`. | T01 |
| T02 | In `checkNodeVersion`, remove the `^` from the version pattern. | T02 |
| T03 | In `npmCommand`, change the compared platform `'win32'` to `'linux'`. | T03 |
| T04 | In `stripEscapes`, delete the last replacement (remaining `\u001b`). | T04, T20 |
| T05 | In `lastLines`, change `slice(-count)` to `slice(-count + 1)`. | T05, T17 |
| T06 | In `combineOutput`, return `stderrText + stdoutText`. | T06, T07 |
| T07 | In `resultFromSpawn`, make the `ETIMEDOUT` branch return `status: 'failed'`. | T07 |
| T08 | In `spawnOptions`, change `stdio: ['ignore', 'pipe', 'pipe']` to `['pipe', 'pipe', 'pipe']`. | T08 |
| T09 | In `buildSteps`, swap the entries of steps 5 and 6. | T09, T12 |
| T10 | In `skipReason`, change the step 3 rule from `id === 4` to `id >= 4`. | T10, T16 |
| T11 | In `formatVerdict`, remove the `skipped > 0` condition. | T11, T14 |
| T12 | In `runSetup`, delete the `write` of the "before" line. | T12 |
| T13 | In `record`, count `warn` as a failure (`level !== 'ok'`). | T13 |
| T14 | In `skipReason`, delete the step 1 rule. | T14, T10 |
| T15 | In `skipReason`, delete the step 2 rule. | T15, T10 |
| T16 | In `runSetup`, skip a step without calling `record` (no `SKIP` line). | T16, T14, T15 |
| T17 | In `runSetup`, write `line` instead of `OUTPUT_INDENT + line`, or pass the whole output instead of `lastLines(..., 30)`. | T17 |
| T18 | In `failText`, return `result.detail` for status `timeout`. | T18 |
| T19 | In `failText`, change the `too-large` text to `exit code 1`. | T19 |
| T20 | In `runSetup`, remove the call to `stripEscapes` around the output. | T20 |
| T21 | In `buildSteps`, use `'node'` instead of `execPath` for step 5. | T21, T09 |
| T22 | In `createEnv`, replace `process.execPath` with `'node'`. | T22 |
| T23 | Add a top-level `process.stdout.write('loaded\n')`. | T23, T27 |
| T24 | In `setup.sh`, delete the `command -v node` line. | T24 |
| T25 | In `setup.bat`, add a line `:done`. | T25 |
| T26 | In `.gitattributes`, add a third rule. | T26 |
| T27 | In `createEnv`, replace `writeSync(1, line + '\n')` with `process.stdout.write(line + '\n')`. | T27 |

No row may start a real `npm`. A change must never make importing the file, or any test, call `runStep` or
`runSetup(createEnv())`, because that runs `npm ci` on the user's machine. The user breaks one row at a time and runs
only `node --test scripts/setup.test.mjs`.

## 7. Decisions on the open points

- **D1. `env` has two more fields.** R59 lists `platform`, `nodeVersion`, `run` and `write`. `runSetup` also takes `root` and `execPath`, so tests can give fake folders and a fake `node` path (T12, T21). `createEnv()` fills them with the real values.
- **D2. `runSetup` returns the exit code.** The command-line part sets `process.exitCode` from it (R56, R57, R61). Tests call it as often as they like.
- **D3. Step 1 does not go through `run`.** It reads `env.nodeVersion` and starts no process, so it has no time limit (R44).
- **D4. Combined output is all of standard output, then all of standard error (R38).** `spawnSync` reads the two pipes separately, so the real interleaving is lost. Redirecting `2>&1` inside a shell was rejected: steps 5 and 6 run with `shell: false`.
- **D5. Captured lines are printed after `stripEscapes` with a four-space indent (R40, R41).** A real captured line can start with `FAIL` (Vitest does). With the indent it cannot start with one of the four words, so lines starting with `PASS`, `WARN`, `FAIL` or `SKIP` are step lines in a real run as well as in the tests (R65). A blank captured line is printed as four spaces.
- **D6. Version parsing is strict.** Three numbers separated by dots, with an optional `-` or `+` suffix. `process.versions.node` is passed in, which has no leading `v`; `'v24.0.0'` and `'24.0'` are unreadable and fail (T02).
- **D7. Timeouts and too-large output also print the last 30 lines** of what was captured before the child was stopped. That output may be partial.
- **D8. `maxBuffer` is 64 MiB per stream**, which is how `spawnSync` counts it. When it is exceeded Node stops the child and the step is `too-large`.
- **D9. `FORCE_COLOR` is not removed from the child environment.** R43 allows only `NO_COLOR` to be added. If a user sets `FORCE_COLOR`, colour sequences can still appear in the child's output, and `stripEscapes` removes them before printing.
- **D10. Script paths in steps 5 and 6 are joined with `path.join`** (R62). The tests write the expected values the same way.
- **D11. Extra tests.** The brief lists ten checks. This design has 27 tests, because R22, R33, R36, R38, R40 to R46 and R60 describe behaviour that none of the ten checks reaches (T27 is asked for by R76). They are a decision for you to keep or remove; removing them leaves those requirements without a test.
- **D12. Windows timeouts.** `spawnSync` stops only the process it started. With `shell: true` on Windows, programs started by `cmd.exe` may keep running after a timeout. No extra code handles it and it is reported as not tested (R84).
- **D13. `runStep` never throws.** If `spawnSync` itself throws, the step fails with `could not start: <message>`. This path is not tested.
- **D14. Skip reasons name the step that caused them** (`not run because step 3 (install) failed`), so the SKIP line explains itself (R48).
- **D15. `windowsHide: true` is set in `spawnOptions`.** No requirement names it. It stops a console window from opening for each child on Windows and changes nothing else.
- **D16. T23 starts `node` only**, never `npm`, so it is allowed by R66.
- **D17. The launcher message says "Node.js 24"**, the tested version, although the minimum is lower (R3). It names a website and downloads nothing (R14).
- **D18. Output goes through `writeSync(1, ...)` with errors ignored (R52).** `writeSync` to a pipe can throw `EAGAIN` when the pipe is full, and a closed pipe throws `EPIPE`. The `catch` drops that line without a message, so a very slow reader can lose lines. This is the chosen behaviour. Because T27 searches the whole file for `process.stdout`, that text must not appear anywhere in `setup.mjs`, including comments.
- **D19. A shell step is one string with `args: []` (R36).** Passing an argument list together with `shell: true` makes recent Node versions print a deprecation warning (DEP0190). A single string avoids it. Every part of the string is a constant (R35).
