# RLS Integration Tests

## Overview

These tests verify **Row Level Security (RLS)** policies at the database level by creating real authenticated Supabase clients and attempting cross-tenant queries.

## What These Tests Cover

### ✅ Tested Tables
- `inventory_items` - Store-scoped inventory items (migration 016)
- `store_users` - Team member access control
- `shifts` - Schedule and timecard isolation
- `audit_logs` - Audit log access by role (migration 018)

### ✅ Test Scenarios
- **Store Isolation**: Users cannot see data from other stores
- **Role-Based Permissions**: Correct CRUD permissions by role (Owner/Manager/Staff)
- **Platform Admin Access**: Admins can see/modify all data
- **Multi-Store Users**: Users with multiple stores see all their stores
- **Data Immutability**: Audit logs cannot be modified/deleted

## Requirements

These tests require **actual Supabase credentials** to run:

```bash
# Required environment variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

⚠️ **Do NOT run these tests against production database!** Use a separate development/testing Supabase project.

## Running RLS Tests

### Option 1: Using .env.local (Recommended for Development)

1. Ensure `.env.local` has valid Supabase credentials
2. Run tests:
   ```bash
   npm test -- tests/integration/rls/ --run
   ```

### Option 2: Inline Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://... \
SUPABASE_SERVICE_ROLE_KEY=... \
npm test -- tests/integration/rls/ --run
```

### Option 3: CI/CD Pipeline

Add Supabase credentials as secrets in your CI environment (GitHub Actions, etc.):

```yaml
# .github/workflows/rls-tests.yml
env:
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

## Test Structure

Each RLS test file follows this pattern:

1. **Setup**: Create test stores and users with different roles
2. **Run Tests**: Attempt queries as different users
3. **Verify Isolation**: Ensure users only see authorized data
4. **Cleanup**: Delete test data after tests complete

## Expected Results

When run with valid credentials, all tests should **PASS**:

```
✓ tests/integration/rls/inventory-items-rls.test.ts (20+ tests)
✓ tests/integration/rls/store-users-rls.test.ts (15+ tests)
✓ tests/integration/rls/shifts-rls.test.ts (15+ tests)
✓ tests/integration/rls/audit-logs-rls.test.ts (15+ tests)
```

## What Gets Created During Tests

Each test suite creates:
- 2 test stores (Store A, Store B)
- 4-6 test users with different roles
- 3-4 test records per table
- All data is cleaned up after tests complete

## Troubleshooting

### "Missing Supabase credentials" Error

**Cause**: Environment variables not set
**Fix**: Add `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to your environment

### Tests Failing: "RLS policy violation"

**Cause**: RLS policies not applied or incorrectly configured
**Fix**:
1. Verify all migrations have been run on your test database
2. Check that migrations 016, 017, 018 are applied
3. Verify `is_platform_admin()` helper function exists

### Tests Timeout

**Cause**: Slow database connection or network issues
**Fix**:
1. Use a Supabase project in the same region
2. Increase timeout in test config: `beforeAll(async () => {...}, 60000)`

### Duplicate Email Errors

**Cause**: Previous test run didn't clean up properly
**Fix**:
1. Manually delete test users from Supabase dashboard (emails containing "rls@test.com")
2. Or use different email addresses in tests

## CI/CD Integration

### Recommended Approach

Use a **separate Supabase project** for CI testing:

1. Create a dedicated "ci-testing" Supabase project
2. Add credentials as CI secrets
3. Run RLS tests as part of PR checks
4. Clean up test data after each run

### GitHub Actions Example

```yaml
name: RLS Tests

on: [pull_request]

jobs:
  rls-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - name: Run RLS Tests
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_CI_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_CI_KEY }}
        run: npm test -- tests/integration/rls/ --run
```

## Security Considerations

⚠️ **Never commit Supabase credentials to version control!**

- Use `.env.local` (already in `.gitignore`)
- Use CI secrets for pipeline credentials
- Rotate service role keys periodically
- Use separate projects for dev/test/prod

## Adding New RLS Tests

To add tests for a new table:

1. Create `tests/integration/rls/[table-name]-rls.test.ts`
2. Import utilities from `tests/utils/rls-test-helpers.ts`
3. Follow existing test structure:
   - Store Isolation
   - Role-Based Permissions
   - Platform Admin Access
   - Multi-Store Users
4. Clean up test data in `afterAll`

Example:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestUser,
  createTestStore,
  createAuthenticatedClient,
  // ...
} from '../../utils/rls-test-helpers'

describe('RLS: your_table', () => {
  // Setup test data
  beforeAll(async () => { /* ... */ })

  // Clean up
  afterAll(async () => { /* ... */ })

  // Tests
  describe('Store Isolation', () => {
    it('should allow users to see only their store data', async () => {
      // ...
    })
  })
})
```

## Related Documentation

- [Migration 016](../../../supabase/migrations/016_inventory_items_store_scoping_fixed.sql) - Multi-tenant inventory
- [Migration 018](../../../supabase/migrations/018_fix_audit_logs_rls.sql) - Audit logs RLS
- [RLS Test Helpers](../../utils/rls-test-helpers.ts) - Utility functions
