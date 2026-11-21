# Requirements Document

## Introduction

path-core is a TypeScript library in `packages/pathkit` (Node 24, ESM, strict mode). It moves generic entities along 3D paths and orients them. An entity is anything with a position and a rotation. The library provides math helpers, a centripetal Catmull-Rom curve, arc-length parameterisation, rotation-minimizing frames, a scene description with ordered constraints (`followPath`, `aimAt`), a `bake` step, an allocation-free `evaluateEntity`, and a motion linter. The library contains no rendering code and no runtime dependencies. Its only dev dependencies are `vitest` and `fast-check`.

All code follows the project steering file `coordinate-conventions.md`: Y-up right-handed coordinates, metres, radians internally, integer frames at a fixed fps, pure core functions, and no per-frame allocation in the evaluation path.

## Glossary

- **Path_Core**: The library under `packages/pathkit`.
- **Math_Module**: `src/math.ts`, containing Vec3 and Quaternion helpers.
- **Vec3**: A three-component vector of numbers (x, y, z).
- **Quaternion**: A four-component unit rotation (x, y, z, w).
- **Curve**: The 3D centripetal Catmull-Rom curve in `src/curve.ts`, parameterised by t in [0,1] over the whole curve.
- **Arc_Length_Table**: The lookup table in `src/arclength.ts` mapping distance to curve parameter. It holds at most 1024 entries.
- **Frame_Builder**: The functions in `src/frames.ts`.
- **Frame**: A record with position, tangent, normal and binormal.
- **RMF**: Rotation-minimizing frames computed by the double reflection method (Wang, Juttler, Zheng, Liu 2008).
- **Frenet_Frames**: Frames computed from the curve's derivative and normal-direction definition, provided for comparison with the RMF.
- **Scene**: The input description with fps, frameCount, path, named targets and entities, defined in `src/scene.ts`.
- **Path**: A Scene field with `points` (Vec3 list) and `closed` (boolean).
- **Target**: A named point or a named set of keyframed positions in a Scene.
- **Entity**: An object in a Scene with `id`, `forwardAxis`, `upAxis` and an ordered list of constraints.
- **Axis_Token**: One of `+X`, `-X`, `+Y`, `-Y`, `+Z`, `-Z`.
- **Constraint**: An item on an Entity with an influence in [0,1] and an order. Types are `followPath` and `aimAt`.
- **Scene_Validator**: The component that validates a Scene and its Entities.
- **Baker**: The `bake(scene)` function.
- **Baked_Data**: The result of `bake`, holding per-frame position and rotation for every Entity.
- **Evaluator**: The `evaluateEntity(baked, entityId, frame, out)` function.
- **Out_Buffer**: A caller-provided object that receives a position and a quaternion.
- **Linter**: The `motionLinter(scene, baked)` function.
- **Finding**: A Linter result with `frame`, `entityId`, `severity`, `code` and `message`.
- **Travelled_Distance**: Distance along the Path at a frame, equal to `startOffset + speed * frame / fps`, before clamping.
- **Held_Frame**: A frame on an open Path where Travelled_Distance is at or beyond the Path length.
- **Vertical_Threshold**: 3 degrees between the aim direction and the world up or down axis.
- **Smooth_Curve**: A Curve whose estimated minimum radius of curvature, measured on the Catmull-Rom curve built from its points, is at least 3 times the sampling step length/N.
- **Rest_Pose**: Position at the origin (0, 0, 0) and the identity rotation.

## Requirements

### Requirement 1: Vector and quaternion math

**User Story:** As a library developer, I want pure vector and quaternion helpers, so that every other module builds on one tested math layer.

#### Acceptance Criteria

1. THE Math_Module SHALL provide the Vec3 functions add, sub, scale, dot, cross, normalize, length and lerp.
2. THE Math_Module SHALL provide a Quaternion function that builds a Quaternion from three orthonormal basis vectors.
3. THE Math_Module SHALL provide a slerp function and a function returning the angle in radians between two Quaternions.
4. WHEN normalize receives a Vec3 of length below 1e-12, THE Math_Module SHALL return a zero Vec3.
5. WHEN slerp receives two Quaternions with a negative dot product, THE Math_Module SHALL interpolate along the shorter arc.
6. THE Math_Module SHALL leave every input argument unmodified.
7. WHERE a caller provides an output argument, THE Math_Module SHALL write the result into that argument and allocate no new object.

### Requirement 2: Catmull-Rom curve

**User Story:** As an animator, I want a smooth curve through my points, so that motion passes through each point without overshoot or cusps.

#### Acceptance Criteria

1. THE Curve SHALL be a 3D centripetal Catmull-Rom spline passing through every supplied point.
2. WHERE the Path is closed, THE Curve SHALL join the last point to the first point with continuous position and continuous tangent, unless the Curve reverses direction at the join (the arriving and leaving directions at the first point are opposite), in which case the join is a cusp and tangentAt SHALL return the chord direction.
3. WHERE the Path is open, THE Curve SHALL start at the first point and end at the last point.
4. WHEN pointAt receives t in [0,1], THE Curve SHALL return the position at parameter t over the whole curve.
5. WHEN tangentAt receives t in [0,1], THE Curve SHALL return a unit-length tangent at parameter t.
6. IF the Curve is created with fewer than 2 points, THEN THE Curve SHALL throw an error stating the required minimum and the supplied count. IF a closed Curve is created with exactly 2 points, THEN THE Curve SHALL throw an error stating that a closed curve needs at least 3 points and the supplied count.
7. IF two consecutive points are coincident, THEN THE Curve SHALL throw an error naming the indexes of both points.
8. WHEN t is outside [0,1], THE Curve SHALL clamp t for an open curve and wrap t for a closed curve.
9. WHERE the Curve is open, WHEN a second Curve is built from the same points in reversed order, THE Curve SHALL satisfy reversed.pointAt(1 - t) equal to original.pointAt(t) within 1e-6 for every t in [0,1].

### Requirement 3: Arc-length parameterisation

**User Story:** As an animator, I want to move at constant speed along the curve, so that distance in metres maps to a position.

#### Acceptance Criteria

1. THE Arc_Length_Table SHALL contain at most 1024 entries.
2. THE Arc_Length_Table SHALL expose the curve length in metres.
3. WHEN pointAtDistance receives a distance d, THE Arc_Length_Table SHALL return the position at distance d along the Curve.
4. WHEN tangentAtDistance receives a distance d, THE Arc_Length_Table SHALL return a unit-length tangent at distance d.
5. WHERE the Curve is open, THE Arc_Length_Table SHALL clamp d to [0, length].
6. WHERE the Curve is closed, THE Arc_Length_Table SHALL wrap d into [0, length).
7. WHERE the Curve is a Smooth_Curve, meaning the estimated minimum radius of curvature of the Catmull-Rom curve built from its points is at least 3 times length/N, WHEN positions are sampled at equal arc-length steps of length/N for N from 50 to 200, THE Arc_Length_Table SHALL return positions whose consecutive chord distances are each within 1 percent of length/N.
8. WHERE the caller provides an output Vec3, THE Arc_Length_Table SHALL write the result into it and allocate no new object during pointAtDistance and tangentAtDistance.

### Requirement 4: Frames along the curve

**User Story:** As an animator, I want a twist-free orientation along the path, so that an entity does not roll unexpectedly.

#### Acceptance Criteria

1. WHEN rotationMinimizingFrames receives a curve and a count, THE Frame_Builder SHALL return count Frames sampled at equal parameter spacing from t=0 to t=1.
2. THE Frame_Builder SHALL compute the RMF by the double reflection method.
3. WHERE initialUp is supplied, THE Frame_Builder SHALL choose the first Frame's normal as the component of initialUp perpendicular to the first tangent.
4. WHERE initialUp is omitted, THE Frame_Builder SHALL choose the first Frame's normal as the component of world up (+Y) perpendicular to the first tangent.
5. IF the first tangent is parallel to the chosen up vector, THEN THE Frame_Builder SHALL choose any unit vector perpendicular to the first tangent as the first normal.
6. THE Frame_Builder SHALL return Frames whose tangent, normal and binormal are mutually orthogonal unit vectors within 1e-6.
7. WHEN frenetFrames receives a curve and a count, THE Frame_Builder SHALL return count Frames using the Frenet definition.
8. IF count is less than 2 or not an integer, THEN THE Frame_Builder SHALL throw an error stating the supplied value.
9. IF a Frenet normal is undefined because the length of the tangent derivative (estimated by a difference quotient per unit of the curve parameter) is below 1e-6, THEN THE Frame_Builder SHALL reuse the previous Frame's normal made perpendicular to the current tangent.

### Requirement 5: Scene definition and validation

**User Story:** As an animator, I want to describe a scene declaratively and get clear errors, so that I can fix mistakes quickly.

#### Acceptance Criteria

1. THE Scene SHALL contain fps, frameCount, a Path, named Targets and a list of Entities.
2. THE Scene_Validator SHALL require fps and frameCount to be positive integers.
3. THE Entity SHALL declare a forwardAxis and an upAxis, each an Axis_Token.
4. IF an Entity's forwardAxis and upAxis lie on the same coordinate axis, including identical or opposite Axis_Tokens, THEN THE Scene_Validator SHALL reject the Entity with an error naming both values.
5. IF an aimAt Constraint names a Target that is not in the Scene, THEN THE Scene_Validator SHALL reject the Scene with an error naming the Entity and the unknown Target name.
6. THE Scene_Validator SHALL require each Constraint influence to be within [0,1].
7. IF a Constraint influence is outside [0,1], THEN THE Scene_Validator SHALL reject the Scene with an error naming the Entity and the influence value.
8. THE followPath Constraint SHALL have speed in metres per second, startOffset in metres, and alignToPath defaulting to false.
9. THE aimAt Constraint SHALL have a Target name.
10. THE Entity SHALL evaluate its Constraints in ascending order value.
11. WHERE a Target has keyframed positions, THE Scene SHALL give each keyframe an integer frame number.
12. IF an Entity id is duplicated within a Scene, THEN THE Scene_Validator SHALL reject the Scene with an error naming the id.
13. IF a keyframed Target has no keyframes, or its keyframe frame numbers are not strictly increasing, THEN THE Scene_Validator SHALL reject the Scene with an error naming the Target, using the message `Target "<name>": keyframes must not be empty` for an empty keyframe list and the message `Target "<name>": keyframe frames must be strictly increasing, got <a> then <b>` for a non-increasing pair, where <a> and <b> are the two consecutive keyframe frame numbers.
14. THE Scene_Validator SHALL require the speed and startOffset of each followPath Constraint, every coordinate of every Path point, every coordinate of every Target position and every coordinate of every keyframe position to be finite numbers, and SHALL reject the Scene otherwise with the message `Entity "<id>": speed must be a finite number, got <value>`, `Entity "<id>": startOffset must be a finite number, got <value>`, `Path point <i> must have finite coordinates`, `Target "<name>": position must have finite coordinates` or `Target "<name>": keyframe <i> position must have finite coordinates`, as applicable.
15. IF an Entity's forwardAxis or upAxis is not one of the six Axis_Tokens, THEN THE Scene_Validator SHALL reject the Entity with an error naming the Entity and the invalid value, using the message `Entity "<id>": forwardAxis "<value>" is not an axis token (use +X, -X, +Y, -Y, +Z or -Z)` or the same message with `upAxis`, as applicable.
16. IF a Constraint order is not a finite number, THEN THE Scene_Validator SHALL reject the Scene with an error naming the Entity and the value, using the message `Entity "<id>": order must be a finite number, got <value>`.

### Requirement 6: Constraint behaviour

**User Story:** As an animator, I want path-following and aiming to combine predictably, so that I can move and orient an entity from the same scene.

#### Acceptance Criteria

1. WHEN a followPath Constraint is applied at a frame, THE Baker SHALL set the Entity position to the Path point at Travelled_Distance, clamped for an open Path and wrapped for a closed Path.
2. WHERE alignToPath is true, THE Baker SHALL set the Entity rotation so that its forwardAxis follows the Path tangent and its upAxis follows the RMF normal.
3. WHERE alignToPath is false, THE followPath Constraint SHALL leave the Entity rotation unchanged.
4. WHEN an aimAt Constraint is applied at a frame, THE Baker SHALL set the Entity rotation so that its forwardAxis points from the Entity position at that point in the Constraint stack to the Target position at that frame, where the Entity position at that point is the position produced by the earlier Constraints in order, or the Rest_Pose origin when there are none.
5. WHEN an aimAt Constraint is applied, THE Baker SHALL choose the upAxis direction closest to world up (+Y) that is perpendicular to the aim direction.
6. WHERE a Constraint has influence below 1, THE Baker SHALL blend the Constraint result with the prior result by that influence, using lerp for position and slerp for rotation.
7. WHERE a Constraint has influence 0, THE Baker SHALL leave the Entity position and rotation unchanged by that Constraint.
8. WHEN a Target has keyframed positions, THE Baker SHALL linearly interpolate the Target position between keyframes and hold the first or last keyframe outside their range.
9. IF the Entity position at that point in the Constraint stack, being the position produced by the earlier Constraints in order or the Rest_Pose origin when there are none, equals the Target position at a frame, THEN THE Baker SHALL keep the previous frame's rotation from that aimAt Constraint, or the identity rotation on frame 0.
10. WHERE the Path is open and an Entity has a single followPath Constraint with influence 1, alignToPath true and speed above 0, THE Baker SHALL produce baked rotations whose angle (quatAngle) between frames f-1 and f is at most 2 * (speed / fps) / rMin + 0.001 radians for every f where frame f-1 is not a Held_Frame, where rMin is the minimum radius of curvature of the Catmull-Rom curve estimated from at least 4096 samples.

### Requirement 7: Baking and evaluation

**User Story:** As a developer, I want to bake once and evaluate cheaply, so that per-frame lookups cost no allocation.

#### Acceptance Criteria

1. WHEN bake receives a valid Scene, THE Baker SHALL compute every frame from 0 to frameCount-1 in ascending order and return Baked_Data.
2. THE Baker SHALL leave the Scene argument unmodified.
3. THE Baker SHALL produce identical Baked_Data for identical Scene input.
4. WHEN the aim direction of an aimAt Constraint at frame f greater than 0 is within the Vertical_Threshold of straight up or straight down, THE Baker SHALL set the up reference to the previous frame's baked up direction, projected perpendicular to the new aim direction and normalised, so that the rotation basis stays orthonormal.
5. IF the projected up reference has a length below 1e-9, THEN THE Baker SHALL use a unit vector perpendicular to the aim direction as the up reference.
6. WHEN the up reference is set by the near-vertical rule, THE Baker SHALL produce a baked up axis at frame f that equals the up reference within 1e-4.
7. THE Baker SHALL start the Constraint stack of each frame from the Rest_Pose.
8. THE Baker SHALL use previous-frame state only in the coincident-aim rule of Requirement 6.9 and the near-vertical up rule of Requirement 7.4, and SHALL NOT use previous-frame state as the starting value of the Constraint stack.
9. WHEN evaluateEntity receives Baked_Data, an Entity id, an integer frame and an Out_Buffer, THE Evaluator SHALL write the Entity position and quaternion for that frame into the Out_Buffer and return the Out_Buffer.
10. THE Evaluator SHALL read only Baked_Data and its arguments.
11. THE Evaluator SHALL allocate no object, array or closure on each call.
12. IF the frame is not an integer or lies outside [0, frameCount-1], THEN THE Evaluator SHALL throw an error stating the frame and the valid range.
13. IF the Entity id is not in the Baked_Data, THEN THE Evaluator SHALL throw an error naming the id.
14. THE Baker, Evaluator and Linter SHALL return no NaN in any output number.
15. IF bake receives an invalid Scene, THEN THE Baker SHALL throw the Scene_Validator error.

### Requirement 8: Path end handling

**User Story:** As an animator, I want entities to stop at the end of an open path and loop on a closed path, so that scenes with long durations behave sensibly.

#### Acceptance Criteria

1. WHERE the Path is open, THE Baker SHALL clamp Travelled_Distance to the Path length so that the Entity holds its end position on Held_Frames.
2. WHERE the Path is closed, THE Baker SHALL wrap Travelled_Distance modulo the Path length.
3. WHERE the Path is open, WHEN the Travelled_Distance of an Entity, computed from the first followPath Constraint in that Entity's Constraint order, first reaches or exceeds the Path length, THE Linter SHALL emit exactly one Finding with code "path-end-reached" and severity "info" for that Entity on that frame.
4. WHERE the Path is open and the Travelled_Distance equals the Path length exactly on the last frame, THE Linter SHALL emit the "path-end-reached" Finding for that frame.
5. WHERE the Path is closed, THE Linter SHALL emit no "path-end-reached" Finding.
6. WHERE the Path is open and an Entity never reaches the Path length, THE Linter SHALL emit no "path-end-reached" Finding for that Entity.
7. WHEN an Entity holds its end position on Held_Frames, THE Baker SHALL keep the rotation defined by the end-of-path frame for any alignToPath Constraint.

### Requirement 9: Motion linter

**User Story:** As an animator, I want warnings about problematic motion, so that I can correct it before use.

#### Acceptance Criteria

1. THE Linter SHALL return a list of Findings, each with frame, entityId, severity, code and message.
2. WHEN the roll change of an Entity between frames f-1 and f exceeds the supplied threshold, given in degrees per frame and converted to radians once on entry, with the comparison made in radians and strictly greater, THE Linter SHALL emit a Finding with code "roll-change" for the later frame.
3. WHEN the speed of an Entity at a frame exceeds 3 times the median speed of that Entity, THE Linter SHALL emit a Finding with code "speed-spike" for that frame.
4. THE Linter SHALL exclude Held_Frames from the median speed calculation.
5. WHEN the stored aim direction of an Entity at a frame is non-zero and within the Vertical_Threshold of straight up or straight down, THE Linter SHALL emit a Finding with code "aim-vertical" for that frame, where the stored aim direction is the aim direction of the last aimAt Constraint in the Entity's Constraint order, or the zero vector when the Entity has no aimAt Constraint or the aim is coincident at that frame.
6. IF the count of declared rotation-driving Constraints on one Entity is at least 2, regardless of Constraint influence, THEN THE Linter SHALL emit a Finding with code "rotation-conflict" for that Entity on frame 0.
7. THE Linter SHALL leave the Scene and Baked_Data arguments unmodified.
8. THE Linter SHALL return Findings ordered by ascending frame, then by Entity order in the Scene, then by code.
9. WHEN the median speed of an Entity is 0, THE Linter SHALL emit no "speed-spike" Finding for that Entity.
10. THE Linter SHALL use severity "warning" for "roll-change", "speed-spike", "aim-vertical" and "rotation-conflict" Findings.
11. THE Linter SHALL compute the roll change of an Entity between frames f-1 and f as follows: let F be the rotated forwardAxis at frame f; project the rotated upAxis of frame f-1 and the rotated upAxis of frame f onto the plane perpendicular to F and normalise each projection; the roll change is the angle between the two normalised vectors, in the range [0, pi] radians, and is 0 when either projection has a length below 1e-9.

### Requirement 10: Project and convention constraints

**User Story:** As a maintainer, I want the project to follow the steering conventions, so that the core stays generic and dependency-free.

#### Acceptance Criteria

1. THE Path_Core SHALL use Y-up right-handed coordinates, metres for distance and radians for internal angles.
2. THE Path_Core SHALL convert degrees to radians only at input and output boundaries.
3. THE Path_Core SHALL measure time in integer frames at the Scene fps.
4. THE Path_Core SHALL contain no identifier, type, comment or error message that refers to a camera.
5. THE Path_Core SHALL read each Entity's forwardAxis and upAxis from the Entity and contain no hard-coded forward or up axis in core code.
6. THE Path_Core SHALL declare no runtime dependency and only `vitest` and `fast-check` as dev dependencies.
7. THE Path_Core SHALL contain no rendering code.
8. THE Path_Core SHALL define the npm script `test` as `vitest run`.
9. THE Path_Core SHALL compile under TypeScript strict mode as ESM on Node 24.
10. THE Path_Core SHALL implement each core function without mutating its inputs, hidden state, I/O, randomness or clock access.
11. THE Path_Core SHALL run history-dependent rules only inside bake.
12. THE Path_Core SHALL include vitest tests for each requirement and fast-check property tests for math, curve, arc-length and frame invariants.
