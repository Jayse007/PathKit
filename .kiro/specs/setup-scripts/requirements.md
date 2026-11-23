# Requirements: check-only setup scripts

Source: `.kiro/specs/setup-scripts/brief.md`. Requirements are in EARS style, one numbered requirement per rule.

## Glossary

- **Setup script**: `scripts/setup.mjs`.
- **Launcher**: `setup.bat` or `setup.sh` in the repository root.
- **Step**: one of the six numbered checks the setup script runs, in order: (1) Node version, (2) npm, (3) install, (4) PathKit tests, (5) checklist tests, (6) constraint checklist.
- **Step line**: the one result line of a step, starting with `PASS`, `WARN`, `FAIL` or `SKIP`.
- **Verdict line**: the single summary line printed after all step lines.
- **Runner**: the `run(step)` function that executes a step's command and returns its result. The real runner uses `spawnSync`. Tests pass a fake.

## Files and structure

1. The setup script SHALL be a single file, `scripts/setup.mjs`, that holds all the setup logic and imports only Node built-in modules.
2. Each launcher SHALL be located in the repository root and SHALL do only this: change to its own folder, check that `node` exists, run `node scripts/setup.mjs`, and pass the exit code of that run on.
3. IF `node` is not found, THEN each launcher SHALL print a plain message and exit with code 1 without running the setup script.
4. The repository SHALL NOT contain a file named `doctor.mjs` created by this work.
5. The tests SHALL be in `scripts/setup.test.mjs` and SHALL be run with `node --test scripts/setup.test.mjs` from the repository root.
6. The setup tests SHALL NOT be part of the `npm.cmd test` run.
7. The repository root SHALL contain a `.gitattributes` file with exactly two rules, `setup.sh text eol=lf` and `setup.bat text eol=crlf`.

## Scope

8. The work SHALL create only these files: `scripts/setup.mjs`, `scripts/setup.test.mjs`, `setup.bat`, `setup.sh`, `.gitattributes`, and the spec files in `.kiro/specs/setup-scripts/`.
9. The last task SHALL edit one existing file, `README.md`, in the section "Run the tests" only, adding a short "Quick start" with `.\setup.bat` (PowerShell on Windows), `sh setup.sh` (elsewhere), and one sentence saying what it does. The work SHALL change nothing else in the README.
10. The work SHALL NOT edit anything under `packages/pathkit`, any `package.json`, any `package-lock.json`, `scripts/guard-*`, `.kiro/hooks/guard-*`, or `scripts/check-constraints*`.
11. The work SHALL NOT name any new file or hook with the prefix `guard-`.
12. The work SHALL NOT add dependencies.
13. The setup script SHALL NOT use the network except through what `npm ci` itself does, and SHALL NOT call a model at run time.
14. The setup script and the launchers SHALL NOT download or run anything from the internet themselves, ask for administrator rights, change the PowerShell execution policy or any system or environment setting, write outside the repository folder, or contain secrets.
15. The setup script SHALL build nothing and SHALL create no project files except what `npm ci` installs in `packages/pathkit/node_modules`.

## Steps

16. WHEN the setup script runs a step, it SHALL print one line before the step starts and one step line when the step ends.
17. The line printed before a step starts SHALL NOT start with `PASS`, `WARN`, `FAIL` or `SKIP`.
18. The setup script SHALL provide a pure function `checkNodeVersion(version)` that returns `{ level, message }`, where `level` is `ok`, `warn` or `fail`.
19. WHEN `checkNodeVersion` receives a version below 20.19.0, any 21.x version, or a 22.x version below 22.12.0, it SHALL return level `fail`.
20. WHEN `checkNodeVersion` receives a version that does not fail and whose major version is not 24, it SHALL return level `warn`.
21. WHEN `checkNodeVersion` receives a version whose major version is 24, it SHALL return level `ok`.
22. IF `checkNodeVersion` receives a version string it cannot read, THEN it SHALL return level `fail` and SHALL NOT throw.
23. IF step 1 has level `fail`, THEN the setup script SHALL stop the run and skip steps 2 to 6.
24. WHEN step 2 runs, the setup script SHALL run `npm --version`.
25. IF step 2 fails, THEN the setup script SHALL stop the run and skip steps 3 to 6.
26. WHEN step 3 runs, the setup script SHALL run `npm ci` in `packages/pathkit`.
27. IF step 3 fails, THEN the setup script SHALL skip step 4 only.
28. WHEN step 4 runs, the setup script SHALL run `npm test` in `packages/pathkit` (the PathKit test suite).
29. WHEN step 5 runs, the setup script SHALL run `node --test scripts/check-constraints.test.mjs` from the repository root.
30. WHEN step 6 runs, the setup script SHALL run `node scripts/check-constraints.mjs --strict` from the repository root.
31. WHILE the run has not been stopped by step 1 or step 2, the setup script SHALL run steps 5 and 6 even when step 3 failed.
32. WHEN a test step (4, 5 or 6) fails, the setup script SHALL still run the steps after it.
33. The setup script SHALL run steps 5 and 6 with `process.execPath` and `shell: false`.

## Windows command rule

34. The setup script SHALL provide a pure function `npmCommand(platform)` that returns `{ command: 'npm.cmd', shell: true }` for `win32` and `{ command: 'npm', shell: false }` for every other platform.
35. The setup script SHALL build every command argument from fixed constants and SHALL NOT use text from outside the script as an argument.
36. WHEN a step runs with `shell: true`, the setup script SHALL give the command and its arguments as one command string (for example `npm.cmd ci`) and an empty `args` list.

## Step output, time limits and results

37. The setup script SHALL capture the output of every step command.
38. The captured output of a step SHALL be its standard output followed by its standard error, and the last 30 lines in requirement 40 SHALL be taken from that combined text.
39. WHEN a step succeeds, the setup script SHALL print only its step line.
40. WHEN a step fails, the setup script SHALL print its fail line followed by the last 30 lines of its captured output (requirement 38) and no earlier line, each of those lines printed with a four-space indent.
41. The setup script SHALL provide a pure function `stripEscapes(text)` and SHALL pass captured output through it before printing, so that the printed captured output contains no escape sequence. Apart from this and the four-space indent of requirement 40, the captured output SHALL be printed unchanged.
42. The real runner SHALL close the standard input of the child process (stdio input set to ignore).
43. The real runner SHALL add `NO_COLOR=1` to the environment of the child process and SHALL change no other environment setting.
44. The setup script SHALL give steps 3 and 4 a time limit of 5 minutes, steps 2, 5 and 6 a time limit of 60 seconds, and step 1 no time limit.
45. IF a step exceeds its time limit, THEN the setup script SHALL report that step as a fail whose line says it timed out.
46. The real runner SHALL set `maxBuffer` to 64 MiB. IF the output of a step exceeds it, THEN the step SHALL fail with a line saying the output was too large.
47. The setup script SHALL NOT hang: every step that starts a process SHALL have a time limit.
48. WHEN the setup script skips a step, it SHALL print a `SKIP` line that gives the reason.
49. A `SKIP` SHALL NOT count as a failure.

## Final output and exit code

50. The setup script SHALL print one step line per step, in step order, each starting with `PASS`, `WARN`, `FAIL` or `SKIP`, followed by one verdict line.
51. The setup script SHALL print plain text with no colour codes.
52. The setup script SHALL write every line with `writeSync(1, line + '\n')` from `node:fs`, inside a `try`/`catch` that ignores errors, and SHALL NOT use `process.stdout`.
53. WHEN no step failed, the verdict line SHALL be `setup: all 6 steps passed.`, even when some steps gave `WARN`.
54. WHEN `<f>` steps failed (f at least 1), the verdict line SHALL be `setup: <f> of 6 steps failed.`.
55. WHEN at least one step failed and `<s>` steps were skipped (s at least 1), the verdict line SHALL end with ` <s> skipped.` after the failure text.
56. WHEN no step failed, the setup script SHALL set exit code 0, including when there are warnings or skips.
57. WHEN at least one step failed, the setup script SHALL set exit code 1.
58. The lines the setup script writes itself SHALL NOT depend on the user's name or folder. This requirement does not apply to the captured output of a failed step.

## Code shape

59. The setup script SHALL make its decisions in pure functions and SHALL provide one function `runSetup(env)` that takes everything it needs (`platform`, `nodeVersion`, a `run(step)` function and a `write(line)` function), so that tests can pass fakes.
60. The real runner SHALL use `spawnSync` with a time limit.
61. The command-line part of the setup script SHALL run only when the file is started directly, using the same `isMain()` pattern as `scripts/check-constraints.mjs`, and SHALL NOT call `process.exit`.
62. The setup script SHALL build every path from `import.meta.url` and `node:path` and SHALL NOT use typed slashes.
63. Every function in the setup script SHALL have one comment line above it.

## Tests

64. The tests SHALL use `node --test` with `node:assert/strict`, with expected results written by hand.
65. The tests SHALL pick the step lines out of the output by the four words `PASS`, `WARN`, `FAIL` and `SKIP` at the start of a line, and by nothing else.
66. The test file SHALL NOT run `npm`, install anything or use the network, and SHALL build its fakes as small objects.
67. The tests SHALL check `checkNodeVersion` against this hand-written table: 18.20.0 fail; 20.18.0 fail; 20.19.0 warn; 21.7.0 fail; 22.11.0 fail; 22.12.0 warn; 23.0.0 warn; 24.0.0 ok; 24.11.1 ok; 25.1.0 warn; `''` fail; `'abc'` fail.
68. The tests SHALL check that `npmCommand('win32')` gives `npm.cmd` with shell true, and that `npmCommand('linux')` and `npmCommand('darwin')` give `npm` with shell false.
69. The tests SHALL check, with a fake runner where everything passes, the exact list of commands, their folders and their order, six step lines, the verdict line and exit code 0, and that a `warn` from step 1 still gives exit code 0.
70. The tests SHALL check that when the Node version is too old only step 1 runs, steps 2 to 6 print `SKIP` lines with a reason, and the exit code is 1; and that when npm is missing only steps 1 and 2 run, steps 3 to 6 print `SKIP` lines with a reason, and the exit code is 1.
71. The tests SHALL check that when install fails, step 4 prints a `SKIP` line that says why, steps 5 and 6 still run, and the exit code is 1.
72. The tests SHALL check that when one test step fails, the other steps still run, the last 30 lines of its output are shown and no earlier line, and the exit code is 1.
73. The tests SHALL check that a step that times out reports a timeout and not a generic failure.
74. The tests SHALL check that no output contains an escape character, including when a fake failing step returns text with escape sequences, and that the commands given to the runner for steps 5 and 6 use `process.execPath` and `shell: false`.
75. The tests SHALL check, in a separate process, that importing `scripts/setup.mjs` prints nothing and sets no exit code.
76. The tests SHALL check, by reading `scripts/setup.mjs`, that it contains `writeSync(1` and does not contain `process.stdout`.
77. The tests SHALL check the launchers and `.gitattributes` by reading the files: `setup.sh` starts with `#!/bin/sh`, has no carriage return, and contains `command -v node` and `scripts/setup.mjs`; `setup.bat` contains `where node` and `scripts\setup.mjs` and contains no `goto`, no label line (a line starting with `:`, lines split on `/\r?\n/`) and no `(` block; `.gitattributes` holds exactly the two rules.
78. Each task SHALL name a "source line it should catch": one change that makes a named test fail.

## Working rules and reporting

79. The agent SHALL NOT run terminal commands. At each checkpoint it SHALL give the user the exact one-line command and ask for the pasted output.
80. The only commands asked for in this work SHALL be `node --test scripts/setup.test.mjs` and, at the end only, `node scripts/setup.mjs`. The line allowing them in `.kiro/steering/windows-terminal.md` is already present.
81. The agent SHALL NOT report a test or run as passing until the user has pasted the output.
82. IF the launcher test finds a carriage return in `setup.sh`, THEN the agent SHALL report it as a defect in `setup.sh` and SHALL NOT weaken the test.
83. The final report SHALL list every file created or edited.
84. The final report SHALL say plainly what was not tested: the real run of `node scripts/setup.mjs` (run once by the user at the end), `setup.bat` on Windows (run by the user), `setup.sh` and the "Node missing" message (run by the reviewer on Linux), that no other operating system and no Node version other than the user's was tried, so the checks do not prove the project works on every machine, and that on Windows a timed-out step may leave the programs it started running, which was not tested.
