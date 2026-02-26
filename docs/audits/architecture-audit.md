# Architecture & Production-Readiness Audit

**Date:** 2026-02-26
**Scope:** Full-stack review — security, performance, scalability, deployment
**Stack:** Next.js 16.1.2, React 19, Supabase, Stripe, Vercel target
**Codebase:** 99 API routes, 47 pages, 137 components, 62 migrations, 1897 tests

---

## Executive Summary

The codebase is **well-architected** with strong security fundamentals — proper CSRF, RLS, multi-tenant isolation, and consistent API patterns. The main gaps are **operational**: no error monitoring, no CI/CD pipeline, no env validation, and a handful of performance bottlenecks that will surface under load. Below are 23 findings organized by severity.

---

## CRITICAL — Fix Before Launch

### 1. No Error Monitoring Service

**Impact:** Production errors are invisible. Users will report bugs before you know they exist.

**Current state:** Only `console.error()` — no Sentry, LogRocket, Datadog, or equivalent.

**Files affected:**
- `components/ErrorBoundary.tsx:27-30` — catches errors, logs to console only
- `app/(dashboard)/error.tsx:13-58` — segment-level error UI, no reporting
- All API routes — errors logged to console, lost on Vercel function completion

**Fix:** Install Sentry for Next.js:
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Then add to `ErrorBoundary.tsx`:
```typescript
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  Sentry.captureException(error, { extra: errorInfo })
}
```

---

### 2. No Environment Variable Validation

**Impact:** Missing env vars cause silent failures or cryptic runtime errors. Placeholder fallbacks mask misconfigurations.

**Files affected:**
- `lib/supabase/client.ts` — falls back to `https://placeholder.supabase.co` if URL missing
- `lib/supabase/admin.ts` — uses `!` non-null assertions without checks
- `lib/supabase/server.ts` — no validation

**Fix:** Create `lib/env.ts`:
```typescript
import { z } from 'zod'

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  RESEND_API_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().min(16),
})

export const env = serverSchema.parse(process.env)
```

Import in `next.config.ts` to fail at build time.

---

### 3. Known Vulnerabilities in Dependencies

**Impact:** Next.js 16.1.2 has 3 known DoS/RCE vulnerabilities. `xlsx` has unfixable prototype pollution.

| Package | Severity | Issue | Fix |
|---------|----------|-------|-----|
| `next@16.1.2` | HIGH | 3 DoS/RCE vulns | Upgrade to `16.1.6+` |
| `xlsx@0.18.5` | HIGH | Prototype pollution, ReDoS | Replace with `papaparse` for CSV or accept risk |
| `rollup` (transitive) | HIGH | Path traversal file write | `npm audit fix` |
| `minimatch` (transitive) | HIGH | ReDoS | `npm audit fix` |

**Fix:**
```bash
npm install next@latest
npm audit fix
```

For `xlsx`: if only used for CSV export, replace with native CSV generation (already partially done in `lib/export.ts`).

---

### 4. No CI/CD Pipeline

**Impact:** No automated tests on PRs. Broken code can be deployed to production.

**Current state:** `.github/workflows/` exists but is empty. No GitHub Actions, no pre-deploy checks.

**Fix:** Create `.github/workflows/ci.yml`:
```yaml
name: CI
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run test:run
      - run: npm run build
```

---

### 5. No Backup/Disaster Recovery Plan

**Impact:** If Supabase data is corrupted or accidentally deleted, there is no documented recovery procedure.

**Fix:**
- Enable Supabase Point-in-Time Recovery (PITR) on your project
- Document backup frequency and recovery steps
- Add data retention policy for unbounded tables (`audit_logs`, `stock_history`)
- Consider scheduled pg_dump exports to S3/GCS for independent backups

---

## HIGH — Fix Within First Month

### 6. N+1 Query Patterns in Recipe & Menu Item Endpoints

**Impact:** 20 recipes/page × 2 queries/recipe = 40 extra database queries per request. Noticeable latency with >10 recipes.

**File:** `app/api/stores/[storeId]/recipes/route.ts:67-106`
```typescript
// CURRENT: N+1 — queries inside Promise.all(map(...))
const recipesWithCosts = await Promise.all(
  (data || []).map(async (recipe) => {
    const { data: ingredients } = await context.supabase
      .from('recipe_ingredients')
      .select('*').eq('recipe_id', recipe.id) // N queries!
  })
)
```

**Fix:** Batch fetch all ingredients in one query:
```typescript
const recipeIds = (data || []).map(r => r.id)
const { data: allIngredients } = await context.supabase
  .from('recipe_ingredients')
  .select('*, inventory_item:inventory_items(id, name, unit)')
  .in('recipe_id', recipeIds)

// Group by recipe_id in JS
const ingredientsByRecipe = groupBy(allIngredients, 'recipe_id')
```

**Same pattern in:** `app/api/stores/[storeId]/menu-items/route.ts:52-108`

---

### 7. N+1 in Public API Stock Operations

**File:** `app/api/v1/stock/route.ts:135-180`

**Issue:** Loop-based queries — 3 queries per item (fetch, upsert, insert history).

**Fix:** Fetch all current inventory in one query, then batch upsert:
```typescript
const itemIds = items.map(i => i.inventory_item_id)
const { data: current } = await adminClient
  .from('store_inventory')
  .select('inventory_item_id, quantity')
  .eq('store_id', storeId)
  .in('inventory_item_id', itemIds)
```

---

### 8. Rate Limit IP Spoofing via X-Forwarded-For

**Impact:** Attacker can bypass rate limits by forging the `X-Forwarded-For` header, enabling brute-force password attacks.

**File:** Rate-limited auth routes (login, signup) — IP extracted from untrusted header.

**Current pattern:**
```typescript
const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  || request.headers.get('x-real-ip')
  || 'unknown'
```

**Fix:** On Vercel, use the trusted header:
```typescript
// Vercel sets this reliably — cannot be spoofed
const ip = request.headers.get('x-real-ip')
  || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  || 'unknown'
```

Or for extra safety, combine IP + user identifier for rate limit keys on auth endpoints.

---

### 9. No Content Security Policy (CSP) Header

**Impact:** Without CSP, XSS attacks can load arbitrary scripts.

**Current state:** All other security headers present (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). CSP is the only major one missing.

**Fix:** Add to `next.config.ts` headers:
```typescript
{
  key: 'Content-Security-Policy',
  value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com; frame-src https://js.stripe.com; font-src 'self';"
}
```

Start with `report-only` mode to catch violations before enforcing.

---

### 10. No Structured Logging

**Impact:** Production logs are unstructured `console.error()` calls. Cannot search, filter, or alert on specific error types.

**Files affected:** 50+ API routes use raw `console.error()`

**Fix:** Create a minimal structured logger:
```typescript
// lib/logger.ts
export const logger = {
  error(message: string, context?: Record<string, unknown>) {
    console.error(JSON.stringify({ level: 'error', message, ...context, timestamp: new Date().toISOString() }))
  },
  warn(message: string, context?: Record<string, unknown>) {
    console.warn(JSON.stringify({ level: 'warn', message, ...context, timestamp: new Date().toISOString() }))
  },
  info(message: string, context?: Record<string, unknown>) {
    console.log(JSON.stringify({ level: 'info', message, ...context, timestamp: new Date().toISOString() }))
  },
}
```

Vercel Log Drains can then pipe structured JSON logs to Datadog/Logflare.

---

### 11. Sensitive Data in Rate Limit Logs

**File:** `lib/rate-limit.ts:18-22`

**Issue:** Redis initialization failure could log the Redis URL (which contains the token).

**Fix:** Catch and sanitize:
```typescript
try {
  redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
} catch (e) {
  console.warn('Redis unavailable, using in-memory rate limiting')
  // Do NOT log the error object — it may contain credentials
}
```

---

## MEDIUM — Fix When Possible

### 12. No Dynamic Imports for Heavy Components

**Impact:** Recharts (~200KB) and chart components are statically imported, bundled into pages even if user never visits reports.

**Files:** 8 chart components in `components/charts/`

**Fix:**
```typescript
import dynamic from 'next/dynamic'

const ForecastChart = dynamic(
  () => import('@/components/charts/ForecastChart'),
  { loading: () => <ChartSkeleton /> }
)
```

Apply to: `ForecastChart`, `InventoryHealthChart`, `StockTrendChart`, `StoreComparisonChart`, `TopMovingItemsChart`, `WasteAnalyticsCharts`

---

### 13. No `loading.tsx` Files for Dashboard Pages

**Impact:** No streaming SSR / page-level loading skeletons. Users see blank pages during navigation.

**Current state:** 0 `loading.tsx` files found under `app/(dashboard)/`

**Fix:** Add `loading.tsx` to high-traffic routes:
```
app/(dashboard)/loading.tsx          (global dashboard skeleton)
app/(dashboard)/inventory/loading.tsx
app/(dashboard)/reports/loading.tsx
app/(dashboard)/billing/loading.tsx
```

---

### 14. Missing Composite Indexes on HACCP Tables

**Impact:** Dashboard time-series queries will degrade as HACCP data grows.

**File:** `supabase/migrations/062_haccp_food_safety.sql`

**Missing indexes:**
```sql
CREATE INDEX idx_haccp_checks_store_date
  ON haccp_checks(store_id, completed_at DESC);
CREATE INDEX idx_haccp_temp_logs_store_date
  ON haccp_temperature_logs(store_id, recorded_at DESC);
CREATE INDEX idx_haccp_corrective_store_resolved
  ON haccp_corrective_actions(store_id, resolved_at);
```

---

### 15. Missing Index on `inventory_item_tags` Junction Table

**File:** `supabase/migrations/038_item_categories_and_tags.sql`

**Fix:**
```sql
CREATE INDEX idx_inventory_item_tags_item_id
  ON inventory_item_tags(inventory_item_id);
```

---

### 16. Expensive RLS Self-Join on Profiles Table

**File:** `supabase/migrations/006_multi_tenant_rls.sql:264-276`

**Issue:** The `profiles_select_policy` does a self-join on `store_users` for every profile query. When a Manager views 50+ users, this is expensive.

**Current:**
```sql
EXISTS (
  SELECT 1 FROM store_users my_stores
  INNER JOIN store_users their_stores ON my_stores.store_id = their_stores.store_id
  WHERE my_stores.user_id = auth.uid()
    AND my_stores.role IN ('Owner', 'Manager')
    AND their_stores.user_id = profiles.id
)
```

**Recommendation:** For bulk user listing, consider moving the authorization to the application layer and using `createAdminClient()` (after auth verification).

---

### 17. Reports Fetch Full Column Sets

**File:** `app/api/reports/daily-summary/route.ts:28-35`

**Current:** `select('*, inventory_item:inventory_items(*), store:stores(*), performer:profiles(*)')` — fetches ALL columns from joined tables.

**Fix:** Select only needed columns:
```typescript
.select(`
  id, created_at, action_type, quantity_change,
  inventory_item:inventory_items(id, name),
  store:stores(id, name),
  performer:profiles(id, full_name)
`)
```

---

### 18. No HTTP Cache Headers on API Responses

**Impact:** Every request hits the database, even for data that changes infrequently (categories, tags, store settings).

**Fix:** Add cache headers to read-only, slow-changing endpoints:
```typescript
// In category/tag list endpoints
return apiSuccess(data, {
  requestId,
  headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' }
})
```

---

### 19. Offline Sync Lacks Deduplication

**File:** `lib/offline/db.ts`

**Issue:** If user saves the same stock count twice while offline, both operations queue. API must be idempotent or duplicates will be created.

**Fix:** Add operation hash:
```typescript
export interface PendingOperation {
  // existing fields...
  operationHash: string // SHA256(type + storeId + JSON.stringify(data))
}
```

Check for existing hash before queuing.

---

### 20. localStorage Access Without Error Handling

**File:** `components/providers/AuthProvider.tsx:124-126, 262-264, 356-358`

**Issue:** `localStorage.getItem()` / `setItem()` will throw in incognito mode on some browsers or when storage is full.

**Fix:**
```typescript
function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key) }
  catch { return null }
}
```

---

### 21. No Cross-Tab Store Synchronization

**File:** `components/providers/AuthProvider.tsx`

**Issue:** If a user switches stores in Tab A, Tab B still shows old store data until manual refresh.

**Fix:** Listen for `storage` events:
```typescript
useEffect(() => {
  const handler = (e: StorageEvent) => {
    if (e.key === CURRENT_STORE_KEY && e.newValue) {
      setCurrentStore(e.newValue)
    }
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}, [])
```

---

### 22. Middleware Auth Check Is Cookie-Existence Only

**File:** `middleware.ts:39-41`

**Issue:** Middleware only checks if a `sb-*-auth-token` cookie exists, not if it's valid. A forged cookie bypasses the redirect.

**Mitigation:** This is defense-in-depth only — all API routes properly validate via `supabase.auth.getUser()`. The middleware redirect is a UX layer, not a security boundary. Current approach is acceptable but worth noting.

---

### 23. Permissions-Policy Header Inconsistency

**Files:** `next.config.ts:39` vs `middleware.ts:28`

**Issue:** Headers differ:
- `next.config.ts`: `camera=(self), microphone=(), geolocation=()`
- `middleware.ts`: `camera=(), microphone=(), geolocation=()`

Camera is allowed from `self` in one but blocked in the other. Since barcode scanning needs the camera, `camera=(self)` is correct.

**Fix:** Align `middleware.ts:28` to match `next.config.ts`:
```typescript
'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
```

---

## Architecture Strengths

These patterns are well-implemented and should be maintained:

| Area | Assessment |
|------|------------|
| **Multi-tenant isolation** | Excellent — RLS + `store_users` junction + `canAccessStore()` in every route |
| **CSRF protection** | Excellent — timing-safe comparison, proper double-submit cookie |
| **API route consistency** | 95% use `withApiAuth` + response helpers correctly |
| **Pagination** | All list endpoints paginated with bounded page sizes |
| **Webhook idempotence** | Both Stripe and POS webhooks have deduplication |
| **Admin client usage** | Always gated behind auth verification |
| **Supabase client architecture** | Singleton browser client, cached admin client, per-request server client |
| **Auth race condition handling** | `latestRequestIdRef` pattern prevents stale state |
| **Store switching isolation** | No data cross-contamination between stores |
| **TypeScript strict mode** | Enabled, catches type errors at compile time |
| **Zod validation** | Consistent schema validation on both client and server |
| **RLS helper functions** | Correctly use `LANGUAGE sql` to avoid infinite recursion |
| **Health check endpoint** | Comprehensive with timing, DB connectivity, auth checks |

---

## Priority Action Plan

### Week 1 (Before Launch)
1. Upgrade Next.js to latest patch (`npm install next@latest`)
2. Add env validation (`lib/env.ts` with Zod)
3. Install Sentry (`@sentry/nextjs`)
4. Create basic CI workflow (`.github/workflows/ci.yml`)
5. Fix Permissions-Policy header inconsistency

### Week 2 (First Users)
6. Fix N+1 queries in recipes/menu-items endpoints
7. Add CSP header (start in report-only mode)
8. Add structured logger
9. Add `loading.tsx` to 4 key routes
10. Apply missing database indexes (HACCP + item_tags)

### Month 1
11. Dynamic imports for chart components
12. HTTP cache headers on read-only endpoints
13. localStorage error handling
14. Sanitize rate-limit error logs
15. Set up backup verification procedure

---

*Generated by architecture audit — 2026-02-26*
