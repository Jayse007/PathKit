---
inclusion: always
---

# Agent workflow rules

## Reading
- Read long files in chunks with offset and limit. For tasks.md read the Execution Rules and the current task only.
- Check the steering files and the spec's design decisions before asking a question. Ask only if they do not answer it.

## Dependencies
- Install only the dev dependencies the spec names. If the spec gives no version, use the latest stable release and report the exact versions installed. Never add any other package.
- Keep package-lock.json.

## Tasks
- Execute one task at a time, in list order. Never run tasks in parallel.
- Say which task you are starting. When finished, report the result in one or two sentences.
- If a property test fails: say whether the code or the property is wrong, make at most 3 fix attempts, then stop and report the seed and counterexample. Never weaken a test to make it pass.
- Never freeze typed arrays (Object.freeze throws on them). Compare copies of their contents instead.
- If a task is blocked, stop and ask the user instead of working around it.

## Reporting
- Do not say a task is done unless its tests ran and passed. Report the counts of tests passed, failed and skipped.