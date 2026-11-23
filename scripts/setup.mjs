// setup.mjs
// Check-only setup for PathKit. It installs the PathKit packages (npm ci), runs every check and prints
// one PASS, WARN, FAIL or SKIP line per step, then one verdict line. It builds nothing.
//
// The steps, in order: (1) Node version, (2) npm, (3) install, (4) PathKit tests,
// (5) checklist tests, (6) constraint checklist.
//
// Notes:
//  - The minimum Node version comes from the lock file: Vite 7.3.8 needs ^20.19.0 || >=22.12.0.
//    The project is tested with Node 24, so any other passing version gives a warning.
//  - Captured output of a step is all of its standard output followed by all of its standard error.
//  - On Windows a timed-out step may leave the programs it started running.

// The Node major version the project is tested with.
export const TESTED_MAJOR = 24;

// How a readable version string looks: three numbers, then an optional suffix after - or +.
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

// Checks a Node version string against the minimum in the lock file and returns { level, message }. Never throws.
export function checkNodeVersion(version) {
  const match = typeof version === 'string' ? VERSION_PATTERN.exec(version) : null;
  if (match === null) {
    const shown = typeof version === 'string' ? `"${version.slice(0, 40)}"` : '(not text)';
    return { level: 'fail', message: `cannot read the Node version ${shown}` };
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const tooOld = major < 20
    || (major === 20 && minor < 19)
    || major === 21
    || (major === 22 && minor < 12);
  if (tooOld) {
    return {
      level: 'fail',
      message: `Node ${version} is too old. PathKit needs 20.19.0 or later, or 22.12.0 or later.`,
    };
  }
  if (major === TESTED_MAJOR) return { level: 'ok', message: `Node ${version}` };
  return {
    level: 'warn',
    message: `Node ${version} should work, but PathKit is tested with Node ${TESTED_MAJOR}.`,
  };
}

// Returns the npm command for a platform: npm.cmd through a shell on Windows, plain npm elsewhere.
export function npmCommand(platform) {
  if (platform === 'win32') return { command: 'npm.cmd', shell: true };
  return { command: 'npm', shell: false };
}

// How many lines of a failed step's captured output are shown.
export const MAX_OUTPUT_LINES = 30;

// Operating system command sequences: ESC ] ... ended by BEL or by ESC \.
const OSC_PATTERN = /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;
// Control sequences, such as colours and cursor moves: ESC [ ... and a final letter.
const CSI_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
// Two-character escapes: ESC and one character from @ to Z or from \ to _.
const SHORT_ESCAPE_PATTERN = /\u001b[@-Z\\-_]/g;

// Removes every escape sequence from text. No escape character is left in the result.
export function stripEscapes(text) {
  return text
    .replace(OSC_PATTERN, '')
    .replace(CSI_PATTERN, '')
    .replace(SHORT_ESCAPE_PATTERN, '')
    .replace(/\u001b/g, '');
}

// Returns the last `count` lines of text joined with \n. A final newline adds no empty line.
export function lastLines(text, count) {
  if (count <= 0) return '';
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.slice(-count).join('\n');
}

// Turns a captured stream (string, Buffer, null or undefined) into text.
function textOf(value) {
  return value === null || value === undefined ? '' : String(value);
}

// Joins the captured streams: all of standard output, then all of standard error.
export function combineOutput(stdout, stderr) {
  return textOf(stdout) + textOf(stderr);
}

// The number of steps in a run.
export const TOTAL_STEPS = 6;

// Builds the verdict line from the number of failed and skipped steps.
export function formatVerdict(failed, skipped) {
  if (failed === 0) return `setup: all ${TOTAL_STEPS} steps passed.`;
  const failure = `setup: ${failed} of ${TOTAL_STEPS} steps failed.`;
  return skipped > 0 ? `${failure} ${skipped} skipped.` : failure;
}

// Describes a time limit in words: whole minutes from 2 minutes up, otherwise seconds.
export function describeLimit(ms) {
  if (ms >= 120000 && ms % 60000 === 0) return `${ms / 60000} minutes`;
  return `${ms / 1000} seconds`;
}
