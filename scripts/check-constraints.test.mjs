// Tests for scripts/check-constraints.mjs. Run from the repository root:
//   node --test scripts/check-constraints.test.mjs
// Expected values are written by hand. Fixture names are alpha, beta, gamma and delta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasWord, hasCase, functionBody, defaultBranch, exportedNames, findTypes, findGaps,
} from './check-constraints.mjs';

// H1: hasWord counts only whole-word, case-sensitive matches.
test('H1 hasWord matches whole words only', () => {
  assert.equal(hasWord('alpha', 'alpha'), true);
  assert.equal(hasWord('use alpha, beta or gamma', 'alpha'), true);
  assert.equal(hasWord('(alpha)', 'alpha'), true);
  assert.equal(hasWord('alpha is first', 'alpha'), true);
  assert.equal(hasWord('the last is alpha', 'alpha'), true);
  assert.equal(hasWord("'alpha'", 'alpha'), true);
  assert.equal(hasWord('alphaExtra', 'alpha'), false);
  assert.equal(hasWord('myalpha', 'alpha'), false);
  assert.equal(hasWord('alpha2', 'alpha'), false);
  assert.equal(hasWord('alpha_x', 'alpha'), false);
  assert.equal(hasWord('Alpha', 'alpha'), false);
  assert.equal(hasWord('', 'alpha'), false);
});

// H1: a word with a regular-expression character matches only itself.
test('H1 hasWord treats regular-expression characters as plain text', () => {
  assert.equal(hasWord('x a.b y', 'a.b'), true);
  assert.equal(hasWord('x aXb y', 'a.b'), false);
});

// H2: hasCase accepts both quote styles and spaces before the colon.
test('H2 hasCase finds a case label of exactly that type', () => {
  assert.equal(hasCase("switch (c.type) { case 'alpha': return 1; }", 'alpha'), true);
  assert.equal(hasCase('case "alpha": break;', 'alpha'), true);
  assert.equal(hasCase("case 'alpha' : break;", 'alpha'), true);
  assert.equal(hasCase("case  'alpha':", 'alpha'), true);
});

// H2: a longer type name, a bare name and a mismatched quote pair do not count.
test('H2 hasCase rejects other text', () => {
  assert.equal(hasCase("case 'alphaX':", 'alpha'), false);
  assert.equal(hasCase('alpha', 'alpha'), false);
  assert.equal(hasCase('// alpha is handled elsewhere', 'alpha'), false);
  assert.equal(hasCase("case 'alpha\":", 'alpha'), false);
  assert.equal(hasCase("showcase 'alpha':", 'alpha'), false);
  assert.equal(hasCase("// add case 'alpha' here", 'alpha'), false);
  assert.equal(hasCase("case 'alpha' ", 'alpha'), false);
});

// H3: functionBody returns the body with nested braces and a template literal, and stops at the match.
test('H3 functionBody returns the matching body', () => {
  const text = [
    'function other(a) { return 1; }',
    'function bakeEntity(x, y) {',
    '  const s = `${x}`;',
    '  if (x) { y(); }',
    '  return s;',
    '}',
    'function after() {}',
  ].join('\n');
  assert.equal(
    functionBody(text, 'bakeEntity'),
    '{\n  const s = `${x}`;\n  if (x) { y(); }\n  return s;\n}',
  );
});

// H3: a parameter type with braces does not start the brace count early.
test('H3 functionBody skips braces in the parameter list', () => {
  const text = 'function f(opts: { a: number }): boolean {\n  return true;\n}';
  assert.equal(functionBody(text, 'f'), '{\n  return true;\n}');
});

// H3: a name that is only a prefix of another function is not matched.
test('H3 functionBody does not match a longer function name', () => {
  assert.equal(functionBody('function bakeEntity(x) { return 1; }', 'bake'), null);
  assert.equal(
    functionBody('function bakeEntity(x) { return 1; }\nfunction bake(x) { return 2; }', 'bake'),
    '{ return 2; }',
  );
});

// H3: a missing function or a missing closing brace gives null and does not throw.
test('H3 functionBody returns null when it cannot find the function', () => {
  assert.equal(functionBody('function other() {}', 'bakeEntity'), null);
  assert.equal(functionBody('', 'bakeEntity'), null);
  assert.equal(functionBody('function f() { if (x) { return 1; }', 'f'), null);
  assert.equal(functionBody('function f(a, b', 'f'), null);
});

// H4: defaultBranch returns the text from the default label to the end of the body.
test('H4 defaultBranch finds the default label', () => {
  const body = "switch (c) {\n case 'a': return 1;\n default: throw x(c);\n}";
  assert.equal(defaultBranch(body), 'default: throw x(c);\n}');
  assert.equal(defaultBranch('{ default : return 2; }'), 'default : return 2; }');
});

// H4: no default label, or a name that only starts with "default", gives null.
test('H4 defaultBranch returns null without a default label', () => {
  assert.equal(defaultBranch("{ case 'a': return 1; }"), null);
  assert.equal(defaultBranch('{ const defaultValue: number = 1; }'), null);
});

// H5: exportedNames reads names over several lines and from more than one block.
test('H5 exportedNames reads the scene type block', () => {
  const text = [
    "export type { Vec3, Quat } from './math.js';",
    'export type {',
    '  AlphaConstraint, BetaConstraint,',
    '  Entity,',
    "} from './scene.js';",
  ].join('\n');
  assert.deepEqual(exportedNames(text), ['AlphaConstraint', 'BetaConstraint', 'Entity']);
  assert.deepEqual(
    exportedNames("export type { A } from './scene.js';\nexport type { B } from \"./scene.js\";"),
    ['A', 'B'],
  );
});

// H5: other blocks and plain exports do not count, and no match gives null.
test('H5 exportedNames ignores other blocks and returns null', () => {
  assert.equal(exportedNames("export type { A } from './other.js';"), null);
  assert.equal(exportedNames("export { axisVector } from './scene.js';"), null);
  assert.equal(exportedNames('export type Constraint = A | B;'), null);
  assert.equal(exportedNames(''), null);
});

// Builds the text of one constraint interface with a type literal.
function iface(name, type) {
  return `export interface ${name} {\n  type: '${type}';\n  order: number;\n}\n`;
}

const ONE_LINE_UNION = 'export type Constraint = AlphaConstraint | BetaConstraint | GammaConstraint;\n';

// F1: three types in a one-line union come back in union order, whatever the interface order.
test('F1 findTypes lists the types in union order', () => {
  const text = iface('BetaConstraint', 'beta') + iface('AlphaConstraint', 'alpha') +
    iface('GammaConstraint', 'gamma') + ONE_LINE_UNION;
  assert.deepEqual(findTypes(text), {
    types: [
      { iface: 'AlphaConstraint', type: 'alpha', listed: true },
      { iface: 'BetaConstraint', type: 'beta', listed: true },
      { iface: 'GammaConstraint', type: 'gamma', listed: true },
    ],
    orphans: [],
    unionFound: true,
  });
});

// F2: an interface with a type literal that the union does not list is added last, not listed.
test('F2 findTypes adds an interface the union does not list', () => {
  const text = iface('AlphaConstraint', 'alpha') + iface('GammaConstraint', 'gamma') +
    iface('BetaConstraint', 'beta') + 'export type Constraint = AlphaConstraint | BetaConstraint;\n';
  assert.deepEqual(findTypes(text), {
    types: [
      { iface: 'AlphaConstraint', type: 'alpha', listed: true },
      { iface: 'BetaConstraint', type: 'beta', listed: true },
      { iface: 'GammaConstraint', type: 'gamma', listed: false },
    ],
    orphans: [],
    unionFound: true,
  });
});

// F3: a union name that no interface declares is an orphan and is not a type.
test('F3 findTypes reports a union name with no interface as an orphan', () => {
  const text = iface('AlphaConstraint', 'alpha') +
    'export type Constraint = AlphaConstraint | MissingConstraint;\n';
  assert.deepEqual(findTypes(text), {
    types: [{ iface: 'AlphaConstraint', type: 'alpha', listed: true }],
    orphans: ['MissingConstraint'],
    unionFound: true,
  });
});

// F4: an interface with no type literal, and one whose name does not end in Constraint, are ignored.
test('F4 findTypes ignores interfaces without a type literal or a Constraint name', () => {
  const text = iface('AlphaConstraint', 'alpha') +
    'export interface PlainConstraint {\n  order: number;\n}\n' +
    "export interface Entity {\n  type: 'entity';\n}\n" +
    'export type Constraint = AlphaConstraint;\n';
  assert.deepEqual(findTypes(text), {
    types: [{ iface: 'AlphaConstraint', type: 'alpha', listed: true }],
    orphans: [],
    unionFound: true,
  });
});

// F4: a type literal in double quotes is found like one in single quotes.
test('F4 findTypes reads a double-quoted type literal', () => {
  const text = 'export interface AlphaConstraint {\n  type: "alpha";\n  order: number;\n}\n' +
    'export type Constraint = AlphaConstraint;\n';
  assert.deepEqual(findTypes(text), {
    types: [{ iface: 'AlphaConstraint', type: 'alpha', listed: true }],
    orphans: [],
    unionFound: true,
  });
});

// F5: with no union in the text, every interface is a type that is not listed.
test('F5 findTypes without a union reports unionFound false', () => {
  const text = iface('AlphaConstraint', 'alpha') + iface('BetaConstraint', 'beta');
  assert.deepEqual(findTypes(text), {
    types: [
      { iface: 'AlphaConstraint', type: 'alpha', listed: false },
      { iface: 'BetaConstraint', type: 'beta', listed: false },
    ],
    orphans: [],
    unionFound: false,
  });
  assert.deepEqual(findTypes(''), { types: [], orphans: [], unionFound: false });
});

// T6: a union written over several lines (and with Windows line endings) gives the same result.
test('T6 findTypes parses a multi-line union', () => {
  const interfaces = iface('AlphaConstraint', 'alpha') + iface('BetaConstraint', 'beta') +
    iface('GammaConstraint', 'gamma');
  const multiLine = 'export type Constraint =\n  | AlphaConstraint\n  | BetaConstraint\n  | GammaConstraint;\n';
  const expected = findTypes(interfaces + ONE_LINE_UNION);
  assert.deepEqual(expected.types.map((entry) => entry.type), ['alpha', 'beta', 'gamma']);
  assert.deepEqual(findTypes(interfaces + multiLine), expected);
  assert.deepEqual(findTypes((interfaces + multiLine).replace(/\n/g, '\r\n')), expected);
});

// The file paths as they appear in messages, written out by hand.
const SCENE = 'packages/pathkit/src/scene.ts';

// Capitalises a type name and adds the suffix: alpha becomes AlphaConstraint.
function ifaceName(type) {
  return type[0].toUpperCase() + type.slice(1) + 'Constraint';
}

// Builds a small, complete set of fixture sources for the given type names.
function makeSources(types) {
  const names = types.map(ifaceName);
  const hint = types.slice(0, -1).join(', ') + ' or ' + types[types.length - 1];
  const scene = types.map((type) => iface(ifaceName(type), type)).join('') +
    `export type Constraint = ${names.join(' | ')};\n` +
    'function checkConstraintOfType(scene, entityId, c) {\n  switch (c.type) {\n' +
    types.map((type) => `    case '${type}':\n      return;\n`).join('') +
    '    default: {\n' +
    '      throw new SceneError(`Entity "${entityId}": unknown constraint type "${String(c.type)}" (use ' +
    hint + ')`);\n    }\n  }\n}\n';
  const bake = 'function bakeEntity(entity) {\n  for (const c of entity.constraints) {\n    switch (c.type) {\n' +
    types.map((type) => `      case '${type}': {\n        break;\n      }\n`).join('') +
    '      default:\n        throw unknownConstraintType(c);\n    }\n  }\n}\n' +
    'function drivesRotation(c) {\n  switch (c.type) {\n' +
    types.map((type) => `    case '${type}': return true;\n`).join('') +
    '    default: throw unknownConstraintType(c);\n  }\n}\n';
  const index = `export type {\n  ${names.join(', ')},\n  Entity,\n} from './scene.js';\n`;
  return {
    scene,
    bake,
    index,
    sceneTests: types.map((type) => ({ name: `${type}.test.ts`, text: `describe('${type} validation', () => {});\n` })),
    bakeTests: types.map((type) => ({ name: `${type}.test.ts`, text: `describe('${type} baking', () => {});\n` })),
  };
}

// Replaces `from` with `to` once, and fails the test when `from` is not in the text.
function swap(text, from, to) {
  assert.ok(text.includes(from), `the fixture does not contain: ${from}`);
  return text.replace(from, to);
}

const ABG_UNION = 'AlphaConstraint | BetaConstraint | GammaConstraint';
const BETA_VALIDATE_CASE = "    case 'beta':\n      return;\n";

// T1: a complete fixture with three types has no findings.
test('T1 findGaps finds nothing in a complete fixture', () => {
  assert.deepEqual(findGaps(makeSources(['alpha', 'beta', 'gamma'])), []);
});

// T3: removing only the validate case of beta gives one validate-case gap.
test('T3 validate-case gap', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.scene = swap(sources.scene, BETA_VALIDATE_CASE, '');
  assert.deepEqual(findGaps(sources), [
    { type: 'beta', place: 'validate-case', detail: `no case 'beta' in checkConstraintOfType, ${SCENE}` },
  ]);
});

// T3: removing only beta from the default message gives one validate-message gap.
test('T3 validate-message gap', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.scene = swap(sources.scene, '(use alpha, beta or gamma)', '(use alpha or gamma)');
  assert.deepEqual(findGaps(sources), [
    {
      type: 'beta',
      place: 'validate-message',
      detail: `the default message in checkConstraintOfType does not mention beta, ${SCENE}`,
    },
  ]);
});

// T3: removing only beta from the union gives one union gap.
test('T3 union gap', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.scene = swap(sources.scene, ABG_UNION, 'AlphaConstraint | GammaConstraint');
  assert.deepEqual(findGaps(sources), [
    { type: 'beta', place: 'union', detail: `BetaConstraint is not in the Constraint union in ${SCENE}` },
  ]);
});

// T5: an interface outside the union still gets the other checks.
test('T5 an unlisted interface is checked in the other places too', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.scene = swap(sources.scene, ABG_UNION, 'AlphaConstraint | GammaConstraint');
  sources.scene = swap(sources.scene, BETA_VALIDATE_CASE, '');
  assert.deepEqual(findGaps(sources), [
    { type: 'beta', place: 'union', detail: `BetaConstraint is not in the Constraint union in ${SCENE}` },
    { type: 'beta', place: 'validate-case', detail: `no case 'beta' in checkConstraintOfType, ${SCENE}` },
  ]);
});

// T7: a union name with no interface gives one union gap named by the interface, and nothing else.
test('T7 an orphan union name gives exactly one union gap', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.scene = swap(sources.scene, ABG_UNION, `${ABG_UNION} | DeltaConstraint`);
  assert.deepEqual(findGaps(sources), [
    {
      type: 'DeltaConstraint',
      place: 'union',
      detail: 'DeltaConstraint is listed in the Constraint union but no interface declares it',
    },
  ]);
});

// T7: an orphan keeps its place in the union order.
test('T7 an orphan stays at its union position in the findings', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.scene = swap(sources.scene, 'AlphaConstraint | BetaConstraint', 'AlphaConstraint | DeltaConstraint | BetaConstraint');
  sources.scene = swap(sources.scene, BETA_VALIDATE_CASE, '');
  assert.deepEqual(findGaps(sources), [
    {
      type: 'DeltaConstraint',
      place: 'union',
      detail: 'DeltaConstraint is listed in the Constraint union but no interface declares it',
    },
    { type: 'beta', place: 'validate-case', detail: `no case 'beta' in checkConstraintOfType, ${SCENE}` },
  ]);
});

// T8: without the union there is one anchor finding, and the other checks still pass.
test('T8 a missing union is a finding, not a crash', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.scene = swap(sources.scene, `export type Constraint = ${ABG_UNION};\n`, '');
  assert.deepEqual(findGaps(sources), [
    { type: '', place: 'anchor', detail: `cannot find the Constraint union in ${SCENE}` },
  ]);
});

// T8: without checkConstraintOfType there is one anchor finding, and the union check still runs.
test('T8 a missing checkConstraintOfType is a finding and other checks still run', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.scene = swap(sources.scene, 'function checkConstraintOfType(', 'function somethingElse(');
  sources.scene = swap(sources.scene, ABG_UNION, 'AlphaConstraint | GammaConstraint');
  assert.deepEqual(findGaps(sources), [
    { type: 'beta', place: 'union', detail: `BetaConstraint is not in the Constraint union in ${SCENE}` },
    { type: '', place: 'anchor', detail: `cannot find checkConstraintOfType in ${SCENE}` },
  ]);
});

const BAKE = 'packages/pathkit/src/bake.ts';
const INDEX = 'packages/pathkit/src/index.ts';
const BETA_BAKE_CASE = "      case 'beta': {\n        break;\n      }\n";
const BETA_ROTATION_CASE = "    case 'beta': return true;\n";
const ABG_EXPORTS = 'AlphaConstraint, BetaConstraint, GammaConstraint,';

// T3: removing only the bakeEntity case of beta gives one bake-case gap.
test('T3 bake-case gap', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.bake = swap(sources.bake, BETA_BAKE_CASE, '');
  assert.deepEqual(findGaps(sources), [
    { type: 'beta', place: 'bake-case', detail: `no case 'beta' in bakeEntity, ${BAKE}` },
  ]);
});

// T3: removing only the drivesRotation case of beta gives one rotation-case gap.
test('T3 rotation-case gap', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.bake = swap(sources.bake, BETA_ROTATION_CASE, '');
  assert.deepEqual(findGaps(sources), [
    { type: 'beta', place: 'rotation-case', detail: `no case 'beta' in drivesRotation, ${BAKE}` },
  ]);
});

// T3: removing only BetaConstraint from the export block gives one export gap.
test('T3 export gap', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.index = swap(sources.index, ABG_EXPORTS, 'AlphaConstraint, GammaConstraint,');
  assert.deepEqual(findGaps(sources), [
    { type: 'beta', place: 'export', detail: `BetaConstraint is not exported from ${INDEX}` },
  ]);
});

// T3: a name exported from another module does not satisfy the export check.
test('T3 export only counts the block that comes from scene.js', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.index = "export type { AlphaConstraint, GammaConstraint, Entity } from './scene.js';\n" +
    "export type { BetaConstraint } from './other.js';\n";
  assert.deepEqual(findGaps(sources), [
    { type: 'beta', place: 'export', detail: `BetaConstraint is not exported from ${INDEX}` },
  ]);
});

// T8: without bakeEntity there is one anchor finding, and the drivesRotation check still runs.
test('T8 a missing bakeEntity is a finding and other checks still run', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.bake = swap(sources.bake, 'function bakeEntity(', 'function other(');
  sources.bake = swap(sources.bake, BETA_ROTATION_CASE, '');
  assert.deepEqual(findGaps(sources), [
    { type: 'beta', place: 'rotation-case', detail: `no case 'beta' in drivesRotation, ${BAKE}` },
    { type: '', place: 'anchor', detail: `cannot find bakeEntity in ${BAKE}` },
  ]);
});

// T8: without drivesRotation there is one anchor finding, and the bakeEntity check still runs.
test('T8 a missing drivesRotation is a finding and other checks still run', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.bake = swap(sources.bake, 'function drivesRotation(', 'function other(');
  sources.bake = swap(sources.bake, BETA_BAKE_CASE, '');
  assert.deepEqual(findGaps(sources), [
    { type: 'beta', place: 'bake-case', detail: `no case 'beta' in bakeEntity, ${BAKE}` },
    { type: '', place: 'anchor', detail: `cannot find drivesRotation in ${BAKE}` },
  ]);
});

// T8: without the export block there is one anchor finding, and the validate check still runs.
test('T8 a missing export block is a finding and other checks still run', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.index = '';
  sources.scene = swap(sources.scene, BETA_VALIDATE_CASE, '');
  assert.deepEqual(findGaps(sources), [
    { type: 'beta', place: 'validate-case', detail: `no case 'beta' in checkConstraintOfType, ${SCENE}` },
    { type: '', place: 'anchor', detail: `cannot find the export type block in ${INDEX}` },
  ]);
});

// T8: all five anchors missing at once give five findings, in a fixed order, and nothing throws.
test('T8 all five anchors missing give five findings in order', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.scene = swap(sources.scene, `export type Constraint = ${ABG_UNION};\n`, '');
  sources.scene = swap(sources.scene, 'function checkConstraintOfType(', 'function other(');
  sources.bake = swap(sources.bake, 'function bakeEntity(', 'function other(');
  sources.bake = swap(sources.bake, 'function drivesRotation(', 'function another(');
  sources.index = '';
  assert.deepEqual(findGaps(sources), [
    { type: '', place: 'anchor', detail: `cannot find the Constraint union in ${SCENE}` },
    { type: '', place: 'anchor', detail: `cannot find checkConstraintOfType in ${SCENE}` },
    { type: '', place: 'anchor', detail: `cannot find bakeEntity in ${BAKE}` },
    { type: '', place: 'anchor', detail: `cannot find drivesRotation in ${BAKE}` },
    { type: '', place: 'anchor', detail: `cannot find the export type block in ${INDEX}` },
  ]);
});

const SCENE_TESTS = 'packages/pathkit/test/scene';
const BAKE_TESTS = 'packages/pathkit/test/bake';

// T3: removing the only scene test file that mentions beta gives one scene-test gap.
test('T3 scene-test gap', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.sceneTests = sources.sceneTests.filter((file) => file.name !== 'beta.test.ts');
  assert.deepEqual(findGaps(sources), [
    { type: 'beta', place: 'scene-test', detail: `no file in ${SCENE_TESTS} mentions beta` },
  ]);
});

// T3: removing the only bake test file that mentions beta gives one bake-test gap.
test('T3 bake-test gap', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.bakeTests = sources.bakeTests.filter((file) => file.name !== 'beta.test.ts');
  assert.deepEqual(findGaps(sources), [
    { type: 'beta', place: 'bake-test', detail: `no file in ${BAKE_TESTS} mentions beta` },
  ]);
});

// T3: a mention in only one of several files is enough, even when the other files mention nothing.
test('T3 a mention in one file counts for the test checks', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.sceneTests = [
    { name: 'one.test.ts', text: "describe('alpha', () => {});\n" },
    { name: 'two.test.ts', text: "describe('beta and gamma', () => {});\n" },
    { name: 'three.test.ts', text: 'nothing here\n' },
  ];
  sources.bakeTests = [{ name: 'all.test.ts', text: '// alpha beta gamma\n' }];
  assert.deepEqual(findGaps(sources), []);
});

// T9: a test file that only has a longer name does not satisfy the type. A comment does count.
test('T9 the test checks need the whole word', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.sceneTests = sources.sceneTests.map((file) =>
    (file.name === 'alpha.test.ts' ? { name: file.name, text: "describe('alphaExtra', () => {});\n" } : file));
  sources.bakeTests = sources.bakeTests.map((file) =>
    (file.name === 'alpha.test.ts' ? { name: file.name, text: '// alpha is only in a comment\n' } : file));
  assert.deepEqual(findGaps(sources), [
    { type: 'alpha', place: 'scene-test', detail: `no file in ${SCENE_TESTS} mentions alpha` },
  ]);
});

// T2: a fourth type added only to the union and its interface gives exactly seven gaps for it.
test('T2 a new type that nothing else knows gives seven gaps in order', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.scene = iface('DeltaConstraint', 'delta') + swap(sources.scene, ABG_UNION, `${ABG_UNION} | DeltaConstraint`);
  assert.deepEqual(findGaps(sources), [
    { type: 'delta', place: 'validate-case', detail: `no case 'delta' in checkConstraintOfType, ${SCENE}` },
    {
      type: 'delta',
      place: 'validate-message',
      detail: `the default message in checkConstraintOfType does not mention delta, ${SCENE}`,
    },
    { type: 'delta', place: 'bake-case', detail: `no case 'delta' in bakeEntity, ${BAKE}` },
    { type: 'delta', place: 'rotation-case', detail: `no case 'delta' in drivesRotation, ${BAKE}` },
    { type: 'delta', place: 'export', detail: `DeltaConstraint is not exported from ${INDEX}` },
    { type: 'delta', place: 'scene-test', detail: `no file in ${SCENE_TESTS} mentions delta` },
    { type: 'delta', place: 'bake-test', detail: `no file in ${BAKE_TESTS} mentions delta` },
  ]);
});

const BAKE_DEFAULT = '      default:\n        throw unknownConstraintType(c);\n';
const ROTATION_DEFAULT = '    default: throw unknownConstraintType(c);\n';

// T3: removing only the default branch of bakeEntity gives one bake-default gap with no type.
test('T3 bake-default gap', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.bake = swap(sources.bake, BAKE_DEFAULT, '');
  assert.deepEqual(findGaps(sources), [
    {
      type: '',
      place: 'bake-default',
      detail: `bakeEntity has no default branch calling unknownConstraintType, ${BAKE}`,
    },
  ]);
});

// T3: removing only the default branch of drivesRotation gives one rotation-default gap with no type.
test('T3 rotation-default gap', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.bake = swap(sources.bake, ROTATION_DEFAULT, '');
  assert.deepEqual(findGaps(sources), [
    {
      type: '',
      place: 'rotation-default',
      detail: `drivesRotation has no default branch calling unknownConstraintType, ${BAKE}`,
    },
  ]);
});

// T4: a default branch that does not call unknownConstraintType is a gap, in each function.
test('T4 a default branch without the call is a gap', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.bake = swap(sources.bake, BAKE_DEFAULT, '      default:\n        break;\n');
  sources.bake = swap(sources.bake, ROTATION_DEFAULT, '    default: return false;\n');
  assert.deepEqual(findGaps(sources), [
    {
      type: '',
      place: 'bake-default',
      detail: `bakeEntity has no default branch calling unknownConstraintType, ${BAKE}`,
    },
    {
      type: '',
      place: 'rotation-default',
      detail: `drivesRotation has no default branch calling unknownConstraintType, ${BAKE}`,
    },
  ]);
});

// T4: with four types and both defaults missing there are still exactly two default gaps.
test('T4 default gaps are reported once, not once per type', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma', 'delta']);
  sources.bake = swap(sources.bake, BAKE_DEFAULT, '');
  sources.bake = swap(sources.bake, ROTATION_DEFAULT, '');
  assert.deepEqual(findGaps(sources).map((finding) => `${finding.type}|${finding.place}`), [
    '|bake-default',
    '|rotation-default',
  ]);
});

// Builds a fixture with gaps in several places: a bake case, an orphan, an export, an unlisted type, a test file,
// a default branch and two missing functions.
function makeBrokenSources() {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.scene = swap(sources.scene, ABG_UNION, 'AlphaConstraint | DeltaConstraint | GammaConstraint');
  sources.scene = swap(sources.scene, 'function checkConstraintOfType(', 'function other(');
  sources.bake = swap(sources.bake, "      case 'alpha': {\n        break;\n      }\n", '');
  sources.bake = swap(sources.bake, BAKE_DEFAULT, '');
  sources.bake = swap(sources.bake, 'function drivesRotation(', 'function another(');
  sources.index = swap(sources.index, ABG_EXPORTS, 'AlphaConstraint, BetaConstraint,');
  sources.sceneTests = sources.sceneTests.filter((file) => file.name !== 'beta.test.ts');
  return sources;
}

// T11: findings come in the order type by type (union order, an orphan in place, unlisted last), then
// default gaps, then missing anchors in a fixed order.
test('T11 findings are in report order', () => {
  assert.deepEqual(findGaps(makeBrokenSources()).map((finding) => `${finding.type}|${finding.place}`), [
    'alpha|bake-case',
    'DeltaConstraint|union',
    'gamma|export',
    'beta|union',
    'beta|scene-test',
    '|bake-default',
    '|anchor',
    '|anchor',
  ]);
  assert.deepEqual(findGaps(makeBrokenSources()).slice(-2).map((finding) => finding.detail), [
    `cannot find checkConstraintOfType in ${SCENE}`,
    `cannot find drivesRotation in ${BAKE}`,
  ]);
});

// Freezes an object and everything inside it that is a plain object or an array.
function deepFreeze(value) {
  if (typeof value === 'object' && value !== null) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

// T10: findGaps does not modify its input, and two calls on the same input give equal results.
test('T10 findGaps leaves a frozen input alone and is repeatable', () => {
  const sources = deepFreeze(makeBrokenSources());
  const first = findGaps(sources);
  const second = findGaps(sources);
  assert.equal(first.length, 8);
  assert.deepEqual(second, first);
  assert.deepEqual(findGaps(deepFreeze(makeSources(['alpha', 'beta', 'gamma']))), []);
});

// T9: a message that mentions only a longer name does not satisfy the type.
test('T9 validate-message needs the whole word', () => {
  const sources = makeSources(['alpha', 'beta', 'gamma']);
  sources.scene = swap(sources.scene, '(use alpha, beta or gamma)', '(use alpha, betaExtra or gamma)');
  assert.deepEqual(findGaps(sources), [
    {
      type: 'beta',
      place: 'validate-message',
      detail: `the default message in checkConstraintOfType does not mention beta, ${SCENE}`,
    },
  ]);
});
