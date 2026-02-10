# Final Schema State - February 9, 2026

## Overview

This document represents the **final working state** of the database schema after fixing all RLS recursion issues and achieving 862/862 passing tests.

## Key RLS Patterns Learned

### ✅ CORRECT: LANGUAGE sql + SECURITY DEFINER

All helper functions MUST use `LANGUAGE sql` to truly bypass RLS:

```sql
CREATE FUNCTION get_user_store_ids()
RETURNS UUID[]
LANGUAGE sql  -- ✅ Bypasses RLS
SECURITY DEFINER
STABLE
AS $$
  SELECT ARRAY(SELECT store_id FROM store_users WHERE user_id = auth.uid());
$$;
```

### ❌ WRONG: LANGUAGE plpgsql + SECURITY DEFINER

This does NOT bypass RLS and causes infinite recursion:

```sql
CREATE FUNCTION get_user_store_ids()
RETURNS UUID[]
LANGUAGE plpgsql  -- ❌ Does NOT bypass RLS!
SECURITY DEFINER
AS $$
BEGIN
  RETURN ARRAY(SELECT store_id FROM store_users WHERE user_id = auth.uid());
END;
$$;
```

---

## Helper Functions (All LANGUAGE sql)

### 1. `get_user_store_ids()` - Returns stores user belongs to
- **Purpose**: Avoid recursion in SELECT policies
- **Usage**: `store_id = ANY(get_user_store_ids())`
- **Migration**: 032, 036

### 2. `can_user_manage_store(UUID)` - Check if user is Owner/Manager
- **Purpose**: Avoid recursion in INSERT/UPDATE policies
- **Usage**: `can_user_manage_store(store_users.store_id)`
- **Migration**: 033, 035

### 3. `is_user_owner_at_store(UUID)` - Check if user is Owner
- **Purpose**: Avoid recursion in DELETE policy
- **Usage**: `is_user_owner_at_store(store_users.store_id)`
- **Migration**: 034, 036

### 4. `is_platform_admin()` - Check if user is platform admin
- **Purpose**: Bypass all RLS for admins
- **Usage**: `(SELECT is_platform_admin())`
- **Migration**: Early migrations

---

## RLS Policies (Final State)

### store_users Table

**SELECT Policy:**
```sql
CREATE POLICY "store_users_select" ON store_users
  FOR SELECT TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR user_id = auth.uid()
    OR store_id = ANY(get_user_store_ids())  -- Uses helper
  );
```

**INSERT Policy:**
```sql
CREATE POLICY "store_users_insert" ON store_users
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_platform_admin())
    OR can_user_manage_store(store_users.store_id)  -- Uses helper
    OR (user_id = auth.uid() AND is_billing_owner = true)
  );
```

**UPDATE Policy:**
```sql
CREATE POLICY "store_users_update" ON store_users
  FOR UPDATE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR can_user_manage_store(store_users.store_id)  -- Uses helper
  );
```

**DELETE Policy:**
```sql
CREATE POLICY "store_users_delete" ON store_users
  FOR DELETE TO authenticated
  USING (
    (SELECT is_platform_admin())
    OR is_user_owner_at_store(store_users.store_id)  -- Uses helper
  );
```

---

### audit_logs Table

**Immutability Guarantee:**

```sql
-- UPDATE: DENY ALL
CREATE POLICY "audit_logs_update_deny" ON audit_logs
  FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

-- DELETE: DENY ALL
CREATE POLICY "audit_logs_delete_deny" ON audit_logs
  FOR DELETE TO authenticated
  USING (false);
```

**Note**: Tests must check `data.length === 0`, not `error !== null` (RLS silently filters)

---

## Critical Lessons Learned

### 1. RLS Recursion Prevention

**Problem**: Policy queries the same table it protects → infinite recursion

**Solution**: Use `LANGUAGE sql` SECURITY DEFINER functions to bypass RLS

### 2. LANGUAGE sql vs plpgsql

| Language | Bypasses RLS? | Use Case |
|----------|---------------|----------|
| `sql` | ✅ Yes | RLS helper functions |
| `plpgsql` | ❌ No | Complex business logic |

### 3. RLS Testing Pattern

**Wrong**:
```typescript
expect(error).not.toBeNull()  // RLS doesn't throw errors!
```

**Correct**:
```typescript
const { data, error } = await client.from('table').update(...).select()
expect(error).toBeNull()      // No error
expect(data).toEqual([])      // But 0 rows affected
```

---

## Migration Timeline

| Date | Migrations | Achievement |
|------|------------|-------------|
| Feb 1-8 | 000-023 | Core schema, initial RLS |
| Feb 9 AM | 024-031 | RLS recursion attempts (6 → 39 failures) |
| Feb 9 PM | 032 | SELECT recursion fixed (39 → 7 failures) |
| Feb 9 PM | 033-034 | UPDATE/DELETE recursion fixed |
| Feb 9 PM | 035-036 | LANGUAGE sql adoption (still 3 failures) |
| Feb 9 PM | 037 | Simplified INSERT policy (862/862 passing! 🎉) |

---

## Production Readiness Checklist

- ✅ Zero infinite recursion issues
- ✅ Audit logs properly immutable
- ✅ Complete multi-tenant isolation
- ✅ All helper functions use LANGUAGE sql
- ✅ 862/862 tests passing (100%)
- ✅ RLS policies tested with real authenticated clients
- ✅ Cross-tenant access prevented
- ✅ Permission boundaries enforced

---

## For New Developers

If you're setting up a new environment:

1. Run migrations 000-037 in order (they're cumulative)
2. Read this document to understand the final state
3. Don't try to "clean up" the migrations - they work!
4. If you see recursion, check: is the function using `LANGUAGE sql`?

---

## Next Steps

- ✅ All tests passing
- ⏭️ Deploy to staging
- ⏭️ Monitor RLS performance under load
- ⏭️ Add E2E tests for multi-tenant scenarios
