---
name: start-task
description: Start working on a Linear issue — fetches details, moves to In Progress, creates branch, enters plan mode
args: issue_id
---

# Start Task

You are starting work on a Linear issue. Follow these steps exactly:

## 1. Validate no other task is active

Check if there's already a branch checked out that follows the `WIP/*` pattern:

```bash
git rev-parse --abbrev-ref HEAD
```

If the current branch matches `WIP/*`, STOP and tell the user:

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

## 4. Create branch

Generate a branch name from the issue:

- Format: `WIP/<ISSUE-ID>-short-kebab-description`
- Keep the description to 3-5 words max
- Example: `WIP/QOS-36-fix-clover-sandbox-url`

```bash
git checkout develop
git pull origin develop
git checkout -b WIP/QOS-XX-short-description
```

## 5. Enter plan mode

Now enter plan mode to design the implementation:

- Read the full Linear issue description (which contains the implementation prompt)
- Explore the codebase as needed to understand the affected areas
- Present an implementation plan for the developer to approve before coding begins

Use the `EnterPlanMode` tool to switch into plan mode.

## 6. Confirm

Tell the user:

> Task started: QOS-XX — {title}
> Branch: `WIP/QOS-XX-description`
> Linear status: In Progress
>
> Review the implementation plan above. Once approved, coding will begin.

## Important Rules

- NEVER start a task if another `WIP/*` branch is already checked out
- ALWAYS branch from `develop`, never from `main`
- ALWAYS pull latest `develop` before branching
- If the issue doesn't exist in Linear, tell the user and stop
- ALWAYS enter plan mode after creating the branch — do not start coding without an approved plan
