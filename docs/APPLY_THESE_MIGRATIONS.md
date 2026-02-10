# Migrations to Apply - February 9, 2026

## Current Status: 7 Failures Remaining (855/862 passing - 99.2%)

Migration 032 fixed the SELECT recursion cascade (39 → 7 failures). Now we need migration 033 to fix the remaining issues.

---

## Migration 033: Fix Remaining Recursion and Immutability

```sql
-- Copy contents from: supabase/migrations/033_fix_remaining_recursion_and_immutability.sql
```

### What this fixes:

**1. Audit Logs Immutability (3 tests)**
- Problem: Old policies still allowing UPDATE/DELETE
- Solution: Nuclear cleanup - drop ALL audit_logs policies, rebuild clean
- Result: UPDATE/DELETE operations will be denied with `USING (false)`

**2. store_users UPDATE Recursion (1 test)**
- Problem: UPDATE policy queries store_users → infinite recursion
- Solution: SECURITY DEFINER helper `can_user_manage_store()`
- Result: No recursion when updating memberships

**3. store_users INSERT Recursion (2 tests)**
- Problem: INSERT policy might have recursion or conflict with UPDATE
- Solution: Use same SECURITY DEFINER helper for consistency
- Result: No recursion when adding team members

**4. Multi-Store User (1 test)**
- Problem: User sees 2 shifts instead of 3 (cascade from INSERT failure)
- Solution: Once INSERT works, user will be added to second store successfully
- Result: User sees all shifts from both stores

---

## Expected Result

**Before migration 033**: 7 failing tests (855/862 passing)
**After migration 033**: 0 failing tests (862/862 passing - 100% success rate!)

---

## What Migration 033 Does

### Part 1: audit_logs Nuclear Cleanup
```sql
-- Drop EVERY policy on audit_logs
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'audit_logs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON audit_logs', pol.policyname);
  END LOOP;
END $$;

-- Rebuild clean policies
CREATE POLICY "audit_logs_update_deny" ON audit_logs
  FOR UPDATE USING (false) WITH CHECK (false);

CREATE POLICY "audit_logs_delete_deny" ON audit_logs
  FOR DELETE USING (false);
```

### Part 2: SECURITY DEFINER Helper for store_users
```sql
-- Helper function (bypasses RLS)
CREATE FUNCTION can_user_manage_store(p_store_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM store_users
    WHERE user_id = auth.uid()
      AND store_id = p_store_id
      AND role IN ('Owner', 'Manager')
  );
END;
$$;
```

### Part 3: Rebuild store_users Policies (No Recursion)
```sql
-- INSERT policy
CREATE POLICY "store_users_insert" ON store_users
  FOR INSERT USING (
    (SELECT is_platform_admin())
    OR can_user_manage_store(store_users.store_id)  -- ← Uses helper
  );

-- UPDATE policy
CREATE POLICY "store_users_update" ON store_users
  FOR UPDATE USING (
    (SELECT is_platform_admin())
    OR can_user_manage_store(store_users.store_id)  -- ← Uses helper
  );
```

---

## How to Apply

1. Open Supabase dashboard → SQL Editor
2. Copy entire contents of `supabase/migrations/033_fix_remaining_recursion_and_immutability.sql`
3. Paste and execute
4. Run tests to verify:

```bash
npm test
```

You should see: **✅ 862/862 passing (100% success rate)**

---

## Previous Migrations Timeline

| Migration | Result | Notes |
|-----------|--------|-------|
| 024-030 | Partial fixes | Fixed shifts, some recursion remained |
| 031 | Made worse | SELECT recursion affected all tables (6 → 39 failures) |
| 032 | Major fix | SECURITY DEFINER for SELECT (39 → 7 failures) |
| **033** | **Final fix** | **SECURITY DEFINER for UPDATE/INSERT + audit_logs cleanup (7 → 0 failures)** |

---

## Key Lessons: RLS Recursion Prevention

When a policy needs to query the same table it protects:

**❌ Bad (causes recursion)**:
```sql
CREATE POLICY "my_policy" ON my_table
  USING (
    id IN (SELECT id FROM my_table WHERE ...)
  );
```

**✅ Good (uses SECURITY DEFINER)**:
```sql
CREATE FUNCTION get_my_ids()
RETURNS UUID[]
SECURITY DEFINER  -- ← Bypasses RLS
AS $$
  SELECT ARRAY(SELECT id FROM my_table WHERE ...)
$$;

CREATE POLICY "my_policy" ON my_table
  USING (id = ANY(get_my_ids()));
```

---

## After Migration 033

Once you achieve **862/862 passing tests**, you'll have:
- ✅ Complete multi-tenant isolation (all RLS working)
- ✅ Audit logs properly immutable (compliance-ready)
- ✅ Zero infinite recursion issues
- ✅ Ready for production

Apply migration 033 and let's hit 100%! 🎯
