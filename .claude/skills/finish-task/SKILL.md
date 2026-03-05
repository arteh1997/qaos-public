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

Extract the Linear issue ID from the branch name (e.g., `feat/QOS-36-fix-clover-sandbox-url` → `QOS-36`).

If the branch doesn't match `feat/*`, STOP:

> "You're not on a feature branch. Start a task first with `/start-task QOS-XX`."

## 2. Check if work was already done

```bash
git diff develop..HEAD --stat
```

**If there are no code changes** (only ROADMAP.md or nothing at all), this is a "fix already existed" case. Skip to the **Already-Done Fast Path** below.

---

### Already-Done Fast Path

If the fix was already in `develop` before this branch was created:

1. Update `ROADMAP.md` — change the issue row from `Backlog` to `Done`
2. Commit: `git commit -m "chore(roadmap): mark QOS-XX as Done — fix was already in develop [QOS-XX]"`
3. Push and open a PR to `develop`
4. Set Linear state to `"Done"` via `save_issue`
5. Confirm:

> Task finished: QOS-XX — fix already existed in `develop`
> PR: {PR URL}
> Linear status: Done

**Stop here — do not run lint/tests for a no-code change.**

---

## 3. Run all checks

Run each check sequentially. If ANY fails, STOP and fix the issues before continuing.

```bash
pnpm lint
```

If lint fails → fix the lint errors, then re-run.

```bash
pnpm test:run
```

If tests fail → fix the failing tests, then re-run.

**Do not proceed past this step until all checks pass cleanly.**

Note: RLS tests in `tests/integration/rls/` require live Supabase credentials and are expected to fail in local/CI environments without those secrets — ignore failures in that directory only.

## 4. Stage and commit

Update `ROADMAP.md` first — change the issue row from `Backlog` or `In Progress` to `Done`. Then stage everything:

```bash
git add -A
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

Example: `git commit -m "fix(tags): scope tag usage counts by store_id to prevent cross-tenant leak [QOS-33]"`

## 5. Push the branch

```bash
git push -u origin feat/QOS-XX-description
```

## 6. Create pull request and enable auto-merge

Use the GitHub CLI to create the PR, then immediately enable auto-merge so it merges automatically once CI passes and CodeRabbit approves:

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

Then enable auto-merge (squash):

```bash
gh pr merge --auto --squash
```

## 7. Update Linear

Use the Linear MCP `save_issue` tool:

- Set `state` to `"In Review"`

Linear will be automatically advanced to `"Done"` by the GitHub Actions workflow when the PR merges.

## 8. Confirm

> Task finished: QOS-XX — {title}
> PR created: {PR URL} (auto-merge enabled)
> Linear status: In Review → Done automatically on merge
> Checks passed: lint, tests

## Important Rules

- NEVER skip the lint/test step (except for the already-done fast path)
- NEVER force push
- NEVER push directly to `main` or `develop` — always go through a PR
- NEVER merge the PR — the developer reviews and merges manually via GitHub
- NEVER commit, push, or merge while on `main` or `develop` — respect the safety hooks
- If checks fail, fix them in the SAME branch and re-run `/finish-task`
- Keep commits atomic — one logical change per commit
- Always use `pnpm`, not `npm run`
