# Qaos — Project Rules for Claude Code

> These rules are loaded automatically by Claude Code. Follow them at all times.

## Workflow Rules

1. **One task at a time.** Always start with `/start-task <LINEAR-ID>` before making any changes. Never work on multiple tasks simultaneously.
2. **Never push directly to `main` or `develop`.** All changes go through feature branches and pull requests.
3. **Run all checks before committing:** `pnpm lint && pnpm typecheck && pnpm test`
4. **Use conventional commit messages:** `type(scope): description [ART-XX]`
   - Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf`
   - Always include the Linear issue ID in the commit message.
5. **Finish tasks properly.** Use `/finish-task` to lint, test, commit, push, create PR, and update Linear — all in one step.
6. **Small PRs only.** Each PR should address one Linear issue. If an issue is too large, break it into sub-issues first.

## Code Standards

### TypeScript

- **No `any` types.** Use proper TypeScript types. If unsure, use `unknown` and narrow.
- **Strict mode is on.** Do not disable `@ts-expect-error` without a comment explaining why.
- **No `console.log` in production code.** Use Sentry for error tracking: `Sentry.captureException(error)` or `Sentry.captureMessage(msg)`.

### Next.js / App Router

- **Server Actions only for data mutations.** Never call Supabase directly from client components.
- **Every Supabase query must include a `store_id` filter.** This is a multi-tenant app. Missing `store_id` = cross-tenant data leak. No exceptions.
- **Use `"use server"` and `"use client"` directives explicitly.** Never rely on inference.
- **Route handlers go in `app/api/`.** Server actions go in `lib/actions/` or co-located `actions.ts` files.

### Supabase

- **Always check RLS policies** when adding new tables or modifying access patterns.
- **Use parameterised queries.** Never interpolate user input into SQL strings.
- **Handle errors explicitly.** Every `.from()` call should check `{ data, error }` and handle the error case.

### Stripe

- **Verify webhook signatures** on every webhook handler.
- **Use idempotency keys** for payment-related operations.
- **Never store full card details.** Use Stripe Elements / Payment Intents only.

### Styling

- **Tailwind CSS only.** No inline styles, no CSS modules, no styled-components.
- **Use design tokens** from the existing theme where available.

## File Organisation

```
src/
├── app/              # Next.js App Router pages and layouts
├── components/       # Shared UI components
│   ├── ui/           # Base design system (shadcn)
│   └── [feature]/    # Feature-specific components
├── lib/
│   ├── actions/      # Server actions
│   ├── hooks/        # Custom React hooks
│   ├── utils/        # Utility functions
│   └── supabase/     # Supabase client and helpers
├── types/            # TypeScript type definitions
└── tests/            # Test files (mirror src/ structure)
```

## Banned Patterns

- `eslint-disable` without an inline comment explaining why
- `@ts-ignore` — use `@ts-expect-error` with explanation instead
- `process.env.` accessed directly in client code — use server-side env only
- Hardcoded API keys, tokens, or secrets anywhere in source
- `fetch()` to external APIs from client components — proxy through API routes
- `useEffect` for data fetching — use server components or React Query

## Testing

- **Every new feature needs at least one test.** Unit test for logic, integration test for API routes.
- **Test file naming:** `*.test.ts` or `*.test.tsx`, co-located with the source file or in `tests/`.
- **Use `@testing-library/react`** for component tests. No `enzyme`.
- **Mock Supabase and Stripe** in tests — never hit real services.

## Security Checklist (before every PR)

- [ ] All Supabase queries filter by `store_id`
- [ ] No secrets or tokens in source code
- [ ] No `console.log` statements
- [ ] Error responses don't leak internal details
- [ ] Input validation on all user-facing endpoints
- [ ] Auth checks on all protected routes and server actions
