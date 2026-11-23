// Tests for scripts/setup.mjs. Run from the repository root:
//   node --test scripts/setup.test.mjs
// Expected values are written by hand. Nothing here runs npm, installs anything or uses the network.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  checkNodeVersion, npmCommand, stripEscapes, lastLines, combineOutput, formatVerdict, describeLimit,
  buildSteps, skipReason, spawnOptions, resultFromSpawn, runSetup, runStep, createEnv,
} from './setup.mjs';

// The folder of this test file (scripts) and the repository root above it, from import.meta.url.
const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPTS_DIR, '..');

// T01: the hand-written version table of requirement 67.
const VERSION_TABLE = [
  ['18.20.0', 'fail'],
  ['19.9.9', 'fail'],
  ['20.0.0', 'fail'],
  ['20.18.0', 'fail'],
  ['20.19.0', 'warn'],
  ['21.7.0', 'fail'],
  ['22.11.0', 'fail'],
  ['22.12.0', 'warn'],
  ['23.0.0', 'warn'],
  ['24.0.0', 'ok'],
  ['24.11.1', 'ok'],
  ['25.1.0', 'warn'],
  ['', 'fail'],
  ['abc', 'fail'],
];

for (const [version, level] of VERSION_TABLE) {
  // One test per row of the table, so the pasted output shows which row ran.
  test(`T01 checkNodeVersion('${version}') is ${level}`, () => {
    const result = checkNodeVersion(version);
    assert.equal(result.level, level);
    assert.equal(typeof result.message, 'string');
    assert.ok(result.message.length > 0);
  });
}

// T02: values that are not a readable version fail and never throw.
test('T02 checkNodeVersion fails without throwing for unreadable values', () => {
  const unreadable = [undefined, null, 24, {}, Object.create(null), '24.0', 'v24.0.0', '24.0.0x', '24.0.0.1'];
  for (const value of unreadable) {
    let result;
    assert.doesNotThrow(() => { result = checkNodeVersion(value); });
    assert.equal(result.level, 'fail');
    assert.equal(typeof result.message, 'string');
    assert.ok(result.message.length > 0);
  }
});

// T02: a version with a - or + suffix is still readable, and its major version decides the level.
test('T02 checkNodeVersion reads a version with a suffix', () => {
  assert.equal(checkNodeVersion('24.0.0-rc.1').level, 'ok');
  assert.equal(checkNodeVersion('24.0.0+build5').level, 'ok');
});

// T03: Windows uses npm.cmd through a shell, every other platform uses plain npm.
test('T03 npmCommand gives npm.cmd with a shell on win32', () => {
  assert.deepEqual(npmCommand('win32'), { command: 'npm.cmd', shell: true });
});

// T03: Linux uses plain npm without a shell.
test('T03 npmCommand gives npm without a shell on linux', () => {
  assert.deepEqual(npmCommand('linux'), { command: 'npm', shell: false });
});

// T03: macOS uses plain npm without a shell.
test('T03 npmCommand gives npm without a shell on darwin', () => {
  assert.deepEqual(npmCommand('darwin'), { command: 'npm', shell: false });
});

// T04: a colour sequence is removed and the text around it stays.
test('T04 stripEscapes removes colour sequences', () => {
  assert.equal(stripEscapes('\u001b[31mred\u001b[0m text'), 'red text');
});

// T04: a cursor sequence is removed.
test('T04 stripEscapes removes cursor sequences', () => {
  assert.equal(stripEscapes('\u001b[2K\u001b[1Gdone'), 'done');
  assert.equal(stripEscapes('\u001b[?25lx\u001b[?25h'), 'x');
});

// T04: operating system title sequences are removed, ended by BEL or by ESC backslash.
test('T04 stripEscapes removes title sequences', () => {
  assert.equal(stripEscapes('\u001b]0;title\u0007text'), 'text');
  assert.equal(stripEscapes('\u001b]0;title\u001b\\text'), 'text');
});

// T04: two-character escapes and a lone escape character are removed.
test('T04 stripEscapes removes a lone escape character', () => {
  assert.equal(stripEscapes('x\u001bMy'), 'xy');
  assert.equal(stripEscapes('a\u001bb'), 'ab');
  assert.equal(stripEscapes('end\u001b'), 'end');
});

// T04: text without escapes comes back identical, including tabs and carriage returns.
test('T04 stripEscapes leaves plain text unchanged', () => {
  const plain = 'plain text\twith a tab\r\nand a second line\n';
  assert.equal(stripEscapes(plain), plain);
  assert.equal(stripEscapes(''), '');
});

// T05: 40 lines with count 30 give lines 11 to 40.
test('T05 lastLines keeps the last 30 of 40 lines', () => {
  const all = [];
  const expected = [];
  for (let i = 1; i <= 40; i++) {
    all.push(`l${i}`);
    if (i >= 11) expected.push(`l${i}`);
  }
  assert.equal(lastLines(all.join('\n'), 30), expected.join('\n'));
  assert.equal(expected.length, 30);
});

// T05: fewer lines than the count give all of them.
test('T05 lastLines gives all lines when there are fewer than the count', () => {
  assert.equal(lastLines('a\nb\nc', 30), 'a\nb\nc');
});

// T05: a final newline adds no empty line, and CRLF splits like LF.
test('T05 lastLines ignores one final newline and splits CRLF', () => {
  assert.equal(lastLines('a\nb\nc\n', 2), 'b\nc');
  assert.equal(lastLines('a\r\nb\r\nc\r\n', 2), 'b\nc');
});

// T05: empty text gives empty text, and a count of 0 gives empty text.
test('T05 lastLines gives empty text for empty text and count 0', () => {
  assert.equal(lastLines('', 30), '');
  assert.equal(lastLines('a\nb', 0), '');
});

// T06: standard output comes first, then standard error.
test('T06 combineOutput puts standard output before standard error', () => {
  assert.equal(combineOutput('a\n', 'b\n'), 'a\nb\n');
});

// T06: null and undefined count as empty text.
test('T06 combineOutput treats null and undefined as empty text', () => {
  assert.equal(combineOutput(null, 'b'), 'b');
  assert.equal(combineOutput('a', undefined), 'a');
  assert.equal(combineOutput(undefined, null), '');
});

// T06: a Buffer is converted to text.
test('T06 combineOutput converts a Buffer', () => {
  assert.equal(combineOutput(Buffer.from('out '), Buffer.from('err')), 'out err');
});

// T11: no failed step gives the all-passed line, whatever the number of skipped steps.
test('T11 formatVerdict says all 6 steps passed when nothing failed', () => {
  assert.equal(formatVerdict(0, 0), 'setup: all 6 steps passed.');
  assert.equal(formatVerdict(0, 3), 'setup: all 6 steps passed.');
});

// T11: failures give the count, and skips are added only when there are some.
test('T11 formatVerdict gives the failure count and the skipped count', () => {
  assert.equal(formatVerdict(2, 0), 'setup: 2 of 6 steps failed.');
  assert.equal(formatVerdict(2, 1), 'setup: 2 of 6 steps failed. 1 skipped.');
  assert.equal(formatVerdict(1, 5), 'setup: 1 of 6 steps failed. 5 skipped.');
});

// T11: time limits are described in seconds or whole minutes.
test('T11 describeLimit gives seconds for 60 seconds and minutes for 5 minutes', () => {
  assert.equal(describeLimit(60000), '60 seconds');
  assert.equal(describeLimit(300000), '5 minutes');
});

// The fake folders and paths used by the step tests, written with path.join as the design says.
const PATHKIT = path.join('ROOT', 'packages', 'pathkit');
const CHECK_TEST = path.join('scripts', 'check-constraints.test.mjs');
const CHECK_SCRIPT = path.join('scripts', 'check-constraints.mjs');

// T09: on Windows steps 2 to 4 are one command string with an empty argument list and a shell.
test('T09 buildSteps on win32 gives one-string npm commands and the node steps', () => {
  assert.deepEqual(buildSteps({ platform: 'win32', root: 'ROOT', execPath: 'NODE_EXE' }), [
    { id: 2, label: 'npm', command: 'npm.cmd --version', args: [], cwd: 'ROOT', shell: true, timeoutMs: 60000 },
    { id: 3, label: 'Install (npm ci)', command: 'npm.cmd ci', args: [], cwd: PATHKIT, shell: true, timeoutMs: 300000 },
    { id: 4, label: 'PathKit tests', command: 'npm.cmd test', args: [], cwd: PATHKIT, shell: true, timeoutMs: 300000 },
    {
      id: 5, label: 'Checklist tests', command: 'NODE_EXE', args: ['--test', CHECK_TEST],
      cwd: 'ROOT', shell: false, timeoutMs: 60000,
    },
    {
      id: 6, label: 'Constraint checklist', command: 'NODE_EXE', args: [CHECK_SCRIPT, '--strict'],
      cwd: 'ROOT', shell: false, timeoutMs: 60000,
    },
  ]);
});

// T09: on Linux steps 2 to 4 are plain npm with an argument list and no shell.
test('T09 buildSteps on linux gives npm with arguments and the node steps', () => {
  assert.deepEqual(buildSteps({ platform: 'linux', root: 'ROOT', execPath: 'NODE_EXE' }), [
    { id: 2, label: 'npm', command: 'npm', args: ['--version'], cwd: 'ROOT', shell: false, timeoutMs: 60000 },
    { id: 3, label: 'Install (npm ci)', command: 'npm', args: ['ci'], cwd: PATHKIT, shell: false, timeoutMs: 300000 },
    { id: 4, label: 'PathKit tests', command: 'npm', args: ['test'], cwd: PATHKIT, shell: false, timeoutMs: 300000 },
    {
      id: 5, label: 'Checklist tests', command: 'NODE_EXE', args: ['--test', CHECK_TEST],
      cwd: 'ROOT', shell: false, timeoutMs: 60000,
    },
    {
      id: 6, label: 'Constraint checklist', command: 'NODE_EXE', args: [CHECK_SCRIPT, '--strict'],
      cwd: 'ROOT', shell: false, timeoutMs: 60000,
    },
  ]);
});

// The three skip reasons, written out by hand.
const REASON_1 = 'not run because step 1 (Node version) failed';
const REASON_2 = 'not run because step 2 (npm) failed';
const REASON_3 = 'not run because step 3 (install) failed';

// T10: a failed Node version skips steps 2 to 6 and never step 1.
test('T10 skipReason after a failed step 1 skips steps 2 to 6', () => {
  const levels = { 1: 'fail' };
  assert.equal(skipReason(1, levels), null);
  for (const id of [2, 3, 4, 5, 6]) assert.equal(skipReason(id, levels), REASON_1);
});

// T10: a failed npm check skips steps 3 to 6 and not step 2.
test('T10 skipReason after a failed step 2 skips steps 3 to 6', () => {
  const levels = { 1: 'ok', 2: 'fail' };
  assert.equal(skipReason(2, levels), null);
  for (const id of [3, 4, 5, 6]) assert.equal(skipReason(id, levels), REASON_2);
});

// T10: a failed install skips step 4 only.
test('T10 skipReason after a failed step 3 skips step 4 only', () => {
  const levels = { 1: 'ok', 2: 'ok', 3: 'fail' };
  assert.equal(skipReason(4, levels), REASON_3);
  assert.equal(skipReason(5, levels), null);
  assert.equal(skipReason(6, levels), null);
});

// T10: a failed test step skips nothing after it.
test('T10 skipReason after a failed step 4 or 5 skips nothing', () => {
  assert.equal(skipReason(5, { 1: 'ok', 2: 'ok', 3: 'ok', 4: 'fail' }), null);
  assert.equal(skipReason(6, { 1: 'ok', 2: 'ok', 3: 'ok', 4: 'ok', 5: 'fail' }), null);
});

// T10: warn and skip levels never cause a skip.
test('T10 skipReason ignores warn and skip levels', () => {
  assert.equal(skipReason(2, { 1: 'warn' }), null);
  assert.equal(skipReason(5, { 1: 'warn', 2: 'ok', 3: 'ok', 4: 'skip' }), null);
  assert.equal(skipReason(4, { 1: 'ok', 2: 'ok', 3: 'skip' }), null);
});

// T08: the options for a step without a shell, written out by hand.
test('T08 spawnOptions for a step without a shell', () => {
  const step = { id: 5, label: 'x', command: 'NODE_EXE', args: ['a'], cwd: 'ROOT', shell: false, timeoutMs: 60000 };
  const base = Object.freeze({ A: '1', PATH: 'p' });
  const options = spawnOptions(step, base);
  assert.deepEqual(options, {
    cwd: 'ROOT',
    shell: false,
    timeout: 60000,
    maxBuffer: 67108864,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { A: '1', PATH: 'p', NO_COLOR: '1' },
  });
  assert.notEqual(options.env, base);
  assert.deepEqual(base, { A: '1', PATH: 'p' });
});

// T08: the options for a step with a shell and a one-string command.
test('T08 spawnOptions for a step with a shell', () => {
  const step = {
    id: 3, label: 'Install (npm ci)', command: 'npm.cmd ci', args: [], cwd: PATHKIT, shell: true, timeoutMs: 300000,
  };
  const options = spawnOptions(step, { NO_COLOR: '0' });
  assert.deepEqual(options, {
    cwd: PATHKIT,
    shell: true,
    timeout: 300000,
    maxBuffer: 67108864,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { NO_COLOR: '1' },
  });
});

// T07: exit code 0 is ok, and the output is standard output then standard error.
test('T07 resultFromSpawn gives ok for status 0', () => {
  assert.deepEqual(
    resultFromSpawn({ status: 0, signal: null, stdout: 'out\n', stderr: 'err\n' }),
    { status: 'ok', detail: '', output: 'out\nerr\n' },
  );
});

// T07: a non-zero exit code is a failure that names the code.
test('T07 resultFromSpawn gives failed for a non-zero status', () => {
  assert.deepEqual(
    resultFromSpawn({ status: 1, signal: null, stdout: 'o', stderr: 'e' }),
    { status: 'failed', detail: 'exit code 1', output: 'oe' },
  );
});

// T07: ETIMEDOUT is a timeout, and the partial output is kept.
test('T07 resultFromSpawn gives timeout for ETIMEDOUT', () => {
  assert.deepEqual(
    resultFromSpawn({ error: { code: 'ETIMEDOUT' }, status: null, signal: 'SIGTERM', stdout: 'partial', stderr: '' }),
    { status: 'timeout', detail: '', output: 'partial' },
  );
});

// T07: ENOBUFS is output that was too large.
test('T07 resultFromSpawn gives too-large for ENOBUFS', () => {
  assert.deepEqual(
    resultFromSpawn({ error: { code: 'ENOBUFS' }, status: null, signal: 'SIGTERM', stdout: 'big', stderr: '' }),
    { status: 'too-large', detail: '', output: 'big' },
  );
});

// T07: a program that cannot start is a failure that says so.
test('T07 resultFromSpawn gives failed for ENOENT', () => {
  assert.deepEqual(
    resultFromSpawn({
      error: { code: 'ENOENT', message: 'spawn npm ENOENT' }, status: null, signal: null, stdout: null, stderr: null,
    }),
    { status: 'failed', detail: 'could not start: ENOENT', output: '' },
  );
  assert.deepEqual(
    resultFromSpawn({ error: { message: 'boom' }, status: null, signal: null, stdout: '', stderr: '' }),
    { status: 'failed', detail: 'could not start: boom', output: '' },
  );
});

// T07: a program ended by a signal has no exit code and is a failure.
test('T07 resultFromSpawn gives failed for a signal', () => {
  assert.deepEqual(
    resultFromSpawn({ status: null, signal: 'SIGKILL', stdout: '', stderr: '' }),
    { status: 'failed', detail: 'ended by signal SIGKILL', output: '' },
  );
});

// Builds a fake environment. `table` maps a step id to the result the fake run gives (default: ok, no output).
// Returns the environment with `lines` (everything written) and `calls` (every step the fake run received).
function makeEnv(overrides = {}, table = {}) {
  const lines = [];
  const calls = [];
  const run = (step) => {
    calls.push(step);
    return table[step.id] ?? { status: 'ok', detail: '', output: '' };
  };
  const env = {
    platform: 'linux',
    nodeVersion: '24.0.0',
    root: 'ROOT',
    execPath: 'NODE_EXE',
    run,
    write: (line) => { lines.push(line); },
    ...overrides,
  };
  return { env, lines, calls };
}

// Picks the step lines out of the written lines: those that start with PASS, WARN, FAIL or SKIP.
function stepLines(lines) {
  return lines.filter((line) => /^(PASS|WARN|FAIL|SKIP)\b/.test(line));
}

// Fails when any written line contains the escape character (T20 relies on this in every run test).
function assertNoEscape(lines) {
  for (const line of lines) assert.ok(!line.includes('\u001b'), `escape character in: ${JSON.stringify(line)}`);
}

// A failed run result with no output, for the fake run.
const FAILED_1 = { status: 'failed', detail: 'exit code 1', output: '' };

// T12: everything passes: the five steps run in order, six step lines, one verdict, exit code 0.
test('T12 runSetup with everything passing', () => {
  const { env, lines, calls } = makeEnv();
  const exitCodeBefore = process.exitCode;
  const code = runSetup(env);
  assert.equal(process.exitCode, exitCodeBefore);
  assert.deepEqual(calls.map((step) => ({ id: step.id, command: step.command, args: step.args, cwd: step.cwd })), [
    { id: 2, command: 'npm', args: ['--version'], cwd: 'ROOT' },
    { id: 3, command: 'npm', args: ['ci'], cwd: PATHKIT },
    { id: 4, command: 'npm', args: ['test'], cwd: PATHKIT },
    { id: 5, command: 'NODE_EXE', args: ['--test', CHECK_TEST], cwd: 'ROOT' },
    { id: 6, command: 'NODE_EXE', args: [CHECK_SCRIPT, '--strict'], cwd: 'ROOT' },
  ]);
  assert.deepEqual(lines, [
    'Step 1/6: Node version ...',
    'PASS 1/6 Node version: Node 24.0.0',
    'Step 2/6: npm ...',
    'PASS 2/6 npm: passed',
    'Step 3/6: Install (npm ci) ...',
    'PASS 3/6 Install (npm ci): passed',
    'Step 4/6: PathKit tests ...',
    'PASS 4/6 PathKit tests: passed',
    'Step 5/6: Checklist tests ...',
    'PASS 5/6 Checklist tests: passed',
    'Step 6/6: Constraint checklist ...',
    'PASS 6/6 Constraint checklist: passed',
    'setup: all 6 steps passed.',
  ]);
  assert.equal(stepLines(lines).length, 6);
  assert.ok(lines.every((line) => !line.includes('ROOT')));
  assert.equal(code, 0);
  assertNoEscape(lines);
});

// T13: a warning from step 1 still gives the all-passed verdict and exit code 0.
test('T13 runSetup with a Node version warning still gives exit code 0', () => {
  const { env, lines } = makeEnv({ nodeVersion: '23.0.0' });
  const code = runSetup(env);
  assert.equal(
    stepLines(lines)[0],
    'WARN 1/6 Node version: Node 23.0.0 should work, but PathKit is tested with Node 24.',
  );
  assert.equal(stepLines(lines).length, 6);
  assert.equal(lines[lines.length - 1], 'setup: all 6 steps passed.');
  assert.equal(code, 0);
  assertNoEscape(lines);
});

// T14: a Node version that is too old stops the run: no step is run and steps 2 to 6 are skipped.
test('T14 runSetup with a Node version that is too old', () => {
  const { env, lines, calls } = makeEnv({ nodeVersion: '18.20.0' });
  const code = runSetup(env);
  assert.equal(calls.length, 0);
  assert.deepEqual(lines, [
    'Step 1/6: Node version ...',
    'FAIL 1/6 Node version: Node 18.20.0 is too old. PathKit needs 20.19.0 or later, or 22.12.0 or later.',
    `SKIP 2/6 npm: ${REASON_1}`,
    `SKIP 3/6 Install (npm ci): ${REASON_1}`,
    `SKIP 4/6 PathKit tests: ${REASON_1}`,
    `SKIP 5/6 Checklist tests: ${REASON_1}`,
    `SKIP 6/6 Constraint checklist: ${REASON_1}`,
    'setup: 1 of 6 steps failed. 5 skipped.',
  ]);
  assert.equal(code, 1);
  assertNoEscape(lines);
});

// T15: a missing npm stops the run after step 2: steps 3 to 6 are skipped.
test('T15 runSetup with npm missing', () => {
  const failedStart = { status: 'failed', detail: 'could not start: ENOENT', output: '' };
  const { env, lines, calls } = makeEnv({}, { 2: failedStart });
  const code = runSetup(env);
  assert.deepEqual(calls.map((step) => step.id), [2]);
  assert.deepEqual(stepLines(lines), [
    'PASS 1/6 Node version: Node 24.0.0',
    'FAIL 2/6 npm: could not start: ENOENT',
    `SKIP 3/6 Install (npm ci): ${REASON_2}`,
    `SKIP 4/6 PathKit tests: ${REASON_2}`,
    `SKIP 5/6 Checklist tests: ${REASON_2}`,
    `SKIP 6/6 Constraint checklist: ${REASON_2}`,
  ]);
  assert.equal(lines[lines.length - 1], 'setup: 1 of 6 steps failed. 4 skipped.');
  assert.equal(code, 1);
  assertNoEscape(lines);
});

// T16: a failed install skips step 4 only; steps 5 and 6 still run.
test('T16 runSetup with a failed install', () => {
  const { env, lines, calls } = makeEnv({}, { 3: FAILED_1 });
  const code = runSetup(env);
  assert.deepEqual(calls.map((step) => step.id), [2, 3, 5, 6]);
  assert.deepEqual(stepLines(lines), [
    'PASS 1/6 Node version: Node 24.0.0',
    'PASS 2/6 npm: passed',
    'FAIL 3/6 Install (npm ci): exit code 1',
    `SKIP 4/6 PathKit tests: ${REASON_3}`,
    'PASS 5/6 Checklist tests: passed',
    'PASS 6/6 Constraint checklist: passed',
  ]);
  assert.equal(lines[lines.length - 1], 'setup: 1 of 6 steps failed. 1 skipped.');
  assert.equal(code, 1);
  assertNoEscape(lines);
});

// T18: a timeout on step 4 says it timed out after 5 minutes, and not "exit code".
test('T18 runSetup reports a timeout of the PathKit tests', () => {
  const { env, lines } = makeEnv({}, { 4: { status: 'timeout', detail: '', output: 'out 1\nout 2' } });
  const code = runSetup(env);
  assert.equal(stepLines(lines)[3], 'FAIL 4/6 PathKit tests: timed out after 5 minutes');
  const at = lines.indexOf('FAIL 4/6 PathKit tests: timed out after 5 minutes');
  assert.deepEqual(lines.slice(at + 1, at + 3), ['    out 1', '    out 2']);
  assert.ok(!lines.some((line) => line.includes('exit code')));
  assert.equal(code, 1);
  assertNoEscape(lines);
});

// T18: a timeout on step 5 says it timed out after 60 seconds.
test('T18 runSetup reports a timeout of the checklist tests', () => {
  const { env, lines } = makeEnv({}, { 5: { status: 'timeout', detail: '', output: '' } });
  const code = runSetup(env);
  assert.equal(stepLines(lines)[4], 'FAIL 5/6 Checklist tests: timed out after 60 seconds');
  assert.equal(code, 1);
  assertNoEscape(lines);
});

// T19: output that was too large is reported as such, not as a generic failure.
test('T19 runSetup reports output that was too large', () => {
  const { env, lines } = makeEnv({}, { 4: { status: 'too-large', detail: '', output: 'out 1\nout 2' } });
  const code = runSetup(env);
  assert.equal(stepLines(lines)[3], 'FAIL 4/6 PathKit tests: output was too large (over 64 MiB)');
  const at = lines.indexOf('FAIL 4/6 PathKit tests: output was too large (over 64 MiB)');
  assert.deepEqual(lines.slice(at + 1, at + 3), ['    out 1', '    out 2']);
  assert.equal(code, 1);
  assertNoEscape(lines);
});

// The labels of the three test steps, for the output tests.
const TEST_STEP_LABELS = { 4: 'PathKit tests', 5: 'Checklist tests', 6: 'Constraint checklist' };

// T17: a failed test step shows the last 30 of its 40 output lines, indented, and the later steps still run.
for (const id of [4, 5, 6]) {
  // One test per failing step (4, 5 and 6).
  test(`T17 runSetup shows the last 30 output lines of failed step ${id}`, () => {
    const output = [];
    const expected = [];
    for (let n = 1; n <= 40; n++) {
      const text = n === 20 ? 'FAIL in suite' : `out ${n}`;
      output.push(text);
      if (n >= 11) expected.push(`    ${text}`);
    }
    const failedStep = { status: 'failed', detail: 'exit code 1', output: `${output.join('\n')}\n` };
    const { env, lines, calls } = makeEnv({}, { [id]: failedStep });
    const code = runSetup(env);
    const at = lines.indexOf(`FAIL ${id}/6 ${TEST_STEP_LABELS[id]}: exit code 1`);
    assert.ok(at >= 0, 'the FAIL line is missing');
    assert.equal(expected.length, 30);
    assert.deepEqual(lines.slice(at + 1, at + 31), expected);
    assert.ok(!lines.some((line) => line.includes('out 10')));
    assert.deepEqual(calls.map((step) => step.id), [2, 3, 4, 5, 6]);
    assert.equal(stepLines(lines).length, 6);
    assert.equal(code, 1);
    assertNoEscape(lines);
  });
}

// T17: two failed steps still give exit code exactly 1, and the verdict counts both.
test('T17 runSetup with steps 4 and 5 both failed gives exit code 1 and the verdict 2 of 6', () => {
  const { env, lines, calls } = makeEnv({}, { 4: FAILED_1, 5: FAILED_1 });
  const code = runSetup(env);
  assert.equal(code, 1);
  assert.equal(lines[lines.length - 1], 'setup: 2 of 6 steps failed.');
  assert.deepEqual(calls.map((step) => step.id), [2, 3, 4, 5, 6]);
  assertNoEscape(lines);
});

// T20: escape sequences in the output of a failed step are removed, and the text between them is written indented.
test('T20 runSetup removes escape sequences from the output of a failed step', () => {
  const output = '\u001b[31mred line\u001b[0m\n\u001b]0;title\u0007title line\nlone\u001b mark\n';
  const { env, lines } = makeEnv({}, { 4: { status: 'failed', detail: 'exit code 1', output } });
  runSetup(env);
  const at = lines.indexOf('FAIL 4/6 PathKit tests: exit code 1');
  assert.deepEqual(lines.slice(at + 1, at + 4), ['    red line', '    title line', '    lone mark']);
  assertNoEscape(lines);
});

// T21: steps 5 and 6 run with the given node path and no shell, on every platform.
for (const platform of ['win32', 'linux']) {
  // One test per platform.
  test(`T21 runSetup runs steps 5 and 6 with execPath and no shell on ${platform}`, () => {
    const { env, calls } = makeEnv({ platform });
    runSetup(env);
    for (const step of calls.filter((call) => call.id >= 5)) {
      assert.equal(step.command, 'NODE_EXE');
      assert.equal(step.shell, false);
    }
    assert.equal(calls.filter((call) => call.id >= 5).length, 2);
  });
}

// T21: on Windows steps 2 to 4 are given to the runner as one command string and no arguments.
test('T21 runSetup gives steps 2 to 4 as one command string on win32', () => {
  const { env, calls } = makeEnv({ platform: 'win32' });
  runSetup(env);
  assert.deepEqual(
    calls.filter((call) => call.id <= 4).map((step) => [step.command, step.args, step.shell]),
    [['npm.cmd --version', [], true], ['npm.cmd ci', [], true], ['npm.cmd test', [], true]],
  );
});

// T22: createEnv gives this machine's values and functions for run and write. The test calls neither function.
test('T22 createEnv gives the real platform, Node version, node path and repository root', () => {
  const env = createEnv();
  assert.equal(env.platform, process.platform);
  assert.equal(env.nodeVersion, process.versions.node);
  assert.equal(env.execPath, process.execPath);
  assert.equal(env.root, REPO_ROOT);
  assert.equal(env.run, runStep);
  assert.equal(typeof env.write, 'function');
});

// T23: importing the script in a separate Node process prints nothing and leaves process.exitCode unset.
test('T23 importing setup.mjs prints nothing and sets no exit code', () => {
  const url = pathToFileURL(path.join(SCRIPTS_DIR, 'setup.mjs')).href;
  const code = `await import(${JSON.stringify(url)}); process.stdout.write(String(process.exitCode));`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8',
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'undefined');
  assert.equal(result.stderr, '');
});

// T27: the script writes with writeSync(1 and the text process.stdout appears nowhere in it.
test('T27 setup.mjs uses writeSync(1 and never process.stdout', () => {
  const text = readFileSync(path.join(SCRIPTS_DIR, 'setup.mjs'), 'utf8');
  assert.ok(text.includes('writeSync(1'));
  assert.ok(!text.includes('process.stdout'));
});

// T24: setup.sh starts with the shell line, has no carriage return, checks for node and starts the script.
test('T24 setup.sh starts with #!/bin/sh, has no carriage return and runs the script', () => {
  const text = readFileSync(path.join(REPO_ROOT, 'setup.sh'), 'utf8');
  assert.ok(text.startsWith('#!/bin/sh'), 'the first line is not #!/bin/sh');
  assert.ok(!text.includes('\r'), 'setup.sh contains a carriage return (a defect in setup.sh)');
  assert.ok(text.includes('command -v node'));
  assert.ok(text.includes('scripts/setup.mjs'));
});

// T25: setup.bat checks for node and starts the script, with no goto, no label line and no ( character.
test('T25 setup.bat has where node, runs the script and has no goto, label or (', () => {
  const text = readFileSync(path.join(REPO_ROOT, 'setup.bat'), 'utf8');
  assert.ok(text.includes('where node'));
  assert.ok(text.includes('scripts\\setup.mjs'));
  assert.ok(!/goto/i.test(text), 'setup.bat contains goto');
  const labelLines = text.split(/\r?\n/).filter((line) => /^\s*:/.test(line));
  assert.deepEqual(labelLines, []);
  assert.ok(!text.includes('('), 'setup.bat contains a ( character');
});

// T26: .gitattributes holds exactly the two line-ending rules.
test('T26 .gitattributes holds exactly the two rules', () => {
  const text = readFileSync(path.join(REPO_ROOT, '.gitattributes'), 'utf8');
  const rules = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '');
  assert.deepEqual(rules, ['setup.sh text eol=lf', 'setup.bat text eol=crlf']);
});
