---
inclusion: always
---

# TypeScript import rules

This project uses `"module": "NodeNext"` and `"type": "module"`.

## Rules

1. Every relative import ends in `.js`, even though the real file is `.ts`.
   Example: `import { length } from './math.js'`
   Example: `import type { Vec3 } from '../../src/math.js'`
2. This applies to `import`, `import type`, `export ... from` and dynamic `import()`.
   It applies in both `src/` and `test/`.
3. Never write `.ts` in an import path. Never leave the extension off a relative import.
4. Imports of packages (`vitest`, `fast-check`) and `node:` modules stay as they are.
5. Never change the `module` or `moduleResolution` settings in `tsconfig.json` to make an error go away.

## Why

Vitest accepts imports with or without the extension, so tests pass either way.
The editor and the TypeScript compiler do not. They report error TS2835.
A missing `.js` therefore looks fine in the test run and only shows up later.

## Checking

- After creating or editing a `.ts` file, look at the editor's Problems/diagnostics for that file.
  If you cannot see diagnostics, say so in your report.
- Before marking a task done, use the Grep tool (not the terminal) on the files you touched.
  Look for relative imports that do not end in `.js'` or `.js"`.