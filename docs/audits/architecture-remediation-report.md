# Architecture Audit — Remediation Report

Generated: 2026-02-26T12:00:00Z

## Summary

| Metric | Value |
|--------|-------|
| Total findings addressed | 23 |
| Files modified | ~100 |
| Files created | 15 |
| New dependencies added | `@sentry/nextjs` |
| Dependencies upgraded | `next` 16.1.2 → 16.1.6 |
| New database migrations | 1 (`063_performance_indexes.sql`) |
| Test suite status | **PASS** — 1897/1897 tests across 95 files |

---

## Changes by Phase

### Phase 1 — CRITICAL

#### FIX 1.1: Environment Variable Validation
- **Finding**: Missing env vars cause cryptic runtime errors; fallback placeholders mask misconfiguration.
- **Fix**: Created `lib/env.ts` with Zod schemas for client and server variables. Client vars validated eagerly at import time; server vars validated lazily on first use. Test environment skips validation.
- **Files**:
  - Created: `lib/env.ts`
  - Modified: `lib/supabase/client.ts`, `lib/supabase/admin.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `next.config.ts`
- **Status**: COMPLETE

#### FIX 1.2: Dependency Vulnerabilities
- **Finding**: `npm audit` reported vulnerabilities in transitive dependencies.
- **Fix**: Upgraded `next` 16.1.2 → 16.1.6, ran `npm audit fix`. Documented the residual `xlsx@0.18.5` advisory (server-side only, trusted data, no user-uploaded parsing).
- **Files**:
  - Modified: `package.json`, `package-lock.json`
  - Modified: `app/api/stores/[storeId]/export/route.ts` (security comment)
- **Status**: COMPLETE — 0 actionable vulnerabilities remaining

#### FIX 1.3: Error Monitoring (Sentry)
- **Finding**: No error monitoring — production errors invisible.
- **Fix**: Installed `@sentry/nextjs`, created client/server/edge configs, wired into `ErrorBoundary`, dashboard `error.tsx`, and the `apiError()` response helper (auto-reports all 5xx).
- **Files**:
  - Created: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
  - Modified: `components/ErrorBoundary.tsx`, `app/(dashboard)/error.tsx`, `lib/api/response.ts`, `next.config.ts`
- **Status**: COMPLETE — requires `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` env vars in production

#### FIX 1.4: CI/CD Pipeline
- **Finding**: No automated checks on PRs — broken code can reach main.
- **Fix**: Created `.github/workflows/ci.yml` — runs lint, type check (`tsc --noEmit`), full test suite, and production build on every push/PR. Uses Node 20, concurrency groups for PR cancellation.
- **Files**:
  - Created: `.github/workflows/ci.yml`
- **Status**: COMPLETE

#### FIX 1.5: Disaster Recovery Documentation
- **Finding**: No documented recovery procedures.
- **Fix**: Created `docs/disaster-recovery.md` covering Supabase PITR, Vercel rollbacks, manual recovery steps, RTO/RPO targets, and data retention policy.
- **Files**:
  - Created: `docs/disaster-recovery.md`
- **Status**: COMPLETE

---

### Phase 2 — HIGH

#### FIX 2.1: N+1 Query — Recipes Endpoint
- **Finding**: `GET /api/stores/:storeId/recipes` issued a separate `recipe_ingredients` + cost query per recipe inside `Promise.all(map(...))`.
- **Fix**: Replaced with batch query: fetch all recipe IDs, batch-fetch all ingredients in one query, batch-fetch costs, group in JavaScript.
- **Files**:
  - Modified: `app/api/stores/[storeId]/recipes/route.ts`
- **Status**: COMPLETE

#### FIX 2.2: N+1 Query — Menu Items Endpoint
- **Finding**: `GET /api/stores/:storeId/menu-items` issued per-item recipe + ingredients queries.
- **Fix**: Same batch pattern — fetch all menu item recipe IDs, batch-fetch recipe ingredients, group by recipe_id.
- **Files**:
  - Modified: `app/api/stores/[storeId]/menu-items/route.ts`
- **Status**: COMPLETE

#### FIX 2.3: N+1 Query — V1 Stock Endpoint
- **Finding**: `POST /api/v1/stock` looped per-item for current inventory fetch, upsert, and history insert.
- **Fix**: Batch-fetch current inventory with `.in('inventory_item_id', itemIds)`, single `.upsert()` for all items, single `.insert()` for all history records.
- **Files**:
  - Modified: `app/api/v1/stock/route.ts`
  - Modified: `tests/integration/api/v1-api.test.ts` (updated mock to array format)
- **Status**: COMPLETE

#### FIX 2.4: Rate Limit IP Spoofing Prevention
- **Finding**: `x-forwarded-for` checked before `x-real-ip`; attackers can spoof `x-forwarded-for` to bypass IP-based rate limiting.
- **Fix**: Changed IP extraction order to prioritize `x-real-ip` (set by Vercel reverse proxy, not user-controllable).
- **Files**:
  - Modified: `app/api/auth/login/route.ts`, `app/api/auth/signup/route.ts`, `lib/audit.ts`, `lib/api/with-supplier-auth.ts`
- **Status**: COMPLETE

#### FIX 2.5: Content Security Policy
- **Finding**: No CSP header — XSS attacks have no mitigation layer.
- **Fix**: Added `Content-Security-Policy-Report-Only` header in both `next.config.ts` (static) and `middleware.ts` (dynamic). Report-only mode allows monitoring without breaking functionality. Covers `default-src`, `script-src`, `style-src`, `img-src`, `connect-src`, `font-src`, `frame-ancestors`.
- **Files**:
  - Modified: `next.config.ts`, `middleware.ts`
- **Status**: COMPLETE — deploy in report-only, then enforce after monitoring

#### FIX 2.6: Structured Logging
- **Finding**: `console.error/warn` throughout — unstructured, no severity levels, not compatible with log aggregation.
- **Fix**: Created `lib/logger.ts` with JSON-structured output (`{ level, message, timestamp, ...context }`). Replaced all `console.error()` and `console.warn()` calls across 84 API routes and 6 library files.
- **Files**:
  - Created: `lib/logger.ts`
  - Modified: ~90 files (all API routes + `lib/rate-limit.ts`, `lib/auth.ts`, `lib/email.ts`, `lib/services/pos.ts`, `lib/stripe/server.ts`, etc.)
- **Status**: COMPLETE

#### FIX 2.7: Sensitive Data in Logs
- **Finding**: Redis connection errors could leak the Upstash URL (which contains embedded credentials) via `console.error`.
- **Fix**: Changed `lib/rate-limit.ts` catch block to suppress the error object entirely, logging only a generic "Redis unavailable" warning.
- **Files**:
  - Modified: `lib/rate-limit.ts`
- **Status**: COMPLETE

---

### Phase 3 — MEDIUM

#### FIX 3.1: Dynamic Imports for Heavy Components
- **Finding**: Chart libraries (Recharts) imported statically — inflates initial JS bundle for pages that may not show charts immediately.
- **Fix**: Converted chart component imports to `next/dynamic` with SSR disabled and skeleton loading placeholders.
- **Files**:
  - Modified: `app/(dashboard)/reports/benchmark/page.tsx`, `app/(dashboard)/reports/forecast/page.tsx`, `app/(dashboard)/waste/page.tsx`
- **Status**: COMPLETE

#### FIX 3.2: Route-Level Loading States
- **Finding**: No `loading.tsx` files — users see nothing during route transitions with SSR streaming.
- **Fix**: Created `loading.tsx` with skeleton UI for the four most visited route groups.
- **Files**:
  - Created: `app/(dashboard)/loading.tsx`, `app/(dashboard)/inventory/loading.tsx`, `app/(dashboard)/reports/loading.tsx`, `app/(dashboard)/billing/loading.tsx`
- **Status**: COMPLETE

#### FIX 3.3: Missing Database Indexes
- **Finding**: HACCP tables and several high-traffic query patterns lack composite indexes.
- **Fix**: Created migration with 6 indexes covering HACCP queries, inventory tag lookups, stock history, and audit logs.
- **Files**:
  - Created: `supabase/migrations/063_performance_indexes.sql`
- **Status**: COMPLETE — apply via `supabase db push` or `supabase migration up`

#### FIX 3.4: Over-Fetching in Daily Summary
- **Finding**: `GET /api/reports/daily-summary` used `select('*')` on joins, pulling unnecessary columns.
- **Fix**: Replaced with explicit column selects for each joined table.
- **Files**:
  - Modified: `app/api/reports/daily-summary/route.ts`
- **Status**: COMPLETE

#### FIX 3.5: Cache Headers for Stable Data
- **Finding**: Relatively stable data (categories, tags) served without cache headers — unnecessary re-fetches.
- **Fix**: Added `cacheControl` option to `apiSuccess()` helper, applied `Cache-Control: private, max-age=300` to categories and tags GET endpoints.
- **Files**:
  - Modified: `lib/api/response.ts`, `app/api/stores/[storeId]/categories/route.ts`, `app/api/stores/[storeId]/tags/route.ts`
- **Status**: COMPLETE

#### FIX 3.6: Safe localStorage Access
- **Finding**: Direct `localStorage` access throws in SSR, private browsing, or when storage is full.
- **Fix**: Created `lib/utils/storage.ts` with try/catch wrappers. Updated all consumer code.
- **Files**:
  - Created: `lib/utils/storage.ts`
  - Modified: `components/providers/AuthProvider.tsx`, `components/PWAInstallPrompt.tsx`
- **Status**: COMPLETE

#### FIX 3.7: Offline Sync Deduplication
- **Finding**: Offline queue in IndexedDB can accumulate duplicate operations if the user retries while offline.
- **Fix**: Added `operationHash` field to the Dexie schema and a simple hash-based dedup check before inserting new operations.
- **Files**:
  - Modified: `lib/offline/db.ts`
- **Status**: COMPLETE

#### FIX 3.8: Cross-Tab Store Synchronization
- **Finding**: Changing the current store in one tab leaves other tabs stale.
- **Fix**: Added `storage` event listener in AuthProvider that detects `currentStoreId` changes and updates state accordingly.
- **Files**:
  - Modified: `components/providers/AuthProvider.tsx`
- **Status**: COMPLETE

#### FIX 3.9: Permissions-Policy Header Mismatch
- **Finding**: `next.config.ts` and `middleware.ts` set different `Permissions-Policy` values — middleware overwrites the stricter config value.
- **Fix**: Unified both to `camera=(self), microphone=(), geolocation=()` to allow barcode scanner camera access.
- **Files**:
  - Modified: `middleware.ts`
- **Status**: COMPLETE

#### FIX 3.10: Middleware Auth Documentation
- **Finding**: Middleware checks for auth cookies but the rationale isn't documented — future devs may remove it.
- **Fix**: Added documentation comment explaining the auth cookie check prevents unnecessary SSR for unauthenticated users.
- **Files**:
  - Modified: `middleware.ts`
- **Status**: COMPLETE

---

### Phase 4 — Additional Hardening

#### FIX 4.1: Security Scan
- **Finding check**: Scanned all API routes for injection, auth bypass, and IDOR vulnerabilities.
- **Result**: 1 minor observation — pre-auth query parameter parsing (non-exploitable since `withApiAuth` gates all operations). No actionable issues found.
- **Status**: COMPLETE — no changes needed

#### FIX 4.2: Hardcoded Secrets Check
- **Finding check**: Searched for hardcoded API keys, tokens, passwords, and connection strings.
- **Result**: No secrets found in source code. `.gitignore` properly excludes `.env*` files. All secrets are environment-variable driven.
- **Status**: COMPLETE — no changes needed

#### FIX 4.3: Full Test Suite Verification
- **Result**: **1897 tests passing across 95 test files** — zero failures, zero skipped.
- **Status**: COMPLETE

---

## Additional Issues Discovered During Remediation

| Issue | Severity | Resolution |
|-------|----------|------------|
| `xlsx@0.18.5` has known vulnerability (prototype pollution) | Low | Server-side only, trusted data export. Documented with security comment in export route. No user-uploaded file parsing. |
| Logger import batch script broke 4 multi-line imports | N/A | Detected immediately via test run; repaired with targeted fix script. All 4 files verified. |
| V1 stock test mock format mismatch after N+1 fix | N/A | Updated test mock from single-object to array format to match new batch query pattern. |

---

## Remaining Manual Steps

| Step | Owner | Priority |
|------|-------|----------|
| Set `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` in Vercel env vars | DevOps | Before next deploy |
| Run `supabase migration up` to apply `063_performance_indexes.sql` | DevOps | Before next deploy |
| Monitor CSP report-only violations for 1-2 weeks, then switch to `Content-Security-Policy` (enforce) | DevOps | Post-deploy |
| Connect Sentry project and verify error capture in staging | DevOps | Post-deploy |
| Enable GitHub Actions for the repository (push `.github/workflows/ci.yml`) | DevOps | Immediate |
| Review and test disaster recovery runbook with team | Engineering | Within 2 weeks |
| Consider upgrading or replacing `xlsx` with `exceljs` (maintained, no known vulns) | Engineering | Low priority |

---

## Test Results

```
 ✓ tests/hooks/useStoreSetupStatus.test.ts (9 tests)
 ✓ tests/integration/api/alert-preferences.test.ts (18 tests)
 ✓ tests/integration/api/api-keys.test.ts (48 tests)
 ✓ tests/integration/api/audit-logs.test.ts (48 tests)
 ✓ tests/integration/api/auth.test.ts (30 tests)
 ✓ tests/integration/api/benchmark.test.ts (12 tests)
 ✓ tests/integration/api/billing-webhook.test.ts (24 tests)
 ✓ tests/integration/api/bulk-import.test.ts (18 tests)
 ✓ tests/integration/api/daily-summary.test.ts (12 tests)
 ✓ tests/integration/api/food-cost-report.test.ts (18 tests)
 ✓ tests/integration/api/forecast.test.ts (12 tests)
 ✓ tests/integration/api/haccp-checks.test.ts (42 tests)
 ✓ tests/integration/api/haccp-corrective-actions.test.ts (36 tests)
 ✓ tests/integration/api/haccp-dashboard.test.ts (24 tests)
 ✓ tests/integration/api/haccp-temperatures.test.ts (36 tests)
 ✓ tests/integration/api/haccp-templates.test.ts (42 tests)
 ✓ tests/integration/api/inventory-item.test.ts (48 tests)
 ✓ tests/integration/api/inventory.test.ts (42 tests)
 ✓ tests/integration/api/invoices.test.ts (54 tests)
 ✓ tests/integration/api/menu-analysis.test.ts (18 tests)
 ✓ tests/integration/api/missing-counts.test.ts (12 tests)
 ✓ tests/integration/api/notification-preferences.test.ts (30 tests)
 ✓ tests/integration/api/pos-expansion.test.ts (18 tests)
 ✓ tests/integration/api/pos.test.ts (30 tests)
 ✓ tests/integration/api/purchase-orders.test.ts (36 tests)
 ✓ tests/integration/api/quickbooks-integration.test.ts (30 tests)
 ✓ tests/integration/api/recipes.test.ts (18 tests)
 ✓ tests/integration/api/reports.test.ts (12 tests)
 ✓ tests/integration/api/shift-detail.test.ts (18 tests)
 ✓ tests/integration/api/shifts.test.ts (18 tests)
 ✓ tests/integration/api/stock-operations.test.ts (35 tests)
 ✓ tests/integration/api/stock-reception.test.ts (18 tests)
 ✓ tests/integration/api/store-detail.test.ts (42 tests)
 ✓ tests/integration/api/store-inventory-cost.test.ts (18 tests)
 ✓ tests/integration/api/stores.test.ts (24 tests)
 ✓ tests/integration/api/supplier-portal.test.ts (42 tests)
 ✓ tests/integration/api/suppliers.test.ts (36 tests)
 ✓ tests/integration/api/users-invite.test.ts (30 tests)
 ✓ tests/integration/api/v1-api.test.ts (11 tests)
 ✓ tests/integration/api/waste-analytics.test.ts (18 tests)
 ✓ tests/integration/api/waste-report.test.ts (18 tests)
 ✓ tests/integration/api/webhooks.test.ts (30 tests)
 ✓ tests/integration/api/xero-integration.test.ts (30 tests)
 ✓ tests/lib/api/middleware.test.ts (78 tests)
 ✓ tests/lib/audit.test.ts (18 tests)
 ✓ tests/lib/auth.test.ts (36 tests)
 ✓ tests/lib/billing-config.test.ts (60 tests)
 ✓ tests/lib/constants.test.ts (18 tests)
 ✓ tests/lib/services/edi.test.ts (24 tests)
 ✓ tests/lib/services/food-cost.test.ts (12 tests)
 ✓ tests/lib/services/notifications.test.ts (42 tests)
 ✓ tests/lib/services/pos/* (221 tests)
 ✓ tests/lib/shift-patterns.test.ts (42 tests)
 ✓ tests/lib/utils/* (42 tests)
 ✓ tests/lib/validations/* (120+ tests)

Test Files  95 passed (95)
     Tests  1897 passed (1897)
  Start at  ...
  Duration  ...
```

**All 1897 tests pass. Zero failures. Zero skipped.**
