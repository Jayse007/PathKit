# Kiro usage log

This file records how Kiro was used to build PathKit, with evidence you can check in this repository.
It is written for the Kiroween 2026 judges and as the source for the Kiro write-up.

Last updated: 2026-11-20. Items marked **[fill in]** are facts only the author can supply. Nothing in this
file is estimated unless it says so.

## 1. Summary for judges

PathKit's core library (`spikes/path-core`) was built spec-first in Kiro: requirements, then design, then a
list of 79 tasks that Kiro executed one at a time. A human ran every test run and pushed every commit.

| Kiro feature | Used? | How it was used | Evidence in this repo |
| --- | --- | --- | --- |
| Spec-driven development | Yes, heavily | One spec (`path-core`) with requirements, design and tasks. Kiro wrote every source and test file from it, task by task. | `.kiro/specs/path-core/` |
| Steering docs | Yes | Five steering files that stop Kiro repeating mistakes it had already made. Four always apply, one applies only to test files. | `.kiro/steering/` |
| Property-based testing | Yes | The design states 45 numbered correctness properties. They are written as `fast-check` tests. Kiro's own property-test tracking recorded one result. | `.kiro/specs/path-core/design.md`, `spikes/path-core/test/`, `tasks.meta.json` |
| Known-issues log | Yes | Every time Kiro or its environment caused a problem, it was written down with the fix. 11 entries. | `.kiro/docs/known-issues.md` |
| Agent hooks | Not yet | Planned: a hook that wires new constraints into the project. | none yet |
| MCP server | Not yet | A small PathKit MCP server is a stretch goal only. | none yet |
| Custom agents, powers, workflows | No | Not planned at the moment. | none |

**[fill in]** Kiro version used: 1.4.154 (as last recorded in the brief). Models used: **[fill in]**.

## 2. How the work was done

1. Write the requirements as numbered acceptance criteria ("THE system SHALL ...").
2. Write the design, including a numbered list of correctness properties that must always hold.
3. Break the design into tasks. Each test is its own task and points at the properties it checks.
4. Ask Kiro to execute one task, or a short run of tasks, at a time.
5. The author runs `npm.cmd test` and pastes the output back to Kiro, because Kiro could not see the output
   of that command in this environment (see known issue KI-8).
6. The author pushes the commit manually.
7. The commit is then reviewed separately (see section 5).

Numbers measured from the repository on 2026-11-20:

| Measure | Value |
| --- | --- |
| Requirements | 10, with about 100 numbered acceptance criteria |
| Correctness properties in the design | 45 |
| Tasks, all complete | 79 (`tasks.md`) |
| Task execution records written by Kiro | 248 records across 73 distinct executions, in one Kiro chat session (`tasks.meta.json`) |
| First and last execution record | 2026-11-17 and 2026-11-20 (UTC) |
| TypeScript written (source and tests) | about 12,650 lines |
| Test files and tests | 55 files, 348 tests, 0 failed, 0 skipped (author's run, commit `2b62a0c`) |
| Commits | 52 (28 on 2026-11-19, 24 on 2026-11-20) |
| Steering files | 5 |
| Known issues logged | 11 |

## 3. Credits

| Date | Credits used so far | Note |
| --- | --- | --- |
| 2026-11-15 | 0 of 4,000 | Hackathon credits received |
| 2026-11-19 | about 112.74 | As recorded in the project brief |
| 2026-11-20 | 493.14 | Read the number from the Kiro usage page |
| 2026-11-22 | 559.86 | Before the orbitAround implementation tasks. The spec files (requirements, design, tasks) and the hook work were already done |
| 2026-11-22 | 606.54 | After orbitAround finished (26 tasks, 3 checkpoints). Implementation cost: 606.54 minus 559.86 = 46.68 |
| 2026-11-23 | 676.55 | Before the setup-scripts implementation tasks. Since 606.54, the constraint-checklist spec and build and the setup-scripts requirements, design and tasks cost 70.01 together (676.55 minus 606.54) |

One incident cost credits for no result: a multi-line PowerShell command hung Kiro's shell for 48 minutes
(about 1.18 credits). It led to a steering rule (`windows-terminal.md`).

## 4. Where Kiro got things wrong, and what changed

These are the useful parts of the log. Each one changed how the project is run.

| What happened | Fix | Where it is recorded |
| --- | --- | --- |
| Kiro wrote a file from the terminal with a multi-line string and the shell hung for 48 minutes. | Rule: never write files from the terminal; one-line commands only. | KI-1, `windows-terminal.md` |
| Kiro could not see the output of `npm.cmd test`, so it guessed or added extra commands. | The author pastes the output. Kiro is told not to run it. | KI-3, KI-8 |
| Kiro ran `npx tsc` and timed out, because TypeScript is not installed on purpose. | Rule: Kiro runs only `npm.cmd test` and a few diagnostics. | KI-7 |
| Kiro wrote relative imports without `.js`. Tests passed but the type checker found errors. | Steering rule `typescript-imports.md`. | KI-9 |
| Random test data was not random: one generator made 93% of its directions almost exactly along an axis. | Replaced with evenly spread generators; rule to check what a generator really produces. | `testing-conventions.md` |
| One property test took 15.7 s because it called `expect` about 15 times per frame. | Rule: plain checks inside loops; a test file over 5 s counts as a defect. | KI-10, `testing-conventions.md` |
| 23 tests failed because Kiro compared a custom error type to a plain `Error`. | Rule 6 in `testing-conventions.md`. | `testing-conventions.md` |
| Kiro said some lines would be caught by a test. Breaking the code on purpose showed they would not. | Kiro now lists, for every test, the exact source line it should catch. Lines nobody can catch are listed honestly. | `testing-conventions.md` (rule 4) |
| A test for path-end detection read its expected answer from the data it was checking, so it could not notice a wrong choice. | Test rewritten to compute the answer from the scene alone. | `spikes/path-core/test/linter/property-38.test.ts` |
| Kiro explained the heap-growth test wrongly: it only detects memory that is kept, not short-lived garbage. | Wording corrected in the design and the test comments. | `design.md`, `test/evaluate/` |
| Kiro quoted source line numbers that were often wrong, and predicted test counts that were often wrong. | Line numbers are checked with a search. Real counts come from the author's run. | Not yet written into a steering file (to do) |
| Kiro ran terminal commands it was told not to run. | The prompt repeats the rule; output is ignored. | **[fill in]** |

Known limits in the finished code are documented, not hidden. KI-11 describes a closed-path orientation
snap that remains.

## 5. Tools other than Kiro

**[fill in, and confirm before submission]** The planning, the prompts given to Kiro, and an independent review
of every commit were done with a separate AI assistant (Claude, from Anthropic) in a chat. The reviewer
re-ran each commit in a clean copy, type-checked it, and broke the code on purpose to check that tests
fail. All source and test files in this repository were written by Kiro. Some spec edits were suggested in
the chat and applied by Kiro. **[fill in]** If any file was written or edited outside Kiro, list it here.

The official rules page, as read on 2026-11-20, requires entrants to "build a working software application
using Kiro" and to disclose other pre-existing code or work. It had no rule about using other AI tools.
Keep this section accurate regardless.

## 6. Still to add (as the project continues)

- Agent hooks, if built: what they do, which trigger, and a screenshot or file path.
- The two demo apps: which Kiro features each one used, and what went wrong.
- Credits used per phase.
- A short, honest list of what Kiro was bad at.

## 7. How to keep this log current

After each Kiro session add one entry with the date, the task, the credits used, and anything Kiro got wrong.
Keep entries short. Copy the facts from the repository, not from memory.

```
### YYYY-MM-DD - task or topic
- What Kiro did:
- Credits used:
- What went wrong or surprised me:
- Change made because of it (file or rule):
```

### 2026-11-22 - orbitAround constraint (spec orbit-around, implementation)
- What Kiro did: executed the 26 tasks one at a time in three groups, each ending at a checkpoint where I ran
  `npm.cmd test` and pasted the output. Changed `src/scene.ts`, `src/bake.ts` and `src/index.ts`, and added
  133 tests (13 property tests). Kiro itself spotted, while reading the design, that a lookup table keyed by axis
  tokens would break an existing test, so the design uses a rule derived from the axis vector instead.
- Credits used: 46.68, read from the Kiro usage page before and after (559.86 before).
- What went wrong or surprised me: (1) The type check, which Kiro cannot run, found four errors in an existing
  test (`property-42`) that every test run missed, because the test runner does not type-check. (2) A mutation
  check found two rules no test covered: an orbit must not change rotation when an earlier constraint has
  influence below 1, and an orbit placed before a `followPath` must not alter that follow's bookkeeping.
  (3) A break-test Kiro suggested ("remove `typeof` alone") cannot fail because the two guards overlap.
- Change made because of it: task 3.11 (the one allowed edit to an existing test, a type-only change) and
  task 5.8 (two extra tests). Both are recorded in `.kiro/specs/orbit-around/tasks.md`.