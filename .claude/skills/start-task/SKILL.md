---
name: start-task
description: Start working on a Linear issue — fetches details, moves to In Progress, creates branch
args: issue_id
---

# Start Task

You are starting work on a Linear issue. Follow these steps exactly:

## 1. Validate no other task is active

```bash
git rev-parse --abbrev-ref HEAD
```

If the current branch matches `feat/*`, STOP and tell the user:

> "You're already on branch `{branch}`. Finish or stash that task first with `/finish-task` before starting a new one."

## 2. Fetch the Linear issue

Use the Linear MCP tool to get the issue details:

- Call `get_issue` with the provided issue ID (e.g., `QOS-36`)
- Extract: title, description, priority, labels

Display a brief summary:

> **Starting:** QOS-XX — {title}
> **Priority:** {priority}
> **Description:** {first 2 lines}

## 3. Move to In Progress

Use the Linear MCP `save_issue` tool:

- Set `state` to `"In Progress"`
- Set `assignee` to `"me"`

## 4. Create feature branch

Generate a branch name from the issue:

- Format: `feat/QOS-XX-short-kebab-description`
- Keep the description to 3-5 words max
- Example: `feat/QOS-36-fix-clover-sandbox-url`

```bash
git checkout develop
git pull origin develop
git checkout -b feat/QOS-XX-short-description
```

## 5. Check if work is already done

Before writing any code, check whether the fix already exists in `develop`:

```bash
git log --oneline develop | head -20
git log --oneline --all -- <relevant-file-paths>
```

Also search the codebase for the expected fix pattern. If the fix is already merged into `develop`:

- Tell the user: "The fix for QOS-XX is already in `develop` (commit {hash}). Skipping to finish."
- Run `/finish-task` immediately — there is nothing to implement.

## 6. Confirm

Tell the user:

> Task started: QOS-XX — {title}
> Branch: `feat/QOS-XX-description`
> Linear status: In Progress
>
> You're ready to code. When done, run `/finish-task`.

## Important Rules

- NEVER start a task if another `feat/*` branch is already checked out
- ALWAYS branch from `develop`, never from `main`
- ALWAYS pull latest `develop` before branching
- If the issue doesn't exist in Linear, tell the user and stop
- ALWAYS check if work is already done before coding
