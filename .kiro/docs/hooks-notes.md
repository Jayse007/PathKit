# Kiro hooks: what we learned

Tested on 21 November 2026, Kiro 1.4.154 (user setup), Windows, Node via nvm4w.

A **hook** is a small rule that Kiro runs automatically when something happens
(a tool is about to run, a file is saved, a session starts). We used hooks to
protect PathKit's frozen core and to stop Kiro from running terminal commands.
Kiro's documentation was incomplete on several points, so we measured the real
behaviour with throwaway probe hooks that logged everything they received.
This note records what we found, so nobody has to repeat the experiments.

Everything below is marked **tested** (we saw it happen) or **untested**
(taken from Kiro's own tool description, or not checked).

## 1. How a hook is defined

Hook files live in `.kiro/hooks/` and are JSON:

```json
{
  "version": "v1",
  "hooks": [
    {
      "name": "Guard frozen core",
      "trigger": "PreToolUse",
      "matcher": "write|replace|relocate",
      "action": { "type": "command", "command": "node scripts/guard-core.mjs" }
    }
  ]
}
```

- **Triggers** offered by this Kiro version (from its `createHook` schema):
  PreToolUse, PostToolUse, SessionStart, Stop, UserPromptSubmit, PreTaskExec,
  PostTaskExec, PreCompact, PostCompact, PostFileCreate, PostFileSave,
  PostFileDelete.
- **Action types:** `command` (runs a program) or `agent` (adds a fixed prompt
  to the model's context).
- **Hooks go live immediately** (tested). Kiro says "next session", but a new
  hook worked on its very next tool call.
- A command hook runs from the repo root (tested), so `node scripts/x.mjs`
  works.

## 2. The matcher

The matcher is a regular expression (a text pattern).

- For tool triggers (PreToolUse) it is tested against the **tool name**, for
  example `fs_write`. Our pattern `write|replace|...` matches by substring.
  The tool `createHook` has no match for those words, so it had to be added to
  the pattern explicitly (tested).
- For file triggers (PostFileSave and similar) it is tested against the **file
  path**. **Windows paths arrive with backslashes.** A matcher written with
  forward slashes silently never fires (tested). Write `[\\/]` to accept both,
  which is `[\\\\/]` inside JSON.

## 3. What a command hook receives

Kiro sends one JSON object on **standard input** (the text stream a program can
read). Environment variables `KIRO_SESSION_ID` and `KIRO_TRUST_CLASSIFIER_MODE`
are also set. The session id changes with every chat.

```
PostFileSave:  { session_id, hook_event_name, cwd, file_path }
PreToolUse:    { session_id, hook_event_name, cwd, tool_name, tool_input }
```

`tool_input` is the exact argument list of the tool call, which makes it
possible to inspect a call before it happens.

## 4. How a hook talks back: exit codes

An **exit code** is the number a program returns when it finishes.

| Exit code | Effect | Status |
| --- | --- | --- |
| 2 on PreToolUse | **Blocks the tool call.** What the hook wrote to standard error is shown to the agent. Kiro stopped and obeyed. | tested |
| 2 on UserPromptSubmit, PreTaskExec, PreCompact | Blocks, forwards standard error | untested (from Kiro's tool description) |
| 0 on SessionStart, UserPromptSubmit, PreTaskExec, PreCompact, PostCompact | Standard output is forwarded to the agent | untested (from Kiro's tool description) |
| Any other code (for example 1) | Silent failure, nothing is blocked | per Kiro's description; exit 1 on PostFileSave delivered nothing (tested) |
| Anything on PostFileSave | **A command hook cannot talk back from PostFileSave.** Neither exit 1 nor exit 2 delivered a message. | tested |

Kiro's public documentation disagrees with its own tool description on some of
these rules. We trusted the installed version's tool description and confirmed
exit code 2 by experiment.

**Important:** only exit code 2 blocks. A script that "fails" with exit code 1
lets the action through.

## 5. Agent hooks are reminders, not enforcement

An `agent` hook appends a fixed prompt to the conversation. Kiro can read it,
but it may decline to follow instructions it finds odd (it did, when our probe
prompt was worded strangely). Use plain project-rule wording for real
reminders, and use an exit-2 block when something must never happen.

## 6. Tool names and what they receive (tested)

| Tool | Input fields |
| --- | --- |
| `fs_write` (create or overwrite a file) | `path`, `text` (the full file text) |
| `str_replace` (edit in place) | `path`, `oldStr`, `newStr`, `replace_all` |
| `read_file` | `path`, `offset`, `limit` |
| `execute_pwsh` (terminal) | `command`, `description`, `cwd`, `run_in_background`, `timeout` |
| `smart_relocate` (move or rename a file, updates imports) | `sourcePath`, `destinationPath` |
| `semantic_rename` (rename a symbol across the codebase) | `path`, `line`, `character`, `oldName`, `newName` |
| `createHook` | `id`, `name`, `description`, `trigger`, `matcher`, `actionType`, `command` or `prompt` |
| `tool_load` (loads extra tools such as `builtin::createHook`) | `tool_ids` |

Kiro calls the loader `load_resource` when it describes itself, but hooks see
the name `tool_load`. Field names differ between tools (`path`, `sourcePath`,
`destinationPath`), so a guard cannot assume one name.

## 7. The guards in this repository

Files: `scripts/guard-terminal.mjs`, `scripts/guard-core.mjs`, and the hook
files `.kiro/hooks/guard-terminal.json` and `.kiro/hooks/guard-core.json`.

**guard-terminal** blocks every tool whose name starts with `execute`. The
developer runs `npm.cmd test` and pastes the output, because Kiro could not
see terminal output reliably (in one probe it saw only the prompt text).
Tested: blocked, and Kiro asked the user instead of finding another way.

**guard-core** blocks a tool call that would change any of these:

| Protected | Unlockable? |
| --- | --- |
| `packages/pathkit/src` and `packages/pathkit/test` (the frozen core) | Yes: create `.pathkit-unlock-core` in the home folder, delete it afterwards |
| `semantic_rename` (it can edit the core from a file outside it) | Yes, same flag |
| `scripts/guard-*` and `.kiro/hooks/guard-*`, including creating a hook whose id starts with `guard-` | No. Change them by hand. |
| Any path containing `.pathkit-unlock-core` (so Kiro cannot unlock itself) | No |

Design choices, and why:

- It looks only at **path-like fields** (names such as `path`, `source`,
  `destination`, or anything ending in `path`/`paths`) and never at file
  contents. A file that merely mentions a protected folder is not blocked.
- It normalises paths (backslashes, upper case, `..` tricks) before comparing.
- It checks that something is blocked **before** the tool runs, so a missing
  file gives a block message, not a "file not found" error.
- It exits 0 on unreadable input, so a glitch cannot lock the developer out.
- The unlock flag lives in the home folder, outside the repository, so it can
  never be committed by accident.

Tests (all passed, each with a real Kiro session): core writes and edits
blocked; moves into and out of the core blocked; `semantic_rename` blocked;
guard files and guard hook ids blocked even with the flag present; the flag
file itself blocked; writes elsewhere and text that mentions the names allowed;
unlocking works and re-locks when the flag is deleted.

**Sub-agents are covered (tested).** A sub-agent is a helper that Kiro starts
through `invoke_sub_agent`. We asked one to create a harmless file in
`apps/`, create a file in the frozen core, and run a terminal command. The
harmless file was created. The core write was blocked by guard-core (visible in
the sub-agent's trace, and `git status` showed no file in `packages/`). The
terminal command was reported blocked with the exact guard-terminal message,
although that call did not appear in the sub-agent's trace, so that one rests on
the sub-agent's report and not on a trace line.

## 8. Traps we hit

- Forward-slash matchers do nothing on Windows (section 2).
- Only exit code 2 blocks (section 4).
- Hooks need no restart, despite what Kiro says.
- Kiro's tools use different field names for the same idea, so the first
  version of the guard missed `smart_relocate`.
- `semantic_rename` and `smart_relocate` act across the whole codebase, so a
  path check on the file you name is not enough for `semantic_rename`.
- A guard that cannot protect itself is not a guard. Without the last two rows
  of the table in section 7, Kiro could have rewritten the guard, replaced its
  hook with `createHook`, or created the unlock flag.
- Pasting code through a chat can double-space it. Kiro copies faithfully, so
  save tested files by hand when exact formatting matters.
- Command hooks cost no Kiro credits. Building and testing the hooks cost
  roughly 4 credits in total by Kiro's own estimates (several sessions at
  0.1 to 0.5 credits each).

## 9. Not tested

- Payloads and output delivery for PreTaskExec, PostTaskExec, Stop, SessionStart
  and UserPromptSubmit.
- Other loadable tools Kiro listed but we did not inspect: `create_artifact`,
  `update_session_information`, `control_pwsh_process`, `get_process_output`,
  `list_processes`, `remote_web_search`. None is known to write project files.
- The guard protects against Kiro's tools only. It does not stop the developer,
  git, or another editor, which is intended.
