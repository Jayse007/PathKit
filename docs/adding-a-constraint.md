# Adding a constraint to PathKit

This guide shows how a new kind of constraint is added to PathKit, using the one that was actually added:
`orbitAround`. Everything below happened in this repository, and the commits and spec files are named so you
can check them.

A **constraint** is one rule that an entity obeys. `followPath` makes it travel along a curve, `aimAt` makes it
face a target, and `orbitAround` makes it circle a point. An entity has a list of constraints, and the baker
applies them one after another for every frame.

## What you get at the end

- A new constraint type that validates its own fields, bakes correctly and can be mixed with the others.
- Zero edits to the rest of the library. Here, only three source files changed: `src/scene.ts`,
  `src/bake.ts` and `src/index.ts`.
- 133 new tests, 13 of them property tests (tests that check a rule over hundreds of random inputs instead of
  a few hand-picked ones).

## The core is frozen

`packages/pathkit/src` and `packages/pathkit/test` are protected. A Kiro hook (`scripts/guard-core.mjs`,
registered by `.kiro/hooks/guard-core.json`) blocks any agent write there. The project owner unlocks it on
purpose, for the length of one approved spec, by creating a flag file in their home folder
(`.pathkit-unlock-core`). Delete the flag when the spec is finished. The hook cannot be edited by the agent,
and the agent cannot create the flag. Terminal commands are blocked too (`scripts/guard-terminal.mjs`), so
the owner runs `npm test` and pastes the output back.

## The steps

### 1. Write the spec first

Three files in `.kiro/specs/<name>/`: requirements (numbered rules, each testable), design (the behaviour,
the code shape and a list of correctness properties) and tasks (small steps in a fixed order). For
`orbitAround` that came to 8 requirements, 13 properties and 26 tasks, with a checkpoint after each group
where the owner runs the tests.

Decide the behaviour in the design, not while coding. The one thing worth deciding early: **where the new
constraint sits in the stack.** `orbitAround` changes only the position, never the rotation. So an `aimAt`
placed after it (higher `order`) faces the centre from the orbit position, and an `aimAt` placed before it
faces the centre from wherever the entity was earlier. Both are tested by hand.

### 2. `src/scene.ts`: the type and its validation

- Add the interface and put it in the `Constraint` union.
- Check the new fields inside `validateScene`, in a fixed order, so the first defect found is always the one
  reported. The existing checks (influence, then order) stay first and keep their messages.
- Use `typeof x !== 'number'` before `Number.isFinite(x)` for numbers. `"5" >= 0` is true in JavaScript.

### 3. `src/index.ts`: export the type only

Add the new type name to the existing `export type { ... }` block and nothing else.
`test/bake/property-37.test.ts` pins the exact list of runtime exports, so a stray export fails it on purpose.
A type-only export disappears at build time and cannot trip that test.

### 4. `src/bake.ts`: replace "else means the other type"

Before this change the baker had two types, so it was written as "if it is `aimAt`, do that, otherwise it must
be `followPath`". With a third type, "otherwise" silently treats an orbit as a `followPath`. Two places had that
shape, `bakeEntity` and `drivesRotation`. Both became explicit `switch` statements:

```ts
switch (c.type) {
  case 'aimAt':       /* unchanged */ break;
  case 'followPath':  /* unchanged */ break;
  case 'orbitAround': applyOrbitAround(...); break;
  default: throw unknownConstraintType(c);   // c has type `never` here
}
```

When `c` is `never`, TypeScript refuses to compile if a future fourth type is added and this `switch` is not
updated. That is the safety net for the next person.

Other rules the new function follows: no object or array is created per frame (a test reads the source and
fails on `new`, `[...]`, `=>` and similar), one degree-to-radian conversion, a guard that throws a clear
`SceneError` if the angle is not a finite number, and `sceneNeedsFrames` left alone so an orbit never pays for
the expensive frame table that only `alignToPath` needs.

### 5. Test in three layers

1. **Hand-computed unit tests.** Work out a few positions on paper and write the numbers into the test. For the
   orbit, one test per axis (`+X`, `-X`, `+Y`, `-Y`, `+Z`, `-Z`). Expected values must never come from the
   baker's own maths, or a bug and its test agree with each other.
2. **Property tests.** For the orbit: distance from the centre equals the radius, the offset is perpendicular
   to the axis, consecutive frames differ by `speed / fps` degrees, the sign of `speed` gives the direction,
   a full lap returns to the start, a moving centre carries the orbit with it, influence blends the position,
   and so on (O1 to O13 in `design.md`).
3. **Structure and defensive tests.** One test reads `bake.ts` as text and checks that the switches name every
   type. Another replaces `validateScene` with a no-op (`vi.mock`) so the `default:` branch, which
   validation normally makes unreachable, can be shown to throw.

Also confirm the linter needs no change. `src/linter.ts` names no constraint type, and a test proves an orbit
produces no findings.

### 6. Type-check, then break the code on purpose

The repository has no TypeScript dependency by design (the only dev dependencies are `vitest` and
`fast-check`), and the test runner does not type-check. So run `tsc` once, outside the repo's dependencies,
before declaring the work done. Then do a **mutation check**: change one line of the new code on purpose
(flip a sign, drop `* radius`, swap two checks), run the tests, and confirm something fails. A test that
cannot fail proves nothing. Restore the line afterwards.

## What went wrong, and what caught it

These are real findings from the `orbitAround` work. Each one would have shipped without the step that caught it.

| Problem | Caught by | Result |
| --- | --- | --- |
| The first plan used a lookup table keyed by axis tokens (`'+X'`, `'-X'`, ...). An existing test forbids quoted axis tokens outside `scene.ts`. | Kiro, while reading the design | Side vectors are derived from `axisVector()` with a cyclic rule. Six hand-computed tests prove it equals the table. |
| The widened `Constraint` union made an existing test, `test/linter/property-42.test.ts`, read `c.alignToPath` on a constraint that might be an orbit. Vitest does not type-check, so every test still passed. | The independent reviewer's `tsc` run | One task (3.11) narrows four lines in that file with no change in behaviour. It is the only existing test file edited, and the spec records it as a named exception. |
| Two rules in the new tests were never exercised: an orbit must not change the rotation when an earlier constraint has influence below 1, and an orbit placed before a `followPath` must not take over that follow's bookkeeping (`travelled`, `heldFromFrame`). | Mutation check | Task 5.8 adds one test for each. Breaking either line now fails a test. |
| A suggested break-test ("remove `typeof` alone", or "use the global `isFinite` alone") should fail the tests but does not. | Mutation check | The two guards overlap, so each change alone behaves identically. Only removing both fails. Some mutations are harmless; do not chase them. |

## Checklist for the next constraint

- [ ] Spec written and approved before any code, with the stack position decided.
- [ ] Core unlocked for this spec only (flag file created by the owner, not the agent).
- [ ] Interface, union member and per-type validation in `scene.ts`, defects reported in a fixed order.
- [ ] Type-only export in `index.ts`. `property-37` untouched and passing.
- [ ] Every "if A else B" over constraint types in `bake.ts` is now an exhaustive `switch` with a `never` default.
- [ ] Hand-computed tests, property tests, a source-text structure test, a defensive-branch test.
- [ ] `tsc` run once. It finds shapes the tests cannot, such as the `property-42` case above.
- [ ] Mutation check: each property has a named source line that, when broken, makes it fail.
- [ ] `git diff --stat` shows only the files the spec names, and `package.json` is unchanged.
- [ ] Flag file deleted.

## Where to look

- The spec: `.kiro/specs/orbit-around/` (`requirements.md`, `design.md`, `tasks.md`).
- The code: `applyOrbitAround`, `checkOrbitAngle` and `unknownConstraintType` in `packages/pathkit/src/bake.ts`;
  `checkOrbitAround` and `checkConstraintOfType` in `packages/pathkit/src/scene.ts`.
- The tests: `packages/pathkit/test/bake/orbit-*.test.ts`, `packages/pathkit/test/scene/orbit-unit.test.ts`
  and `packages/pathkit/test/helpers/orbit-generators.ts`.
- How Kiro and the other tools were used, including the independent reviewer: `.kiro/docs/kiro-log.md`.
- Hook and guard behaviour, tested on Windows: `.kiro/docs/hooks-notes.md`.
