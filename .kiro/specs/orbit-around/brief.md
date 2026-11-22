# orbitAround: design input for the spec

This file is the full design input for the new spec `orbit-around`. The author has
already decided everything below. Do not ask questions that this file answers. If
something is missing or contradicts the code, ask once, in a single message, before
you write anything.

## 1. Goal

Add a third constraint, `orbitAround`, to the frozen core in `packages/pathkit`. An
entity moves on an exact circle around a centre point. It sets position only.
Facing stays the job of `aimAt`.

A second purpose: the real steps of adding this constraint become the evidence for
a guide, `docs/adding-a-constraint.md`. That guide is written later by the author,
from what actually happened. It is not part of this spec.

## 2. What to produce

- A new spec in `.kiro/specs/orbit-around/`: `requirements.md`, then `design.md`,
  then `tasks.md`, in the same style as `.kiro/specs/path-core/` (glossary, numbered
  acceptance criteria, numbered correctness properties, tasks that point at the
  properties they check).
- Do not change anything in `.kiro/specs/path-core/`.
- Do not change anything under `packages/` while creating the spec.
- Write `requirements.md` first and stop for review. Write `design.md` only after
  approval, then `tasks.md` only after approval.

## 3. The constraint

```ts
export interface OrbitAroundConstraint {
  type: 'orbitAround';
  order: number;       // run order in the stack, as for the other constraints
  influence: number;   // 0 to 1, as for the other constraints
  target: string;      // the centre: a named target, exactly like aimAt (static or keyframed)
  radius: number;      // distance from the centre, 0 or more
  axis: AxisToken;     // the line it circles around, one of +X -X +Y -Y +Z -Z (existing type)
  speed: number;       // degrees per second; negative turns the other way
  startAngle: number;  // degrees at frame 0
}
```

`Constraint` becomes `FollowPathConstraint | AimAtConstraint | OrbitAroundConstraint`.

## 4. The maths

Each frame:

- `angle = startAngle + speed * frame / fps` (degrees; convert to radians for cos and sin)
- `position = centre + radius * (cos(angle) * side1 + sin(angle) * side2)`
- `centre` is the target position at that frame. Reuse the existing target lookup
  (`targetPositionAt` in `bake.ts`), so keyframed centres work.
- The result is blended into the stack by `influence`, position only. The existing
  helper `blendCandidate(work, influence, false)` does exactly this for followPath
  with rotation off.

Side vectors, chosen so that `side1 x side2 = axis` (right-hand rule):

| Axis | side1 | side2 |
| --- | --- | --- |
| +X | +Y | +Z |
| -X | +Z | +Y |
| +Y | +Z | +X |
| -Y | +X | +Z |
| +Z | +X | +Y |
| -Z | +Y | +X |

Hand-computed examples for the tests (centre at the origin):

- axis +Y, radius 5, angle 0: (0, 0, 5). Angle 90: (5, 0, 0).
- axis +X, radius 2, angle 90: (0, 0, 2).
- axis +Z, radius 3, angle 90: (0, 3, 0).

Derive the other axes from the table and hand-compute them in the tests.

## 5. Behaviour rules

- Position only. `orbitAround` never changes the rotation.
- Order: `aimAt` reads the entity position when it runs, so `orbitAround` needs a
  lower `order` than the `aimAt` that should face the centre. State this in the
  design. The same trap already exists for `followPath` then `aimAt`.
- Radius 0 puts the entity on the centre. Negative speed reverses the direction.
- `orbitAround` does not touch `travelled`, `heldFromFrame` or `aimDirections`.
  Only `followPath` and `aimAt` write those, as today.
- `orbitAround` drives no rotation, so rotation-driver counting does not count it.
- A scene still needs a valid path even if no entity follows it, because `bake`
  always builds the curve.
- Reuse the work buffers; do not allocate per frame in the new code.
- No mention of cameras anywhere in `src`.
- `src/linter.ts` should need no change (it reads baked output and names no
  constraint). Prove this with a test instead of assuming it: read `linter.ts`, then
  test what the linter reports for a very fast orbit and for a gentle one.

## 6. Validation (`validateScene` in `scene.ts`)

Inside the existing per-constraint check (step 6: influence, then order, then target),
for an `orbitAround`: unknown target, then axis, then radius, then speed, then
startAngle. First defect wins, as today. All errors are `SceneError`. Messages follow
the existing style, for example:

- `Entity "<id>": unknown target "<name>"` (same wording as aimAt)
- `Entity "<id>": orbitAround axis "<value>" is not an axis token (use +X, -X, +Y, -Y, +Z or -Z)`
- `Entity "<id>": orbitAround radius must be a finite number of 0 or more, got <value>`
- `Entity "<id>": orbitAround speed must be a finite number, got <value>`
- `Entity "<id>": orbitAround startAngle must be a finite number, got <value>`

Also add a check that a constraint whose `type` is not one of the three known types is
rejected with a `SceneError` (see section 7).

## 7. The trap: a new type must not silently run as followPath

In `bake.ts`, `bakeEntity` currently does "if the constraint is aimAt, do that;
otherwise treat it as followPath". A third type would be run as followPath without any
error. `vitest` does not type-check, and the repo has no TypeScript dependency on
purpose, so only a type check (run later by the reviewer) would catch it. The same
shape appears in `drivesRotation`.

The spec must make this its own requirement and its own task:

- `bakeEntity` dispatches explicitly on each of the three types, with a final branch
  that throws an `Error` naming the unknown type.
- `drivesRotation` is explicit per type and also throws for an unknown type.
- A test per type proves each type runs its own code, and a test proves an unknown
  type is rejected.

## 8. Expected code changes

- `src/scene.ts`: the new interface, the `Constraint` union, the validation.
- `src/bake.ts`: a type guard, `applyOrbitAround`, explicit dispatch in `bakeEntity`,
  explicit `drivesRotation`.
- `src/index.ts`: one new `export type { OrbitAroundConstraint }`.
- New tests only. The 348 existing tests must pass unchanged. Do not edit existing
  test files. `test/bake/property-37.test.ts` pins the runtime export names; a type
  export does not change them, so it should pass untouched. If it does not, stop and
  report.

## 9. Tests to require

Every test uses an oracle that does not read the code under test: expected values come
from the scene numbers or from hand calculation, not from calling the baker's own maths.
Follow `.kiro/steering/testing-conventions.md`.

1. Distance from the centre equals `radius` at every frame.
2. The offset from the centre is perpendicular to the axis at every frame.
3. Hand-computed positions at known angles for all six axes.
4. Direction: the sign of `speed` gives the turning direction by the right-hand rule,
   checked with a cross product against the axis.
5. Steady speed: the angle between consecutive frames equals `speed / fps`.
6. A full lap returns to the start position.
7. Keyframed centre: the offset from the centre is unchanged while the centre moves.
8. Influence 0 leaves the rest pose. Influence 1 gives the full orbit. Influence 0.5
   after another position constraint gives the midpoint.
9. With an `aimAt` at a higher `order`, the baked aim direction points at the centre
   every frame.
10. Rotation stays the identity when no other rotation-driving constraint exists, and
    rotation-driver counting ignores `orbitAround`.
11. Each validation error, with its message, in the order of section 6.
12. The scene is not modified, and baking twice gives identical output.
13. The dispatch tests of section 7.
14. The linter behaviour of section 5.

File names (the old numbering would collide with the path-core property numbers):
`test/bake/orbit-unit.test.ts`, `test/bake/orbit-property-<N>.test.ts` (N counts from
1 inside this spec), `test/scene/orbit-unit.test.ts`. Name the properties "Property O1",
"Property O2" and so on in `design.md`.

## 10. Rules for `tasks.md`

Copy the Execution Rules of `.kiro/specs/path-core/tasks.md` that still apply
(property-test rules, no frozen typed arrays, at most 3 fix attempts, one task at a
time), and replace the terminal rules with these:

- Kiro cannot run terminal commands (a project hook blocks them). After a task that
  changes code, ask the user to run `npm.cmd test` from `packages/pathkit` and paste
  the output. Do not mark the task done until the pasted output shows the results.
- The frozen core is locked by a hook. The user unlocks it for the whole spec. If a
  write under `packages/pathkit/src` or `packages/pathkit/test` is blocked, stop and
  tell the user. Never look for another way.
- Change only the files a task names.
- Do not mark test tasks optional.
- Include a checkpoint task after each group of tasks that asks the user for the full
  `npm.cmd test` output.
- The last task asks the user for the full test output and reports the totals. It
  states that the reviewer will run a type check, which Kiro cannot.

## 11. Not in this spec

`docs/adding-a-constraint.md`, any `spin` constraint, arbitrary axis vectors, any
app code, README changes.
