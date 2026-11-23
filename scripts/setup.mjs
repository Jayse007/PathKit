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

import { spawnSync } from 'node:child_process';
import { realpathSync, writeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

// One minute in milliseconds.
export const MINUTE = 60 * 1000;
// The time limit of the install and PathKit test steps (3 and 4).
export const LIMIT_LONG_MS = 5 * MINUTE;
// The time limit of steps 2, 5 and 6.
export const LIMIT_SHORT_MS = MINUTE;

// Builds the description of one npm step. With a shell the command is one string and args is empty.
function npmStep(npm, { id, label, args, cwd, timeoutMs }) {
  if (npm.shell) {
    return { id, label, command: [npm.command, ...args].join(' '), args: [], cwd, shell: true, timeoutMs };
  }
  return { id, label, command: npm.command, args, cwd, shell: false, timeoutMs };
}

// Builds the descriptions of steps 2 to 6, in order. Every argument is a fixed constant.
export function buildSteps({ platform, root, execPath }) {
  const npm = npmCommand(platform);
  const pathkit = path.join(root, 'packages', 'pathkit');
  return [
    npmStep(npm, { id: 2, label: 'npm', args: ['--version'], cwd: root, timeoutMs: LIMIT_SHORT_MS }),
    npmStep(npm, { id: 3, label: 'Install (npm ci)', args: ['ci'], cwd: pathkit, timeoutMs: LIMIT_LONG_MS }),
    npmStep(npm, { id: 4, label: 'PathKit tests', args: ['test'], cwd: pathkit, timeoutMs: LIMIT_LONG_MS }),
    {
      id: 5,
      label: 'Checklist tests',
      command: execPath,
      args: ['--test', path.join('scripts', 'check-constraints.test.mjs')],
      cwd: root,
      shell: false,
      timeoutMs: LIMIT_SHORT_MS,
    },
    {
      id: 6,
      label: 'Constraint checklist',
      command: execPath,
      args: [path.join('scripts', 'check-constraints.mjs'), '--strict'],
      cwd: root,
      shell: false,
      timeoutMs: LIMIT_SHORT_MS,
    },
  ];
}

// Returns why a step must be skipped, or null. `levels` maps a finished step id to ok, warn, fail or skip.
export function skipReason(id, levels) {
  if (id >= 2 && levels[1] === 'fail') return 'not run because step 1 (Node version) failed';
  if (id >= 3 && levels[2] === 'fail') return 'not run because step 2 (npm) failed';
  if (id === 4 && levels[3] === 'fail') return 'not run because step 3 (install) failed';
  return null;
}

// The most output kept from each stream of a step: 64 MiB.
export const MAX_BUFFER = 64 * 1024 * 1024;

// Builds the options for spawnSync: time limit, buffer size, closed input and NO_COLOR in a copy of the environment.
export function spawnOptions(step, baseEnv) {
  return {
    cwd: step.cwd,
    shell: step.shell,
    timeout: step.timeoutMs,
    maxBuffer: MAX_BUFFER,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...baseEnv, NO_COLOR: '1' },
  };
}

// Turns the object that spawnSync returns into { status, detail, output }.
export function resultFromSpawn(spawned) {
  const output = combineOutput(spawned.stdout, spawned.stderr);
  const error = spawned.error;
  if (error && error.code === 'ETIMEDOUT') return { status: 'timeout', detail: '', output };
  if (error && error.code === 'ENOBUFS') return { status: 'too-large', detail: '', output };
  if (error) return { status: 'failed', detail: `could not start: ${error.code || error.message}`, output };
  if (spawned.status === null || spawned.status === undefined) {
    return { status: 'failed', detail: `ended by signal ${spawned.signal ?? 'unknown'}`, output };
  }
  if (spawned.status !== 0) return { status: 'failed', detail: `exit code ${spawned.status}`, output };
  return { status: 'ok', detail: '', output };
}

// Four spaces printed before every line of captured output, so it never looks like a step line.
export const OUTPUT_INDENT = '    ';

// The word that starts the step line for each level.
const LEVEL_WORDS = { ok: 'PASS', warn: 'WARN', fail: 'FAIL', skip: 'SKIP' };

// Describes in words why a step failed, for its FAIL line.
export function failText(result, step) {
  if (result.status === 'timeout') return `timed out after ${describeLimit(step.timeoutMs)}`;
  if (result.status === 'too-large') return `output was too large (over ${MAX_BUFFER / (1024 * 1024)} MiB)`;
  return result.detail;
}

// Runs the six steps in order through env.run, writes every line through env.write and returns the exit code.
export function runSetup(env) {
  const levels = {};
  let failed = 0;
  let skipped = 0;

  // Stores the level of a step, counts it and writes its step line.
  function record(id, level, label, text) {
    levels[id] = level;
    if (level === 'fail') failed++;
    if (level === 'skip') skipped++;
    env.write(`${LEVEL_WORDS[level]} ${id}/${TOTAL_STEPS} ${label}: ${text}`);
  }

  env.write(`Step 1/${TOTAL_STEPS}: Node version ...`);
  const nodeCheck = checkNodeVersion(env.nodeVersion);
  record(1, nodeCheck.level, 'Node version', nodeCheck.message);

  for (const step of buildSteps(env)) {
    const reason = skipReason(step.id, levels);
    if (reason !== null) {
      record(step.id, 'skip', step.label, reason);
      continue;
    }
    env.write(`Step ${step.id}/${TOTAL_STEPS}: ${step.label} ...`);
    const result = env.run(step);
    if (result.status === 'ok') {
      record(step.id, 'ok', step.label, 'passed');
    } else {
      record(step.id, 'fail', step.label, failText(result, step));
      const shown = lastLines(stripEscapes(result.output), MAX_OUTPUT_LINES);
      if (shown !== '') {
        for (const line of shown.split('\n')) env.write(OUTPUT_INDENT + line);
      }
    }
  }

  env.write(formatVerdict(failed, skipped));
  return failed === 0 ? 0 : 1;
}

// The repository root: the parent of the folder this file is in.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Runs one step with spawnSync and turns the outcome into a run result. Never throws.
export function runStep(step) {
  try {
    return resultFromSpawn(spawnSync(step.command, step.args, spawnOptions(step, process.env)));
  } catch (error) {
    const reason = error && error.message ? error.message : String(error);
    return { status: 'failed', detail: `could not start: ${reason}`, output: '' };
  }
}

// The real environment: this machine's values, the real runner and a writer. It starts nothing.
export function createEnv() {
  return {
    platform: process.platform,
    nodeVersion: process.versions.node,
    root: ROOT,
    execPath: process.execPath,
    run: runStep,
    write: (line) => {
      try {
        writeSync(1, line + '\n');
      } catch {
        // The output is gone (for example a closed pipe); there is nothing left to do.
      }
    },
  };
}

// True when this file was started directly (node scripts/setup.mjs) and not imported.
function isMain() {
  if (process.argv[1] === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(path.resolve(process.argv[1]))).href;
  } catch {
    return false;
  }
}

// The command-line part. It runs only when the file is started directly and sets the exit code through process.exitCode.
if (isMain()) {
  process.exitCode = runSetup(createEnv());
}
