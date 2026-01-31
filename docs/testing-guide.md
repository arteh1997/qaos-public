# Test Suite Documentation

## Overview

This document describes the comprehensive test suite for the Restaurant Inventory Management System. The test suite is built using **Vitest** with full TypeScript support and covers unit tests, integration tests, and edge cases.

## Quick Start

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
# Run all tests once
npm run test:run

# Run tests in watch mode (re-run on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Open Vitest UI (interactive browser interface)
npm run test:ui
```

## Test Structure

```
tests/
├── setup.ts                          # Global test setup and mocks
├── lib/
│   ├── rate-limit.test.ts            # Rate limiter unit tests
│   ├── auth.test.ts                  # Auth helper unit tests
│   ├── utils.test.ts                 # Utility function unit tests
│   ├── api/
│   │   ├── response.test.ts          # API response helper tests
│   │   └── middleware.test.ts        # API middleware tests
│   └── validations/
│       ├── auth.test.ts              # Auth validation schema tests
│       ├── inventory.test.ts         # Inventory validation tests
│       ├── store.test.ts             # Store validation tests
│       ├── user.test.ts              # User validation tests
│       └── shift.test.ts             # Shift validation tests
└── integration/
    └── api/
        └── stores.test.ts            # Store API integration tests
```

## Test Coverage Estimates

### Unit Tests (100% Coverage Target)

| Module | Tests | Estimated Coverage |
|--------|-------|-------------------|
| `lib/rate-limit.ts` | 15 tests | ~95% |
| `lib/auth.ts` | 35 tests | ~100% |
| `lib/utils.ts` | 25 tests | ~100% |
| `lib/api/response.ts` | 30 tests | ~95% |
| `lib/api/middleware.ts` | 20 tests | ~90% |
| `lib/validations/auth.ts` | 18 tests | ~100% |
| `lib/validations/inventory.ts` | 20 tests | ~100% |
| `lib/validations/store.ts` | 15 tests | ~100% |
| `lib/validations/user.ts` | 22 tests | ~100% |
| `lib/validations/shift.ts` | 20 tests | ~100% |

**Total Unit Tests: ~220 tests**

### Integration Tests

| API Endpoint | Tests | Coverage Areas |
|--------------|-------|----------------|
| `GET /api/stores` | 3 tests | Auth, pagination, filtering |
| `POST /api/stores` | 4 tests | Auth, validation, creation |

**Note:** Integration tests use mocked Supabase clients to avoid database dependencies.

## Test Categories

### 1. Rate Limiter Tests (`lib/rate-limit.test.ts`)

Tests the sliding window rate limiting algorithm:

- **Basic Functionality**
  - First request allowed with correct remaining count
  - Decrementing counter on subsequent requests
  - Blocking when limit exceeded
  - Reset after window expires

- **Edge Cases**
  - Separate tracking per identifier
  - Very short window durations
  - Limit of 1
  - Empty identifier strings

- **Rate Limit Headers**
  - Correct header generation
  - Zero remaining handling

- **Preset Configurations**
  - API rate limit (100/min)
  - Auth rate limit (10/min)
  - Create user rate limit (5/min)
  - Reports rate limit (20/min)

### 2. Auth Helper Tests (`lib/auth.test.ts`)

Tests role-based access control:

- **Role Classification**
  - `hasGlobalAccess()` - Admin, Driver
  - `isStoreScopedRole()` - Staff only

- **Permission Functions**
  - `canManageStores()` - Admin only
  - `canViewAllStores()` - Admin, Driver
  - `canManageUsers()` - Admin only
  - `canManageInventoryItems()` - Admin only
  - `canDoStockCount()` - Admin, Staff
  - `canDoStockReception()` - Admin, Driver
  - `canManageShifts()` - Admin only
  - `canViewReports()` - Admin, Driver

- **Store Access Control**
  - Global roles access any store
  - Staff only access assigned store
  - Null/undefined role handling

- **Default Store ID**
  - Staff returns assigned store
  - Global roles return null

### 3. Utility Function Tests (`lib/utils.test.ts`)

#### `sanitizeString()`
- HTML entity escaping (&, <, >, ", ', /)
- XSS attack prevention (script tags, event handlers)
- Edge cases (null, undefined, empty strings, unicode)

#### `sanitizeNotes()`
- HTML tag stripping
- Length limiting (1000 characters)
- Whitespace trimming
- Combined operations

#### `cn()` (Tailwind className utility)
- Class merging
- Conditional classes
- Tailwind conflict resolution

### 4. API Response Tests (`lib/api/response.test.ts`)

- **Request ID Generation**
  - Unique IDs
  - Correct format (req_*)

- **Pagination Metadata**
  - First/middle/last page calculations
  - hasNext/hasPrev flags
  - Empty results handling

- **Response Helpers**
  - `apiSuccess()` - 200 with data
  - `apiError()` - 500 with message
  - `apiUnauthorized()` - 401
  - `apiForbidden()` - 403
  - `apiNotFound()` - 404
  - `apiBadRequest()` - 400
  - `apiRateLimited()` - 429
  - `apiValidationError()` - 400 with field errors

### 5. Validation Schema Tests (`lib/validations/*.test.ts`)

Each validation schema is tested for:

1. **Valid Inputs** - All acceptable formats
2. **Invalid Inputs** - Rejection with correct error messages
3. **Edge Cases** - Boundary values, special characters
4. **Missing Fields** - Required field validation
5. **Type Validation** - Correct type enforcement

#### Schemas Tested:
- `loginSchema` - Email + password
- `forgotPasswordSchema` - Email only
- `resetPasswordSchema` - Password + confirmation
- `acceptInviteSchema` - Password + confirmation + name
- `inventoryItemSchema` - Item details
- `storeInventorySchema` - Store-item relationship
- `stockCountSchema` - Count submission
- `stockReceptionSchema` - Reception recording
- `storeSchema` - Store details
- `inviteUserSchema` - User invitation
- `updateUserSchema` - User updates
- `shiftSchema` - Shift scheduling
- `clockInOutSchema` - Time tracking

### 6. API Middleware Tests (`lib/api/middleware.test.ts`)

- **Store Access Control**
  - Admin/Driver global access
  - Staff store-scoped access

- **Pagination Parsing**
  - Default values
  - Custom parameters
  - Boundary enforcement (max 100, min 1)
  - Invalid value handling

- **Filter Parsing**
  - Search, store_id, status, date extraction
  - Null for missing params
  - Special character handling

### 7. Integration Tests (`tests/integration/api/`)

Tests API endpoints with mocked Supabase:

- **Authentication**
  - 401 for unauthenticated requests

- **Authorization**
  - 403 for insufficient permissions

- **Validation**
  - 400 for invalid input data

- **Success Cases**
  - Correct response format
  - Proper status codes (200, 201)

## Writing New Tests

### Test File Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Module Name', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('functionName', () => {
    describe('Valid Inputs', () => {
      it('should handle normal case', () => {
        // Arrange
        const input = { ... }

        // Act
        const result = functionName(input)

        // Assert
        expect(result).toBe(expected)
      })
    })

    describe('Invalid Inputs', () => {
      it('should reject invalid input', () => {
        // Test invalid cases
      })
    })

    describe('Edge Cases', () => {
      it('should handle boundary values', () => {
        // Test edge cases
      })
    })
  })
})
```

### Testing Patterns

1. **Arrange-Act-Assert (AAA)**
   - Arrange: Set up test data
   - Act: Execute the function
   - Assert: Verify the result

2. **Test Isolation**
   - Each test should be independent
   - Use `beforeEach` to reset state
   - Use `vi.clearAllMocks()` for mock cleanup

3. **Descriptive Names**
   - `describe` blocks for grouping
   - `it` statements describe expected behavior
   - Use "should" convention

4. **Edge Case Coverage**
   - Null/undefined values
   - Empty strings/arrays
   - Boundary values
   - Invalid types

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:run

      - name: Generate coverage report
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: true
```

### Pre-commit Hook (optional)

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
npm run test:run
```

## Debugging Tests

### Run Single Test File

```bash
npx vitest run tests/lib/auth.test.ts
```

### Run Tests Matching Pattern

```bash
npx vitest run -t "should allow Admin"
```

### Debug Mode

```bash
npx vitest --inspect-brk
```

### Verbose Output

```bash
npx vitest run --reporter=verbose
```

## Coverage Reports

After running `npm run test:coverage`, coverage reports are available at:

- **Terminal**: Summary printed to console
- **HTML**: `coverage/index.html` (open in browser)
- **JSON**: `coverage/coverage-final.json`

### Coverage Thresholds

Recommended minimum coverage thresholds:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      }
    }
  }
})
```

## Common Issues & Solutions

### Issue: Module not found errors

**Solution**: Ensure `@` path alias is configured in `vitest.config.ts`:

```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './'),
  },
}
```

### Issue: Next.js server components not mocking properly

**Solution**: Mock `next/server` in `tests/setup.ts`:

```typescript
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init) => ({
      json: async () => data,
      status: init?.status ?? 200,
    })),
  },
}))
```

### Issue: Supabase client errors in tests

**Solution**: Mock the Supabase client:

```typescript
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}))
```

## Future Improvements

1. **E2E Tests** - Add Playwright tests for critical user flows
2. **Component Tests** - Add React Testing Library for UI components
3. **Snapshot Tests** - Add snapshot tests for complex outputs
4. **Performance Tests** - Add benchmarks for critical paths
5. **API Contract Tests** - Add OpenAPI schema validation

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Zod Testing Best Practices](https://zod.dev/)
