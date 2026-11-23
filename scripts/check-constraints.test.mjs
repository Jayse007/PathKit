// Tests for scripts/check-constraints.mjs. Run from the repository root:
//   node --test scripts/check-constraints.test.mjs
// Expected values are written by hand. Fixture names are alpha, beta, gamma and delta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasWord, hasCase, functionBody, defaultBranch, exportedNames, findTypes,
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
