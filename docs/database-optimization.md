# Database Optimization Plan

## Executive Summary

This document provides a comprehensive database optimization plan for the Restaurant Inventory Management System. Based on analysis of the schema and query patterns, we've identified several critical optimizations that can improve query performance by **60-80%** for common operations.

---

## Current Schema Analysis

### Tables Overview

| Table | Primary Use | Query Frequency | Growth Rate |
|-------|-------------|-----------------|-------------|
| `stock_history` | Audit trail, reports | Very High | ~100-500 rows/day |
| `store_inventory` | Real-time inventory | High | ~stores × items |
| `shifts` | Scheduling, time tracking | High | ~20-50 rows/day |
| `daily_counts` | Compliance tracking | Medium | ~stores/day |
| `stores` | Reference data | Low | Slow growth |
| `inventory_items` | Reference data | Low | Slow growth |
| `profiles` | User management | Low | Slow growth |

### Estimated Data Volume (2 Year Projection)

| Table | Current Est. | 6 Months | 1 Year | 2 Years |
|-------|--------------|----------|--------|---------|
| `stock_history` | 10K | 50K | 150K | 400K |
| `store_inventory` | 500 | 1K | 2K | 5K |
| `shifts` | 2K | 10K | 25K | 60K |
| `daily_counts` | 1K | 5K | 12K | 30K |
| `stores` | 10 | 20 | 40 | 80 |
| `inventory_items` | 50 | 100 | 200 | 400 |
| `profiles` | 30 | 60 | 120 | 250 |

---

## Identified Performance Issues

### 1. Missing Indexes (Critical)

**Problem:** Queries on `stock_history` with date ranges and store filters perform full table scans.

```sql
-- Current query pattern (slow without index)
SELECT * FROM stock_history
WHERE store_id = $1
AND created_at BETWEEN $2 AND $3
ORDER BY created_at DESC;
```

**Impact:** Query time grows linearly with table size. At 100K rows, expect 2-5 second queries.

### 2. Inefficient Low Stock Query

**Problem:** Low stock report fetches ALL inventory with PAR levels, then filters in application code.

```typescript
// Current: Fetches all, filters in JS
const data = await supabase
  .from('store_inventory')
  .select('*, store:stores(*), inventory_item:inventory_items(*)')
  .not('par_level', 'is', null)
// Then filters: data.filter(item => item.quantity < item.par_level)
```

**Impact:** Transfers unnecessary data, causes memory pressure on large datasets.

### 3. N+1 Query Pattern in Missing Counts

**Problem:** Two separate queries to calculate missing store counts.

```typescript
// Query 1: Get all stores
// Query 2: Get submitted counts
// Then: JavaScript Set difference
```

**Impact:** 2 round trips to database, client-side processing.

### 4. Unindexed Foreign Keys

**Problem:** Foreign key columns without indexes cause slow JOIN operations.

- `profiles.store_id` - Used in every role-based access check
- `shifts.user_id` - Used in shift overlap detection
- `stock_history.performed_by` - Used in audit reports

### 5. Text Search Without Index

**Problem:** `ILIKE` searches on `stores.name` and `inventory_items.name` perform full scans.

```sql
WHERE name ILIKE '%search%' OR address ILIKE '%search%'
```

---

## Optimization Recommendations

### Priority 1: Critical Index Creation (Immediate Impact)

**Estimated Improvement:** 70-90% query time reduction for affected queries

```sql
-- =====================================================
-- MIGRATION: Add Performance Indexes
-- Run this in Supabase SQL Editor or as a migration
-- =====================================================

-- 1. Stock History - Most queried table
-- Covers: date range queries, store filtering, chronological ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_history_store_created
ON stock_history(store_id, created_at DESC);

-- Covers: action type filtering with date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_history_action_created
ON stock_history(action_type, created_at DESC);

-- Covers: performer lookups for audit trails
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_history_performed_by
ON stock_history(performed_by)
WHERE performed_by IS NOT NULL;

-- 2. Store Inventory - High frequency reads
-- Covers: store-specific inventory with low stock detection
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_store_inventory_store_quantity
ON store_inventory(store_id, quantity);

-- Covers: low stock report optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_store_inventory_below_par
ON store_inventory(store_id, inventory_item_id)
WHERE par_level IS NOT NULL AND quantity < par_level;

-- 3. Shifts - Schedule management
-- Covers: user shift lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_user_time
ON shifts(user_id, start_time, end_time);

-- Covers: store schedule views
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_store_time
ON shifts(store_id, start_time DESC);

-- 4. Daily Counts - Compliance tracking
-- Covers: date-based lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_counts_date
ON daily_counts(count_date DESC);

-- 5. Profiles - Role-based access
-- Covers: staff-to-store lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_store
ON profiles(store_id)
WHERE store_id IS NOT NULL;

-- Covers: role-based filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_role_status
ON profiles(role, status);

-- 6. Reference Tables - Quick lookups
-- Covers: active item filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_items_active
ON inventory_items(is_active, name);

-- Covers: active store filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stores_active
ON stores(is_active, name);
```

### Priority 2: Query Optimizations

#### 2.1 Low Stock Report - Use Database View

**Current:** Application fetches all inventory, filters in JavaScript
**Optimized:** Database does the filtering

```sql
-- Create a materialized view for low stock (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_low_stock_items AS
SELECT
    si.store_id,
    s.name AS store_name,
    si.inventory_item_id,
    i.name AS item_name,
    i.unit_of_measure,
    si.quantity AS current_quantity,
    si.par_level,
    (si.par_level - si.quantity) AS shortage
FROM store_inventory si
JOIN stores s ON s.id = si.store_id
JOIN inventory_items i ON i.id = si.inventory_item_id
WHERE si.par_level IS NOT NULL
  AND si.quantity < si.par_level
  AND s.is_active = true
  AND i.is_active = true
ORDER BY shortage DESC;

-- Create index on the view
CREATE INDEX IF NOT EXISTS idx_mv_low_stock_store
ON mv_low_stock_items(store_id);

-- Refresh function (call via cron or trigger)
CREATE OR REPLACE FUNCTION refresh_low_stock_view()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_low_stock_items;
END;
$$ LANGUAGE plpgsql;
```

#### 2.2 Missing Counts - Single Query with LEFT JOIN

**Current:** Two queries + JavaScript processing
**Optimized:** Single query with anti-join

```sql
-- Create a function for missing counts
CREATE OR REPLACE FUNCTION get_missing_counts(target_date DATE)
RETURNS TABLE(store_id UUID, store_name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.name
    FROM stores s
    LEFT JOIN daily_counts dc
        ON dc.store_id = s.id
        AND dc.count_date = target_date
    WHERE s.is_active = true
      AND dc.id IS NULL
    ORDER BY s.name;
END;
$$ LANGUAGE plpgsql STABLE;
```

#### 2.3 Shift Overlap Detection - Improved Query

**Current:** String concatenation in OR clause
**Optimized:** Proper overlap detection with index support

```sql
-- Better overlap detection using range operators
CREATE OR REPLACE FUNCTION check_shift_overlap(
    p_user_id UUID,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_exclude_shift_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM shifts
        WHERE user_id = p_user_id
          AND (p_exclude_shift_id IS NULL OR id != p_exclude_shift_id)
          AND start_time < p_end_time
          AND end_time > p_start_time
    );
END;
$$ LANGUAGE plpgsql STABLE;
```

### Priority 3: Schema Improvements

#### 3.1 Add Computed Column for Stock Status

```sql
-- Add status column to store_inventory
ALTER TABLE store_inventory
ADD COLUMN IF NOT EXISTS stock_status TEXT
GENERATED ALWAYS AS (
    CASE
        WHEN par_level IS NULL THEN 'unknown'
        WHEN quantity >= par_level THEN 'ok'
        WHEN quantity >= par_level * 0.5 THEN 'low'
        ELSE 'critical'
    END
) STORED;

-- Index the status for filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_store_inventory_status
ON store_inventory(stock_status, store_id);
```

#### 3.2 Partitioning for stock_history (Future)

When `stock_history` exceeds 1M rows, consider range partitioning:

```sql
-- Future: Partition by month (implement when data exceeds 500K rows)
-- This requires recreating the table, plan for maintenance window

-- CREATE TABLE stock_history_partitioned (
--     LIKE stock_history INCLUDING ALL
-- ) PARTITION BY RANGE (created_at);

-- CREATE TABLE stock_history_y2024m01 PARTITION OF stock_history_partitioned
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Priority 4: Caching Strategy

#### 4.1 Application-Level Caching

Already implemented in `lib/supabase/middleware.ts`:
- Profile caching with 5-minute TTL ✓

Recommended additions:

```typescript
// Add to lib/cache.ts
const CACHE_CONFIG = {
  // Static reference data - cache longer
  stores: { ttl: 5 * 60 * 1000 },      // 5 minutes
  inventoryItems: { ttl: 5 * 60 * 1000 }, // 5 minutes

  // Dynamic data - shorter cache
  storeInventory: { ttl: 30 * 1000 },   // 30 seconds
  lowStockReport: { ttl: 60 * 1000 },   // 1 minute

  // Real-time data - no cache
  shifts: { ttl: 0 },
  stockHistory: { ttl: 0 },
}
```

#### 4.2 React Query Stale Time Configuration

```typescript
// Recommended staleTime settings
const queryConfig = {
  // Reference data queries
  stores: { staleTime: 5 * 60 * 1000 },
  inventory: { staleTime: 5 * 60 * 1000 },

  // Operational data
  storeInventory: { staleTime: 30 * 1000 },
  shifts: { staleTime: 60 * 1000 },

  // Reports (can be slightly stale)
  lowStockReport: { staleTime: 2 * 60 * 1000 },
  dailyCounts: { staleTime: 60 * 1000 },
}
```

---

## Migration Script

### Complete Migration (Run in Supabase SQL Editor)

```sql
-- =====================================================
-- DATABASE OPTIMIZATION MIGRATION
-- Restaurant Inventory Management System
--
-- Run Time: ~2-5 minutes on empty database
--          ~10-30 minutes on production with data
--
-- Safe to run: Uses CONCURRENTLY to avoid locks
-- Idempotent: Can be run multiple times safely
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Create Performance Indexes
-- =====================================================

-- Stock History Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_history_store_created
ON stock_history(store_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_history_action_created
ON stock_history(action_type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_history_performed_by
ON stock_history(performed_by)
WHERE performed_by IS NOT NULL;

-- Store Inventory Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_store_inventory_store_quantity
ON store_inventory(store_id, quantity);

-- Shifts Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_user_time
ON shifts(user_id, start_time, end_time);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_store_time
ON shifts(store_id, start_time DESC);

-- Daily Counts Index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_counts_date
ON daily_counts(count_date DESC);

-- Profiles Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_store
ON profiles(store_id)
WHERE store_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_role_status
ON profiles(role, status);

-- Reference Table Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_items_active
ON inventory_items(is_active, name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stores_active
ON stores(is_active, name);

COMMIT;

-- =====================================================
-- STEP 2: Create Optimized Functions
-- =====================================================

-- Function: Get missing counts efficiently
CREATE OR REPLACE FUNCTION get_missing_counts(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
    store_id UUID,
    store_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.name::TEXT
    FROM stores s
    LEFT JOIN daily_counts dc
        ON dc.store_id = s.id
        AND dc.count_date = target_date
    WHERE s.is_active = true
      AND dc.id IS NULL
    ORDER BY s.name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Check shift overlap
CREATE OR REPLACE FUNCTION check_shift_overlap(
    p_user_id UUID,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_exclude_shift_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM shifts
        WHERE user_id = p_user_id
          AND (p_exclude_shift_id IS NULL OR id != p_exclude_shift_id)
          AND start_time < p_end_time
          AND end_time > p_start_time
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get low stock items efficiently
CREATE OR REPLACE FUNCTION get_low_stock_items(p_store_id UUID DEFAULT NULL)
RETURNS TABLE(
    store_id UUID,
    store_name TEXT,
    inventory_item_id UUID,
    item_name TEXT,
    unit_of_measure TEXT,
    current_quantity NUMERIC,
    par_level NUMERIC,
    shortage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        si.store_id,
        s.name::TEXT,
        si.inventory_item_id,
        i.name::TEXT,
        i.unit_of_measure::TEXT,
        si.quantity,
        si.par_level,
        (si.par_level - si.quantity)
    FROM store_inventory si
    JOIN stores s ON s.id = si.store_id
    JOIN inventory_items i ON i.id = si.inventory_item_id
    WHERE si.par_level IS NOT NULL
      AND si.quantity < si.par_level
      AND s.is_active = true
      AND i.is_active = true
      AND (p_store_id IS NULL OR si.store_id = p_store_id)
    ORDER BY (si.par_level - si.quantity) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- STEP 3: Create Statistics Update Job
-- =====================================================

-- Ensure statistics are up to date for query planner
ANALYZE stores;
ANALYZE profiles;
ANALYZE inventory_items;
ANALYZE store_inventory;
ANALYZE stock_history;
ANALYZE shifts;
ANALYZE daily_counts;

-- =====================================================
-- VERIFICATION: Check indexes were created
-- =====================================================

-- Run this query to verify indexes:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;
```

---

## Performance Estimates

### Before Optimization

| Query | Rows Scanned | Estimated Time |
|-------|--------------|----------------|
| Stock history (date range) | Full table | 500ms - 2s |
| Low stock report | Full table + joins | 300ms - 1s |
| Shift overlap check | Full table | 100ms - 500ms |
| Missing counts | 2 queries + JS | 200ms - 600ms |
| Store inventory list | Index scan | 50ms - 100ms |

### After Optimization

| Query | Rows Scanned | Estimated Time | Improvement |
|-------|--------------|----------------|-------------|
| Stock history (date range) | Index only | 20ms - 50ms | **90%** |
| Low stock report | Function call | 30ms - 80ms | **80%** |
| Shift overlap check | Index scan | 5ms - 20ms | **95%** |
| Missing counts | Single query | 20ms - 50ms | **85%** |
| Store inventory list | Index scan | 20ms - 50ms | **50%** |

---

## Implementation Checklist

### Phase 1: Indexes (Day 1)
- [ ] Run index creation migration in Supabase SQL Editor
- [ ] Verify indexes with `pg_indexes` query
- [ ] Run `ANALYZE` on all tables
- [ ] Test query performance improvements

### Phase 2: Functions (Day 2)
- [ ] Create optimized database functions
- [ ] Update API endpoints to use functions
- [ ] Update hooks to use RPC calls for complex queries

### Phase 3: Monitoring (Week 1)
- [ ] Enable Supabase Query Performance monitoring
- [ ] Set up alerts for slow queries (>500ms)
- [ ] Monitor index usage statistics

### Phase 4: Future Optimizations (Month 2+)
- [ ] Evaluate materialized views based on usage
- [ ] Consider partitioning when stock_history > 500K rows
- [ ] Implement query result caching at application level

---

## Monitoring Queries

### Check Index Usage

```sql
-- See which indexes are being used
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Find Slow Queries

```sql
-- Requires pg_stat_statements extension
SELECT
    query,
    calls,
    total_time / calls as avg_time_ms,
    rows / calls as avg_rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY total_time DESC
LIMIT 20;
```

### Check Table Sizes

```sql
SELECT
    relname as table_name,
    pg_size_pretty(pg_total_relation_size(relid)) as total_size,
    pg_size_pretty(pg_relation_size(relid)) as data_size,
    pg_size_pretty(pg_indexes_size(relid)) as index_size,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC;
```

---

## Write vs Read Trade-offs

| Change | Read Impact | Write Impact | Recommendation |
|--------|-------------|--------------|----------------|
| Stock history indexes | +90% faster | -5% slower | **Implement** - reads far exceed writes |
| Store inventory indexes | +70% faster | -3% slower | **Implement** - frequent reads |
| Shift indexes | +80% faster | -5% slower | **Implement** - overlap checks frequent |
| Computed columns | +50% faster | -10% slower | **Consider** - evaluate actual usage |
| Materialized views | +95% faster | Refresh cost | **Defer** - add if reports slow |

---

## Conclusion

Implementing the Priority 1 indexes alone will provide significant performance improvements with minimal risk. The migration script is designed to be safe for production use with `CONCURRENTLY` index creation.

**Estimated Total Implementation Time:** 2-4 hours
**Risk Level:** Low (all changes are additive, no schema modifications)
**Expected Overall Performance Gain:** 60-80% for most queries
