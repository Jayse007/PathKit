---
inclusion: always
---

# Terminal and environment rules (Windows, PowerShell)

## You do not run commands
- A project hook blocks every terminal tool, so you cannot run commands. Do not look for another way (no sub-agent, no script, no hook, no editor trick).
- The user runs commands in their own terminal and pastes the output back. When a step needs a command, give the exact command on one line, say which folder to run it in, then wait.
- If a hook blocks anything, stop and tell the user what was blocked. Do not work around it.

## Commands you ask the user to run
- Use npm.cmd instead of npm, because PowerShell blocks npm.ps1. Never ask for npx, npx.cmd or tsc: they can try to download packages and hang.
- To run the tests, ask for exactly: npm.cmd test, run from packages/pathkit. Add nothing to it.
- Two more commands may be asked for, only when a spec task names them, one at a time, run from the repo root: `node --test scripts/check-constraints.test.mjs` (the script tests) and `node scripts/check-constraints.mjs --strict` (the constraint checklist). Add nothing to them. They need no install and cannot download anything.
- Two more commands may be asked for, only when a spec task names them, from the repo root: `node --test scripts/setup.test.mjs` and, once at the end, `node scripts/setup.mjs`. Add nothing to them.
- Keep every command on one line. Never ask for watch mode or any command that does not exit.
- If PowerShell says "running scripts is disabled", tell the user to run once in their own PowerShell: Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned. Never suggest any other change to execution policy, environment variables or system settings.
- If npm install fails, ask the user to run it in their own terminal and wait.

## Test output
- Never say tests passed unless the user has pasted the results. Report the counts of tests passed, failed and skipped from what they pasted.
- If the pasted output is missing or cut off, ask the user to paste it again.
- Inside apps/shot-rail and apps/skeleton-bench only, a spec task may ask for these, one at a time, run from that app folder: npm.cmd install (the exact pinned line the task gives), npm.cmd test and npm.cmd run build. Add nothing to them.
