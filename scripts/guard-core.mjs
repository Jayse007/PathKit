// guard-core.mjs
// Plain words: this script runs before a tool is used. It reads the tool call
// (JSON) from standard input and blocks it (exit 2) if it would change one of
// these protected things:
//
//  1. The frozen core: packages/pathkit/src and packages/pathkit/test.
//     Can be unlocked with the flag file below.
//  2. The guard itself: scripts/guard-* and .kiro/hooks/guard-*. This includes
//     creating a hook with an id that starts with "guard-". Never unlockable;
//     the user changes these by hand.
//  3. The unlock flag: any path containing .pathkit-unlock-core. Never
//     unlockable, so the agent cannot unlock itself.
//  4. semantic_rename. It renames a symbol across the whole codebase, so it can
//     edit the core even when the file you give it is outside the core.
//     Can be unlocked with the flag file.
//
// Only path-like fields are checked (path, source, destination, target, from,
// to, or any name ending in "path"/"paths"). File contents (text, oldStr,
// newStr) are never read.
//
// Unlock flag: the file .pathkit-unlock-core in the user's home folder.
// Invalid input exits 0, so a glitch can never lock the user out.

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, posix } from 'node:path';

const PATH_KEYS = new Set([
  'path', 'paths', 'file', 'source', 'src', 'destination', 'dest', 'target', 'from', 'to',
]);
const CORE_DIRS = ['packages/pathkit/src', 'packages/pathkit/test'];
const GUARD_PREFIXES = ['scripts/guard-', '.kiro/hooks/guard-'];
const UNLOCK_FLAG = '.pathkit-unlock-core';
const UNLOCK_FLAG_PATH = join(homedir(), UNLOCK_FLAG);

const CORE_MESSAGE =
  'Blocked by a project hook: packages/pathkit/src and packages/pathkit/test are the frozen core. ' +
  'Changes are only allowed inside an approved spec task. Stop and ask the user to unlock it.';
const RENAME_MESSAGE =
  'Blocked by a project hook: semantic_rename can change the frozen core (packages/pathkit/src and ' +
  'packages/pathkit/test) from a file outside it. Use str_replace instead, or stop and ask the user to unlock it.';
const GUARD_MESSAGE =
  'Blocked by a project hook: the guard scripts (scripts/guard-*) and guard hooks (.kiro/hooks/guard-*) ' +
  'protect this project and cannot be changed by the agent. Stop and ask the user to change them by hand.';
const FLAG_MESSAGE =
  'Blocked by a project hook: only the user may create or change the unlock flag. Stop and ask the user.';

function isPathKey(key) {
  const k = key.toLowerCase();
  return PATH_KEYS.has(k) || k.endsWith('path') || k.endsWith('paths');
}

function normalise(value) {
  return posix.normalize(value.replace(/\\/g, '/').toLowerCase());
}

function collectPaths(args) {
  const found = [];
  for (const [key, value] of Object.entries(args)) {
    if (!isPathKey(key)) continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      if (typeof v === 'string') found.push(normalise(v));
    }
  }
  return found;
}

const touchesCore = (p) => CORE_DIRS.some((dir) => p.includes(dir + '/') || p.endsWith(dir));
const touchesGuard = (p) => GUARD_PREFIXES.some((prefix) => p.includes(prefix));
const touchesFlag = (p) => p.includes(UNLOCK_FLAG);

// Returns { message, unlockable } for a blocked call, or null if it is fine.
function findProblem(input) {
  const args = input.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {};
  const paths = collectPaths(args);

  if (paths.some(touchesFlag)) return { message: FLAG_MESSAGE, unlockable: false };
  const hookId = String(args.id ?? '').toLowerCase();
  if (input.tool_name === 'createHook' && hookId.startsWith('guard-')) {
    return { message: GUARD_MESSAGE, unlockable: false };
  }
  if (paths.some(touchesGuard)) return { message: GUARD_MESSAGE, unlockable: false };
  if (input.tool_name === 'semantic_rename') return { message: RENAME_MESSAGE, unlockable: true };
  if (paths.some(touchesCore)) return { message: CORE_MESSAGE, unlockable: true };
  return null;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  if (!input || typeof input !== 'object') process.exit(0);

  const problem = findProblem(input);
  if (!problem) process.exit(0);
  if (problem.unlockable && existsSync(UNLOCK_FLAG_PATH)) process.exit(0);

  process.stderr.write(problem.message);
  process.exit(2);
});
