---
name: start-task
description: Start working on a Linear issue — fetches details, moves to In Progress, creates feature branch
args: issue_id
---

# Start Task

You are starting work on a Linear issue. Follow these steps exactly:

## 1. Validate no other task is active

Check if there's already a branch checked out that follows the `feat/ART-*` pattern:

```bash
git rev-parse --abbrev-ref HEAD
```

If the current branch matches `feat/ART-*`, STOP and tell the user:

> "You're already on branch `{branch}`. Finish or stash that task first with `/finish-task` before starting a new one."

## 2. Fetch the Linear issue

Use the Linear MCP tool to get the issue details:

- Call `get_issue` with the provided issue ID (e.g., `ART-32`)
- Extract: title, description, priority, labels

Display a brief summary:

> **Starting:** ART-XX — {title}
> **Priority:** {priority}
> **Description:** {first 2 lines}

## 3. Move to In Progress

Use the Linear MCP `save_issue` tool:

- Set `state` to `"In Progress"`
- Set `assignee` to `"me"`

## 4. Create feature branch

Generate a branch name from the issue:

- Format: `feat/ART-XX-short-kebab-description`
- Keep the description to 3-5 words max
- Example: `feat/ART-32-fix-tenant-category-leak`

```bash
git checkout develop
git pull origin develop
git checkout -b feat/ART-XX-short-description
```

## 5. Confirm

Tell the user:

> Task started: ART-XX — {title}
> Branch: `feat/ART-XX-description`
> Linear status: In Progress
>
> You're ready to code. When done, run `/finish-task`.

## Important Rules

- NEVER start a task if another feature branch is already checked out
- ALWAYS branch from `develop`, never from `main`
- ALWAYS pull latest `develop` before branching
- If the issue doesn't exist in Linear, tell the user and stop
