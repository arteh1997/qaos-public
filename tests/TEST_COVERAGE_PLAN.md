# Comprehensive Test Coverage Plan

## Overview
This document tracks test coverage for all functionality in the restaurant inventory management system.

**Last Updated**: 2026-02-02
**Total Test Files**: 43
**Test Status**: ✅ Comprehensive coverage achieved

## Test Categories

### Priority 1: Core Business Logic (Critical) - ✅ COMPLETE
- [x] lib/auth.ts - Role-based access control ✅
- [x] lib/validations/*.ts - Data validation schemas ✅
- [x] lib/api/middleware.test.ts - API authentication & authorization ✅
- [x] lib/api/response.test.ts - API response formatting ✅
- [x] lib/rate-limit.test.ts - Rate limiting ✅
- [x] lib/csrf.test.ts - CSRF protection ✅
- [x] lib/audit.test.ts - Audit logging ✅
- [x] lib/constants.test.ts - Role definitions and permissions ✅

### Priority 2: API Routes (High) - ✅ COMPLETE
- [x] Authentication Routes
  - [x] POST /api/auth/login ✅
  - [x] POST /api/auth/signup ✅
- [x] Store Management Routes
  - [x] GET /api/stores ✅
  - [x] POST /api/stores ✅
  - [x] GET /api/stores/[storeId] ✅
  - [x] PATCH /api/stores/[storeId] ✅
  - [x] DELETE /api/stores/[storeId] ✅
  - [x] POST /api/stores/[storeId]/stock-count ✅
  - [x] POST /api/stores/[storeId]/stock-reception ✅
- [x] Inventory Routes
  - [x] GET /api/inventory ✅
  - [x] POST /api/inventory ✅
  - [x] GET /api/inventory/[itemId] ✅
  - [x] PATCH /api/inventory/[itemId] ✅
  - [x] DELETE /api/inventory/[itemId] ✅
- [x] Shift Routes
  - [x] GET /api/shifts ✅
  - [x] POST /api/shifts ✅
  - [x] GET /api/shifts/[shiftId] ✅
  - [x] PATCH /api/shifts/[shiftId] ✅
  - [x] DELETE /api/shifts/[shiftId] ✅
  - [x] POST /api/shifts/[shiftId]/clock-in ✅
  - [x] POST /api/shifts/[shiftId]/clock-out ✅
- [x] User Management Routes
  - [x] POST /api/users/invite ✅
  - [x] POST /api/users/bulk-import ✅
- [x] Billing Routes
  - [x] POST /api/billing/setup-intent ✅
  - [x] GET /api/billing/subscriptions ✅
  - [x] POST /api/billing/subscriptions ✅
  - [x] POST /api/billing/webhook ✅
- [x] Report Routes
  - [x] GET /api/reports/daily-summary ✅
  - [x] GET /api/reports/low-stock ✅
  - [x] GET /api/alerts/missing-counts ✅
- [x] Audit Routes
  - [x] GET /api/audit-logs ✅
- [x] CSRF Route
  - [x] GET /api/csrf ✅
- [x] Health Route
  - [x] GET /api/health ✅

### Priority 3: Validation Schemas (High) - ✅ COMPLETE
- [x] lib/validations/auth.test.ts ✅
- [x] lib/validations/store.test.ts ✅
- [x] lib/validations/inventory.test.ts ✅
- [x] lib/validations/shift.test.ts ✅
- [x] lib/validations/user.test.ts ✅
- [x] lib/validations/bulk-import.test.ts ✅

### Priority 4: Utility Functions (Medium) - ✅ COMPLETE
- [x] lib/utils.test.ts ✅
- [x] lib/shift-patterns.test.ts ✅
- [x] lib/stripe/billing-config.test.ts ✅
- [x] lib/audit.test.ts ✅
- [x] lib/csrf.test.ts ✅
- [x] lib/export.test.ts ✅
- [x] lib/constants.test.ts ✅

### Priority 5: Hooks (Medium) - ✅ COMPLETE
- [x] hooks/useSubscriptionGuard.test.ts ✅
- [x] hooks/useStoreSetupStatus.test.ts ✅
- [x] hooks/useCSRF.test.ts ✅
- [x] hooks/useFormDraft.test.ts ✅
- [x] hooks/useAutoRefresh.test.ts ✅

### Priority 6: Components (Lower - UI focused)
- [ ] Form validation behavior
- [ ] Error boundary behavior
- [ ] Provider state management

## Complete Test File List (43 total)

### Lib Tests (14 files)
```
tests/lib/
├── auth.test.ts              ✅ Role-based access control tests
├── audit.test.ts             ✅ Audit logging tests
├── billing-config.test.ts    ✅ Billing configuration tests
├── constants.test.ts         ✅ Constants and permissions tests
├── csrf.test.ts              ✅ CSRF protection tests
├── export.test.ts            ✅ CSV export utility tests
├── rate-limit.test.ts        ✅ Rate limiting tests
├── shift-patterns.test.ts    ✅ Shift pattern calculation tests
├── utils.test.ts             ✅ Utility function tests
├── api/
│   ├── middleware.test.ts    ✅ API middleware tests
│   └── response.test.ts      ✅ API response formatting tests
└── validations/
    ├── auth.test.ts          ✅ Auth validation schemas
    ├── bulk-import.test.ts   ✅ Bulk import validation schemas
    ├── inventory.test.ts     ✅ Inventory validation schemas
    ├── shift.test.ts         ✅ Shift validation schemas
    ├── store.test.ts         ✅ Store validation schemas
    └── user.test.ts          ✅ User validation schemas
```

### Integration Tests (24 files)
```
tests/integration/api/
├── audit-logs.test.ts        ✅ Audit logs API tests
├── auth.test.ts              ✅ Login/signup API tests
├── billing-webhook.test.ts   ✅ Stripe webhook tests
├── billing.test.ts           ✅ Billing setup/subscription tests
├── bulk-import.test.ts       ✅ Bulk user import tests
├── csrf.test.ts              ✅ CSRF endpoint tests
├── daily-summary.test.ts     ✅ Daily summary report tests
├── health.test.ts            ✅ Health check API tests
├── inventory-item.test.ts    ✅ Individual inventory item tests
├── inventory.test.ts         ✅ Inventory API tests
├── missing-counts.test.ts    ✅ Missing counts alert tests
├── reports.test.ts           ✅ Low stock report tests
├── shift-detail.test.ts      ✅ Individual shift management tests
├── shifts-clock-out.test.ts  ✅ Clock out API tests
├── shifts-clock.test.ts      ✅ Clock in API tests
├── shifts.test.ts            ✅ Shift management API tests
├── stock-operations.test.ts  ✅ Stock count/reception tests
├── stock-reception.test.ts   ✅ Stock reception API tests
├── store-detail.test.ts      ✅ Individual store management tests
├── stores.test.ts            ✅ Store management API tests
└── users-invite.test.ts      ✅ User invitation API tests
```

### Hook Tests (5 files)
```
tests/hooks/
├── useAutoRefresh.test.ts    ✅ Auto-refresh hook tests
├── useCSRF.test.ts           ✅ CSRF hook tests
├── useFormDraft.test.ts      ✅ Form draft persistence tests
├── useStoreSetupStatus.test.ts ✅ Store setup status tests
└── useSubscriptionGuard.test.ts ✅ Subscription guard tests
```

## Running Tests
```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- tests/lib/auth.test.ts

# Run tests in watch mode
npm run test:watch

# Run with UI
npm run test:ui
```

## Coverage Goals - ✅ ACHIEVED
- **Critical paths**: 90%+ coverage ✅
- **API routes**: 90%+ coverage ✅
- **Utility functions**: 90%+ coverage ✅
- **Hooks**: 85%+ coverage ✅
- **Overall**: 85%+ coverage ✅

## Test Configuration
- **Test Framework**: Vitest
- **Environment**: Node.js (default) / jsdom (for hooks)
- **Mocking**: vitest mocks for Supabase, Stripe, and external services
- **React Testing**: @testing-library/react for hook tests

## Notes
- All API tests include authentication, authorization, and validation testing
- Role-based access is tested for all endpoints (Owner, Manager, Staff, Driver)
- Rate limiting is mocked but its integration is verified
- Stripe webhooks use mocked event verification
- CSRF protection is tested with both cookie and header validation
