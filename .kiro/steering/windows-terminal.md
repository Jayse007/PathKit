---
inclusion: always
---

# Terminal and environment rules (Windows, PowerShell)

## Files
- Create and edit files only with your file tools. Never write files from the terminal (no redirection, heredocs, Set-Content, Out-File or multi-line strings).

## Commands
- Keep every terminal command on one line.
- Use npm.cmd instead of npm in PowerShell. Never run npx or npx.cmd, and never run tsc: they can try to download packages and hang. The only commands you may run are npm.cmd test, git status, and a diagnostic such as node -v. Do not run any other command without asking the user.
- Use cwd to choose the folder instead of chaining cd.
- Never start watch mode or any command that does not exit. Run tests once with npm.cmd test.
- Never change PowerShell execution policy, environment variables or any system setting. Tell the user the exact command and let the user run it.

## When something fails
- If PowerShell says "running scripts is disabled", stop. Tell the user to run once in their own PowerShell: Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned. Do not retry until the user confirms.
- If a command returns exit code -1 with no output, run at most one diagnostic command (such as node -v), then stop and report. Never retry the same failing command more than once.
- If npm install fails or returns -1, ask the user to run it in their own terminal and wait.
- If a command seems stuck for more than 60 seconds, stop and tell the user.

## Test output
- Run tests with exactly: npm.cmd test. Add nothing to it.
- Never add pipes, redirection or output cmdlets to any command (Out-String, Out-File, Tee-Object, Select-String, Format-List, >, >>, |).
- If you cannot see the test output, do not try to work around it. Stop, ask the user to run npm test in their own terminal and paste the result, and wait.
- Never say tests passed unless you have seen the results with your own eyes or the user has pasted them. Report the counts of tests passed, failed and skipped.