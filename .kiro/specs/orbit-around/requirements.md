# Requirements Document

## Introduction

orbit-around adds a third constraint, `orbitAround`, to the frozen core in `packages/pathkit`. An Entity with an `orbitAround` constraint moves on an exact circle around a centre point. The constraint sets position only. Facing stays the job of `aimAt`.

The change touches four source files: `src/scene.ts` (the new constraint interface, the `Constraint` union and the validation), `src/bake.ts` (the new constraint step and explicit dispatch on the constraint type), `src/index.ts` (one new type export) and `src/linter.ts`, which is expected to need no change. That expectation is checked by tests, not assumed. Every other source file stays as it is.

Today `bakeEntity` and `drivesRotation` in `src/bake.ts` treat every constraint that is not `aimAt` as `followPath`. A third constraint type would therefore run as `followPath` without any error. Requirement 5 closes that gap and is a requirement in its own right.

All code follows the project steering files `coordinate-conventions.md` (Y-up right-handed coordinates, metres, radians internally, integer frames at a fixed fps, pure core functions, no per-frame allocation in the evaluation path) and `testing-conventions.md`. Degrees appear only in the `orbitAround` input fields.

The path-core spec in `.kiro/specs/path-core/` is not changed. The 348 existing tests pass unchanged. The only edit to an existing test file is the type-only change to `test/linter/property-42.test.ts` named in Requirement 7.7.

Out of scope: the guide `docs/adding-a-constraint.md`, any `spin` constraint, arbitrary axis vectors, any app code and any README change.

## Glossary

- **Path_Core**: The library under `packages/pathkit`.
- **Vec3**: A three-component vector of numbers (x, y, z).
- **Quaternion**: A four-component unit rotation (x, y, z, w).
- **Scene**: The input description with fps, frameCount, path, named targets and entities, defined in `src/scene.ts`.
- **Path**: A Scene field with `points` (Vec3 list) and `closed` (boolean).
- **Target**: A named point or a named set of keyframed positions in a Scene.
- **Entity**: An object in a Scene with `id`, `forwardAxis`, `upAxis` and an ordered list of constraints.
- **Axis_Token**: One of `+X`, `-X`, `+Y`, `-Y`, `+Z`, `-Z`.
- **Constraint**: An item on an Entity with an influence in [0,1] and an order. Types are `followPath`, `aimAt` and `orbitAround`.
- **Constraint_Type**: The value of the `type` field of a Constraint. The known Constraint_Types are `followPath`, `aimAt` and `orbitAround`.
- **Constraint_Dispatch**: The code in `bakeEntity` and `drivesRotation` that selects the code to run for a Constraint according to its Constraint_Type.
- **Unknown_Type**: A Constraint_Type value that is none of `followPath`, `aimAt` and `orbitAround`.
- **OrbitAround_Constraint**: A Constraint of type `orbitAround` with the fields `type`, `order`, `influence`, `target` (a Target name), `radius` (metres, 0 or more), `axis` (an Axis_Token), `speed` (degrees per second, negative turns the other way) and `startAngle` (degrees at frame 0).
- **Orbit_Centre**: The position of the Target named by an OrbitAround_Constraint at a given frame, found with the existing target lookup (`targetPositionAt` in `src/bake.ts`).
- **Orbit_Angle**: The angle in degrees at a frame, equal to `startAngle + speed * frame / fps`.
- **Side_Vectors**: The ordered pair (side1, side2) of unit vectors perpendicular to the OrbitAround_Constraint axis, chosen so that side1 x side2 equals the axis unit vector (right-hand rule). The table is: `+X`: (+Y, +Z); `-X`: (+Z, +Y); `+Y`: (+Z, +X); `-Y`: (+X, +Z); `+Z`: (+X, +Y); `-Z`: (+Y, +X).
- **Orbit_Position**: The position `Orbit_Centre + radius * (cos(Orbit_Angle) * side1 + sin(Orbit_Angle) * side2)`, with Orbit_Angle converted to radians for cos and sin.
- **Scene_Validator**: The `validateScene` function in `src/scene.ts`.
- **Scene_Error**: The `SceneError` class that the Scene_Validator throws.
- **Baker**: The `bake(scene)` function.
- **Baked_Data**: The result of `bake`, holding per-frame position and rotation for every Entity, plus `travelled`, `heldFromFrame`, `rotationDrivers` and `aimDirections`.
- **Entity_Work**: The preallocated working buffers that the Baker reuses for every frame of one Entity.
- **Rotation_Driver**: A Constraint that can change an Entity's rotation: an `aimAt`, or a `followPath` with `alignToPath` true.
- **Linter**: The `motionLinter(scene, baked)` function in `src/linter.ts`.
- **Finding**: A Linter result with `frame`, `entityId`, `severity`, `code` and `message`.
- **Rest_Pose**: Position at the origin (0, 0, 0) and the identity rotation.
- **Export_Test**: The existing test `test/bake/property-37.test.ts`, which pins the runtime export names of `src/index.ts`.
- **Test_Oracle**: The source of an expected value in a test. A valid Test_Oracle is a number taken from the Scene or a hand-calculated value. Calling the Baker's own maths is not a valid Test_Oracle.

## Requirements

### Requirement 1: Constraint type and public surface

**User Story:** As a library user, I want a typed `orbitAround` constraint exported from the package entry point, so that I can describe an orbit in a Scene with full type checking.

#### Acceptance Criteria

1. THE Path_Core SHALL define an `OrbitAroundConstraint` interface in `src/scene.ts` with the fields `type` (the literal `'orbitAround'`), `order` (number), `influence` (number), `target` (string), `radius` (number, metres), `axis` (Axis_Token), `speed` (number, degrees per second) and `startAngle` (number, degrees at frame 0).
2. THE Path_Core SHALL define the `Constraint` union as `FollowPathConstraint | AimAtConstraint | OrbitAroundConstraint`.
3. THE Path_Core SHALL export `OrbitAroundConstraint` as a type from `src/index.ts` with one added `export type` name, and SHALL add no other export name to `src/index.ts`.
4. THE Path_Core SHALL leave the set of runtime export names of `src/index.ts` identical to the set before this change.
5. WHEN the Export_Test runs without any edit to the Export_Test, THE Export_Test SHALL pass.
6. IF the Export_Test fails, THEN the work SHALL stop, no edit to the Export_Test SHALL be made to make it pass, and the failure SHALL be reported to the user with the failing test name and the output of the failure.

### Requirement 2: Orbit position

**User Story:** As an animator, I want an Entity to move on an exact circle around a centre, so that I can orbit an object around a point without hand-keying positions.

#### Acceptance Criteria

1. WHEN the Baker bakes an OrbitAround_Constraint at an integer frame, THE Baker SHALL compute the Orbit_Angle as `startAngle + speed * frame / fps` in degrees.
2. WHEN the Baker evaluates cosine and sine for an Orbit_Angle, THE Baker SHALL convert the Orbit_Angle from degrees to radians at that point only and at no earlier step.
3. WHEN the Baker bakes an OrbitAround_Constraint at an integer frame, THE Baker SHALL compute the candidate position as the Orbit_Position of that frame.
4. WHEN the Baker bakes an OrbitAround_Constraint, THE Baker SHALL select the Side_Vectors from the axis of the OrbitAround_Constraint according to the table in the Glossary (`+X`: (+Y, +Z); `-X`: (+Z, +Y); `+Y`: (+Z, +X); `-Y`: (+X, +Z); `+Z`: (+X, +Y); `-Z`: (+Y, +X); side1 x side2 equals the axis).
5. WHEN the Baker bakes an OrbitAround_Constraint at an integer frame, THE Baker SHALL obtain the Orbit_Centre of that frame through the existing target lookup, so that a static Target and a keyframed Target both work.
6. WHEN an OrbitAround_Constraint has radius 0, THE Baker SHALL place the candidate position on the Orbit_Centre of the same frame at every frame.
7. WHEN an OrbitAround_Constraint has a negative speed, THE Baker SHALL turn the Entity in the direction opposite to the direction of the same constraint with the positive speed of the same magnitude.
8. WHEN the Orbit_Centre is the origin, the axis is `+Y`, the radius is 5 and the Orbit_Angle is 0 degrees, THE Baker SHALL produce the position (0, 0, 5).
9. WHEN the Orbit_Centre is the origin, the axis is `+Y`, the radius is 5 and the Orbit_Angle is 90 degrees, THE Baker SHALL produce the position (5, 0, 0).
10. WHEN the Orbit_Centre is the origin, the axis is `+X`, the radius is 2 and the Orbit_Angle is 90 degrees, THE Baker SHALL produce the position (0, 0, 2).
11. WHEN the Orbit_Centre is the origin, the axis is `+Z`, the radius is 3 and the Orbit_Angle is 90 degrees, THE Baker SHALL produce the position (0, 3, 0).
12. WHEN the Baker bakes an OrbitAround_Constraint with any of the six Axis_Tokens at the Orbit_Angles 0 and 90 degrees, THE Baker SHALL produce the positions that follow from the Side_Vectors table (hand-computed in the tests).
13. WHEN the Baker bakes an OrbitAround_Constraint with influence 1 and a static Orbit_Centre, THE Baker SHALL produce at every frame a position whose distance from the Orbit_Centre equals the radius, within floating-point tolerance.
14. WHEN the Baker bakes an OrbitAround_Constraint with influence 1, THE Baker SHALL produce at every frame a position whose offset from the Orbit_Centre is perpendicular to the axis vector, within floating-point tolerance.
15. WHEN the Baker bakes an OrbitAround_Constraint with influence 1, radius above 0 and an absolute value of `speed / fps` below 180 degrees per frame, THE Baker SHALL produce for every pair of consecutive frames positions whose offsets from the Orbit_Centre differ by an angle, measured about the axis, equal to `speed / fps` degrees, within floating-point tolerance.
16. WHEN `speed * N / fps` equals 360 for an integer frame N inside the frame range, THE Baker SHALL produce at frame N the position it produced at frame 0, within floating-point tolerance.
17. WHEN the Baker bakes an OrbitAround_Constraint with influence 1, radius above 0, a `speed` that is not zero and an absolute value of `speed / fps` below 180 degrees per frame, THE Baker SHALL produce for every pair of consecutive frames f and f+1 positions whose offsets from the Orbit_Centre have a cross product (offset at frame f x offset at frame f+1) pointing in the same direction as the axis vector (right-hand rule) when the speed is positive, and in the opposite direction when the speed is negative.
18. WHILE the Orbit_Centre moves because its Target is keyframed, THE Baker SHALL keep the offset between the baked position and the Orbit_Centre of the same frame equal to the offset computed from the Scene numbers, within floating-point tolerance.
19. IF the Orbit_Angle at a frame is not finite, THEN THE Baker SHALL throw a Scene_Error with the message `Entity "<id>": orbitAround angle at frame <f> must be a finite number, got <value>`.

### Requirement 3: Behaviour in the constraint stack

**User Story:** As an animator, I want `orbitAround` to combine predictably with `followPath` and `aimAt`, so that I can build motion from several constraints and know which one decides what.

#### Acceptance Criteria

1. WHEN the Baker bakes an OrbitAround_Constraint, THE Baker SHALL blend the candidate position into the stack by the influence of the constraint and leave the stack rotation unchanged.
2. WHEN an OrbitAround_Constraint has influence 0 and no earlier constraint changes the position, THE Baker SHALL leave the Entity at the Rest_Pose position (0, 0, 0).
3. WHEN an OrbitAround_Constraint has influence 0 and an earlier constraint has set the position, THE Baker SHALL leave that earlier position unchanged.
4. WHEN an OrbitAround_Constraint has influence 1, THE Baker SHALL produce the full Orbit_Position.
5. WHEN an OrbitAround_Constraint has influence 0.5 and runs after another constraint that sets the position, THE Baker SHALL produce the midpoint between the position from the stack and the Orbit_Position.
6. WHEN the Baker bakes an Entity, THE Baker SHALL run the constraints of the Entity in ascending `order`.
7. WHEN an `aimAt` constraint has a higher `order` than an OrbitAround_Constraint on the same Entity, THE Baker SHALL run the `aimAt` after the OrbitAround_Constraint, so that the `aimAt` reads the Entity position produced by the OrbitAround_Constraint. Consequently, a Scene author who wants an `aimAt` to face the Orbit_Centre gives that `aimAt` a higher `order` than the OrbitAround_Constraint. The same rule applies to a `followPath` followed by an `aimAt`.
8. WHEN an `aimAt` that names the Orbit_Centre Target has a higher `order` than an OrbitAround_Constraint with influence 1 and radius above 0, THE Baker SHALL store at every frame an aim direction equal to the unit vector from the baked Entity position to the Orbit_Centre.
9. THE Baker SHALL leave the Baked_Data fields `travelled`, `heldFromFrame` and `aimDirections` unchanged by an OrbitAround_Constraint. Only `followPath` writes `travelled` and `heldFromFrame`, and only `aimAt` writes `aimDirections`.
10. WHEN an Entity has an OrbitAround_Constraint and no other Rotation_Driver, THE Baker SHALL produce the identity rotation at every frame.
11. THE Baker SHALL leave the `rotationDrivers` count of an Entity unchanged by an OrbitAround_Constraint, because an OrbitAround_Constraint drives no rotation.
12. WHEN a Scene has a valid Path and no Entity that follows the Path, THE Scene_Validator SHALL accept the Scene, because the Baker always builds the curve.
13. WHEN two constraints on one Entity have equal `order`, THE Baker SHALL run them in their list order in the constraint list of the Entity, because the Baker sorts a copy of the constraints (`sortedCopy`) with a stable sort.

### Requirement 4: Validation of orbitAround

**User Story:** As a library user, I want a clear error when an `orbitAround` constraint is malformed, so that I find the defect before baking.

#### Acceptance Criteria

1. WHEN the Scene_Validator checks a constraint of type `orbitAround`, THE Scene_Validator SHALL check the OrbitAround_Constraint inside the existing per-constraint check, after the influence check and the order check.
2. WHEN the Scene_Validator checks an OrbitAround_Constraint, THE Scene_Validator SHALL test the target first, then the axis, then the radius, then the speed, then the startAngle, and SHALL report the first defect found.
3. IF the `target` of an OrbitAround_Constraint is not a name in the Scene targets, THEN THE Scene_Validator SHALL throw a Scene_Error with the message `Entity "<id>": unknown target "<name>"`, the same wording as for `aimAt`.
4. IF the `axis` of an OrbitAround_Constraint is not an Axis_Token, THEN THE Scene_Validator SHALL throw a Scene_Error with the message `Entity "<id>": orbitAround axis "<value>" is not an axis token (use +X, -X, +Y, -Y, +Z or -Z)`.
5. IF the `radius` of an OrbitAround_Constraint is NaN, Infinity, -Infinity, any other non-finite value, any value that is not a number, or a negative number, THEN THE Scene_Validator SHALL throw a Scene_Error with the message `Entity "<id>": orbitAround radius must be a finite number of 0 or more, got <value>`.
6. IF the `speed` of an OrbitAround_Constraint is NaN, Infinity, -Infinity, or any value that is not a number, THEN THE Scene_Validator SHALL throw a Scene_Error with the message `Entity "<id>": orbitAround speed must be a finite number, got <value>`.
7. IF the `startAngle` of an OrbitAround_Constraint is NaN, Infinity, -Infinity, or any value that is not a number, THEN THE Scene_Validator SHALL throw a Scene_Error with the message `Entity "<id>": orbitAround startAngle must be a finite number, got <value>`.
8. IF an OrbitAround_Constraint has two or more defects, THEN THE Scene_Validator SHALL throw only the Scene_Error of the defect that comes first in the order target, axis, radius, speed, startAngle.
9. WHEN an OrbitAround_Constraint has radius 0 and no other defect, THE Scene_Validator SHALL accept the constraint without throwing.
10. WHEN the Scene_Validator is given a valid Scene or an invalid Scene, THE Scene_Validator SHALL leave the Scene unmodified, so that the Scene is deeply equal to a copy taken before validation.
11. IF a Scene contains an invalid OrbitAround_Constraint, THEN THE Baker SHALL reject the Scene on a call to `bake` with the same Scene_Error that the Scene_Validator throws, because `bake` validates first.

### Requirement 5: Explicit dispatch on constraint type

**User Story:** As a maintainer, I want every constraint type to run its own code and an unknown type to fail loudly, so that a new type can never silently run as `followPath`.

#### Acceptance Criteria

1. THE Constraint_Dispatch in `bakeEntity` SHALL branch explicitly on each of the three Constraint_Types `followPath`, `aimAt` and `orbitAround`.
2. IF `bakeEntity` meets an Unknown_Type, THEN THE Baker SHALL throw an `Error` with the message `Unknown constraint type "<value>"`, built by the shared helper `unknownConstraintType`, which both defensive branches use and which builds this one message.
3. THE Constraint_Dispatch in `drivesRotation` SHALL decide explicitly for each of the three Constraint_Types: `aimAt` drives rotation, `followPath` drives rotation when `alignToPath` is true, and `orbitAround` does not.
4. IF `drivesRotation` meets an Unknown_Type, THEN THE Baker SHALL throw an `Error` with the same message `Unknown constraint type "<value>"`, built through the shared helper `unknownConstraintType`.
5. IF a Scene contains a Constraint of an Unknown_Type, THEN THE Scene_Validator SHALL throw a Scene_Error with the message `Entity "<id>": unknown constraint type "<value>" (use followPath, aimAt or orbitAround)`.
6. THE Scene_Validator SHALL check the Constraint_Type inside the per-constraint check, after the influence check and the order check.
7. IF a Constraint has an Unknown_Type and also an invalid influence or an invalid order, THEN THE Scene_Validator SHALL report the influence error first, then the order error, and SHALL report the Unknown_Type error only when the influence and order checks both pass. The Scene_Validator SHALL throw exactly one Scene_Error per validation run.
8. IF a Scene contains a Constraint of an Unknown_Type, THEN THE Baker SHALL reject the Scene by throwing the Scene_Error from criterion 5 or from criterion 7, and SHALL NOT produce Baked_Data.
9. THE `sceneNeedsFrames` function in `src/bake.ts` SHALL NOT count an OrbitAround_Constraint as a constraint that needs path frames, so that THE Baker builds the path frames only for a `followPath` with `alignToPath` true. The three places that branch on Constraint_Type are `bakeEntity`, `drivesRotation` and `sceneNeedsFrames`.
10. THE test suite SHALL contain, for each of the three Constraint_Types, a test that proves the constraint runs its own code. The test SHALL show a result that only that type can produce: a position on the path for `followPath`, a stored aim direction for `aimAt` and a position on the circle for `orbitAround`.
11. THE test suite SHALL contain a test that proves `bake` rejects a Scene that contains an Unknown_Type.
12. THE Path_Core SHALL keep the Unknown_Type branches in `bakeEntity` and `drivesRotation` as defensive branches, because `bake` validates the Scene before baking and a normal Scene cannot reach them. The message SHALL be tested through `bakeEntity`, with `validateScene` mocked by `vi.mock` in a separate test file, which needs no new export from any source file. The `drivesRotation` branch cannot be reached through `bake()`, so it SHALL be verified by a source-text check and by the reviewer's type check.

### Requirement 6: Linter behaviour

**User Story:** As a library user, I want to know what the motion linter reports for an orbit, so that I can trust its findings and know that it needs no change.

#### Acceptance Criteria

1. THE Linter SHALL read Baked_Data and the Scene without any reference to a Constraint_Type, and `src/linter.ts` SHALL stay unchanged by this spec.
2. THE test suite SHALL contain a test that bakes a Scene with a single Entity, a static Orbit_Centre, radius above 0, influence 1 and a very fast `orbitAround` (at least 90 degrees per frame, and not an exact multiple of 360 degrees per frame), runs the Linter and checks the Findings it returns.
3. THE test suite SHALL contain a test that bakes the same Scene with a gentle `orbitAround` (at most 1 degree per frame), runs the Linter and checks the Findings it returns.
4. WHEN the Linter runs on the Scene of either test, and that Scene has a path for the Entity but no `followPath` and no `aimAt`, THE Linter SHALL report no `path-end-reached`, `rotation-conflict`, `aim-vertical` or `roll-change` Finding, because `heldFromFrame` is -1 (used by `path-end-reached`), `rotationDrivers` is 0 (`rotation-conflict` needs at least 2), `aimDirections` is all zero (used by `aim-vertical`) and the rotation is the identity (`roll-change` reads rotation only, so its value is 0).
5. WHEN the Linter runs on the Scene of either test, and that Scene has a static Orbit_Centre, THE Linter SHALL report no `speed-spike` Finding, because the chord length between consecutive frames is equal at every frame, so no chord speed (chord length times fps) exceeds 3 times the median speed.
6. IF a Finding in the two tests cannot be justified by reading `src/linter.ts`, THEN the test SHALL record the Findings it observes and `design.md` SHALL decide what the expected result is.
7. IF either of the two tests shows that the Linter needs a change, THEN the work SHALL stop and the result SHALL be reported before any change to `src/linter.ts`.

### Requirement 7: Project constraints and non-regression

**User Story:** As the owner of the frozen core, I want the change to stay inside the project rules, so that nothing already working is broken.

#### Acceptance Criteria

1. THE Baker SHALL leave the Scene passed to `bake` unmodified, and the Scene passed to `validateScene` unmodified. A deep comparison of the Scene before and after each call finds no difference.
2. WHEN `bake` is called twice with the same Scene, THE Baker SHALL return Baked_Data whose values are identical both times, compared element by element with exact equality.
3. THE Baker SHALL, in the new code in `src/bake.ts`, write per-frame working values into the Entity_Work buffers and allocate no object, array, closure or vector per frame. The Entity_Work buffers are the existing preallocated working values that the Baker reuses for every frame of one Entity. Allocation is allowed in setup code outside the per-frame loop.
4. THE source files under `packages/pathkit/src` SHALL contain no mention of cameras, in identifiers, types, comments or error messages. A case-insensitive search of those files for "camera" returns no match.
5. THE Path_Core SHALL add no runtime dependency and no dev dependency. The `dependencies` and `devDependencies` entries of `packages/pathkit/package.json` are unchanged by the work.
6. THE Path_Core change to `packages/pathkit/src` SHALL modify only `scene.ts`, `bake.ts` and `index.ts`. Every other file under `packages/pathkit/src` is byte-identical before and after the work.
7. WHEN `npm.cmd test` is run from `packages/pathkit` after the change, THE Path_Core test suite SHALL pass all 348 existing tests with 0 failed, and with no edit to any existing test file, except one type-only edit to `test/linter/property-42.test.ts` (task 3.11 in `tasks.md`) that narrows its `alignToPath` checks to `followPath` constraints, keeps every assertion, label, run count and generator, and leaves the number of tests in that file unchanged.
8. THE Path_Core SHALL use Y-up right-handed coordinates, metres for distances and radians internally. Degrees SHALL appear only in the `speed` and `startAngle` fields of the OrbitAround_Constraint, and the conversion from degrees to radians SHALL happen at the point where `cos` and `sin` are computed (see Requirement 2).
9. WHEN the work is complete, THE repository files under `.kiro/specs/path-core/` SHALL be byte-identical to their content before the work began.

### Requirement 8: Verification

**User Story:** As a reviewer, I want the tests to check the orbit against independent values, so that a wrong implementation cannot pass by agreeing with itself.

#### Acceptance Criteria

1. THE test suite SHALL use only a valid Test_Oracle for every expected value: a number from the Scene or a hand calculation. No test SHALL call the Baker's own maths to produce an expected value.
2. THE test suite SHALL follow `.kiro/steering/testing-conventions.md`, including the rules stated in criteria 19 to 21.
3. THE test suite SHALL place the new tests in `test/bake/orbit-unit.test.ts`, `test/bake/orbit-property-<N>.test.ts` (N counts from 1 inside this spec), `test/scene/orbit-unit.test.ts` and `test/bake/orbit-defensive.test.ts`, and SHALL place shared generators in the helper `test/helpers/orbit-generators.ts`.
4. THE test suite SHALL check that the distance from the Orbit_Centre equals the radius at every frame.
5. THE test suite SHALL check that the offset from the Orbit_Centre is perpendicular to the axis at every frame.
6. THE test suite SHALL check hand-computed positions at known Orbit_Angles for all six Axis_Tokens, with one test case per Axis_Token.
7. WHERE `speed` is not zero and the absolute value of `speed / fps` is below 180 degrees per frame, THE test suite SHALL check the turning direction given by the sign of `speed`, with a cross product against the axis (right-hand rule), for both a positive `speed` and a negative `speed`.
8. WHERE the absolute value of `speed / fps` is below 180 degrees per frame, THE test suite SHALL check that the angle between consecutive frames equals `speed / fps` for every pair of consecutive frames.
9. THE test suite SHALL check that a full lap (a total turn of exactly 360 degrees) returns to the start position.
10. THE test suite SHALL check that the offset from the Orbit_Centre is unchanged at every frame while a keyframed Orbit_Centre moves.
11. THE test suite SHALL check three cases: influence 0 (the pose from earlier constraints stays), influence 1 (the full orbit) and influence 0.5 after another position constraint (the midpoint of the two positions).
12. THE test suite SHALL check that an `aimAt` with a higher `order` stores an aim direction that points at the Orbit_Centre at every frame.
13. THE test suite SHALL check that the rotation stays the identity when no other Rotation_Driver exists, and that the `rotationDrivers` count ignores the OrbitAround_Constraint.
14. THE test suite SHALL check each validation error of Requirement 4 by asserting the exact message string, passing a SceneError instance to `toThrow`, and SHALL check the order of the checks with an input that breaks two rules at once.
15. THE test suite SHALL check that the Scene is not modified (a copy of its contents taken before baking equals its contents after baking) and that baking twice gives identical output.
16. THE test suite SHALL contain the dispatch tests of Requirement 5, asserting each Requirement 5 message as the exact string.
17. THE test suite SHALL contain the Linter tests of Requirement 6.
18. WHEN a new test file takes more than 5 seconds to run on the user's machine, THE test suite SHALL treat that as a defect to report and to fix before work continues.
19. WHILE a test checks a value inside a per-frame loop, THE test suite SHALL use a plain comparison that throws an Error with a descriptive message naming the frame and the values compared, and SHALL use `expect` only for checks made once per run.
20. WHERE a property test generates random geometry or scalar inputs, THE test suite SHALL generate them with `fc.integer` mapped onto the required range, and SHALL NOT use `fc.double` for those inputs.
21. THE test suite SHALL force each of these special cases in at least one test, in addition to the random inputs: radius 0, startAngle 0, a turn of exactly 90 degrees, a turn of exactly 360 degrees, the first frame and the last frame.
22. THE test suite SHALL contain a test for the equal-`order` rule of Requirement 3 criterion 13, using two position-setting constraints with equal `order` whose result depends on which one runs first (for example an OrbitAround_Constraint with influence 0.5 and a second position-setting constraint), run in both list orders, with a different expected position for each list order computed by hand.
23. THE test suite SHALL contain a test for Requirement 5 criterion 9: a Scene whose only constraint is an OrbitAround_Constraint bakes correctly, and a Scene that mixes an OrbitAround_Constraint with a `followPath` with `alignToPath` true still bakes the aligned rotation.
24. THE test suite SHALL create each Unknown_Type constraint with a cast such as `as unknown as Constraint`, in the same way the existing tests build invalid Axis_Tokens.
25. THE test suite SHALL contain a test that an OrbitAround_Constraint with the `radius` given as the string "5" (a value that is not of number type) is rejected with the exact radius message of Requirement 4 criterion 5, with the got value shown as it appears in the message template.
26. THE test suite SHALL contain a test with a finite but huge `speed` (such as 1e308), whose Orbit_Angle overflows to a non-finite value, asserting the exact message of Requirement 2 criterion 19 and passing a SceneError instance to `toThrow`.
