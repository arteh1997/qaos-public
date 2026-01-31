# Architecture Analysis: Restaurant Inventory Management System

**Date**: January 2026
**Version**: 1.1
**Status**: Production Ready

---

## Target Scale

This system is designed for **~10 businesses with ~20 employees each** (~200 total users).

| Metric | Target |
|--------|--------|
| Businesses | ~10 |
| Users per business | ~20 |
| Total users | ~200 |
| Concurrent users (peak) | ~30-50 |
| Inventory items per business | 100-500+ |

At this scale, the current architecture is **well-suited** without requiring distributed caching or Redis.

---

## Table of Contents

1. [Tech Stack Summary](#tech-stack-summary)
2. [Architecture Strengths](#1-architecture-strengths-whats-working-well)
3. [Critical Bottlenecks](#2-critical-bottlenecks-what-will-break-at-scale)
4. [Security Vulnerabilities](#3-security-vulnerabilities-what-could-go-wrong)
5. [Recommended Improvements](#4-recommended-improvements-specific-actionable-changes)
6. [Implementation Priority](#5-implementation-priority-what-to-fix-first)
7. [Scaling Considerations](#scaling-considerations)

---

## Tech Stack Summary

| Layer | Technology | Version |
|-------|------------|---------|
| **Framework** | Next.js (App Router) | 16.1.2 |
| **UI Library** | React | 19.2.3 |
| **Language** | TypeScript | 5.x |
| **Styling** | Tailwind CSS | 4.x |
| **Components** | Radix UI | Latest |
| **Forms** | React Hook Form + Zod | 7.71.1 / 4.3.5 |
| **Backend** | Supabase (PostgreSQL + Auth + REST) | - |
| **State** | React Context + Custom Hooks | - |
| **Testing** | Vitest | 2.1.0 |

---

## 1. Architecture Strengths (What's Working Well)

### Clean Separation of Concerns

- **Route Groups**: `(public)` and `(dashboard)` clearly separate authentication flows
- **Custom Hooks**: Encapsulate all data fetching logic
  - `hooks/useStores.ts`
  - `hooks/useInventory.ts`
  - `hooks/useStockCount.ts`
  - `hooks/useStockReception.ts`
- **Consistent API Responses**: Standardized format via `lib/api/response.ts`

### Robust Authentication Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Authentication Flow                       │
├─────────────────────────────────────────────────────────────┤
│  1. User logs in via Supabase Auth                          │
│  2. JWT stored in HttpOnly cookies (SSR)                    │
│  3. Client decodes JWT directly from cookies                │
│  4. Session refresh on tab visibility (5s debounce)         │
│  5. Global auth state persisted via module variable         │
└─────────────────────────────────────────────────────────────┘
```

- JWT tokens decoded directly from cookies, bypassing Supabase client hangs
- Session refresh on tab visibility change with debouncing
- Global auth state persisted across navigations

### Defense in Depth for Authorization

```
┌─────────────────────────────────────────────────────────────┐
│                  Authorization Layers                        │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Database RLS                                       │
│  └── Optimized (select auth.uid()) pattern                  │
│  └── Helper functions: get_user_role(), get_user_store_id() │
│                                                              │
│  Layer 2: API Middleware                                     │
│  └── Role validation via withApiAuth()                      │
│  └── Store access check via canAccessStore()                │
│                                                              │
│  Layer 3: UI Conditional Rendering                          │
│  └── Components render based on user role                   │
└─────────────────────────────────────────────────────────────┘
```

### Optimistic Updates with Rollback

```typescript
// Example from useStores.ts
const createStore = useCallback(async (formData: StoreFormData) => {
  // 1. Immediate UI update (optimistic)
  setStores(prev => [...prev, optimisticStore])

  try {
    // 2. Make API call
    const { error } = await supabaseInsert('stores', formData)
    if (error) throw error
  } catch (err) {
    // 3. Rollback on failure
    setStores(prev => prev.filter(s => s.id !== optimisticStore.id))
  }
}, [])
```

- UI updates immediately on actions
- Automatic rollback on API failure
- Better UX on slow networks

### Immutable Audit Trail

- `stock_history` table is append-only
- Complete record of all inventory changes
- Enables compliance reporting and accountability

### Performance-Optimized RLS

```sql
-- Optimized helper functions (from migration 002)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM profiles WHERE id = (select auth.uid());
$$;
```

- Helper functions cached per query
- `SECURITY DEFINER` with fixed `search_path` prevents injection
- Strategic indexes on common query patterns

---

## 2. Bottleneck Assessment (For Target Scale)

> **Note**: At the target scale of ~200 users, most of these are NOT critical issues.
> They are documented for awareness if scaling beyond the current target.

### 2.1 In-Memory Rate Limiting

**Location**: `lib/rate-limit.ts`

**Current State**: Uses in-memory Map

**At Target Scale (~200 users)**: **ACCEPTABLE**
- Single Vercel instance is typical at this scale
- Rate limiting will work correctly
- Memory usage is minimal

**If Scaling Beyond**: Would need Redis-based rate limiting

---

### 2.2 N+1 Query in Stock Operations - FIXED ✅

**Location**: `hooks/useStockReception.ts`, `hooks/useStockCount.ts`

**Status**: **RESOLVED**

Stock operations now use batch queries:
```typescript
// BATCH: Fetch all existing quantities in one query
const { data: existingInventory } = await supabaseFetch<{...}>('store_inventory', {
  filter: { inventory_item_id: `in.(${itemIds.join(',')})` }
})

// BATCH: Upsert all inventory updates at once
const { error } = await supabaseUpsert('store_inventory', inventoryUpdates, ...)

// BATCH: Insert all stock history at once
const { error } = await supabaseInsertMany('stock_history', historyInserts)
```

This reduces database round trips from N to 3 regardless of item count.

---

### 2.3 Database Connection Pooling

**At Target Scale**: **ACCEPTABLE**
- Supabase free tier: 60 connections
- Supabase Pro: 200+ connections
- ~200 users with typical usage patterns won't exhaust this

---

### 2.4 Caching

**At Target Scale**: **NOT NEEDED**
- Database queries are fast for this data volume
- Supabase is optimized for these access patterns
- Adding caching would add complexity without significant benefit

---

## 3. Security Status (All Vulnerabilities Addressed)

### 3.1 JWT Verification - MITIGATED ✅

**Status**: **ACCEPTABLE RISK**

- Client-side JWT decoding is for UI display only
- All data operations go through API routes with server-side validation
- RLS enforces access control at database level regardless of client state
- Server-side `withApiAuth()` validates user via Supabase server client

---

### 3.2 Search Parameter Injection - FIXED ✅

**Status**: **RESOLVED**

Search inputs are now sanitized at both client and server:

```typescript
// lib/utils.ts
export function sanitizeSearchInput(input: string): string {
  return input
    .replace(/[(),.:]/g, ' ')  // Remove PostgREST special chars
    .replace(/[;'"\\]/g, '')   // Remove SQL injection chars
    .replace(/\s+/g, ' ')      // Collapse spaces
    .trim()
    .slice(0, 100)             // Limit length
}

// lib/api/response.ts
export function sanitizeSearchQuery(input: string): string { ... }
```

Applied in:
- `hooks/useStores.ts`
- `hooks/useUsers.ts`
- `app/api/stores/route.ts`
- `app/api/inventory/route.ts`

---

### 3.3 CSRF & Security Headers - FIXED ✅

**Status**: **RESOLVED**

Security headers added via middleware and Next.js config:

```typescript
// middleware.ts & next.config.ts
{
  'X-Frame-Options': 'DENY',                    // Prevent clickjacking
  'X-Content-Type-Options': 'nosniff',          // Prevent MIME sniffing
  'X-XSS-Protection': '1; mode=block',          // XSS protection
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
}
```

Supabase cookies use `SameSite=Lax` by default, which provides CSRF protection for state-changing requests.

---

### 3.4 Error Message Sanitization - FIXED ✅

**Status**: **RESOLVED**

Error messages are now automatically sanitized:

```typescript
// lib/api/response.ts
function sanitizeApiErrorMessage(message: string): string {
  // Removes: stack traces, file paths, credentials, connection strings
  // Returns: User-friendly message or generic fallback
}

// lib/utils.ts (client-side)
export function sanitizeErrorMessage(error: unknown): string { ... }
```

All API routes use `apiError()` which automatically sanitizes messages.
All hooks use `sanitizeErrorMessage()` for toast notifications.

---

### 3.5 API Request Security - ACCEPTABLE ✅

**Status**: **ACCEPTABLE FOR TARGET SCALE**

Current protections:
- JWT authentication with short expiry
- Rate limiting per user
- RLS at database level
- Input validation via Zod schemas

At target scale, replay attack risk is minimal. If scaling significantly, consider adding request signing.

---

## 4. Recommended Improvements (Specific, Actionable Changes)

### 4.1 Priority 1: Distributed Rate Limiting

Replace in-memory rate limiting with Redis:

```typescript
// lib/rate-limit.ts - Updated implementation
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  analytics: true,
})

// Usage in middleware
const { success, limit, remaining, reset } = await ratelimit.limit(userId)
```

**Dependencies**: `@upstash/ratelimit`, `@upstash/redis`

---

### 4.2 Priority 2: Batch Database Operations

Ensure all stock operations use bulk inserts:

```typescript
// hooks/useStockReception.ts - Improved
const inventoryUpdates = data.items.map(item => ({
  store_id: data.store_id,
  inventory_item_id: item.inventory_item_id,
  quantity: item.quantity_received,
  last_updated_at: now,
  last_updated_by: user.id,
}))

// Single bulk upsert instead of loop
const { error } = await supabaseUpsert(
  'store_inventory',
  inventoryUpdates,  // Array of all items
  'store_id,inventory_item_id'
)
```

---

### 4.3 Priority 3: Input Sanitization

Add search input sanitization:

```typescript
// lib/utils.ts - Add function
export function sanitizeSearchInput(input: string): string {
  // Remove special PostgREST characters that could affect query
  return input
    .replace(/[(),.]/g, '')
    .slice(0, 100)  // Limit length
}

// Usage in hooks
const sanitizedSearch = sanitizeSearchInput(search)
filter['or'] = `(name.ilike.%${sanitizedSearch}%,address.ilike.%${sanitizedSearch}%)`
```

---

### 4.4 Priority 4: Retry Logic for Transient Failures

```typescript
// lib/utils.ts - Add retry wrapper
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; delay?: number } = {}
): Promise<T> {
  const { retries = 3, delay = 100 } = options

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === retries - 1) throw error
      await new Promise(resolve =>
        setTimeout(resolve, delay * Math.pow(2, attempt))
      )
    }
  }
  throw new Error('Unreachable')
}
```

---

### 4.5 Priority 5: Enhanced Health Check

```typescript
// app/api/health/route.ts - Improved
export async function GET() {
  const checks = {
    database: false,
    timestamp: new Date().toISOString(),
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.from('stores').select('id').limit(1)
    checks.database = !error
  } catch {
    checks.database = false
  }

  const healthy = Object.values(checks).every(v => v === true || typeof v === 'string')

  return Response.json(checks, {
    status: healthy ? 200 : 503
  })
}
```

---

## 5. Implementation Status

| Issue | Status | Notes |
|-------|--------|-------|
| Batch stock operations | ✅ DONE | Stock count & reception use batch queries |
| Search input sanitization | ✅ DONE | Client & server-side sanitization |
| Error message sanitization | ✅ DONE | Auto-sanitization in apiError() |
| Security headers | ✅ DONE | Added via middleware & next.config |
| CSRF protection | ✅ DONE | Verified via SameSite cookies |
| Rate limiting | ✅ OK | In-memory is sufficient for target scale |
| Connection pooling | ✅ OK | Default Supabase config is sufficient |
| Caching | ⏸️ DEFERRED | Not needed at target scale |

---

## Scaling Considerations

### Current Target Scale (Production Ready)

| Metric | Supported |
|--------|-----------|
| Businesses | ~10 |
| Users per business | ~20 |
| Total users | ~200 |
| Concurrent users | ~30-50 |
| Inventory items | 500+ per business |
| Stores | 10-50 total |

**The current architecture fully supports this scale without modifications.**

### Cost Estimate (Target Scale)

| Service | Estimated Monthly Cost |
|---------|----------------------|
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| **Total** | ~$45/month |

### Future Scaling (If Needed)

If scaling beyond 1,000+ concurrent users:

1. **Add Redis** ($10-30/month)
   - Distributed rate limiting
   - Session caching
   - Inventory item caching

2. **Database read replicas**
   - Route report queries to replica
   - Supabase Pro supports this

3. **Background jobs**
   - Supabase Edge Functions for heavy reports
   - Vercel Cron for scheduled tasks

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client Browser                              │
├─────────────────────────────────────────────────────────────────────────┤
│  Next.js App (React 19)                                                  │
│  ├── Public Routes: /login, /forgot-password, /accept-invite            │
│  └── Dashboard Routes: /stores, /inventory, /reports, /profile          │
│                                                                          │
│  State Management:                                                       │
│  ├── AuthProvider (global auth context)                                 │
│  └── Custom Hooks (useStores, useInventory, etc.)                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Next.js API Routes                             │
├─────────────────────────────────────────────────────────────────────────┤
│  Middleware Stack:                                                       │
│  ├── withApiAuth() - Authentication & Authorization                     │
│  ├── Rate Limiting (in-memory, needs Redis upgrade)                     │
│  └── Input Validation (Zod schemas)                                     │
│                                                                          │
│  Endpoints:                                                              │
│  ├── /api/stores/*        (6 endpoints)                                 │
│  ├── /api/inventory/*     (3 endpoints)                                 │
│  ├── /api/shifts/*        (4 endpoints)                                 │
│  ├── /api/reports/*       (2 endpoints)                                 │
│  └── /api/users/invite    (1 endpoint)                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              Supabase                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  Authentication:                                                         │
│  └── JWT tokens in HttpOnly cookies                                     │
│                                                                          │
│  PostgreSQL Database:                                                    │
│  ├── stores              (multi-location support)                       │
│  ├── profiles            (user management)                              │
│  ├── inventory_items     (master catalog)                               │
│  ├── store_inventory     (stock per location)                           │
│  ├── stock_history       (immutable audit trail)                        │
│  ├── shifts              (staff scheduling)                             │
│  └── daily_counts        (compliance tracking)                          │
│                                                                          │
│  Row-Level Security:                                                     │
│  ├── Admin: Full access                                                 │
│  ├── Driver: Multi-store access                                         │
│  └── Staff: Single-store access                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

The architecture is **production-ready for the target scale** (~10 businesses, ~200 users).

### Key Strengths
- Three-role model (Admin, Driver, Staff) is well-implemented
- RLS provides strong data isolation at database level
- Optimistic updates ensure excellent UX
- Immutable audit trail enables compliance
- Batch operations prevent performance issues
- Comprehensive security headers and input sanitization

### Security Status: ✅ ALL ADDRESSED
- Input sanitization (search, notes, errors)
- Security headers (XSS, clickjacking, MIME sniffing)
- Error message sanitization (no information disclosure)
- CSRF protection via SameSite cookies

### Performance Status: ✅ OPTIMIZED
- Batch database operations for stock count/reception
- Efficient RLS with cached helper functions
- Strategic database indexes

**The system is ready for production deployment.**

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2026 | Architecture Review | Initial analysis |
| 1.1 | Jan 2026 | Security Review | Fixed all security issues, updated scale assessment, batch operations |
