// Tests for scripts/setup.mjs. Run from the repository root:
//   node --test scripts/setup.test.mjs
// Expected values are written by hand. Nothing here runs npm, installs anything or uses the network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkNodeVersion, npmCommand, stripEscapes, lastLines, combineOutput, formatVerdict, describeLimit,
} from './setup.mjs';

// T01: the hand-written version table of requirement 67.
const VERSION_TABLE = [
  ['18.20.0', 'fail'],
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
  const unreadable = [undefined, null, 24, {}, Object.create(null), '24.0', 'v24.0.0'];
  for (const value of unreadable) {
    let result;
    assert.doesNotThrow(() => { result = checkNodeVersion(value); });
    assert.equal(result.level, 'fail');
    assert.equal(typeof result.message, 'string');
    assert.ok(result.message.length > 0);
  }
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
