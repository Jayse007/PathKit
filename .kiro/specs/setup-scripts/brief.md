# Brief: check-only setup scripts

Written by the reviewer for Kiro to turn into requirements, design and tasks. It is a brief, not a spec.
If anything here is unclear or conflicts with the repository, stop and ask before building on it.

## Goal

A stranger who clones PathKit (a judge, or the owner on a new machine) should be able to run one command and
learn whether the project works on their machine. The setup is **check-only**: it installs the PathKit
packages (the one thing needed to run the tests), runs every check, and prints a clear pass or fail for each
step. It builds nothing and creates no project files except what `npm ci` installs in `packages/pathkit/node_modules`.

## Structure (decided)

- `scripts/setup.mjs`: all the logic, in one place. Node built-in modules only.
- `setup.bat` (Windows) and `setup.sh` (macOS and Linux) in the repository root: thin launchers. Each does only
  this: go to its own folder, check that `node` exists (plain message and exit code 1 if not), then run
  `node scripts/setup.mjs` and pass its exit code on. No other logic. This replaces the separate `doctor.mjs`
  that was planned, so do not create `doctor.mjs`.
- `scripts/setup.test.mjs`: tests, run with `node --test scripts/setup.test.mjs` from the repository root.
  They do not run under `npm.cmd test`.
- `.gitattributes` in the repository root with exactly two rules, so line endings cannot break the launchers
  (a shell script with Windows line endings fails): `setup.sh text eol=lf` and `setup.bat text eol=crlf`.

## Scope: what may and may not change

- New files only: the four files above, `.gitattributes`, and the spec files in `.kiro/specs/setup-scripts/`.
- One existing file may be edited, in the last task: `README.md`, section "Run the tests". Add a short
  "Quick start" with the two commands (`.\setup.bat` in PowerShell on Windows, `sh setup.sh` elsewhere) and
  one sentence saying what it does. Change nothing else in the README.
- Do not edit anything under `packages/pathkit`, any `package.json` or `package-lock.json`, `scripts/guard-*`,
  `.kiro/hooks/guard-*`, or `scripts/check-constraints*`. Name no new file or hook with the prefix `guard-`.
- No new dependencies. No network access except what `npm ci` itself does. No model call at run time.
- The scripts must never: download or run anything from the internet themselves (no `curl | sh`), ask for
  administrator rights, change PowerShell execution policy or any system or environment setting, or write
  outside the repository folder. They contain no secrets.
- Kiro cannot run terminal commands in this project. For every checkpoint, give the user the exact one-line
  command and ask for the pasted output. The two commands for this work are
  `node --test scripts/setup.test.mjs` and, at the end only, `node scripts/setup.mjs` (it installs and runs
  everything, so it takes about a minute or more). The user adds one line to
  `.kiro/steering/windows-terminal.md` allowing them.

## What `scripts/setup.mjs` does, in order

Each step prints a line before it starts, because the slow ones are silent for up to a minute, and one line
when it ends.

1. **Node version.** Pure function `checkNodeVersion(version)` returns `{ level, message }` with level `ok`,
   `warn` or `fail`. The minimum comes from the lock file (Vite 7.3.8 needs `^20.19.0 || >=22.12.0`), so: below
   20.19.0 fails; any 21.x fails; 22.x below 22.12.0 fails; everything else passes. A pass that is not major
   version 24 is a `warn`, because the project is tested with Node 24. An unreadable version string fails and
   never throws. A `fail` stops the whole run.
2. **npm.** Run `npm --version`. A failure stops the whole run.
3. **Install.** Run `npm ci` in `packages/pathkit`. `npm ci` installs exactly what the lock file says and never
   rewrites it, which is what a stranger gets. A failure skips step 4 only.
4. **PathKit tests.** Run `npm test` in `packages/pathkit` (the PathKit test suite).
5. **Checklist tests.** Run `node --test scripts/check-constraints.test.mjs` from the repository root.
6. **Constraint checklist.** Run `node scripts/check-constraints.mjs --strict` from the repository root.

Steps 5 and 6 need no install, so they still run when step 3 fails. A failing test step does not stop the
later steps, so the user sees everything in one run. Steps 5 and 6 run `process.execPath` (the Node that is
running the script) with `shell: false`, not the plain `node` command.

- **Windows rule:** Node 20.12 and later refuse to start a `.cmd` file unless `shell: true` is set (security
  fix CVE-2024-27980, error `EINVAL`). So pure function `npmCommand(platform)` returns
  `{ command: 'npm.cmd', shell: true }` on `win32` and `{ command: 'npm', shell: false }` elsewhere. Every
  argument is a fixed constant, never text from outside, so `shell: true` is safe here.
- **Output of a step:** capture it. Print only a pass line when it succeeds. When it fails, print the last 30
  lines of its output under the fail line, shown unchanged except that pure function `stripEscapes(text)`
  first removes escape sequences from it. The child process gets `NO_COLOR=1` added to its environment (the
  child's environment only; the script changes no system or environment setting). Each step has a time limit:
  steps 3 and 4 get 5 minutes; steps 2, 5 and 6 get 60 seconds; step 1 has no limit (it runs no process). A
  timeout is a fail that says so. Nothing may hang.
- **Final output:** one line per step starting with `PASS`, `WARN`, `FAIL` or `SKIP`, then one verdict line.
  A step that does not run (because step 1 or 2 stopped the run, or step 3 failed and step 4 is skipped) still
  gets a `SKIP` line that gives the reason. A `SKIP` is not a failure. With no failed step the verdict is
  `setup: all 6 steps passed.`, even when there are warnings. With failures it is `setup: <f> of 6 steps failed.`,
  and when any step was skipped ` <s> skipped.` is appended, for example
  `setup: 2 of 6 steps failed. 1 skipped.` Plain text, no colour codes. Exit code 0 only when no step failed
  (warnings and skips alone are fine), otherwise 1. The script's own lines print nothing that depends on the
  user's name or folder; this does not apply to the captured output of a failed step.
- **Shape of the code:** pure functions for decisions, and one `runSetup(env)` that takes everything it needs
  (`platform`, `nodeVersion`, a `run(step)` function, a `write(line)` function) so tests can feed fakes.
  The real runner uses `spawnSync` with a time limit. The command-line part runs only when the file is run
  directly, like `check-constraints.mjs` (use the same `isMain()` pattern, and do not call `process.exit`).
  Paths come from `import.meta.url` and `node:path`, never typed slashes. One comment line above each function.

## Tests

Use `node --test` with `node:assert/strict`. Expected results are written by hand. Nothing in the test file
may run `npm`, install anything or touch the network. Build fakes as small objects.

1. `checkNodeVersion` table, written by hand: 18.20.0 fail; 20.18.0 fail; 20.19.0 warn; 21.7.0 fail;
   22.11.0 fail; 22.12.0 warn; 23.0.0 warn; 24.0.0 ok; 24.11.1 ok; 25.1.0 warn; `''` and `'abc'` fail.
2. `npmCommand`: `win32` gives `npm.cmd` with shell true; `linux` and `darwin` give `npm` with shell false.
3. Everything passes (fake runner): the exact list of commands, their folders and their order, six step lines,
   the verdict line, exit code 0. A `warn` from step 1 still gives 0.
4. Node too old: only step 1 runs, steps 2 to 6 print `SKIP` lines with a reason, exit code 1. npm missing:
   only steps 1 and 2 run, steps 3 to 6 print `SKIP` lines with a reason, exit code 1.
5. Install fails: step 4 is skipped with a line saying why, steps 5 and 6 still run, exit code 1.
6. One test step fails: the others still run, the last 30 lines of its output are shown and no earlier line,
   exit code 1.
7. A step that times out reports a timeout, not a generic failure.
8. No output contains an escape character, even when a fake failing step returns text with escape sequences
   (`stripEscapes` removes them). The commands the runner is given for steps 5 and 6 use `process.execPath`
   and `shell: false`, and the real runner adds `NO_COLOR=1` to the child environment.
9. Importing `scripts/setup.mjs` prints nothing and sets no exit code (checked in a separate process).
10. Launchers, by reading the files: `setup.sh` starts with `#!/bin/sh`, has no carriage return, contains
    `command -v node` and `scripts/setup.mjs`; `setup.bat` contains `where node` and `scripts\setup.mjs` and
    no `goto`, no label line (a line starting with `:`) and no `(` block, so its line endings cannot matter;
    `.gitattributes` holds exactly the two rules.

Each task must name a "source line it should catch": one change that makes a named test fail.

## Things Kiro cannot test (say so in the final report)

- The real run of `node scripts/setup.mjs` (it installs packages and takes a minute or more): the user runs it
  once at the end and pastes the output.
- `setup.bat` on Windows is run by the user. `setup.sh` and the "Node missing" message are run by the
  reviewer on Linux.
- No other operating system and no Node version other than the user's was tried. The checks do not prove the
  project works on every machine.
- The final report must list every file created or edited and say plainly what was not tested.
