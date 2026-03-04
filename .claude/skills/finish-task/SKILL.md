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

Extract the Linear issue ID from the branch name (e.g., `feat/ART-32-fix-tenant-leak` → `ART-32`).

If the branch doesn't match `feat/ART-*`, STOP:

> "You're not on a feature branch. Start a task first with `/start-task ART-XX`."

## 2. Run all checks

Run each check sequentially. If ANY fails, STOP and fix the issues before continuing.

```bash
pnpm lint
```

If lint fails → fix the lint errors, then re-run.

```bash
pnpm typecheck
```

If typecheck fails → fix the type errors, then re-run.

```bash
pnpm test
```

If tests fail → fix the failing tests, then re-run.

**Do not proceed past this step until all three pass cleanly.**

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
git commit -m "type(scope): concise description [ART-XX]"
```

Example: `git commit -m "fix(categories): add store_id filter to prevent cross-tenant leak [ART-32]"`

## 4. Push the branch

```bash
git push -u origin feat/ART-XX-description
```

## 5. Create pull request

Use the GitHub CLI:

```bash
gh pr create \
  --base develop \
  --title "type(scope): description [ART-XX]" \
  --body "## Summary

Resolves ART-XX — {issue title from Linear}

## Changes
{bullet list of what changed}

## Testing
- [ ] Lint passes
- [ ] TypeScript passes
- [ ] Tests pass
- [ ] Manual testing done

## Linear
[ART-XX](https://linear.app/issue/ART-XX)"
```

## 6. Update Linear

Use the Linear MCP `save_issue` tool:

- Set `state` to `"In Review"`

## 7. Confirm

> Task finished: ART-XX — {title}
> PR created: {PR URL}
> Linear status: In Review
> Checks passed: lint, typecheck, tests
>
> CodeRabbit will review the PR automatically. Wait for its review before merging.

## Important Rules

- NEVER skip the lint/typecheck/test step
- NEVER force push
- NEVER create a PR targeting `main` — always target `develop`
- If checks fail, fix them in the SAME branch and re-run `/finish-task`
- Keep commits atomic — one logical change per commit
