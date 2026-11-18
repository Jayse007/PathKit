---
inclusion: always
---

# Coordinate and Core Code Conventions

These rules apply to all code in this project.

## Coordinate system and units

- Coordinates are Y-up and right-handed.
- Distances are in metres.
- Angles are in radians internally. Convert degrees only at input/output boundaries.
- Time is measured in frames. Frames are integers at a fixed fps. Never use fractional frame numbers.

## Generic core

- Core code is generic. It operates on "entities": anything with a position and a rotation, such as a camera, vehicle, drone, character, light or UI element.
- Core code must never mention or assume cameras. This applies to identifiers, types, comments, error messages and logic. Camera-specific behaviour belongs outside the core.
- Each entity declares its own `forwardAxis` and `upAxis`. Each is one of `+X`, `-X`, `+Y`, `-Y`, `+Z`, `-Z`.
- `forwardAxis` and `upAxis` must lie on different coordinate axes (X, Y or Z). Reject any pair on the same axis, whether the same value (`+Z` and `+Z`) or opposite values (`+Z` and `-Z`), with a clear error that names both values.
- Never hard-code a forward or up axis in core code. Always read them from the entity.

## Purity and baking

- All core functions are pure: no mutation of inputs, hidden state, I/O, randomness or clock access.
- Rules that depend on history may only run inside `bake()`.
- `evaluateEntity` must only read baked data.

## Dependencies

- No runtime dependencies.
- The only dev dependencies are `vitest` and `fast-check`. Do not add others.

## Performance

- No per-frame memory allocation in the evaluation path. This covers `evaluateEntity` and everything it calls. Do not create objects, arrays, closures or vectors per frame. Write into caller-provided output buffers or preallocated scratch storage.
- Allocation is allowed in `bake()` and in setup code.
