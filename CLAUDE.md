# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
npm run test             # Vitest in watch mode
npm run test:run         # Run all tests once (1163 tests)
npm run test:coverage    # Coverage report

# Run a single test file
npx vitest run tests/integration/api/inventory.test.ts

# Run tests matching a pattern
npx vitest run -t "should return 401"

# Regenerate database types from Supabase
npm run db:types
```

## Architecture

### Multi-Tenant SaaS Model

Users belong to **stores** via the `store_users` junction table, each with a role. A user can be Owner at one store and Staff at another. All data is scoped by `store_id`. The three roles are: **Owner**, **Manager**, **Staff** (legacy role names `Admin` map to `Owner`).

### API Route Pattern

Every API route follows this structure using `withApiAuth` middleware:

```typescript
export async function POST(request: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params
  const auth = await withApiAuth(request, {
    allowedRoles: ['Owner', 'Manager'],
    rateLimit: { key: 'api', config: RATE_LIMITS.api },
    requireCSRF: true,  // Required for POST/PUT/PATCH/DELETE
  })
  if (!auth.success) return auth.response
  const { context } = auth
  // context.user.id, context.supabase, context.stores, context.requestId
}
```

**Critical rules:**
- Use `context.user.id` (NOT `context.userId`) to get the authenticated user's ID
- All state-changing endpoints (POST/PUT/PATCH/DELETE) must set `requireCSRF: true`
- Response helpers: `apiSuccess(data, { requestId })`, `apiError(msg)`, `apiBadRequest(msg, requestId)`, `apiForbidden(msg, requestId)`
- For operations that need to bypass RLS (after auth is verified), use `createAdminClient()` from `lib/supabase/admin.ts`

### Audit Logging

```typescript
await auditLog(supabaseClient, {
  userId: context.user.id,
  storeId,
  action: 'stock.count_submit',
  details: { itemCount: 5 },
})
```

The `auditLog` function takes exactly **2 arguments**: a Supabase client and an options object.

### Row-Level Security (RLS)

RLS helper functions **must** use `LANGUAGE sql` (not `plpgsql`) with `SECURITY DEFINER` to avoid infinite recursion:

```sql
-- CORRECT
CREATE FUNCTION get_user_store_ids() RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT store_id FROM store_users WHERE user_id = auth.uid()
$$;

-- WRONG (causes infinite recursion)
CREATE FUNCTION get_user_store_ids() RETURNS SETOF UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN RETURN QUERY SELECT store_id FROM store_users WHERE user_id = auth.uid(); END;
$$;
```

RLS silently filters rows rather than throwing errors. Test assertions should check for empty results, not errors:
```typescript
const { data, error } = await client.from('table').select('*').eq('store_id', otherStoreId)
expect(error).toBeNull()   // No error — RLS doesn't throw
expect(data).toEqual([])   // But zero rows returned
```

### CSRF Protection

The middleware (`middleware.ts`) sets a `csrf_token` cookie on first page load using the double-submit cookie pattern. The client-side `useCSRF()` hook provides `csrfFetch()` which reads the cookie and sends it as the `x-csrf-token` header. The server validates that cookie and header match.

### Supabase Clients

| Client | File | Use Case |
|--------|------|----------|
| Browser client | `lib/supabase/client.ts` | Client components, `supabaseFetch`/`supabaseUpdate` helpers |
| Server client | `lib/supabase/server.ts` | Server components, respects RLS via user session |
| Admin client | `lib/supabase/admin.ts` | Bypass RLS in API routes (after auth verified) |

### State Management

- **TanStack Query v5** for server state (`useStores`, `useStoreInventory`, `useStoreUsers`)
- **AuthProvider** (`components/providers/AuthProvider.tsx`) for auth context — uses request sequencing (`latestRequestIdRef`) to prevent race conditions
- `useAuth()` hook provides: `user`, `profile`, `stores`, `currentStore`, `role`, `storeId`, `signOut`, `setCurrentStore`

### Validation

Zod schemas live in `lib/validations/` (one file per domain: `store.ts`, `inventory.ts`, `user.ts`, `shift.ts`, `suppliers.ts`, `recipes.ts`, `categories-tags.ts`, `bulk-import.ts`, `auth.ts`). Used both server-side in API routes and client-side via React Hook Form.

### Rate Limiting

Upstash Redis in production (sliding window algorithm), in-memory Map fallback in development. Configured in `lib/rate-limit.ts`. Standard limits: `api` 100/min, `auth` 10/min, `createUser` 5/min.

## Testing

- **Test runner:** Vitest with `node` environment (hooks use `jsdom` via `environmentMatchGlobs`)
- **Setup file:** `tests/setup.ts`
- **API tests:** `tests/integration/api/` — mock Supabase client, CSRF, rate limiting
- **RLS tests:** `tests/integration/rls/` — require real Supabase credentials (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- **Path alias:** `@/` resolves to project root

Standard test mock pattern for API routes:
```typescript
const mockSupabaseClient = { auth: { getUser: vi.fn() }, from: vi.fn() }
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)) }))
vi.mock('@/lib/csrf', () => ({ validateCSRFToken: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, remaining: 99, resetTime: Date.now() + 60000, limit: 100 })),
  RATE_LIMITS: { api: { limit: 100, windowMs: 60000 } },
  getRateLimitHeaders: vi.fn(() => ({})),
}))
```

When a route uses `createAdminClient()`, the test must also mock `@/lib/supabase/admin`.

## Key File Locations

| Purpose | Path |
|---------|------|
| API auth middleware | `lib/api/middleware.ts` |
| API response helpers | `lib/api/response.ts` |
| Auth & permissions | `lib/auth.ts` |
| Role/permission constants | `lib/constants.ts` |
| Rate limiting | `lib/rate-limit.ts` |
| CSRF protection | `lib/csrf.ts` |
| Audit logging | `lib/audit.ts` |
| Email sending | `lib/email.ts` |
| Database types (generated) | `types/database.ts` |
| App types | `types/index.ts` |
| Auth context provider | `components/providers/AuthProvider.tsx` |
| DB migrations | `supabase/migrations/` (000–044) |

## Types

Core roles and types are in `types/index.ts`:
- `AppRole = 'Owner' | 'Manager' | 'Staff'`
- `StoreUser` — junction table with `store_id`, `user_id`, `role`, `is_billing_owner`
- `StockHistory.action_type` — `'Count' | 'Reception' | 'Adjustment' | 'Waste' | 'Sale'`
- `PurchaseOrder.status` — `'draft' | 'submitted' | 'acknowledged' | 'shipped' | 'partial' | 'received' | 'cancelled'`

## Environment Variables

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

Optional: `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`
