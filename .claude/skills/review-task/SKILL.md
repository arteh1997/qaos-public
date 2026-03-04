---
name: review-task
description: Review a pull request for code quality, security, and project standards
args: pr_number
---

# Review Task

You are reviewing a pull request for the Qaos project. This supplements CodeRabbit with project-specific checks.

## 1. Get the PR diff

```bash
gh pr diff {pr_number}
```

Also get the PR details:

```bash
gh pr view {pr_number}
```

## 2. Security checks (CRITICAL — check these first)

Scan every changed file for:

### Multi-tenant isolation

- [ ] Every Supabase `.from()` call includes `.eq('store_id', storeId)` or equivalent filter
- [ ] No raw SQL without `store_id` in WHERE clause
- [ ] RLS policies are not being bypassed with `service_role` key without good reason

### Secrets and credentials

- [ ] No hardcoded API keys, tokens, or passwords
- [ ] No `.env` values exposed in client-side code
- [ ] No `process.env` accessed in client components

### Auth

- [ ] Protected routes check authentication
- [ ] Server actions verify the user's session
- [ ] API routes validate auth headers / webhook signatures

**If any security issue is found, flag it as a BLOCKING issue.**

## 3. Code quality checks

Scan for:

### Banned patterns

- [ ] No `console.log` (use Sentry instead)
- [ ] No `any` types (use proper TypeScript)
- [ ] No `eslint-disable` without explanation comment
- [ ] No `@ts-ignore` (use `@ts-expect-error` with comment)
- [ ] No `useEffect` for data fetching

### Best practices

- [ ] Error handling on all async operations
- [ ] Loading states for async UI
- [ ] Proper TypeScript types (no implicit any)
- [ ] Server actions use `"use server"` directive
- [ ] Client components use `"use client"` directive

### Dead code

- [ ] No commented-out code blocks
- [ ] No unused imports
- [ ] No TODO/FIXME without a Linear issue reference

## 4. Testing

- [ ] New features have corresponding tests
- [ ] Tests cover both happy path and error cases
- [ ] Mocks are used for external services (Supabase, Stripe)
- [ ] No `.only` or `.skip` left in test files

## 5. Post review summary

Post a comment on the PR using:

```bash
gh pr comment {pr_number} --body "review content"
```

Format the review as:

## Code Review — ART-XX

### Security

{No issues or list them}

### Code Quality

{Clean or list issues}

### Testing

{Adequate or list gaps}

### Verdict

{APPROVE — ready to merge | REQUEST CHANGES — must fix before merging}

## 6. Update Linear (if blocking issues found)

If there are blocking issues, use the Linear MCP `save_issue` tool:

- Add a comment describing the issues found
- Keep state as "In Review"

Tell the user what needs to be fixed and that they should re-run `/finish-task` after fixing.

## Important Rules

- Security issues are ALWAYS blocking — no exceptions
- Be specific: don't say "fix the types" — say which file, which line, what's wrong
- If the PR is clean, say so clearly and approve
- Never merge the PR yourself — that's the developer's decision after review
