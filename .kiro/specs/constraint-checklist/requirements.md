# Requirements Document

## Introduction

constraint-checklist makes the checklist in `docs/adding-a-constraint.md` automatic. When a new constraint type is added to PathKit, several places must list it. A script reads the source files as text and reports, for every constraint type, which places forget it. A hook runs the script before every spec task, so the agent doing the task sees the result.

The script only reports. It never blocks a task and never edits a file. In the middle of a spec the code is meant to be inconsistent (for example, `scene.ts` knows a new type before `bake.ts` handles it), so a blocking hook would stop a spec halfway. Blocking is the job of the final check, `--strict`, which a person runs.

The work adds four kinds of file: `scripts/check-constraints.mjs`, `scripts/check-constraints.test.mjs`, `.kiro/hooks/constraint-checklist.json` and the spec files in `.kiro/specs/constraint-checklist/`. It adds one line to `docs/adding-a-constraint.md`. It reads the frozen core in `packages/pathkit` and changes nothing there.

Out of scope: any change under `packages/pathkit`, any `package.json`, any new dependency, any blocking behaviour in the hook, and any check of how well a test tests a constraint.

## Glossary

- **Checker**: The script `scripts/check-constraints.mjs`.
- **Constraint_Type**: The string literal in the `type:` field of an interface in `packages/pathkit/src/scene.ts` whose name ends in `Constraint`, for example `orbitAround`.
- **Constraint_Interface**: An `export interface XConstraint { type: 'x'; ... }` declaration in `scene.ts`. Its name is `XConstraint` and its Constraint_Type is `x`.
- **Constraint_Union**: The declaration `export type Constraint = A | B | C;` in `scene.ts`. It lists Constraint_Interface names and may span several lines.
- **Place**: One location that must list every Constraint_Type. Each Place has a short Place_Id.
- **Place_Id**: One of `union`, `validate-case`, `validate-message`, `bake-case`, `rotation-case`, `bake-default`, `rotation-default`, `export`, `scene-test`, `bake-test`.
- **Per_Type_Place**: A Place checked once for every Constraint_Type: `union`, `validate-case`, `validate-message`, `bake-case`, `rotation-case`, `export`, `scene-test`, `bake-test`.
- **Default_Place**: A Place that does not depend on the type and is reported once: `bake-default`, `rotation-default`.
- **Function_Body**: The text of a named function, found by locating `function <name>(` and then counting curly braces from the first `{` of the function until they balance.
- **Anchor**: Something the Checker must find before it can check a Place: the Constraint_Union, one of the functions `checkConstraintOfType`, `bakeEntity` or `drivesRotation`, or the `export type { ... } from './scene.js'` block in `index.ts`.
- **Orphan_Name**: A name listed in the Constraint_Union that no Constraint_Interface in `scene.ts` declares. It has no `type:` literal, so it has no Constraint_Type.
- **Gap**: A Place that fails its check, reported as `{ type, place, detail }`. For a Default_Place, `type` is empty. For an Orphan_Name, `type` holds the interface name, because there is no Constraint_Type.
- **Missing_Anchor**: A Finding reporting `cannot find <anchor> in <file>`.
- **Finding**: A Gap or a Missing_Anchor.
- **Whole_Word_Match**: A match of a name in a text where the characters directly before and after the match are not letters, digits or underscores.
- **Sources**: The object passed to `findGaps`, with the text of `scene`, `bake` and `index`, and the arrays `sceneTests` and `bakeTests` of `{ name, text }`.
- **Strict_Mode**: The Checker run with the flag `--strict`.
- **Hook**: The file `.kiro/hooks/constraint-checklist.json`.
- **Probe_File**: The file `.kiro/probe/checklist-received.txt`, used once to prove what the hook delivers.

## Requirements

### Requirement 1: Find the constraint types

**User Story:** As a maintainer, I want the Checker to find the constraint types itself, so that it keeps working when a fourth type is added.

#### Acceptance Criteria

1. THE Checker SHALL read the Constraint_Union in `scene.ts` and take the interface names it lists, whether the union is written on one line or on several lines.
2. THE Checker SHALL find every Constraint_Interface in `scene.ts` and take its Constraint_Type from the `type:` literal.
3. WHEN a Constraint_Interface is not listed in the Constraint_Union, THE Checker SHALL report a Gap with the Place_Id `union` for its Constraint_Type.
4. WHEN the Constraint_Union lists an Orphan_Name, THE Checker SHALL NOT guess a Constraint_Type from the name. THE Checker SHALL report one Gap with the Place_Id `union`, with the interface name where the type would go and the detail `<Name> is listed in the Constraint union but no interface declares it`, and SHALL skip every other per-type check for that name.
5. THE Checker SHALL contain no list of the three current Constraint_Types. The types it checks come only from the text it is given.

### Requirement 2: Per-type places

**User Story:** As a maintainer, I want every place that must list a constraint type to be checked, so that I find a forgotten place before I declare the type finished.

#### Acceptance Criteria

1. FOR each Constraint_Type `t`, THE Checker SHALL check `union`, which passes when the Constraint_Interface of `t` is listed in the Constraint_Union.
2. FOR each Constraint_Type `t`, THE Checker SHALL check `validate-case`, which passes when the Function_Body of `checkConstraintOfType` in `scene.ts` contains `case 't'`.
3. FOR each Constraint_Type `t`, THE Checker SHALL check `validate-message`, which passes when the text of the `default` branch of `checkConstraintOfType` contains `t` as a Whole_Word_Match.
4. FOR each Constraint_Type `t`, THE Checker SHALL check `bake-case`, which passes when the Function_Body of `bakeEntity` in `bake.ts` contains `case 't'`.
5. FOR each Constraint_Type `t`, THE Checker SHALL check `rotation-case`, which passes when the Function_Body of `drivesRotation` in `bake.ts` contains `case 't'`.
6. FOR each Constraint_Type `t`, THE Checker SHALL check `export`, which passes when the name of the Constraint_Interface of `t` is inside the `export type { ... } from './scene.js'` block of `index.ts`.
7. FOR each Constraint_Type `t`, THE Checker SHALL check `scene-test`, which passes when the text of at least one file in `sceneTests` contains `t` as a Whole_Word_Match.
8. FOR each Constraint_Type `t`, THE Checker SHALL check `bake-test`, which passes when the text of at least one file in `bakeTests` contains `t` as a Whole_Word_Match.
9. THE Checker SHALL NOT require the name to be in quotes in the two test checks. The real `orbitAround` scene tests build constraints through a helper and mention the name only in titles and messages, so a quoted-name check would report a false Gap.
10. THE design and the header comment of the Checker SHALL state the limit of the two test checks: they show that a test file mentions the type, not that the type is tested well, and a name in a comment also counts.
11. THE Checker SHALL, for a failing Per_Type_Place, report one Gap with the Constraint_Type, the Place_Id and a `detail` text that names what is missing and where.

### Requirement 3: Places that do not depend on the type

**User Story:** As a maintainer, I want an unhandled constraint type to fail loudly in the baker, so that a new type can never run silently as another type.

#### Acceptance Criteria

1. THE Checker SHALL check `bake-default`, which passes when the Function_Body of `bakeEntity` has a `default:` branch that calls `unknownConstraintType(`.
2. THE Checker SHALL check `rotation-default`, which passes when the Function_Body of `drivesRotation` has a `default:` branch that calls `unknownConstraintType(`.
3. THE Checker SHALL report a failing Default_Place once, with the Place_Id and no type name, however many Constraint_Types exist.

### Requirement 4: Missing anchors

**User Story:** As a maintainer, I want a clear finding when the Checker cannot find something it needs, so that a renamed function is noticed and not silently ignored.

#### Acceptance Criteria

1. IF the Constraint_Union cannot be found in `scene.ts`, THEN THE Checker SHALL report a Missing_Anchor with the text `cannot find the Constraint union in packages/pathkit/src/scene.ts`.
2. IF a function named `checkConstraintOfType`, `bakeEntity` or `drivesRotation` cannot be found, THEN THE Checker SHALL report a Missing_Anchor with the text `cannot find <name> in <file>`, where `<file>` is the repository path of the file searched.
3. IF the `export type { ... } from './scene.js'` block cannot be found in `index.ts`, THEN THE Checker SHALL report a Missing_Anchor with the text `cannot find the export type block in packages/pathkit/src/index.ts`.
4. WHEN an Anchor is missing, THE Checker SHALL skip only the checks that need that Anchor and SHALL still run every other check.
5. THE Checker SHALL NOT throw for a missing Anchor. A Missing_Anchor is a Finding, not a crash.

### Requirement 5: The pure function findGaps

**User Story:** As a test author, I want the checking logic in a pure function, so that tests can feed it small fixture texts.

#### Acceptance Criteria

1. THE Checker SHALL export a function `findGaps(sources)` that takes a Sources object and returns an array of Findings, each `{ type, place, detail }`.
2. THE `findGaps` function SHALL read no file, read no standard input, read no environment value, use no clock and use no randomness.
3. THE `findGaps` function SHALL NOT modify the Sources object or any text or array in it.
4. WHEN `findGaps` is called twice with equal Sources, THE `findGaps` function SHALL return equal arrays in the same order.
5. THE `findGaps` function SHALL return an empty array when every place passes and no Anchor is missing.

### Requirement 6: Reading the real files

**User Story:** As a user, I want the Checker to work from any folder on Windows, so that it runs the same from the hook, a terminal or a test.

#### Acceptance Criteria

1. THE Checker SHALL contain a function, separate from `findGaps`, that reads `scene.ts`, `bake.ts` and `index.ts` from `packages/pathkit/src` and every `.ts` file in `packages/pathkit/test/scene/` and `packages/pathkit/test/bake/`, and returns a Sources object.
2. THE Checker SHALL compute every path from `import.meta.url` with `node:path`, and SHALL NOT hard-code a slash or a backslash in a path.
3. THE Checker SHALL give the same result when started from the repository root, from `scripts/` or from any other folder.
4. THE Checker SHALL read only. It SHALL NOT create, change or delete any file.
5. THE Checker SHALL use only Node built-in modules.

### Requirement 7: Output

**User Story:** As an agent or a person reading the result, I want short plain text, so that I can act on it without decoding it.

#### Acceptance Criteria

1. THE Checker SHALL print plain text with no colour codes.
2. WHEN there are no Findings, THE Checker SHALL print exactly one line: `constraint-checklist: <n> constraint types (<names, comma separated>), every place covered.`, with the names in the order of the Constraint_Union. For the three current types this is `constraint-checklist: 3 constraint types (followPath, aimAt, orbitAround), every place covered.`
3. WHEN there are Findings, THE Checker SHALL print a header line `constraint-checklist: <k> gaps for <n> constraint types.`, then one line per Finding in the form `  - <type>: <place> (<detail>)`, then the line `Checklist: docs/adding-a-constraint.md`. For a Default_Place or a Missing_Anchor, which has no type, the form is `  - <place> (<detail>)`. For the Gap of criterion 1.4, the interface name of the Orphan_Name is printed where the type would be.
4. THE Checker SHALL count every Finding, Missing_Anchors included, in `<k>`.
5. THE Checker SHALL print Findings in a fixed order: by Constraint_Type in union order and, within a type, by Place_Id in the order of the Glossary, then the Default_Places, then the Missing_Anchors.

### Requirement 8: Exit codes and failure handling

**User Story:** As a person running the final check, I want a failing exit code only when I ask for it, so that the hook never stops a task.

#### Acceptance Criteria

1. WHEN the Checker runs without `--strict`, THE Checker SHALL exit with code 0, whether or not there are Findings.
2. WHEN the Checker runs with `--strict` and there is at least one Finding, THE Checker SHALL exit with code 1.
3. WHEN the Checker runs with `--strict` and there are no Findings, THE Checker SHALL exit with code 0.
4. THE Checker SHALL NOT read standard input. The hook passes JSON on standard input and the Checker ignores it, so unreadable text on standard input does not change the output or the exit code.
5. IF any error occurs while the Checker runs (for example a file cannot be read), THEN THE Checker SHALL print one line that starts with `constraint-checklist: cannot run (` and ends with `)`, with a short reason, and SHALL exit with code 0, or 1 with `--strict`. THE Checker SHALL NOT print a stack trace.
6. THE Checker SHALL run its command-line part only when the file is run directly, and SHALL NOT run it when the file is imported.

### Requirement 9: Report only

**User Story:** As the owner of the workflow, I want the checklist to inform and never block, so that a spec can pass through inconsistent states.

#### Acceptance Criteria

1. THE Checker SHALL NOT block, cancel or change any tool call, task or file, in any mode.
2. THE Hook SHALL run the Checker without `--strict`.
3. THE Hook SHALL NOT contain `--strict`.
4. WHEN the Checker reports Findings, THE Hook run SHALL still end with exit code 0, so that the task continues.
5. THE Checker SHALL NOT call a model, a network service or any other program.

### Requirement 10: The hook

**User Story:** As an agent doing a spec task, I want the checklist result delivered before each task, so that I see which places a constraint type forgets.

#### Acceptance Criteria

1. THE Hook SHALL be the file `.kiro/hooks/constraint-checklist.json` and SHALL contain the hook definition given in the brief: `version` `v1`, name `Constraint checklist`, trigger `PreTaskExec`, matcher `.*` and the command action `node scripts/check-constraints.mjs`.
2. THE Hook SHALL NOT have a file name or an id that starts with `guard-`.
3. THE Hook SHALL be valid JSON.
4. THE Hook SHALL cost no model credits. Nothing in this work SHALL call a model at run time.
5. WHERE the Hook is registered, THE hook mechanism SHALL run it from the repository root, so that `node scripts/check-constraints.mjs` resolves. This is a measured fact (22 November 2026) and SHALL NOT be re-tested.

### Requirement 11: Scope and project rules

**User Story:** As the owner of the frozen core, I want this work to stay inside its files, so that nothing already working is changed.

#### Acceptance Criteria

1. THE work SHALL create only these files: `scripts/check-constraints.mjs`, `scripts/check-constraints.test.mjs`, `.kiro/hooks/constraint-checklist.json`, `requirements.md`, `design.md` and `tasks.md` in `.kiro/specs/constraint-checklist/`, any task-record file Kiro creates by itself in the spec folder, and the temporary Probe_File with its folder (Requirement 13).
2. THE work SHALL edit one existing file, `docs/adding-a-constraint.md`, by adding one line at the end of its checklist that points to the Checker and says to run `node scripts/check-constraints.mjs --strict` before declaring a new constraint finished.
3. THE work SHALL NOT edit any file under `packages/pathkit`. Every file there is byte-identical before and after the work.
4. THE work SHALL NOT edit any `package.json` or `package-lock.json` and SHALL add no dependency.
5. THE work SHALL NOT create or edit any file or hook id that starts with `guard-`.
6. THE work SHALL NOT edit `scripts/guard-*`, `.kiro/hooks/guard-*` or `.kiro/specs/orbit-around/`.
7. THE Checker and its test file SHALL be ES modules with the extension `.mjs`, with one comment line above each function saying what it does.

### Requirement 12: Verification

**User Story:** As a reviewer, I want tests that cannot agree with a wrong script, so that a passing run means something.

#### Acceptance Criteria

1. THE test file `scripts/check-constraints.test.mjs` SHALL use the built-in runner (`node --test`) and `node:assert/strict`, and SHALL add no dependency.
2. THE tests SHALL write every expected result by hand and build every fixture as a small string. No test SHALL take an expected answer from the output of the Checker.
3. THE tests SHALL check that a complete fixture with three types gives no Findings.
4. THE tests SHALL check that a fourth type added only to the union and its interface gives exactly seven Gaps for that type (`validate-case`, `validate-message`, `bake-case`, `rotation-case`, `export`, `scene-test`, `bake-test`) and none for the other three.
5. THE tests SHALL check, for each Place_Id, that removing only that place from a complete fixture gives exactly that one Gap.
6. THE tests SHALL check that a missing `default` branch in `bakeEntity` gives one `bake-default` Gap, and the same for `drivesRotation`.
7. THE tests SHALL check that a Constraint_Interface with a `type:` literal that is not in the union gives a `union` Gap.
8. THE tests SHALL check that a multi-line Constraint_Union is parsed.
9. THE tests SHALL check that a function that cannot be found gives a `cannot find` Finding and does not throw.
10. THE tests SHALL check the Whole_Word_Match rule: a longer name that contains the type name, such as `orbitAroundExtra` for the type `orbitAround`, does not satisfy `scene-test` or `bake-test`.
11. THE tests SHALL check that `findGaps` does not modify its input.
12. THE tests SHALL run the Checker against the real repository and check that there are no Findings and that the output is the single line of Requirement 7.2 for the three real types.
13. THE tests SHALL check the output text and the exit codes by running the Checker as a separate process: the OK line, the Finding lines, exit code 1 with `--strict` and a Finding, exit code 0 without `--strict`, and exit code 0 when standard input holds unreadable text.
14. FOR each task, THE tasks SHALL name a source line it should catch: one change to the Checker that makes a named test fail.
15. THE tests SHALL NOT run with `npm.cmd test`. They run with `node --test scripts/check-constraints.test.mjs` from the repository root.
16. WHEN a task changes code, THE agent SHALL give the user the exact one-line command, say where to run it, and wait for the pasted output before calling the task done.
17. THE tests SHALL check that an Orphan_Name in the Constraint_Union gives exactly one Gap, with the Place_Id `union`, the interface name in the `type` position and the detail of Requirement 1.4, and no other Gap for that name.

### Requirement 13: Proof that the hook delivers its output

**User Story:** As the owner, I want proof of what the hook delivers that does not rest on anyone's word, so that I know the agent really sees the checklist.

#### Acceptance Criteria

1. THE last task of the spec SHALL check the Hook with a real task and SHALL ask the sub-agent that does that task to write the exact text it received from the Hook into the Probe_File.
2. THE user SHALL read the Probe_File and compare it with the output of `node scripts/check-constraints.mjs --strict`.
3. IF the Probe_File does not exist or does not contain the Checker output, THEN THE work SHALL report that the Hook delivery is not proven and SHALL NOT claim that the agent sees the result.
4. WHEN the check is finished, THE Probe_File and its folder `.kiro/probe/` SHALL be deleted. Kiro has no tool to delete files here, so Kiro SHALL ask the user to delete them and SHALL wait for confirmation.

### Requirement 14: Final report

**User Story:** As the owner, I want an honest final report, so that I know what was and was not tested.

#### Acceptance Criteria

1. THE final report SHALL list every file created and every file edited.
2. THE final report SHALL say plainly what was not tested.
3. THE final report SHALL give the counts of tests passed, failed and skipped only from output the user has pasted.
4. THE final report SHALL say that the Hook delivery to the main agent rests on the Probe_File, or that it is not proven if the Probe_File check failed.
