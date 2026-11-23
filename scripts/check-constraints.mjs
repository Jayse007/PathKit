// check-constraints.mjs
// Reads the PathKit source files as text and reports, for every constraint type,
// which places forget it (see docs/adding-a-constraint.md). It only reports: it never
// edits a file, never blocks, and never reads standard input.
//
// Limits, because the checks are text matches and not a parser:
//  - The two test checks (scene-test, bake-test) show that a test file mentions the type
//    name as a whole word. They do not show that the type is tested well, and a name in
//    a comment also counts.
//  - Brace counting does not know about strings or comments. An unbalanced brace inside
//    one of the three checked functions gives a wrong gap or a "cannot find" finding.
//  - An interface body is read up to its first closing brace, so a field with an inline
//    object type would end it early.

// Path segments below the repository root, joined with node:path when files are read.
export const SRC = ['packages', 'pathkit', 'src'];
// Repository paths as shown in messages (display text only, never used to read a file).
export const SCENE_FILE = 'packages/pathkit/src/scene.ts';
export const BAKE_FILE = 'packages/pathkit/src/bake.ts';
export const INDEX_FILE = 'packages/pathkit/src/index.ts';
export const CHECKLIST = 'docs/adding-a-constraint.md';
// The places checked once for every constraint type, in report order.
export const TYPE_PLACES = [
  'union', 'validate-case', 'validate-message', 'bake-case',
  'rotation-case', 'export', 'scene-test', 'bake-test',
];

// Escapes a string for use inside a regular expression.
export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// True when `word` appears with no letter, digit or underscore directly before or after it.
export function hasWord(text, word) {
  return new RegExp('(?<![A-Za-z0-9_])' + escapeRegExp(word) + '(?![A-Za-z0-9_])').test(text);
}

// True when the body contains `case 'type'` (either quote style, spaces allowed before the colon).
export function hasCase(body, type) {
  return new RegExp('\\bcase\\s+([\'"])' + escapeRegExp(type) + '\\1\\s*:').test(body);
}

// Index of the bracket that closes the one at `from`, counting nested pairs, or -1.
function closingIndex(text, from, open, close) {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close && --depth === 0) return i;
  }
  return -1;
}

// The text of `function name(...) { ... }` from its first `{` to the matching `}`, or null.
export function functionBody(text, name) {
  const start = new RegExp('\\bfunction\\s+' + escapeRegExp(name) + '\\s*\\(').exec(text);
  if (start === null) return null;
  const paramsEnd = closingIndex(text, start.index + start[0].length - 1, '(', ')');
  if (paramsEnd < 0) return null;
  const open = text.indexOf('{', paramsEnd);
  if (open < 0) return null;
  const close = closingIndex(text, open, '{', '}');
  return close < 0 ? null : text.slice(open, close + 1);
}

// The text from the first `default:` label to the end of the body, or null.
export function defaultBranch(body) {
  const match = /\bdefault\s*:/.exec(body);
  return match === null ? null : body.slice(match.index);
}

// Finds the constraint types in scene.ts text: union order first, then interfaces the union does not list.
export function findTypes(sceneText) {
  const union = /export\s+type\s+Constraint\s*=\s*([^;]+);/.exec(sceneText);
  const unionNames = union === null
    ? []
    : union[1].split('|').map((part) => part.trim()).filter((part) => part !== '');

  const interfaces = [];
  for (const match of sceneText.matchAll(/export\s+interface\s+(\w*Constraint)\s*\{([^}]*)\}/g)) {
    const literal = /\btype\s*:\s*(['"])([^'"]+)\1/.exec(match[2]);
    if (literal !== null) interfaces.push({ iface: match[1], type: literal[2] });
  }

  const types = [];
  const orphans = [];
  for (const name of unionNames) {
    const found = interfaces.find((entry) => entry.iface === name);
    if (found === undefined) orphans.push(name);
    else types.push({ iface: found.iface, type: found.type, listed: true });
  }
  for (const entry of interfaces) {
    if (!unionNames.includes(entry.iface)) {
      types.push({ iface: entry.iface, type: entry.type, listed: false });
    }
  }
  return { types, orphans, unionFound: union !== null };
}

// The names inside every `export type { ... } from './scene.js'` block, or null when there is none.
export function exportedNames(indexText) {
  const pattern = /export\s+type\s*\{([^}]*)\}\s*from\s*(['"])\.\/scene\.js\2/g;
  let names = null;
  for (const match of indexText.matchAll(pattern)) {
    names = names ?? [];
    for (const part of match[1].split(',')) {
      const name = part.trim();
      if (name !== '') names.push(name);
    }
  }
  return names;
}
