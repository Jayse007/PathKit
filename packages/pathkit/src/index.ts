// path-core: a generic core that bakes entities along paths and aims them,
// evaluates the baked frames without allocating, and lints the motion.
// It knows nothing about what an entity is: anything with a position and a rotation works.
// This file is the only supported entry point. Import from here, not from the other modules.

export {
  add, sub, scale, dot, cross, length, normalize, lerp,
  quatFromBasis, quatMul, quatInverse, rotateVec, slerp, quatAngle,
} from './math.js';
export type { Vec3, Quat } from './math.js';

export { createCurve } from './curve.js';
export type { Curve } from './curve.js';

export { createArcLengthTable } from './arclength.js';
export type { ArcLengthTable } from './arclength.js';

export { rotationMinimizingFrames, frenetFrames } from './frames.js';
export type { Frame } from './frames.js';

export { axisVector, validateScene, SceneError } from './scene.js';
export type {
  AxisToken, FollowPathConstraint, AimAtConstraint, OrbitAroundConstraint, Constraint,
  Entity, Keyframe, Target, Scene,
} from './scene.js';

// VERTICAL_COS is deliberately not exported: it is an internal constant shared by bake and the linter.
export { bake } from './bake.js';
export type { BakedData } from './bake.js';

export { evaluateEntity } from './evaluate.js';
export type { OutBuffer } from './evaluate.js';

export { motionLinter } from './linter.js';
export type { Severity, Finding, LinterOptions } from './linter.js';
