---
name: finish-task
description: Finish the current task — run checks, commit, push, create PR, update Linear
---

# Finish Task

You are finishing the current task. Follow these steps exactly and STOP if any step fails.

## 1. Identify the current task

```bash
git rev-parse --abbrev-ref HEAD
```

Extract the Linear issue ID from the branch name (e.g., `WIP/QOS-36-fix-clover-sandbox-url` → `QOS-36`).

If the branch doesn't match `WIP/*`, STOP:

> "You're not on a feature branch. Start a task first with `/start-task QOS-XX`."

## 2. Run all checks

Run each check sequentially. If ANY fails, STOP and fix the issues before continuing.

```bash
npm run lint
```

If lint fails → fix the lint errors, then re-run.

```bash
npm run test:run
```

If tests fail → fix the failing tests, then re-run.

**Do not proceed past this step until all checks pass cleanly.**

## 3. Stage and commit

Stage all changes:

```bash
git add -A
```

Review what's staged:

```bash
git status
git diff --cached --stat
```

Create a conventional commit. Determine the type from the changes:

- Bug fix → `fix`
- New feature → `feat`
- Refactoring → `refactor`
- Tests only → `test`
- Config/tooling → `chore`

```bash
git commit -m "type(scope): concise description [QOS-XX]"
```

Example: `git commit -m "fix(categories): add store_id filter to prevent cross-tenant leak [QOS-36]"`

## 4. Push the branch

```bash
git push -u origin WIP/QOS-XX-description
```

## 5. Create pull request

Use the GitHub CLI:

```bash
gh pr create \
  --base develop \
  --title "type(scope): description [QOS-XX]" \
  --body "## Summary

Resolves QOS-XX — {issue title from Linear}

## Changes
{bullet list of what changed}

## Testing
- [ ] Lint passes
- [ ] Tests pass
- [ ] Manual testing done

## Linear
[QOS-XX](https://linear.app/qaos/issue/QOS-XX)"
```

## 6. Update Linear

Use the Linear MCP `save_issue` tool:

- Set `state` to `"In Review"`

## 7. Update ROADMAP.md

Mark the issue as complete in `ROADMAP.md` by changing its status from `Backlog` or `In Progress` to `Done`:

- Find the row matching the issue ID (e.g., `QOS-36`)
- Change the Status column to `Done`
- Stage and commit this change on the current branch before the PR is created (include it in step 3's commit, or as a separate commit)

## 8. Confirm

> Task finished: QOS-XX — {title}
> PR created: {PR URL}
> Linear status: In Review
> Checks passed: lint, tests
>
> The developer will review the PR, merge via GitHub, and delete the branch.

## Important Rules

- NEVER skip the lint/test step
- NEVER force push
- NEVER push directly to `main` or `develop` — always go through a PR
- NEVER merge the PR — the developer reviews and merges manually via GitHub
- NEVER commit, push, or merge while on `main` or `develop` — respect the safety hooks
- If checks fail, fix them in the SAME branch and re-run `/finish-task`
- Keep commits atomic — one logical change per commit
