# Database Optimization Audit

**Date:** 2026-02-26
**Scope:** Full database layer audit — schema, indexes, queries, caching, connection pooling, data growth
**Database:** PostgreSQL 15+ (Supabase-managed), PostgREST, RLS on all tables
**Target Scale:** 50 restaurants, 500+ items each, daily operations, 2+ year retention

---

## Top 5 Critical Items

1. **POS `processSaleEvent` N+1 query** — 3 DB round-trips per sold item in a loop. A 10-item sale = 30+ queries. Fix: batch to 3 total queries. Saves ~135,000 queries/day at scale.
2. **`getCurrentInventoryMap` full-table scan** — Fetches ALL store inventory (500+ rows) when operating on 10 items. Used by 4 routes (stock-count, waste, reception, PO receive). Fix: add `.in()` filter. Saves ~122,500 excess rows/day.
3. **Auth middleware over-fetch on every request** — Selects `*` from `store_users` + 8 columns from `stores`, most unused. Fix: narrow to 5+4 columns.
4. **No data archival strategy** — `stock_history` and `audit_logs` are append-only with no cleanup. Projected 40M+ rows after 2 years. Fix: archive tables + weekly cron.
5. **Low stock filtering done client-side** — Pagination counts are wrong because JS filters results after the DB query. Fix: database function with `COUNT(*) OVER()`.

---

## Finding 1: POS `processSaleEvent` N+1 Query

**Severity:** HIGH
**File:** `lib/services/pos.ts` lines 249-304
**Frequency:** Every POS webhook sale event (potentially hundreds per day per store)

### Problem

The `processSaleEvent` function loops over each item in a sale and makes 3 individual queries per item:

```typescript
// Lines 250-304 — FOR EACH sold item:
for (const soldItem of event.items) {
  // Query 1: Get current inventory (line 263-268)
  const { data: current } = await adminClient
    .from('store_inventory')
    .select('quantity')
    .eq('store_id', storeId)
    .eq('inventory_item_id', mapping.inventory_item_id)
    .single()

  // Query 2: Upsert updated quantity (line 274-283)
  await adminClient
    .from('store_inventory')
    .upsert({ ... }, { onConflict: 'store_id,inventory_item_id' })

  // Query 3: Insert stock history (line 291-301)
  await adminClient
    .from('stock_history')
    .insert({ ... })
}
```

### Impact

| Sale Size | Current Queries | Optimized Queries | Reduction |
|-----------|----------------|-------------------|-----------|
| 5 items | 15 | 3 | 80% |
| 10 items | 30 | 3 | 90% |
| 20 items | 60 | 3 | 95% |

At 50 stores × 100 sales/day × 5 items average = **135,000 unnecessary queries/day**.

### Fix

Batch-fetch all inventory upfront with `.in()`, calculate all changes in memory, then execute 1x batch UPSERT + 1x batch INSERT:

```typescript
// Step 1: Batch-fetch all inventory for mapped items (1 query)
const { data: currentInventories } = await adminClient
  .from('store_inventory')
  .select('inventory_item_id, quantity')
  .eq('store_id', storeId)
  .in('inventory_item_id', mappedInventoryItemIds)

// Step 2: Calculate all changes in memory (0 queries)
const inventoryUpserts = []
const historyInserts = []
for (const soldItem of event.items) { /* ...compute... */ }

// Step 3: Batch upsert inventory (1 query)
await adminClient.from('store_inventory').upsert(inventoryUpserts, { onConflict: '...' })

// Step 4: Batch insert history (1 query)
await adminClient.from('stock_history').insert(historyInserts)
```

**Edge case:** Multiple POS items mapping to the same `inventory_item_id` — handled by updating a local Map after each calculation to track the running quantity, then deduplicating the upsert array before sending.

---

## Finding 2: `getCurrentInventoryMap` Full-Table Scan

**Severity:** HIGH
**File:** `lib/services/stockOperations.ts` lines 75-90
**Callers:** 4 routes (stock-count, stock-reception, waste, PO receive)

### Problem

```typescript
export async function getCurrentInventoryMap(
  supabase: SupabaseClient,
  storeId: string
): Promise<Map<string, number>> {
  const { data: currentInventory } = await supabase
    .from('store_inventory')
    .select('inventory_item_id, quantity')
    .eq('store_id', storeId)  // Fetches ALL items for store
  // ...
}
```

A store with 500 inventory items always fetches all 500 rows, even when processing a 10-item stock count.

### Impact

| Operation | Items in Request | Rows Fetched | Wasted |
|-----------|-----------------|-------------|--------|
| Stock count | 10 | 500 | 490 rows |
| Waste log | 3 | 500 | 497 rows |
| PO receive | 15 | 500 | 485 rows |

At 50 stores × 5 operations/day × 490 excess rows = **122,500 unnecessary rows/day**.

### Fix

```typescript
export async function getCurrentInventoryMap(
  supabase: SupabaseClient,
  storeId: string,
  itemIds?: string[]  // Optional filter
): Promise<Map<string, number>> {
  let query = supabase
    .from('store_inventory')
    .select('inventory_item_id, quantity')
    .eq('store_id', storeId)

  if (itemIds && itemIds.length > 0) {
    query = query.in('inventory_item_id', itemIds)
  }

  const { data: currentInventory } = await query
  // ...
}
```

Backward compatible — existing callers that don't pass `itemIds` still get the full fetch.

**Callers to update:**
- `app/api/stores/[storeId]/stock-count/route.ts` line 86 — `itemIds` already computed at line 67
- `app/api/stores/[storeId]/stock-reception/route.ts` line 96
- `app/api/stores/[storeId]/waste/route.ts` line 97
- `app/api/stores/[storeId]/purchase-orders/[poId]/receive/route.ts` line 127

---

## Finding 3: Auth Middleware Over-Fetch

**Severity:** MEDIUM-HIGH
**File:** `lib/api/middleware.ts` lines 140-143
**Frequency:** Every authenticated API request (~0.78 RPS at 50 stores)

### Problem

```typescript
// Line 140-143 — runs on EVERY authenticated request
supabaseAny
  .from('store_users')
  .select('*, store:stores(id, name, is_active, subscription_status, opening_time, closing_time, created_at, updated_at)')
  .eq('user_id', user.id)
```

The `*` on `store_users` fetches: `id`, `store_id`, `user_id`, `role`, `is_billing_owner`, `hourly_rate`, `invited_by`, `created_at`, `updated_at`. Of these, `hourly_rate`, `invited_by`, `created_at`, `updated_at` are never accessed from `context.stores` in any API route.

The embedded `stores` join includes `opening_time`, `closing_time`, `created_at`, `updated_at` — none accessed from auth context.

### Verified Usage

Searched all API routes for `context.stores` access patterns. Only these fields are used:
- `store_id`, `user_id`, `role`, `is_billing_owner` (auth checks)
- `store.id`, `store.name`, `store.is_active`, `store.subscription_status` (billing/access checks)

### Fix

```typescript
// Before:
.select('*, store:stores(id, name, is_active, subscription_status, opening_time, closing_time, created_at, updated_at)')

// After:
.select('id, store_id, user_id, role, is_billing_owner, store:stores(id, name, is_active, subscription_status)')
```

Removes ~6 unused columns per store membership per request. For a user with 3 stores, saves ~18 fields deserialized per API call.

---

## Finding 4: No Data Archival Strategy

**Severity:** MEDIUM-HIGH
**Tables:** `stock_history`, `audit_logs`, `haccp_checks`, `haccp_temperature_logs`, `alert_history`

### Data Growth Projections (50 stores, 2 years)

| Table | Growth Rate | Year 1 | Year 2 | Notes |
|-------|-----------|--------|--------|-------|
| `stock_history` | ~500 items × daily counts + receptions + sales | ~9M rows | ~18M rows | Append-only, immutable |
| `audit_logs` | ~50-250 actions/store/day | ~6M rows | ~12M rows | Append-only, immutable |
| `haccp_checks` | ~10-50 checks/store/day | ~2.5M rows | ~5M rows | Compliance data |
| `haccp_temperature_logs` | ~20-100 logs/store/day | ~2.5M rows | ~5M rows | Compliance data |
| `alert_history` | ~10-100 alerts/store/day | ~1.2M rows | ~2.4M rows | Notification records |
| **Total** | | **~21M rows** | **~42M rows** | |

### Impact

- **Index bloat**: B-tree indexes on 20M+ row tables increase insert latency and memory usage
- **Query degradation**: Even with indexes, `COUNT(*)` for pagination on large tables gets slower
- **Backup size**: Full database backups grow linearly
- **No current cleanup**: Zero archival, purge, or partition logic found in codebase

### Fix

1. Create `stock_history_archive` and `audit_logs_archive` tables (identical schema + `archived_at`)
2. Weekly cron endpoint at `/api/cron/archive-data` that moves records older than 12 months in 5000-row batches
3. Archive tables have RLS enabled but no user policies (admin-only access via service role)

---

## Finding 5: Low Stock Client-Side Filtering

**Severity:** MEDIUM
**File:** `app/api/stores/[storeId]/inventory/route.ts` lines 55-70

### Problem

```typescript
// Line 56-58: Only ensures par_level exists
if (lowStock) {
  query = query.not('par_level', 'is', null)
}

// Line 60: Executes query with pagination
const { data, error, count } = await query.range(from, to)

// Line 64-70: Filters in JavaScript AFTER the query
if (lowStock) {
  inventory = inventory.filter(item =>
    item.par_level !== null && item.quantity < item.par_level
  )
}
```

PostgREST doesn't support column-to-column comparisons (e.g., `quantity < par_level`), so this is done in JS. But:

1. **Pagination count is wrong** — `count` includes all items with `par_level`, not just low-stock ones
2. **Excess data transfer** — fetches items that pass the `par_level IS NOT NULL` filter but aren't actually low-stock
3. **Page size mismatch** — page of 20 items could return 3 after JS filtering

### Fix

Create a database function `get_low_stock_inventory(p_store_id, p_category, p_limit, p_offset)` using `LANGUAGE sql STABLE SECURITY DEFINER` that does the `quantity < par_level` comparison server-side with `COUNT(*) OVER()` for accurate pagination totals. Call via `.rpc()` when `low_stock=true`.

---

## Finding 6: Missing Composite Indexes

**Severity:** MEDIUM
**Status:** Migration 063 already added some. 5 gaps remain.

### Current Index Coverage (Migration 063)

| Index | Table | Columns |
|-------|-------|---------|
| `idx_haccp_checks_store_date` | `haccp_checks` | `(store_id, completed_at DESC)` |
| `idx_haccp_temp_logs_store_date` | `haccp_temperature_logs` | `(store_id, recorded_at DESC)` |
| `idx_haccp_corrective_store_resolved` | `haccp_corrective_actions` | `(store_id, resolved_at)` |
| `idx_inventory_item_tags_item_id` | `inventory_item_tags` | `(inventory_item_id)` |
| `idx_stock_history_store_created` | `stock_history` | `(store_id, created_at DESC)` |
| `idx_audit_logs_store_created` | `audit_logs` | `(store_id, created_at DESC)` |

### Remaining Gaps

| Table | Missing Index | Query Pattern |
|-------|--------------|---------------|
| `notification_preferences` | `(store_id, user_id)` | `.eq('store_id', storeId).eq('user_id', userId)` |
| `waste_log` | `(store_id, reported_at DESC)` | `.eq('store_id', storeId).order('reported_at', desc)` |
| `alert_history` | `(store_id, sent_at DESC)` | `.eq('store_id', storeId).order('sent_at', desc)` |
| `accounting_sync_log` | `(connection_id, created_at DESC)` | `.eq('connection_id', connId).order('created_at', desc)` |
| `supplier_portal_activity` | `(supplier_id, created_at DESC)` | `.eq('supplier_id', suppId).order('created_at', desc)` |

**Not needed:** `store_inventory(store_id, inventory_item_id)` — covered by existing UNIQUE constraint (Postgres creates a B-tree index automatically for UNIQUE constraints). Same for `pos_sale_events(pos_connection_id, external_event_id)`.

---

## Finding 7: `select('*')` Over-Fetch in Routes

**Severity:** LOW-MEDIUM
**Files:** Multiple API routes

### Inventory List Route

**File:** `app/api/stores/[storeId]/inventory/route.ts` lines 44-47

```typescript
// Before:
.select('*, inventory_item:inventory_items(*)', { count: 'exact' })

// After:
.select(`
  id, store_id, inventory_item_id, quantity, par_level, unit_cost, cost_currency, last_updated_at,
  inventory_item:inventory_items(id, name, category, category_id, unit_of_measure, is_active)
`, { count: 'exact' })
```

Removes: `store_inventory.last_updated_by`, `store_inventory.created_at` and `inventory_items.store_id`, `inventory_items.created_at`, `inventory_items.updated_at` from the response (~5 columns per row).

### Stock History Route

**File:** `app/api/stores/[storeId]/history/route.ts` lines 45-48

```typescript
// Before:
.select('*, inventory_item:inventory_items(*), performer:profiles(id, full_name, email)')

// After:
.select(`
  id, store_id, inventory_item_id, action_type, quantity_before, quantity_after,
  quantity_change, performed_by, notes, created_at,
  inventory_item:inventory_items(id, name, category, unit_of_measure),
  performer:profiles(id, full_name, email)
`, { count: 'exact' })
```

Removes: `inventory_items.store_id`, `inventory_items.category_id`, `inventory_items.is_active`, `inventory_items.created_at`, `inventory_items.updated_at` (~5 columns per row).

---

## Finding 8: Well-Optimized Patterns (No Changes Needed)

These patterns are already well-optimized — documenting for completeness:

| Pattern | File | Why It's Good |
|---------|------|--------------|
| **Recipe batch loading** | `app/api/stores/[storeId]/recipes/route.ts` | Batch-fetches all ingredients + costs with `.in()` — no N+1 |
| **Analytics parallel queries** | `app/api/reports/analytics/route.ts` | 4 queries in `Promise.all()` with selective columns |
| **Audit log lazy-load** | `app/api/audit-logs/route.ts` | Only fetches missing user names and item names when needed |
| **Notifications batch** | `lib/services/notifications.ts` | Single store_users query, then parallel sends via `Promise.allSettled()` |
| **PO line items** | `app/api/stores/[storeId]/purchase-orders/route.ts` | Array `.insert()` for batch line item creation |
| **Admin client singleton** | `lib/supabase/admin.ts` | Cached as module-level variable, reused across requests |
| **TanStack Query dedup** | `components/providers/QueryProvider.tsx` | 30s staleTime, 5m gcTime, concurrent request deduplication |

---

## Finding 9: Caching Assessment

### Current State

| Layer | Implementation | Effectiveness |
|-------|---------------|---------------|
| **Client-side (TanStack Query)** | 30s staleTime, 5m gcTime, refetchOnWindowFocus | Good — ~60% API call reduction |
| **Admin client** | Singleton module cache | Good — single instance per process |
| **Redis (Upstash)** | Rate limiting only | Underutilized — no query caching |
| **Server-side query cache** | None | Gap — auth middleware queries could be cached |

### Recommendation: Not Needed Yet

At the projected scale (50 stores, ~2.3 RPS total), server-side query caching adds complexity without meaningful benefit. Supabase handles 10k+ RPS. The optimizations in Findings 1-3 reduce query count sufficiently.

**When to add Redis query caching:** If the app scales to 200+ stores or observes >50 RPS on auth middleware. At that point, cache `profile + store_users` results in Redis with a 60-second TTL keyed by `user_id`, invalidated on role/store changes.

### Hooks Bypassing TanStack Query

Two hooks use manual `useState` + `useEffect` instead of TanStack Query:
- `hooks/useInventory.ts`
- `hooks/useReports.ts`

These miss TanStack's deduplication, caching, and background refetch. Migrating them would improve client-side performance but is a UI concern, not a database optimization.

---

## Schema Assessment

### Relationships: Correctly Modeled

The multi-tenant schema is well-designed:
- **Junction table** (`store_users`) correctly models many-to-many user-store with role per membership
- **Separation of concerns**: `inventory_items` (global catalog) vs `store_inventory` (per-store stock levels) is correct
- **Append-only audit trail**: `stock_history` with immutable RLS (no UPDATE/DELETE) is correct for compliance
- **Foreign key cascades**: `recipe_ingredients` CASCADE on recipe delete, `category_id` SET NULL on category delete

### Denormalization: Not Recommended

The current schema avoids denormalization, which is correct for this data model:
- `audit_logs.user_email` is the one denormalized field (preserves email at time of action) — correct for audit trail
- Stock counts could theoretically cache aggregates, but the real-time nature of inventory makes stale caches dangerous
- Recipe cost calculations are done on-demand from ingredients — correct since ingredient costs change frequently

### Connection Pooling

Supabase uses built-in PgBouncer in transaction mode. No configuration needed from the application side. The PostgREST HTTP API handles connection management transparently.

---

## Implementation Priority

| # | Finding | Impact | Effort | Risk |
|---|---------|--------|--------|------|
| 1 | POS N+1 batch rewrite | HIGH | Medium | Low (test update needed) |
| 2 | getCurrentInventoryMap filter | HIGH | Low | None (backward compatible) |
| 3 | Auth middleware column reduction | MEDIUM-HIGH | Low | Low (verified no consumers) |
| 4 | Migration 064 (indexes) | MEDIUM | Low | None (additive only) |
| 5 | Low stock DB function | MEDIUM | Medium | Low (new code path) |
| 6 | select('*') column narrowing | LOW-MEDIUM | Low | Low |
| 7 | Archive tables + cron | MEDIUM-HIGH | Medium | Low (new tables, admin-only) |

---

## Migration SQL Previews

### Migration 064: Indexes + Low Stock Function

```sql
-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_notification_prefs_store_user
  ON notification_preferences(store_id, user_id);

CREATE INDEX IF NOT EXISTS idx_waste_log_store_reported
  ON waste_log(store_id, reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_history_store_sent
  ON alert_history(store_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_accounting_sync_log_connection_created
  ON accounting_sync_log(connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_portal_activity_supplier_created
  ON supplier_portal_activity(supplier_id, created_at DESC);

-- Low stock inventory function (server-side filtering with accurate pagination)
CREATE OR REPLACE FUNCTION get_low_stock_inventory(
  p_store_id UUID,
  p_category TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(
  id UUID, store_id UUID, inventory_item_id UUID,
  quantity NUMERIC, par_level NUMERIC, unit_cost NUMERIC,
  cost_currency TEXT, last_updated_at TIMESTAMPTZ, last_updated_by UUID,
  item_name TEXT, item_category TEXT, item_category_id UUID,
  unit_of_measure TEXT, is_active BOOLEAN, total_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    si.id, si.store_id, si.inventory_item_id,
    si.quantity, si.par_level, si.unit_cost,
    si.cost_currency, si.last_updated_at, si.last_updated_by,
    i.name, i.category, i.category_id,
    i.unit_of_measure, i.is_active,
    COUNT(*) OVER()
  FROM store_inventory si
  INNER JOIN inventory_items i ON i.id = si.inventory_item_id
  WHERE si.store_id = p_store_id
    AND si.par_level IS NOT NULL
    AND si.quantity < si.par_level
    AND i.is_active = true
    AND (p_category IS NULL OR i.category = p_category)
  ORDER BY (si.par_level - si.quantity) DESC
  LIMIT p_limit OFFSET p_offset
$$;
```

### Migration 065: Archive Tables

```sql
CREATE TABLE IF NOT EXISTS stock_history_archive (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL, inventory_item_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  quantity_before NUMERIC, quantity_after NUMERIC, quantity_change NUMERIC,
  performed_by UUID, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_history_archive_store_created
  ON stock_history_archive(store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs_archive (
  id UUID PRIMARY KEY,
  user_id UUID, user_email TEXT,
  action TEXT NOT NULL, action_category TEXT NOT NULL,
  store_id UUID, resource_type TEXT, resource_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_archive_store_created
  ON audit_logs_archive(store_id, created_at DESC);

ALTER TABLE stock_history_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs_archive ENABLE ROW LEVEL SECURITY;
```

---

## Appendix: Full Index Inventory

### All Existing Indexes (Post-Migration 063)

<details>
<summary>Click to expand (67 indexes across 44 tables)</summary>

| Table | Index | Columns |
|-------|-------|---------|
| stores | idx_stores_billing_user | billing_user_id (WHERE NOT NULL) |
| stores | idx_stores_active_name | is_active, name |
| stores | idx_stores_has_hours | (WHERE opening_time IS NOT NULL) |
| stores | idx_stores_weekly_hours | weekly_hours (GIN) |
| profiles | idx_profiles_platform_admin | (WHERE is_platform_admin = true) |
| profiles | idx_profiles_store | store_id (WHERE NOT NULL) |
| profiles | idx_profiles_role_status | role, status |
| profiles | idx_profiles_email | lower(email) |
| store_users | idx_store_users_user_id | user_id |
| store_users | idx_store_users_store_id | store_id |
| store_users | idx_store_users_role | role |
| store_users | idx_store_users_billing_owner | (WHERE is_billing_owner = true) |
| store_users | UNIQUE | (store_id, user_id) |
| subscriptions | idx_subscriptions_billing_user | billing_user_id |
| subscriptions | idx_subscriptions_status | status |
| subscriptions | idx_subscriptions_stripe_customer | stripe_customer_id (WHERE NOT NULL) |
| subscriptions | UNIQUE | store_id |
| inventory_items | idx_inventory_items_category_id | category_id |
| inventory_items | idx_inventory_items_category | category |
| inventory_items | idx_inventory_items_active_name | is_active, name |
| store_inventory | idx_store_inventory_store | store_id |
| store_inventory | idx_store_inventory_store_quantity | store_id, quantity |
| store_inventory | idx_store_inventory_low_stock | (WHERE par_level IS NOT NULL) |
| store_inventory | UNIQUE | (store_id, inventory_item_id) |
| stock_history | idx_stock_history_store_created | (store_id, created_at DESC) |
| stock_history | idx_stock_history_action_created | (action_type, created_at DESC) |
| stock_history | idx_stock_history_performed_by | performed_by (WHERE NOT NULL) |
| stock_history | idx_stock_history_store_action_created | (store_id, action_type, created_at DESC) |
| audit_logs | idx_audit_logs_user_id | user_id |
| audit_logs | idx_audit_logs_store_id | store_id |
| audit_logs | idx_audit_logs_action | action |
| audit_logs | idx_audit_logs_action_category | action_category |
| audit_logs | idx_audit_logs_created_at | created_at |
| audit_logs | idx_audit_logs_resource | resource_type, resource_id |
| audit_logs | idx_audit_logs_store_created | (store_id, created_at DESC) |
| item_categories | idx_item_categories_store_id | store_id |
| item_categories | idx_item_categories_sort_order | (store_id, sort_order) |
| item_tags | idx_item_tags_store_id | store_id |
| inventory_item_tags | idx_inventory_item_tags_item_id | inventory_item_id |
| inventory_item_tags | idx_inventory_item_tags_tag_id | tag_id |
| daily_counts | idx_daily_counts_date | count_date |
| daily_counts | idx_daily_counts_store_date | (store_id, count_date DESC) |
| shifts | idx_shifts_user_time | (user_id, start_time, end_time) |
| shifts | idx_shifts_store_time | (store_id, start_time DESC) |
| shifts | idx_shifts_active | (WHERE clock_in_time IS NOT NULL AND clock_out_time IS NULL) |
| waste_log | idx_waste_log_store_id | store_id |
| waste_log | idx_waste_log_reported_at | reported_at |
| waste_log | idx_waste_log_reason | reason |
| waste_log | idx_waste_log_inventory_item | inventory_item_id |
| waste_log | idx_waste_log_store_date | (store_id, reported_at DESC) |
| recipes | idx_recipes_store_id | store_id |
| recipes | idx_recipes_active | (store_id, is_active) |
| suppliers | idx_suppliers_store_id | store_id |
| suppliers | idx_suppliers_active | (store_id, is_active) |
| purchase_orders | idx_purchase_orders_store_id | store_id |
| purchase_orders | idx_purchase_orders_supplier_id | supplier_id |
| purchase_orders | idx_purchase_orders_status | (store_id, status) |
| purchase_orders | idx_purchase_orders_order_date | (store_id, order_date DESC) |
| pos_connections | idx_pos_connections_store_id | store_id |
| pos_item_mappings | idx_pos_item_mappings_connection | pos_connection_id |
| pos_item_mappings | idx_pos_item_mappings_store | store_id |
| pos_item_mappings | idx_pos_item_mappings_pos_item | pos_item_id |
| pos_sale_events | idx_pos_sale_events_connection | pos_connection_id |
| pos_sale_events | idx_pos_sale_events_store | store_id |
| pos_sale_events | idx_pos_sale_events_status | status |
| pos_sale_events | idx_pos_sale_events_occurred | occurred_at |
| haccp_checks | idx_haccp_checks_store_date | (store_id, completed_at DESC) |
| haccp_temperature_logs | idx_haccp_temp_logs_store_date | (store_id, recorded_at DESC) |
| haccp_corrective_actions | idx_haccp_corrective_store_resolved | (store_id, resolved_at) |

</details>

### Indexes Added by This Optimization (Migration 064)

| Table | Index | Columns |
|-------|-------|---------|
| notification_preferences | idx_notification_prefs_store_user | (store_id, user_id) |
| waste_log | idx_waste_log_store_reported | (store_id, reported_at DESC) |
| alert_history | idx_alert_history_store_sent | (store_id, sent_at DESC) |
| accounting_sync_log | idx_accounting_sync_log_connection_created | (connection_id, created_at DESC) |
| supplier_portal_activity | idx_supplier_portal_activity_supplier_created | (supplier_id, created_at DESC) |

### Redundant Indexes (Not Recommended to Remove)

`waste_log` has both `idx_waste_log_store_id` (store_id alone) and the new `idx_waste_log_store_reported` (store_id, reported_at DESC). The composite index covers queries that filter by store_id alone (Postgres uses the leading column), so `idx_waste_log_store_id` is technically redundant. However, removing it carries risk and the storage cost is negligible, so **leave both in place**.

Same applies to `idx_waste_log_reported_at` vs `idx_waste_log_store_date` — the store-scoped composite covers the standalone time filter for store-scoped queries. Keep both.
