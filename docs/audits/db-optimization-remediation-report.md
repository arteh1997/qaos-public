# Database Optimization — Remediation Report

**Date:** 2026-02-26
**Branch:** `db-optimization`
**Test Results:** 1897 tests passing (95 files), build clean

---

## Executive Summary

All 7 findings from the database optimization audit have been remediated across 5 phases. The changes reduce query volume by ~135,000 queries/day at scale (50 stores), eliminate broken pagination on low-stock views, add data archival for 20M+ row growth tables, and reduce per-request payload by removing unused columns from every authenticated API call.

---

## Phase 1: Fix N+1 Queries and Full-Table Scans (HIGH)

### FIX 1.1 — POS `processSaleEvent` N+1 Batch Rewrite

**File:** `lib/services/pos.ts` (lines 249-338)

**Before:** Loop executed 3 DB queries per sold item (SELECT inventory + UPSERT inventory + INSERT history). A 10-item sale = 30+ round-trips.

```typescript
// BEFORE: N+1 pattern (3 queries per item)
for (const soldItem of event.items) {
  const { data: current } = await adminClient
    .from('store_inventory').select('quantity')
    .eq('store_id', storeId)
    .eq('inventory_item_id', mapping.inventory_item_id).single()
  await adminClient.from('store_inventory').upsert({...})
  await adminClient.from('stock_history').insert({...})
}
```

**After:** 5-step batch process: collect IDs → 1x batch SELECT with `.in()` → calculate changes in memory with dedup Map → 1x batch UPSERT → 1x batch INSERT. Reduces to ~3 queries regardless of sale size.

```typescript
// AFTER: Batch operations (3 queries total)
// Step 2: Batch-fetch current inventory in ONE query
const { data: currentInventory } = await adminClient
  .from('store_inventory').select('inventory_item_id, quantity')
  .eq('store_id', storeId).in('inventory_item_id', inventoryItemIds)

// Step 3: Calculate all changes in memory (dedup Map)
// Step 4: Batch upsert ALL inventory changes
await adminClient.from('store_inventory').upsert(upsertRows, { onConflict: '...' })

// Step 5: Batch insert ALL stock history
await adminClient.from('stock_history').insert(historyRows)
```

**Impact:** 50 stores × 100 sales/day × 10 items/sale = **~135,000 fewer queries/day**

**Test update:** `tests/lib/services/pos.test.ts` — mocks updated from `.single()` returns to array returns for batch SELECT pattern. All 6 POS tests passing.

---

### FIX 1.2 — `getCurrentInventoryMap` Filtered Fetch

**File:** `lib/services/stockOperations.ts` (line 75)

**Before:** Always fetched ALL store inventory (500+ rows) regardless of operation size.

```typescript
// BEFORE: Full table scan
export async function getCurrentInventoryMap(supabase, storeId) {
  const { data } = await supabase.from('store_inventory')
    .select('inventory_item_id, quantity').eq('store_id', storeId)
}
```

**After:** Optional `itemIds` parameter with `.in()` filter. Only fetches rows for the items being operated on.

```typescript
// AFTER: Filtered fetch
export async function getCurrentInventoryMap(supabase, storeId, itemIds?: string[]) {
  let query = supabase.from('store_inventory')
    .select('inventory_item_id, quantity').eq('store_id', storeId)
  if (itemIds && itemIds.length > 0) {
    query = query.in('inventory_item_id', itemIds)
  }
}
```

**Callers updated (4 routes):**
| Route | File | Line |
|-------|------|------|
| Stock count | `app/api/stores/[storeId]/stock-count/route.ts` | 86 |
| Stock reception | `app/api/stores/[storeId]/stock-reception/route.ts` | 96 |
| Waste | `app/api/stores/[storeId]/waste/route.ts` | 97 |
| PO receive | `app/api/stores/[storeId]/purchase-orders/[poId]/receive/route.ts` | 127 |

**Impact:** Reduces ~490 unused rows per operation × 50 stores × 5 operations/day = **~122,500 fewer rows fetched/day**

---

## Phase 2: Auth Middleware Column Reduction + Archival Strategy (MEDIUM-HIGH)

### FIX 2.1 — Middleware Column Reduction

**File:** `lib/api/middleware.ts` (line 142)

**Before:**
```typescript
.select('*, store:stores(id, name, is_active, subscription_status, opening_time, closing_time, created_at, updated_at)')
```

**After:**
```typescript
.select('id, store_id, user_id, role, is_billing_owner, store:stores(id, name, is_active, subscription_status)')
```

Removes ~10 unused columns (`opening_time`, `closing_time`, `created_at`, `updated_at` from stores + `hourly_rate`, `invited_by`, `invited_at`, `accepted_at`, `created_at`, `updated_at` from store_users) per request. Verified no route accesses these fields from `context.stores`.

**Impact:** Every authenticated request (~0.78 RPS at scale)

---

### FIX 2.2 — Data Archival Strategy

**Migration:** `supabase/migrations/064_archival_tables.sql`

Created `stock_history_archive` and `audit_logs_archive` tables with:
- Identical schemas to source tables + `archived_at` timestamp
- Composite indexes on `(store_id, created_at DESC)` for date-range queries
- RLS enabled with service_role-only access policies

**Cron endpoint:** `app/api/cron/archive-data/route.ts`

- Weekly schedule: Sundays 3 AM UTC (`0 3 * * 0`)
- Moves records older than 12 months in 5,000-row batches
- Uses admin client (bypasses RLS), authenticated via `CRON_SECRET`
- Processes both `stock_history` and `audit_logs`

**Vercel cron config:** `vercel.json`

```json
{
  "crons": [{ "path": "/api/cron/archive-data", "schedule": "0 3 * * 0" }]
}
```

**Impact:** Keeps main tables under ~12M rows, preventing index bloat on tables projected to reach 20M+ rows annually

---

## Phase 3: Low Stock Server-Side Filtering + Missing Indexes (MEDIUM)

### FIX 3.1 — Low Stock RPC Function

**Migration:** `supabase/migrations/065_low_stock_function_and_indexes.sql`

**Before:** Client-side post-filter after pagination — broken pagination counts, some pages returned fewer items than `pageSize`.

```typescript
// BEFORE: Broken pagination
const { data, count } = await query.range(from, to)
inventory = inventory.filter(item => item.quantity < item.par_level) // Reduces count!
```

**After:** `get_low_stock_inventory()` SQL function with `COUNT(*) OVER()` window function for accurate totals. Uses `LANGUAGE sql STABLE SECURITY DEFINER`. Orders by criticality (`quantity / par_level` ascending).

```sql
CREATE OR REPLACE FUNCTION get_low_stock_inventory(
  p_store_id UUID, p_category TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20, p_offset INT DEFAULT 0
) RETURNS TABLE (..., total_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ..., COUNT(*) OVER() AS total_count
  FROM store_inventory si JOIN inventory_items ii ON ii.id = si.inventory_item_id
  WHERE si.store_id = p_store_id
    AND si.par_level IS NOT NULL AND si.quantity < si.par_level
    AND (p_category IS NULL OR ii.category = p_category)
    AND ii.is_active = true
  ORDER BY (si.quantity / NULLIF(si.par_level, 0)) ASC
  LIMIT p_limit OFFSET p_offset
$$;
```

**Route update:** `app/api/stores/[storeId]/inventory/route.ts` — when `low_stock=true`, uses `.rpc('get_low_stock_inventory')` instead of client-side filter.

**Impact:** Correct pagination counts + eliminates excess row transfer + prioritizes critically low items

---

### FIX 3.2 — Missing Composite Indexes

5 composite indexes added for common query patterns:

| Index | Table | Columns |
|-------|-------|---------|
| `idx_notification_preferences_user_store` | notification_preferences | (user_id, store_id) |
| `idx_alert_history_store_sent` | alert_history | (store_id, sent_at DESC) |
| `idx_alert_history_store_type` | alert_history | (store_id, alert_type) |
| `idx_accounting_sync_log_store_created` | accounting_sync_log | (store_id, created_at DESC) |
| `idx_supplier_portal_activity_store_created` | supplier_portal_activity | (store_id, created_at DESC) |

These tables previously had single-column indexes but queries filter by multiple columns simultaneously.

---

## Phase 4: `select('*')` Over-Fetch Narrowing (LOW-MEDIUM)

### FIX 4.1 — Inventory Route

**File:** `app/api/stores/[storeId]/inventory/route.ts`

**Before:**
```typescript
.select('*, inventory_item:inventory_items(*)', { count: 'exact' })
```

**After:**
```typescript
.select(`
  id, store_id, inventory_item_id, quantity, par_level, unit_cost, cost_currency, last_updated_at, last_updated_by,
  inventory_item:inventory_items(id, name, category, category_id, unit_of_measure, is_active)
`, { count: 'exact' })
```

### FIX 4.2 — Stock History Route

**File:** `app/api/stores/[storeId]/history/route.ts`

**Before:**
```typescript
.select('*, inventory_item:inventory_items(*), performer:profiles(id, full_name, email)', { count: 'exact' })
```

**After:**
```typescript
.select(`
  id, store_id, inventory_item_id, action_type, quantity_before, quantity_after, quantity_change, performed_by, notes, created_at,
  inventory_item:inventory_items(id, name, category, unit_of_measure),
  performer:profiles(id, full_name, email)
`, { count: 'exact' })
```

**Impact:** Reduces response payload size by eliminating unused columns from joined tables.

---

## Files Changed

| File | Change |
|------|--------|
| `lib/services/pos.ts` | Batch rewrite of processSaleEvent (lines 249-338) |
| `lib/services/stockOperations.ts` | Added optional `itemIds` filter parameter |
| `lib/api/middleware.ts` | Narrowed store_users + stores column selection |
| `app/api/stores/[storeId]/inventory/route.ts` | Low stock RPC + explicit columns |
| `app/api/stores/[storeId]/history/route.ts` | Explicit columns |
| `app/api/stores/[storeId]/stock-count/route.ts` | Pass itemIds to getCurrentInventoryMap |
| `app/api/stores/[storeId]/stock-reception/route.ts` | Pass itemIds to getCurrentInventoryMap |
| `app/api/stores/[storeId]/waste/route.ts` | Pass itemIds to getCurrentInventoryMap |
| `app/api/stores/[storeId]/purchase-orders/[poId]/receive/route.ts` | Pass itemIds to getCurrentInventoryMap |
| `app/api/cron/archive-data/route.ts` | **NEW** — Weekly archival cron |
| `tests/lib/services/pos.test.ts` | Updated mocks for batch pattern |
| `supabase/migrations/064_archival_tables.sql` | **NEW** — Archive tables |
| `supabase/migrations/065_low_stock_function_and_indexes.sql` | **NEW** — RPC function + indexes |
| `vercel.json` | **NEW** — Cron schedule config |

---

## Estimated Impact Summary

| Change | Metric | Scale Impact (50 stores) |
|--------|--------|--------------------------|
| POS batch rewrite | ~27 queries saved/sale | 135,000 fewer queries/day |
| getCurrentInventoryMap filter | ~490 rows saved/operation | 122,500 fewer rows/day |
| Auth middleware narrowing | ~10 columns saved/request | Every authenticated request |
| Low stock server-side filter | Correct pagination | Eliminates broken counts |
| Archival (weekly) | Moves 12mo+ data | Keeps main tables < 12M rows |
| Composite indexes (5) | Index-only scans | Faster filtered queries |
| select('*') narrowing | Fewer bytes/response | All inventory + history requests |

---

## Verification

- **Tests:** 1897 passing (95 files) — zero regressions
- **Build:** Clean TypeScript compilation, no errors
- **Key test files verified:**
  - `tests/lib/services/pos.test.ts` (6 tests — batch mock pattern)
  - `tests/integration/api/inventory.test.ts` (11 tests — select narrowing)
  - `tests/integration/api/stock-operations.test.ts` (7 tests — itemIds filter)
  - `tests/integration/api/stock-reception.test.ts` (11 tests — itemIds filter)
  - `tests/integration/api/purchase-orders.test.ts` (9 tests — itemIds filter)
  - `tests/lib/api/middleware.test.ts` (39 tests — column reduction)
