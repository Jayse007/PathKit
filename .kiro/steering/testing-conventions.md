---
inclusion: fileMatch
fileMatchPattern: "spikes/path-core/test/**/*.ts"
---

# Test conventions

Each rule exists because it already cost us time.

1. **Plain checks inside loops.** In a property test, any check that runs once per frame or per sample uses plain comparisons and throws an Error naming the check, the index and the value. Call `expect` only for once-per-run checks. Reason: hundreds of thousands of `expect` calls made one test take 15 s against a 30 s timeout; plain checks took under 0.1 s.

2. **Evenly spread random inputs.** Do not use `fc.double` for geometry, directions, parameters or scalars. It favours extreme magnitudes (about 93% of generated directions lay almost exactly along an axis). Use `fc.integer(...)` mapped onto a range, or the generators in `test/helpers/basic-generators.ts`.

3. **Force the special cases.** Random inputs almost never hit edge cases such as a vector exactly parallel to a tangent, a zero vector, or the first and last sample. Build those cases on purpose from the curve's own values.

4. **A passing test is not proof.** When you finish a property test, tell the user which source line, if broken, this test should catch, so they can break it once and confirm the test fails.

5. **Speed.** A new test file that takes more than 5 seconds on the user's machine is a defect. Report it and find the cause before moving on.
