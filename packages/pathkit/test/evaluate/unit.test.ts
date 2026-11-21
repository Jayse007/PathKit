import { describe, it, expect } from 'vitest';
import { bake } from '../../src/bake.js';
import type { BakedData } from '../../src/bake.js';
import { evaluateEntity } from '../../src/evaluate.js';
import type { OutBuffer } from '../../src/evaluate.js';
import type { Scene } from '../../src/scene.js';

// Unit tests for evaluateEntity allocation: the returned object is the caller's Out_Buffer, the success path of the
// source contains no allocating syntax (checked by a small source scanner that is itself tested), and 100,000 calls
// grow heapUsed by less than 1 MB. Requirements 7.9, 7.10, 7.11.

const GC_MISSING_MESSAGE =
  "globalThis.gc is not available: the heap check cannot run. Check that packages/pathkit/vitest.config.ts sets pool: 'forks' with poolOptions.forks.execArgv ['--expose-gc'].";

// ---------------------------------------------------------------------------------------------------------------
// Success-path source checker (test code, allocation is fine here)
//
// Input is the text of one function (evaluateEntity.toString()). It is compiled JavaScript, so it has no type syntax.
//
// Step 1, mask: comments are blanked and the contents of '...' and "..." strings are blanked (same length, quotes
//   kept), so brackets or keywords inside them cannot confuse the scan. Template literals are copied unchanged.
// Step 2, strip throws: every `throw` statement is cut out and replaced by one space. Errors are built with template
//   strings and `new Error` only inside a throw, and those only run on the failure path. The scanner finds the whole
//   word `throw` (not inside a longer identifier, not after a dot, not inside a template), then walks forward to the
//   end of the statement while tracking () [] {} nesting depth, quoted strings and template literals (including
//   `${ ... }` holes that contain `}` or nested templates). The statement ends at a `;` at depth 0, or at an unmatched
//   closing bracket (a `}` that closes the enclosing block), or at a newline at depth 0 when the text before it does
//   not end in an operator or `(` `,` and the next text does not begin with an operator or `.`.
//   Limitations: a regex literal containing quotes or brackets, and ASI cases that look like a continued expression,
//   are not understood. The code under test always ends throws with `;`.
// Step 3, scan the body (after the parameter list and the opening `{` of the body) and report hazards.
//   The parameter list is checked separately for destructuring and rest.
//
// How index access and blocks are told apart from literals: for each `[` or `{` the scanner looks at the last
//   non-space character before it (the "previous significant character"), never before the start of the body.
//   `[`: if that character is `)` or `]` or a quote, or an identifier character whose word is not a value keyword
//   (return, typeof, in, of, case, else, do, void, delete, yield, await, throw, new, instanceof), it is index access
//   (`t[i]`, `a[b][c]`, `f(x)[0]`). Anything else (`=`, `(`, `,`, `:`, `?`, `&`, `|`, `[`, `;`, `}`, a value keyword,
//   or nothing) makes it an array literal.
//   `{`: if there is no previous character (start of body), or it is `)`, `;`, `}` or `{`, or it is the word
//   else, do, try or finally, it opens a block. Anything else (`=`, `(`, `,`, `:`, `?`, `&`, `|`, `[`, `>` of `=>`,
//   the word return, ...) makes it an object literal used as a value.
//   Limitations: `case x: {` and labelled blocks look like an object literal (false positive); a block after a bare
//   `)` that is not a statement head is accepted as a block (false negative only for invalid JavaScript); a `{`
//   after `}` is treated as a block; division versus regex is not distinguished; getters, classes and object
//   methods are not understood beyond the `class` and `function` keywords.
// ---------------------------------------------------------------------------------------------------------------

const VALUE_KEYWORDS = new Set(['return', 'typeof', 'in', 'of', 'case', 'else', 'do', 'void', 'delete', 'yield', 'await', 'throw', 'new', 'instanceof']);
const BLOCK_KEYWORDS = new Set(['else', 'do', 'try', 'finally']);
const CALL_HAZARDS: ReadonlyArray<readonly [string, RegExp]> = [
  ['call to Object.assign', /\bObject\s*\.\s*assign\b/g],
  ['call to Array.from', /\bArray\s*\.\s*from\b/g],
  ['call to .map(', /\.\s*map\s*\(/g],
  ['call to .filter(', /\.\s*filter\s*\(/g],
  ['call to .slice(', /\.\s*slice\s*\(/g],
  ['call to .concat(', /\.\s*concat\s*\(/g],
  ['use of JSON.', /\bJSON\s*\./g],
];

function isIdent(c: string): boolean {
  return /[A-Za-z0-9_$]/.test(c);
}

function isQuote(c: string): boolean {
  return c === '"' || c === "'";
}

/** `src[i]` is a quote. Returns the index after the closing quote. */
function skipString(src: string, i: number): number {
  const q = src[i];
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') j += 2;
    else if (c === q) return j + 1;
    else j++;
  }
  return src.length;
}

/** `src[i]` is a backtick. Returns the index after the closing backtick, skipping `${ ... }` holes (which may nest). */
function skipTemplate(src: string, i: number): number {
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') j += 2;
    else if (c === '`') return j + 1;
    else if (c === '$' && src[j + 1] === '{') j = skipBraces(src, j + 2);
    else j++;
  }
  return src.length;
}

/** `j` is just after an opening `{`. Returns the index after its matching `}`. */
function skipBraces(src: string, j: number): number {
  let depth = 1;
  while (j < src.length) {
    const c = src[j];
    if (isQuote(c)) j = skipString(src, j);
    else if (c === '`') j = skipTemplate(src, j);
    else {
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) return j + 1;
      }
      j++;
    }
  }
  return src.length;
}

/** Step 1: blank comments and string contents, keep length and template literals. */
function maskNonCode(src: string): string {
  const chars = src.split('');
  const blank = (from: number, to: number): void => {
    for (let k = from; k < to; k++) if (chars[k] !== '\n') chars[k] = ' ';
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      let end = src.indexOf('\n', i);
      if (end < 0) end = src.length;
      blank(i, end);
      i = end;
    } else if (c === '/' && src[i + 1] === '*') {
      let end = src.indexOf('*/', i + 2);
      end = end < 0 ? src.length : end + 2;
      blank(i, end);
      i = end;
    } else if (isQuote(c)) {
      const end = skipString(src, i);
      blank(i + 1, end - 1);
      i = end;
    } else if (c === '`') {
      i = skipTemplate(src, i);
    } else {
      i++;
    }
  }
  return chars.join('');
}

function prevSignificantIndex(text: string, i: number, min: number): number {
  let k = i - 1;
  while (k >= min && /\s/.test(text[k])) k--;
  return k;
}

function nextSignificantIndex(text: string, i: number): number {
  let k = i;
  while (k < text.length && /\s/.test(text[k])) k++;
  return k;
}

/** Newline at depth 0 ends a throw statement only if the expression cannot continue across it. */
function newlineEndsStatement(text: string, newlineIndex: number): boolean {
  const p = prevSignificantIndex(text, newlineIndex, 0);
  const n = nextSignificantIndex(text, newlineIndex);
  if (p < 0 || n >= text.length) return true;
  if ('+-*/%&|^=<>?:,.('.includes(text[p])) return false;
  if ('.+-*/%&|^=<>?:,'.includes(text[n])) return false;
  return true;
}

/** `j` is the index just after the word `throw`. Returns the index where the statement ends (after its `;`). */
function findStatementEnd(text: string, j: number): number {
  let depth = 0;
  while (j < text.length) {
    const c = text[j];
    if (isQuote(c)) {
      j = skipString(text, j);
      continue;
    }
    if (c === '`') {
      j = skipTemplate(text, j);
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return j; // closes the enclosing block: the statement had no `;`
      depth--;
    } else if (c === ';' && depth === 0) return j + 1;
    else if (c === '\n' && depth === 0 && newlineEndsStatement(text, j)) return j;
    j++;
  }
  return text.length;
}

/** Step 2: replace every throw statement with one space. */
function stripThrows(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '`') {
      const end = skipTemplate(text, i);
      out += text.slice(i, end);
      i = end;
    } else if (isQuote(c)) {
      const end = skipString(text, i);
      out += text.slice(i, end);
      i = end;
    } else if (isIdent(c)) {
      let j = i;
      while (j < text.length && isIdent(text[j])) j++;
      const word = text.slice(i, j);
      const afterDot = i > 0 && text[prevSignificantIndex(text, i, 0)] === '.';
      if (word === 'throw' && !afterDot) {
        out += ' ';
        i = findStatementEnd(text, j);
      } else {
        out += word;
        i = j;
      }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function readWordBack(text: string, k: number, min: number): string {
  let s = k;
  while (s - 1 >= min && isIdent(text[s - 1])) s--;
  return text.slice(s, k + 1);
}

function isIndexAccess(text: string, i: number, min: number): boolean {
  const k = prevSignificantIndex(text, i, min);
  if (k < min) return false;
  const ch = text[k];
  if (ch === ')' || ch === ']' || isQuote(ch)) return true;
  if (isIdent(ch)) return !VALUE_KEYWORDS.has(readWordBack(text, k, min));
  return false;
}

function isBlockBrace(text: string, i: number, min: number): boolean {
  const k = prevSignificantIndex(text, i, min);
  if (k < min) return true;
  const ch = text[k];
  if (ch === ')' || ch === ';' || ch === '}' || ch === '{') return true;
  if (isIdent(ch)) return BLOCK_KEYWORDS.has(readWordBack(text, k, min));
  return false;
}

function snippet(text: string, i: number): string {
  return text.slice(i, i + 24).replace(/\s+/g, ' ');
}

interface Analysis {
  /** The text that was scanned: comments and string contents blanked, throw statements replaced by a space. */
  stripped: string;
  hazards: string[];
}

function analyseSource(source: string): Analysis {
  const text = stripThrows(maskNonCode(source));
  const hazards: string[] = [];
  const add = (kind: string, i: number): void => {
    hazards.push(`${kind} at index ${i}: ${snippet(text, i)}`);
  };

  // Parameter list: from the first `(` to its matching `)`.
  const open = text.indexOf('(');
  let close = -1;
  if (open >= 0) {
    let depth = 0;
    let j = open;
    while (j < text.length) {
      const c = text[j];
      if (isQuote(c)) {
        j = skipString(text, j);
        continue;
      }
      if (c === '`') {
        j = skipTemplate(text, j);
        continue;
      }
      if (c === '(') depth++;
      else if (c === ')') {
        depth--;
        if (depth === 0) {
          close = j;
          break;
        }
      }
      j++;
    }
  }
  const braceIndex = close >= 0 ? text.indexOf('{', close) : -1;
  if (open < 0 || close < 0 || braceIndex < 0) {
    return { stripped: text, hazards: ['unparseable source: no parameter list and body found'] };
  }
  const params = text.slice(open + 1, close);
  if (/[{[]/.test(params)) add('destructuring (parameter)', open + 1);
  if (params.includes('...')) add('spread or rest (parameter)', open + 1);

  const bodyStart = braceIndex + 1;
  let i = bodyStart;
  while (i < text.length) {
    const c = text[i];
    if (c === '`') {
      add('template literal', i);
      i = skipTemplate(text, i);
    } else if (isQuote(c)) {
      i = skipString(text, i);
    } else if (c === '.' && text.startsWith('...', i)) {
      add('spread or rest', i);
      i += 3;
    } else if (c === '=' && text[i + 1] === '>') {
      add('arrow function', i);
      i += 2;
    } else if (c === '[') {
      if (!isIndexAccess(text, i, bodyStart)) add('array literal', i);
      i++;
    } else if (c === '{') {
      if (!isBlockBrace(text, i, bodyStart)) add('object literal', i);
      i++;
    } else if (isIdent(c)) {
      let j = i;
      while (j < text.length && isIdent(text[j])) j++;
      const word = text.slice(i, j);
      const p = prevSignificantIndex(text, i, bodyStart);
      const afterDot = p >= bodyStart && text[p] === '.';
      i = j;
      if (afterDot) continue;
      if (word === 'new') add('new expression', i - word.length);
      else if (word === 'function') add('nested function (closure)', i - word.length);
      else if (word === 'class') add('class', i - word.length);
      else if (word === 'const' || word === 'let' || word === 'var') {
        const k = nextSignificantIndex(text, j);
        if (text[k] === '{' || text[k] === '[') {
          add('destructuring', k);
          i = k + 1;
        }
      }
    } else {
      i++;
    }
  }

  const body = text.slice(bodyStart);
  for (const [kind, regex] of CALL_HAZARDS) {
    for (const m of body.matchAll(regex)) add(kind, bodyStart + (m.index ?? 0));
  }
  return { stripped: text, hazards };
}

/** Returns the allocation hazards found on the success path of a function's source text (throw statements ignored). */
function findAllocationHazards(source: string): string[] {
  return analyseSource(source).hazards;
}

// ---------------------------------------------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------------------------------------------

function makeOut(): OutBuffer {
  return { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
}

function makeScene(): Scene {
  return {
    fps: 30,
    frameCount: 120,
    path: {
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 2, z: 3 },
        { x: 18, y: -1, z: 12 },
        { x: 25, y: 4, z: 20 },
      ],
      closed: false,
    },
    targets: {},
    entities: [
      {
        id: 'alpha',
        forwardAxis: '+Z',
        upAxis: '+Y',
        constraints: [{ type: 'followPath', order: 0, influence: 1, speed: 1, startOffset: 0, alignToPath: true }],
      },
      {
        id: 'beta',
        forwardAxis: '+X',
        upAxis: '+Y',
        constraints: [{ type: 'followPath', order: 0, influence: 1, speed: 2, startOffset: 1, alignToPath: true }],
      },
    ],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------------------------

describe('evaluateEntity: returned buffer and values', () => {
  it('returns the Out_Buffer it was given and writes the baked position and rotation, identically on repeated calls', () => {
    const baked = bake(makeScene());
    const out1 = makeOut();
    const out2 = makeOut();
    for (const id of baked.entityIds) {
      const t = baked.transforms[baked.entityIndex.get(id) as number];
      for (const f of [0, 1, 59, baked.frameCount - 1]) {
        const r1 = evaluateEntity(baked, id, f, out1);
        expect(r1).toBe(out1);
        const r2 = evaluateEntity(baked, id, f, out2);
        expect(r2).toBe(out2);
        const base = f * 7;
        expect([r1.position.x, r1.position.y, r1.position.z, r1.rotation.x, r1.rotation.y, r1.rotation.z, r1.rotation.w]).toEqual([
          t[base], t[base + 1], t[base + 2], t[base + 3], t[base + 4], t[base + 5], t[base + 6],
        ]);
        expect(out2).toEqual(out1);
      }
    }
  });
});

describe('success-path source checker (tests of the checker)', () => {
  const badCases: ReadonlyArray<{ name: string; source: string; kind: string }> = [
    { name: 'new expression', source: 'function f(a){ const o = new Foo(); return o; }', kind: 'new expression' },
    { name: 'array literal after =', source: 'function f(a){ const x = [1,2]; return a; }', kind: 'array literal' },
    { name: 'array literal after return', source: 'function f(a){ return [a, a]; }', kind: 'array literal' },
    { name: 'object literal used as a value', source: 'function f(a){ const o = { x: 1 }; return o; }', kind: 'object literal' },
    { name: 'arrow function', source: 'function f(a){ const g = (x) => x; return g(a); }', kind: 'arrow function' },
    { name: 'template literal', source: 'function f(a){ const s = `v${a}`; return s; }', kind: 'template literal' },
    { name: 'spread', source: 'function f(a){ return g(...a); }', kind: 'spread or rest' },
    { name: 'destructuring in a declaration', source: 'function f(a){ const { x } = a; return x; }', kind: 'destructuring' },
    { name: 'destructuring in the parameter list', source: 'function f({ x }){ return x; }', kind: 'destructuring (parameter)' },
    { name: 'nested function', source: 'function f(a){ const g = function () { return a; }; return g(); }', kind: 'nested function' },
    { name: 'class', source: 'function f(a){ const C = class {}; return a; }', kind: 'class' },
    { name: 'Object.assign', source: 'function f(a, b){ Object.assign(a, b); return a; }', kind: 'call to Object.assign' },
    { name: 'Array.from', source: 'function f(a){ return Array.from(a); }', kind: 'call to Array.from' },
    { name: '.map(', source: 'function f(a){ return a.map(g); }', kind: 'call to .map(' },
    { name: '.filter(', source: 'function f(a){ return a.filter(g); }', kind: 'call to .filter(' },
    { name: '.slice(', source: 'function f(a){ return a.slice(1); }', kind: 'call to .slice(' },
    { name: '.concat(', source: 'function f(a){ return a.concat(a); }', kind: 'call to .concat(' },
    { name: 'JSON.', source: 'function f(a){ return JSON.stringify(a); }', kind: 'use of JSON.' },
  ];

  for (const c of badCases) {
    it(`flags ${c.name}`, () => {
      const hazards = findAllocationHazards(c.source);
      expect(hazards.some((h) => h.startsWith(c.kind)), `expected a "${c.kind}" hazard, got ${JSON.stringify(hazards)}`).toBe(true);
    });
  }

  it('reports no hazards for index access, blocks, loops and throw statements', () => {
    const goodSources = [
      'function f(t, i){ return t[i]; }',
      'function f(t, i){ return t[i + 1]; }',
      'function f(a, b, c){ return a[b][c]; }',
      'function f(g, x){ return g(x)[0]; }',
      'function f(a){ let x = 0; if (a) { x = 1; } else { x = 2; } return x; }',
      'function f(a){ let x = 0; if (a > 1) { x = 1; } else if (a > 0) { x = 2; } else { x = 3; } return x; }',
      'function f(t, n){ let s = 0; for (let i = 0; i < n; i++) { s += t[i]; } return s; }',
      'function f(a){ try { a++; } finally { a--; } return a; }',
      'function f(a){ if (a < 0) { throw new Error(`bad ${a}`); } return a; }',
      'function f(a, b){ if (a < 0) { throw new Error(`x ${a} {y} [${b}]`); } return a; }',
      'function f(a, b){ if (a < 0) { throw new Error(`n ${ `in ${b}` } }`); } return a; }',
      'function f(a){ if (a < 0) throw new Error(`bad ${a}`)\n return a; }',
      'function f(a){ // [ new { `\n return a; /* => ... */ }',
    ];
    for (const source of goodSources) {
      expect(findAllocationHazards(source), source).toEqual([]);
    }
  });

  it('strips only the throw statements: hazards outside them are still reported', () => {
    const source = 'function f(a){ if (a < 0) { throw new Error(`bad ${a}`); } return new Foo(); }';
    const { stripped, hazards } = analyseSource(source);
    expect(stripped).not.toContain('Error');
    expect(hazards).toHaveLength(1);
    expect(hazards[0].startsWith('new expression')).toBe(true);
  });
});

describe('evaluateEntity allocation', () => {
  it('has no allocating syntax on its success path', () => {
    const { stripped, hazards } = analyseSource(evaluateEntity.toString());
    expect(hazards).toEqual([]);
    // The checker is not blind: the real body was scanned, and the throw statements were removed.
    expect(stripped).toContain('entityIndex.get');
    expect(stripped).toContain('transforms[');
    expect(stripped).not.toContain('new Error');
    expect(stripped).not.toContain('`');
  });

  it('100,000 calls with a reused Out_Buffer grow heapUsed by less than 1 MB', () => {
    const baked: BakedData = bake(makeScene());

    // Precompute the (id, frame) pairs before the measured section, so the loop below only indexes into them.
    const pairCount = baked.entityIds.length * baked.frameCount;
    const pairIds: string[] = new Array<string>(pairCount);
    const pairFrames = new Int32Array(pairCount);
    let p = 0;
    for (let e = 0; e < baked.entityIds.length; e++) {
      for (let f = 0; f < baked.frameCount; f++) {
        pairIds[p] = baked.entityIds[e];
        pairFrames[p] = f;
        p++;
      }
    }

    const out = makeOut();
    const gc = (globalThis as { gc?: () => void }).gc;

    // Warm-up, so the optimiser and inline caches are settled before measuring.
    for (let i = 0; i < 1000; i++) {
      const k = i % pairCount;
      evaluateEntity(baked, pairIds[k], pairFrames[k], out);
    }

    if (typeof gc !== 'function') {
      throw new Error(GC_MISSING_MESSAGE);
    }

    const total = 100000;
    // Only numbers are created in the loop (counters and heap readings); no objects, arrays, strings or closures.
    // heapUsed is measured after gc(), so discarded objects are already freed: this heap check detects retained
    // memory (leaks) only. The source checker above is the guard against per-call allocation.
    let mismatches = 0;
    let k = 0;
    gc();
    const heapBefore = process.memoryUsage().heapUsed;
    for (let i = 0; i < total; i++) {
      const returned = evaluateEntity(baked, pairIds[k], pairFrames[k], out);
      if (returned !== out) mismatches++;
      k++;
      if (k === pairCount) k = 0;
    }
    gc();
    const heapAfter = process.memoryUsage().heapUsed;

    const growth = heapAfter - heapBefore;
    expect(mismatches, `${mismatches} of ${total} calls did not return the Out_Buffer passed in`).toBe(0);
    if (growth >= 1048576) {
      throw new Error(`heapUsed grew by ${growth} bytes over ${total} calls (limit 1048576 bytes)`);
    }
  });
});
