# Database Migrations

## How to Use

**For existing database**: Already applied migrations 000-037 ✅

**For new database**: Run migrations in order (000 → 037)

```bash
# Example: Apply via Supabase CLI (if installed)
supabase db push

# Or: Copy/paste each migration into Supabase SQL Editor
```

---

## Migration Categories

### 📦 Core Schema (000-023)

Foundation tables and initial RLS setup:

- `000-005`: Base tables (stores, profiles, inventory_items, shifts)
- `006-015`: Multi-tenant architecture (store_users, subscriptions)
- `016-019`: Inventory RLS, audit logs, webhook deduplication
- `020-023`: Store user policies, permissions

### 🔄 RLS Recursion Fixes (024-037)

**Context**: Discovered infinite recursion bugs when testing multi-tenant isolation

**Problem**: RLS policies querying the same table they protect → infinite loop

**Solution Journey**:
- 024-030: First attempts using various patterns (partial success)
- 031: Wrong approach - made recursion worse ❌
- 032: Breakthrough! SECURITY DEFINER for SELECT ✅
- 033: Fixed UPDATE recursion ✅
- 034: Fixed DELETE recursion ✅
- 035-036: Key insight - LANGUAGE sql (not plpgsql!) ✅
- 037: Final fix - simplified INSERT policy ✅

**Result**: 862/862 tests passing, zero recursion

---

## Migration Details

### Recent Migrations (024-037)

| # | Name | Purpose | Status |
|---|------|---------|--------|
| 024 | Initial RLS fixes | First attempt at fixing recursion | Superseded |
| 025-030 | Iterative fixes | Various approaches | Superseded |
| 031 | Wrong approach | Made recursion worse | Superseded |
| 032 | SELECT recursion fix | SECURITY DEFINER pattern | ✅ Core |
| 033 | UPDATE/audit_logs fix | Clean policies, helper functions | ✅ Core |
| 034 | DELETE recursion fix | Owner-only delete helper | ✅ Core |
| 035 | Fix can_user_manage_store | LANGUAGE sql adoption | ✅ Core |
| 036 | Fix get_user_store_ids | LANGUAGE sql adoption | ✅ Core |
| 037 | Simplify INSERT policy | Remove stores table query | ✅ Core |

---

## Key Patterns

### ✅ Correct RLS Helper Pattern

```sql
CREATE FUNCTION helper_function()
RETURNS type
LANGUAGE sql          -- ✅ Must be sql, not plpgsql!
SECURITY DEFINER      -- ✅ Run as database owner
STABLE                -- ✅ Optimization hint
AS $$
  SELECT ... FROM table WHERE ...
$$;
```

### ❌ Incorrect Pattern (Causes Recursion)

```sql
CREATE FUNCTION helper_function()
RETURNS type
LANGUAGE plpgsql      -- ❌ Does NOT bypass RLS!
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT ... FROM table WHERE ...);
END;
$$;
```

---

## Testing Migrations

```bash
# Run all tests (requires Supabase credentials)
npm test

# Run specific RLS tests
npm test tests/integration/rls/

# Expected: 862/862 passing
```

---

## Troubleshooting

### "Infinite recursion detected in policy"

**Cause**: Helper function using `LANGUAGE plpgsql` instead of `LANGUAGE sql`

**Fix**: Check migrations 035-036 for correct pattern

### "Tests failing after migration"

**Cause**: Migration not applied to test database

**Fix**: Copy/paste migration into Supabase SQL Editor

---

## For Production Deployment

1. ✅ All migrations tested (862/862 tests passing)
2. ✅ Applied to main database
3. ⏭️ Ready for staging deployment
4. ⏭️ Backup database before deploying to production
5. ⏭️ Apply migrations in order (000-037)
6. ⏭️ Verify with test suite

---

## References

- [Final Schema State](../../docs/FINAL_SCHEMA_STATE.md) - Complete schema documentation
- [RLS Testing Guide](../../tests/integration/rls/README.md) - How to test RLS policies
- [PostgreSQL RLS Docs](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)

---

## History Preserved

All migrations are kept as historical record. They show:
- The evolution of the schema
- Lessons learned from RLS complexity
- Why certain patterns were chosen

**Don't delete old migrations** - they're part of the project history and already applied to the database.
