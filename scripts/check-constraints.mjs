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
export const SCENE_TESTS = 'packages/pathkit/test/scene';
export const BAKE_TESTS = 'packages/pathkit/test/bake';
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

// The interface names listed in `export type Constraint = A | B;`, in order, or null when there is no union.
function unionNamesOf(sceneText) {
  const union = /export\s+type\s+Constraint\s*=\s*([^;]+);/.exec(sceneText);
  if (union === null) return null;
  return union[1].split('|').map((part) => part.trim()).filter((part) => part !== '');
}

// Finds the constraint types in scene.ts text: union order first, then interfaces the union does not list.
export function findTypes(sceneText) {
  const listedNames = unionNamesOf(sceneText);
  const unionNames = listedNames ?? [];

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
  return { types, orphans, unionFound: listedNames !== null };
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

// Builds one finding. `type` is '' for a place that does not depend on the type.
function gap(type, place, detail) {
  return { type, place, detail };
}

// The entries to check: union order (an orphan name stays in its place), then interfaces the union does not list.
function orderedEntries(sceneText) {
  const { types, orphans } = findTypes(sceneText);
  const entries = [];
  for (const name of unionNamesOf(sceneText) ?? []) {
    entries.push(orphans.includes(name) ? { orphan: name } : types.find((entry) => entry.iface === name));
  }
  for (const entry of types) {
    if (!entry.listed) entries.push(entry);
  }
  return entries;
}

// The gaps of one type in the places that live in scene.ts, in report order.
function checkTypeInScene(entry, ctx) {
  const { type, iface } = entry;
  const gaps = [];
  if (ctx.unionFound && !entry.listed) {
    gaps.push(gap(type, 'union', `${iface} is not in the Constraint union in ${SCENE_FILE}`));
  }
  if (ctx.validateBody !== null) {
    if (!hasCase(ctx.validateBody, type)) {
      gaps.push(gap(type, 'validate-case', `no case '${type}' in checkConstraintOfType, ${SCENE_FILE}`));
    }
    const branch = defaultBranch(ctx.validateBody);
    if (branch === null || !hasWord(branch, type)) {
      gaps.push(gap(
        type, 'validate-message',
        `the default message in checkConstraintOfType does not mention ${type}, ${SCENE_FILE}`,
      ));
    }
  }
  return gaps;
}

// The gaps of one type in the two switches of bake.ts, in report order.
function checkTypeInBake(entry, ctx) {
  const { type } = entry;
  const gaps = [];
  if (ctx.bakeBody !== null && !hasCase(ctx.bakeBody, type)) {
    gaps.push(gap(type, 'bake-case', `no case '${type}' in bakeEntity, ${BAKE_FILE}`));
  }
  if (ctx.rotationBody !== null && !hasCase(ctx.rotationBody, type)) {
    gaps.push(gap(type, 'rotation-case', `no case '${type}' in drivesRotation, ${BAKE_FILE}`));
  }
  return gaps;
}

// The gap of one type in the export block of index.ts, as a list of zero or one findings.
function checkTypeInIndex(entry, ctx) {
  if (ctx.exportNames === null || ctx.exportNames.includes(entry.iface)) return [];
  return [gap(entry.type, 'export', `${entry.iface} is not exported from ${INDEX_FILE}`)];
}

// The gaps of one type in the two test folders: some file must mention the type as a whole word.
function checkTypeInTests(entry, sources) {
  const { type } = entry;
  const gaps = [];
  if (!sources.sceneTests.some((file) => hasWord(file.text, type))) {
    gaps.push(gap(type, 'scene-test', `no file in ${SCENE_TESTS} mentions ${type}`));
  }
  if (!sources.bakeTests.some((file) => hasWord(file.text, type))) {
    gaps.push(gap(type, 'bake-test', `no file in ${BAKE_TESTS} mentions ${type}`));
  }
  return gaps;
}

// The gap for a function whose `default:` branch does not call unknownConstraintType, or null when it does.
function checkDefault(body, place, name) {
  if (body === null) return null;
  const branch = defaultBranch(body);
  if (branch !== null && branch.includes('unknownConstraintType(')) return null;
  return gap('', place, `${name} has no default branch calling unknownConstraintType, ${BAKE_FILE}`);
}

// Checks every place for every constraint type and returns the findings in report order.
export function findGaps(sources) {
  const ctx = {
    unionFound: findTypes(sources.scene).unionFound,
    validateBody: functionBody(sources.scene, 'checkConstraintOfType'),
    bakeBody: functionBody(sources.bake, 'bakeEntity'),
    rotationBody: functionBody(sources.bake, 'drivesRotation'),
    exportNames: exportedNames(sources.index),
  };

  const perType = [];
  for (const entry of orderedEntries(sources.scene)) {
    if (entry.orphan !== undefined) {
      perType.push(gap(
        entry.orphan, 'union',
        `${entry.orphan} is listed in the Constraint union but no interface declares it`,
      ));
    } else {
      perType.push(
        ...checkTypeInScene(entry, ctx),
        ...checkTypeInBake(entry, ctx),
        ...checkTypeInIndex(entry, ctx),
        ...checkTypeInTests(entry, sources),
      );
    }
  }

  const defaults = [
    checkDefault(ctx.bakeBody, 'bake-default', 'bakeEntity'),
    checkDefault(ctx.rotationBody, 'rotation-default', 'drivesRotation'),
  ].filter((finding) => finding !== null);

  const anchors = [];
  if (!ctx.unionFound) {
    anchors.push(gap('', 'anchor', `cannot find the Constraint union in ${SCENE_FILE}`));
  }
  if (ctx.validateBody === null) {
    anchors.push(gap('', 'anchor', `cannot find checkConstraintOfType in ${SCENE_FILE}`));
  }
  if (ctx.bakeBody === null) {
    anchors.push(gap('', 'anchor', `cannot find bakeEntity in ${BAKE_FILE}`));
  }
  if (ctx.rotationBody === null) {
    anchors.push(gap('', 'anchor', `cannot find drivesRotation in ${BAKE_FILE}`));
  }
  if (ctx.exportNames === null) {
    anchors.push(gap('', 'anchor', `cannot find the export type block in ${INDEX_FILE}`));
  }
  return [...perType, ...defaults, ...anchors];
}
