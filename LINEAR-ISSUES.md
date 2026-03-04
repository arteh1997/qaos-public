# LINEAR-ISSUES.md — Development Task Backlog

Generated 2026-03-01. Every task derived from FEATURES.md, AUDIT.md, and GitHub Issues.

---

## Summary

| Metric                                  | Count          |
| --------------------------------------- | -------------- |
| **Total tasks**                         | 124            |
| **Done**                                | 58             |
| **To Do**                               | 66             |
| **Estimated total effort (To Do only)** | ~360–465 hours |

### Effort breakdown (To Do only)

| Priority | Tasks | Est. Hours |
| -------- | ----- | ---------- |
| Urgent   | 7     | 17–22      |
| High     | 18    | 64–86      |
| Medium   | 23    | 124–167    |
| Low      | 14    | 155–190    |

---

## Area 1 — Authentication & Security

### [Auth] — Email / password authentication

**Status:** Done
**Priority:** Urgent
**Labels:** backend, frontend, testing
**Acceptance Criteria:**

- [x] User can sign up with email and password
- [x] User can log in with valid credentials
- [x] Invalid credentials return 401, not a server error
- [x] Sign-up rate limited to 5 requests/min
- [x] Login rate limited to 10 requests/min
- [x] Passwords validated with Zod schema (min length, complexity)
- [x] Session cookie set on successful login
- [x] Duplicate email sign-up returns meaningful error
      **Notes:** Fully implemented in `app/api/auth/login/route.ts`, `app/api/auth/signup/route.ts`, `lib/validations/auth.ts`.

---

### [Auth] — Google OAuth sign-in

**Status:** Done
**Priority:** Urgent
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] User can click "Sign in with Google" and complete OAuth flow
- [x] Callback route exchanges code for session
- [x] New users are auto-provisioned a profile on first Google sign-in
- [x] Existing users with matching email can sign in via Google
- [x] OAuth errors redirect to login with error message
      **Notes:** Implemented in `app/api/auth/callback/route.ts`.

---

### [Auth] — Session management and middleware

**Status:** Done
**Priority:** Urgent
**Labels:** backend
**Acceptance Criteria:**

- [x] Session auto-refreshes via middleware on every request
- [x] Expired sessions redirect to login
- [x] AuthProvider loads user profile and stores on mount
- [x] Race conditions prevented by request sequencing (`latestRequestIdRef`)
- [x] `useAuth()` hook exposes `user`, `profile`, `stores`, `currentStore`, `role`, `storeId`, `signOut`
      **Notes:** `middleware.ts`, `components/providers/AuthProvider.tsx`, `lib/supabase/server.ts`.

---

### [Auth] — CSRF double-submit cookie protection

**Status:** Done
**Priority:** Urgent
**Labels:** backend, security
**Acceptance Criteria:**

- [x] First page load sets `csrf_token` cookie
- [x] `csrfFetch()` reads cookie and sends it as `x-csrf-token` header
- [x] State-changing API requests without valid CSRF token return 403
- [x] All POST/PUT/PATCH/DELETE endpoints enforce CSRF via `requireCSRF: true`
      **Notes:** `lib/csrf.ts`, `hooks/useCSRF.ts`, `middleware.ts`.

---

### [Auth] — Role-based access control (RBAC)

**Status:** Done
**Priority:** Urgent
**Labels:** backend, database
**Acceptance Criteria:**

- [x] Users can have different roles at different stores via `store_users` junction table
- [x] Owner can perform all actions within their store
- [x] Manager can manage inventory, shifts, suppliers but not billing or store deletion
- [x] Staff can clock in/out, submit counts, view inventory
- [x] `withApiAuth` rejects requests from users without required role
- [x] Role hierarchy prevents Managers from inviting Owners
- [x] RLS enforces store scoping — users only see data for their stores
      **Notes:** `lib/auth.ts`, `lib/api/middleware.ts`, `lib/constants.ts`.

---

### [Security] — Enforce Content Security Policy (not report-only)

**Status:** To Do
**Priority:** High
**Labels:** backend, security
**Acceptance Criteria:**

- [ ] CSP header changed from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`
- [ ] All inline scripts either removed or covered by nonce/hash
- [ ] No console CSP violations on any page after enforcement
- [ ] Sentry, Vercel Analytics, Stripe, and Google OAuth domains whitelisted
      **Notes:** GitHub Issue #5. Currently in `middleware.ts`. Audit all inline scripts before switching.

---

## Area 2 — Store Management

### [Stores] — Store CRUD

**Status:** Done
**Priority:** High
**Labels:** backend, frontend, database
**Acceptance Criteria:**

- [x] Authenticated user can create a new store
- [x] Store creator is auto-assigned Owner role and `is_billing_owner`
- [x] Owner can update store name, address, operating hours
- [x] Owner can delete store (cascades via FK)
- [x] Users see only stores they belong to (RLS)
- [x] Store list shows role badge per store
      **Notes:** `app/api/stores/route.ts`, `app/api/stores/[storeId]/route.ts`.

---

### [Stores] — Multi-store switching

**Status:** Done
**Priority:** High
**Labels:** frontend
**Acceptance Criteria:**

- [x] Users with multiple stores see a store switcher in sidebar
- [x] Switching store updates all dashboard data
- [x] Selected store persists across page navigation (localStorage)
- [x] Cross-tab sync via `storage` event listener
- [x] Single-store users do not see the switcher
      **Notes:** `components/layout/StoreSelector.tsx`, `AuthProvider.tsx`.

---

### [Settings] — Add API keys and webhooks sections to settings page

**Status:** To Do
**Priority:** Medium
**Labels:** frontend
**Acceptance Criteria:**

- [ ] Settings page has a "Developer" or "API" section
- [ ] `ApiKeyForm` component rendered and functional within settings
- [ ] `WebhookForm` component rendered and functional within settings
- [ ] Section only visible to Owner role
- [ ] Links to billing and integrations pages from settings
      **Notes:** Components `components/settings/ApiKeyForm.tsx` and `WebhookForm.tsx` already exist but are not imported anywhere. Wire them into `app/(dashboard)/settings/page.tsx`.

---

### [Settings] — Add danger zone (delete store) to settings page

**Status:** To Do
**Priority:** Low
**Labels:** frontend
**Acceptance Criteria:**

- [ ] "Danger Zone" section at bottom of settings page (Owner only)
- [ ] Delete store button with confirmation dialog (type store name to confirm)
- [ ] Calls existing `DELETE /api/stores/[storeId]` endpoint
- [ ] Redirects to store list after deletion
      **Notes:** API endpoint already exists. Just needs UI.

---

### [Stores] — Store setup wizard

**Status:** Done
**Priority:** Medium
**Labels:** frontend
**Acceptance Criteria:**

- [x] New store shows setup wizard prompts
- [x] Wizard tracks: inventory added, shift created, supplier added
- [x] Progress updates in real time as user completes steps
- [x] Wizard dismisses once all steps complete
      **Notes:** `hooks/useStoreSetupStatus.ts`, `components/store/setup/`.

---

## Area 3 — Inventory Management

### [Inventory] — Inventory items CRUD

**Status:** Done
**Priority:** High
**Labels:** backend, frontend, database
**Acceptance Criteria:**

- [x] Owner/Manager can add inventory items with name, unit, cost, category, par level
- [x] Items listed with current stock, par level, and status indicator
- [x] Search by name, filter by category, sort by any column
- [x] PATCH updates item details; DELETE removes item
- [x] Pagination (50+ items per page)
- [x] Audit logged on create/update/delete
      **Notes:** `app/api/stores/[storeId]/inventory/route.ts`, `app/(dashboard)/inventory/page.tsx`.

---

### [Inventory] — Stock counting

**Status:** Done
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Any staff member can submit a stock count
- [x] Count records current quantity for each item
- [x] Variance calculated against previous count
- [x] Count saved to `stock_history` with `action_type: 'Count'`
- [x] Missing counts tracked and alerted via cron
- [x] Count can be submitted offline and synced later
      **Notes:** `app/api/stores/[storeId]/stock-count/route.ts`.

---

### [Inventory] — Stock reception (deliveries)

**Status:** Done
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] User records received quantities per item
- [x] Stock levels auto-update on reception
- [x] Reception linked to purchase order if applicable
- [x] Variance flagged when received differs from ordered
- [x] `stock_history` entry created with `action_type: 'Reception'`
- [x] Audit logged
      **Notes:** `app/api/stores/[storeId]/stock-reception/route.ts`.

---

### [Inventory] — Stock adjustments

**Status:** Done
**Priority:** Medium
**Labels:** backend
**Acceptance Criteria:**

- [x] Owner/Manager can adjust stock quantities up or down
- [x] Adjustment reason is required
- [x] `stock_history` records adjustment with reason and user
- [x] Current stock level updated accordingly
- [x] Audit logged
      **Notes:** `app/api/stores/[storeId]/stock/adjustment/route.ts`.

---

### [Inventory] — Barcode scanning

**Status:** Done
**Priority:** Medium
**Labels:** frontend
**Acceptance Criteria:**

- [x] User can scan barcode via camera to look up inventory item
- [x] Manual barcode entry also supported
- [x] Scanned barcode auto-fills item in count/reception form
- [x] Barcode lookups cached in IndexedDB for offline use
- [x] Unrecognized barcode shows "item not found" message
      **Notes:** `hooks/useBarcodeScanner.ts`, `html5-qrcode` library.

---

### [Inventory] — Fix CSV import to use withApiAuth middleware

**Status:** To Do
**Priority:** High
**Labels:** backend, security, bug
**Acceptance Criteria:**

- [ ] `app/api/stores/[storeId]/inventory/import/route.ts` refactored to use `withApiAuth`
- [ ] CSRF validation enforced on import endpoint
- [ ] Rate limiting applied
- [ ] Existing import functionality (header aliases, per-row validation) preserved
- [ ] Tests updated to reflect new auth pattern
      **Notes:** Currently uses `createClient()` directly, bypassing standard auth middleware. Security gap.

---

### [Inventory] — Add export button to dashboard UI

**Status:** To Do
**Priority:** Medium
**Labels:** frontend
**Acceptance Criteria:**

- [ ] Export button visible on inventory page (Owner only)
- [ ] Button triggers `GET /api/stores/{storeId}/export` and downloads `.xlsx`
- [ ] Optional date range picker for filtering
- [ ] Loading state while export generates
      **Notes:** API endpoint `app/api/stores/[storeId]/export/route.ts` already works. Just needs a UI trigger.

---

### [Inventory] — Par levels and low-stock alerts

**Status:** Done
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Each item has a configurable par level
- [x] Items below par level flagged as "low stock"
- [x] Items below critical threshold flagged as "critical"
- [x] Email alerts sent based on user alert preferences
- [x] Low-stock report page shows all items below par
      **Notes:** `store_inventory.par_level`, `app/api/cron/send-alerts/route.ts`.

---

## Area 4 — Categories & Tags

### [Categories] — Fix cross-tenant item count leak

**Status:** To Do
**Priority:** Urgent
**Labels:** backend, bug, security
**Acceptance Criteria:**

- [ ] Categories GET endpoint adds `store_id` filter to `inventory_items` count query
- [ ] Item counts return 0 for categories with no items in the current store
- [ ] Multi-tenant test: store A's category shows only store A's item count
- [ ] Existing category tests updated
      **Notes:** `app/api/stores/[storeId]/categories/route.ts` — the count subquery on `inventory_items` is missing `.eq('store_id', storeId)`. Data leakage across tenants.

---

### [Categories] — Categories CRUD (existing functionality)

**Status:** Done
**Priority:** Medium
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Owner/Manager can create categories with name, color, description
- [x] Duplicate category name rejected
- [x] Delete blocked when items are assigned to category
- [x] Owner-only delete access
- [x] CRUD operations work end-to-end
      **Notes:** `app/api/stores/[storeId]/categories/route.ts`, `components/categories/`.

---

### [Tags] — Fix cross-tenant tag usage count leak

**Status:** To Do
**Priority:** Urgent
**Labels:** backend, bug, security
**Acceptance Criteria:**

- [ ] Tags GET endpoint adds `store_id` filter to `inventory_item_tags` usage count query
- [ ] Tag counts return 0 for tags with no items in the current store
- [ ] Multi-tenant test: store A's tag shows only store A's usage count
      **Notes:** Same pattern as categories bug. `app/api/stores/[storeId]/tags/route.ts`.

---

### [Tags] — Tags CRUD (existing functionality)

**Status:** Done
**Priority:** Medium
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Owner/Manager can create tags with name, color, description
- [x] Tags can be assigned to and removed from inventory items
- [x] Duplicate tag name rejected
- [x] CRUD operations work end-to-end
      **Notes:** `app/api/stores/[storeId]/tags/route.ts`, `components/tags/`.

---

## Area 5 — Recipes & Menu

### [Recipes] — Recipes and ingredients CRUD

**Status:** Done
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Owner/Manager can create recipes with name and category
- [x] Ingredients can be added to recipes from inventory items
- [x] Ingredient quantities and units specified
- [x] Recipe cost auto-calculated from ingredient costs
- [x] Recipes can be updated and deleted
- [x] Audit logged
      **Notes:** `app/api/stores/[storeId]/recipes/route.ts`.

---

### [Menu] — Menu items and costing (existing functionality)

**Status:** Done
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Owner/Manager can create menu items with selling price
- [x] Menu item auto-links to a recipe for cost tracking
- [x] Food cost percentage calculated per item
- [x] Profit margin and rating displayed (excellent/good/fair/poor)
      **Notes:** `app/api/stores/[storeId]/menu-items/route.ts`.

---

### [Menu] — Add recipe yield quantity/unit UI

**Status:** To Do
**Priority:** Low
**Labels:** frontend
**Acceptance Criteria:**

- [ ] Recipe/ingredient form includes yield quantity and yield unit fields
- [ ] Defaults to `1 serving` if not set
- [ ] Cost per serving recalculates when yield changes
- [ ] Existing recipes with default yield continue to work
      **Notes:** Schema fields `yield_quantity`/`yield_unit` exist in DB. Just needs UI in `IngredientForm.tsx`.

---

### [Menu] — Menu analysis

**Status:** Done
**Priority:** Medium
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Average food cost percentage across all menu items
- [x] Items with high food cost flagged with alerts
- [x] Category-level cost breakdown available
- [x] Analysis updates when menu items or ingredient costs change
      **Notes:** `app/api/stores/[storeId]/menu-analysis/route.ts`.

---

## Area 6 — Shifts & Payroll

### [Shifts] — Shift scheduling

**Status:** Done
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Manager/Owner can create shifts with date, start/end time, assigned staff
- [x] Staff see only their own shifts
- [x] Shifts display in calendar or list view
- [x] Shifts can be updated or cancelled
- [x] Shift patterns can be auto-generated
- [x] Notification sent when shift assigned/updated/cancelled
      **Notes:** `app/api/stores/[storeId]/shifts/route.ts`, `app/(dashboard)/shifts/page.tsx`.

---

### [Shifts] — Clock in / clock out

**Status:** Done
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Staff can clock in to their assigned shift
- [x] Staff can clock out at end of shift
- [x] Actual start/end times recorded alongside scheduled times
- [x] Cannot clock in to someone else's shift
- [x] Active shift visible in dashboard
      **Notes:** `app/api/stores/[storeId]/shifts/clock/route.ts`, `clock-out/route.ts`.

---

### [Payroll] — Payroll calculation

**Status:** Done
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Owner/Manager can generate payroll for a date range
- [x] Hours calculated from actual clock in/out times
- [x] Overtime calculated based on configurable threshold
- [x] Gross pay computed from hours x hourly rate
- [x] Payroll summary shows per-employee breakdown
      **Notes:** `app/api/stores/[storeId]/payroll/pay-runs/route.ts`.

---

### [Payroll] — Payslip generation

**Status:** Done
**Priority:** Medium
**Labels:** backend
**Acceptance Criteria:**

- [x] Payslip generated per employee per pay period
- [x] Payslip shows hours, rate, gross pay, date range
- [x] Employee notified via email when payslip available (if opted in)
- [x] Only Owner/Manager can generate payslips
      **Notes:** `app/api/stores/[storeId]/payroll/payslip/route.ts`.

---

## Area 7 — Suppliers & Procurement

### [Suppliers] — Supplier CRUD

**Status:** Done
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Owner/Manager can add suppliers with contact details
- [x] Supplier list searchable and filterable
- [x] Supplier details editable
- [x] Delete cascades or blocks appropriately
- [x] Audit logged
      **Notes:** `app/api/stores/[storeId]/suppliers/route.ts`.

---

### [Suppliers] — Purchase orders

**Status:** Done
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Owner/Manager can create POs with line items from inventory
- [x] PO linked to a supplier
- [x] Status progresses through defined workflow (open → partial → received)
- [x] Receiving a PO updates stock levels
- [x] Partial receiving supported
- [x] PO can be cancelled at any stage before received
- [x] Audit logged
      **Notes:** `app/api/stores/[storeId]/purchase-orders/route.ts`.

---

### [Suppliers] — Supplier portal

**Status:** Done
**Priority:** Medium
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Store generates a portal access token for a supplier
- [x] Supplier accesses portal via unique URL with token
- [x] Supplier views their purchase orders without logging in
- [x] Supplier can acknowledge/update PO status
- [x] Token can be revoked by store owner
- [x] Expired or invalid tokens rejected
      **Notes:** `app/(supplier-portal)/`, `app/api/supplier-portal/`.

---

### [Suppliers] — EDI document processing

**Status:** Done
**Priority:** Low
**Labels:** backend
**Acceptance Criteria:**

- [x] System can parse incoming EDI documents from suppliers
- [x] System can generate outgoing EDI documents for POs
- [x] Standard EDI formats supported
- [x] Parsing errors handled gracefully
      **Notes:** `lib/services/edi.ts`.

---

## Area 8 — Waste Management

### [Waste] — Waste logging

**Status:** Done
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Any staff member can log waste
- [x] Waste entry includes item, quantity, and reason
- [x] Stock levels auto-decremented
- [x] `stock_history` records waste event
- [x] Waste can be logged offline and synced later
- [x] Audit logged
      **Notes:** `app/api/stores/[storeId]/waste/route.ts`.

---

### [Waste] — Waste analytics

**Status:** Done
**Priority:** Medium
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Dashboard shows waste trends over time
- [x] Top wasted items ranked by cost/quantity
- [x] Waste by reason breakdown available
- [x] Date range filter supported
      **Notes:** `app/api/stores/[storeId]/waste-analytics/route.ts`.

---

## Area 9 — User Management

### [Users] — User invitation and RBAC

**Status:** Done
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Owner/Manager can invite users by email
- [x] Existing users added immediately; new users receive email invite
- [x] Pending invitations shown with resend/cancel options
- [x] Role hierarchy enforced (Manager cannot invite Owner)
- [x] User removal auto-clocks out active shifts
- [x] Audit logged for invite, role change, and removal
      **Notes:** `app/api/users/invite/route.ts`, `lib/services/userInvitation.ts`.

---

### [Users] — Wire up bulk user import form

**Status:** To Do
**Priority:** Medium
**Labels:** frontend
**Acceptance Criteria:**

- [ ] `BulkUserImportForm` component rendered on the team management page
- [ ] Import button visible to Owner/Manager
- [ ] CSV file upload works end-to-end
- [ ] Per-row validation errors displayed before import
- [ ] Existing users and pending invites skipped gracefully
      **Notes:** `components/forms/BulkUserImportForm.tsx` exists but is not imported in any page. `app/api/users/bulk-import/route.ts` backend works.

---

### [Users] — Add user bulk import CSV template endpoint

**Status:** To Do
**Priority:** Low
**Labels:** backend
**Acceptance Criteria:**

- [ ] `GET /api/users/bulk-import/template` returns a CSV with headers (name, email, role)
- [ ] Template downloadable from the bulk import form
- [ ] Headers match what `bulkUserRowSchema` expects
      **Notes:** Inventory has a template endpoint at `/api/stores/[storeId]/inventory/template`; replicate pattern for users.

---

### [Users] — Implement billing ownership transfer

**Status:** To Do
**Priority:** Medium
**Labels:** backend, frontend
**Acceptance Criteria:**

- [ ] `transferBillingOwnership` in `useStoreUsers` hook calls `POST /api/stores/{storeId}/billing-owner`
- [ ] Confirmation dialog shown before transfer
- [ ] Old billing owner retains Owner role but `is_billing_owner` set to false
- [ ] New billing owner's `is_billing_owner` set to true
- [ ] Stripe customer updated to new billing owner's payment method
- [ ] Audit logged
- [ ] Error toast replaced with actual functionality
      **Notes:** API route exists at `app/api/stores/[storeId]/billing-owner/route.ts`. Client stub has explicit `TODO`. Remove the stub toast.

---

## Area 10 — Billing & Subscriptions

### [Billing] — Stripe subscription billing

**Status:** Done
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Store owner can subscribe to a plan via Stripe Checkout
- [x] Webhook handles `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated/deleted`
- [x] Subscription status reflected in dashboard
- [x] Owner can manage payment methods via Stripe Customer Portal
- [x] Cancellation handled gracefully with end-of-period access
      **Notes:** `app/api/billing/webhook/route.ts`, `app/(dashboard)/billing/page.tsx`.

---

### [Billing] — Subscription guards and feature gating

**Status:** Done
**Priority:** High
**Labels:** frontend
**Acceptance Criteria:**

- [x] Features gated by subscription plan
- [x] Exceeding plan limits shows upgrade prompt
- [x] Free tier has defined feature limits
- [x] Guard checks are client-side with server-side enforcement
      **Notes:** `hooks/useSubscriptionGuard.ts`.

---

### [Billing] — Verify volume discounts apply in Stripe Checkout

**Status:** To Do
**Priority:** Medium
**Labels:** backend
**Acceptance Criteria:**

- [ ] `VOLUME_DISCOUNTS` tiers from `billing-config.ts` applied during Stripe Checkout session creation
- [ ] Stripe coupon or price adjustment created for qualifying stores
- [ ] Discount reflected on Stripe invoice
- [ ] Pricing page and actual checkout price match
      **Notes:** Discounts display on pricing page but may not be applied in actual checkout. Verify `app/api/billing/create-checkout/route.ts`.

---

### [Billing] — Build dunning flow for failed payments

**Status:** To Do
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [ ] `invoice.payment_failed` webhook sends email to billing owner with payment update link
- [ ] In-app banner appears on dashboard when payment has failed
- [ ] Banner includes direct link to Stripe Customer Portal to update payment method
- [ ] Grace period of 7 days before feature degradation
- [ ] After grace period, subscription downgraded to free tier
- [ ] Banner dismisses when payment succeeds
      **Notes:** Webhook handler exists but only updates DB status. Needs email, UI banner, and grace period logic.

---

## Area 11 — POS Integrations

### [POS] — Framework and registry

**Status:** Done
**Priority:** High
**Labels:** backend
**Acceptance Criteria:**

- [x] Framework supports adding new POS providers via registry pattern
- [x] Each provider implements `syncSales()`, `fetchMenuItems()`, `validateConnection()`
- [x] Store can connect/disconnect POS from UI
- [x] Webhook endpoint validates provider-specific signatures
- [x] Sync can be triggered manually or via webhook
      **Notes:** `lib/services/pos/registry.ts`, `lib/services/pos/types.ts`.

---

### [POS] — Toast adapter

**Status:** Done
**Priority:** High
**Labels:** backend
**Acceptance Criteria:**

- [x] Store can connect Toast POS with API credentials
- [x] Sales sync pulls orders and decrements inventory
- [x] Menu items importable from Toast
- [x] Connection validation confirms API access
- [x] Toast webhooks received and processed
      **Notes:** `lib/services/pos/providers/toast.ts`.

---

### [POS] — Implement Square fetchMenuItems

**Status:** To Do
**Priority:** Medium
**Labels:** backend
**Acceptance Criteria:**

- [ ] `fetchMenuItems()` calls Square Catalog API to retrieve menu items
- [ ] Items mapped to `POSMenuItem` interface (id, name, price, category)
- [ ] Empty catalog returns empty array (not error)
- [ ] Test coverage for the new method
      **Notes:** `lib/services/pos/providers/square.ts` — `syncSales()` and `validateConnection()` already work.

---

### [POS] — Fix Clover adapter hardcoded sandbox URL

**Status:** To Do
**Priority:** High
**Labels:** backend, bug
**Acceptance Criteria:**

- [ ] Base URL changed from `sandbox.dev.clover.com` to `api.clover.com`
- [ ] Environment variable `CLOVER_API_URL` (or similar) allows override for testing
- [ ] Existing `syncSales()`, `fetchMenuItems()`, `validateConnection()` continue to work
- [ ] Test confirms production URL is default
      **Notes:** `lib/services/pos/providers/clover.ts`. Currently broken in production.

---

### [POS] — Implement Lightspeed adapter

**Status:** To Do
**Priority:** Low
**Labels:** backend
**Acceptance Criteria:**

- [ ] `syncSales()` fetches orders from Lightspeed Restaurant API
- [ ] `fetchMenuItems()` retrieves menu catalog
- [ ] `validateConnection()` verifies API credentials
- [ ] Webhook signature validation if applicable
- [ ] Test coverage
      **Notes:** `lib/services/pos/providers/lightspeed.ts` — currently a stub.

---

### [POS] — Implement Revel adapter

**Status:** To Do
**Priority:** Low
**Labels:** backend
**Acceptance Criteria:**

- [ ] `syncSales()` fetches orders from Revel API
- [ ] `fetchMenuItems()` retrieves menu catalog
- [ ] `validateConnection()` verifies API credentials
- [ ] Test coverage
      **Notes:** `lib/services/pos/providers/revel.ts` — currently a stub.

---

### [POS] — Implement TouchBistro adapter

**Status:** To Do
**Priority:** Low
**Labels:** backend
**Acceptance Criteria:**

- [ ] `syncSales()` fetches orders from TouchBistro API
- [ ] `fetchMenuItems()` retrieves menu catalog
- [ ] `validateConnection()` verifies API credentials
- [ ] Test coverage
      **Notes:** `lib/services/pos/providers/touchbistro.ts` — currently a stub.

---

### [POS] — Implement Upserve adapter

**Status:** To Do
**Priority:** Low
**Labels:** backend
**Acceptance Criteria:**

- [ ] `syncSales()` fetches orders from Upserve API
- [ ] `fetchMenuItems()` retrieves menu catalog
- [ ] `validateConnection()` verifies API credentials
- [ ] Test coverage
      **Notes:** `lib/services/pos/providers/upserve.ts` — currently a stub.

---

### [POS] — Implement US POS adapters (30+ providers)

**Status:** To Do
**Priority:** Low
**Labels:** backend
**Acceptance Criteria:**

- [ ] Each adapter connects to its respective POS API with real credentials
- [ ] Sales data syncs correctly per provider's API format
- [ ] Menu import works per provider
- [ ] Connection validation works per provider
- [ ] Stub adapters that won't be implemented short-term are removed from the registry to avoid misleading users
      **Notes:** `lib/services/pos/providers/us/` — 30+ stub files. Consider prioritizing by market demand rather than implementing all at once. May be better to remove unimplemented providers from the UI registry.

---

## Area 12 — Accounting Integrations

### [Accounting] — Xero OAuth flow (existing)

**Status:** Done
**Priority:** Medium
**Labels:** backend
**Acceptance Criteria:**

- [x] Store connects Xero via OAuth2
- [x] OAuth tokens stored in `accounting_connections`
- [x] Token refresh implemented
      **Notes:** `lib/services/accounting/xero.ts`, `app/api/integrations/xero/`.

---

### [Accounting] — Complete Xero sync logic

**Status:** To Do
**Priority:** Medium
**Labels:** backend
**Acceptance Criteria:**

- [ ] Invoices/expenses pushed to Xero with all required fields mapped
- [ ] Chart of accounts pulled from Xero
- [ ] Sync errors captured and surfaced in UI (not silently swallowed)
- [ ] Token refresh handles all edge cases (expired, revoked)
- [ ] Test coverage for sync operations
      **Notes:** OAuth works but sync is partial. `lib/services/accounting/xero.ts`.

---

### [Accounting] — QuickBooks OAuth flow (existing)

**Status:** Done
**Priority:** Medium
**Labels:** backend
**Acceptance Criteria:**

- [x] Store connects QuickBooks via OAuth2
- [x] OAuth tokens stored in `accounting_connections`
- [x] Token refresh implemented
      **Notes:** `lib/services/accounting/quickbooks.ts`, `app/api/integrations/quickbooks/`.

---

### [Accounting] — Complete QuickBooks sync logic

**Status:** To Do
**Priority:** Medium
**Labels:** backend
**Acceptance Criteria:**

- [ ] Invoices/expenses pushed to QuickBooks with correct field mapping
- [ ] Chart of accounts synced from QuickBooks
- [ ] Expense categories mapped correctly
- [ ] Sync errors surfaced in UI
- [ ] Test coverage for sync operations
      **Notes:** Same gaps as Xero. `lib/services/accounting/quickbooks.ts`.

---

### [Accounting] — Implement FreshBooks adapter

**Status:** To Do
**Priority:** Low
**Labels:** backend
**Acceptance Criteria:**

- [ ] OAuth2 flow for FreshBooks
- [ ] OAuth routes created (`/api/integrations/freshbooks/auth`, `/callback`, `/disconnect`)
- [ ] Invoice/expense sync implemented
- [ ] DB migration if needed for provider-specific fields
- [ ] Test coverage
      **Notes:** `lib/services/accounting/freshbooks.ts` — currently a stub. No OAuth routes or DB support.

---

### [Accounting] — Implement MYOB adapter

**Status:** To Do
**Priority:** Low
**Labels:** backend
**Acceptance Criteria:**

- [ ] OAuth2 flow for MYOB
- [ ] Invoice/expense sync implemented
- [ ] Test coverage
      **Notes:** `lib/services/accounting/myob.ts` — stub.

---

### [Accounting] — Implement Sage adapter

**Status:** To Do
**Priority:** Low
**Labels:** backend
**Acceptance Criteria:**

- [ ] OAuth2 flow for Sage
- [ ] Invoice/expense sync implemented
- [ ] Test coverage
      **Notes:** `lib/services/accounting/sage.ts` — stub.

---

### [Accounting] — Implement Wave adapter

**Status:** To Do
**Priority:** Low
**Labels:** backend
**Acceptance Criteria:**

- [ ] OAuth2 flow for Wave
- [ ] Invoice/expense sync implemented
- [ ] Test coverage
      **Notes:** `lib/services/accounting/wave.ts` — stub.

---

### [Accounting] — Implement Zoho Books adapter

**Status:** To Do
**Priority:** Low
**Labels:** backend
**Acceptance Criteria:**

- [ ] OAuth2 flow for Zoho Books
- [ ] Invoice/expense sync implemented
- [ ] Test coverage
      **Notes:** `lib/services/accounting/zoho-books.ts` — stub.

---

## Area 13 — HACCP Food Safety

### [HACCP] — Check templates

**Status:** Done
**Priority:** Medium
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Owner/Manager can create check templates with named items
- [x] Templates support daily, weekly, or per-shift frequency
- [x] Templates can be activated/deactivated
- [x] Items stored as structured JSONB
- [x] Templates scoped to store via RLS
      **Notes:** `app/api/stores/[storeId]/haccp/templates/route.ts`.

---

### [HACCP] — Daily checks

**Status:** Done
**Priority:** Medium
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Staff can complete a check from a template
- [x] Each item marked pass/fail individually
- [x] Overall check status derived from item results
- [x] Check records who completed it and when
- [x] Failed checks can trigger corrective actions
      **Notes:** `app/api/stores/[storeId]/haccp/checks/route.ts`.

---

### [HACCP] — Temperature logging

**Status:** Done
**Priority:** Medium
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Staff can record temperature for named locations
- [x] Min/max acceptable range defined per location
- [x] Out-of-range readings auto-flagged
- [x] Corrective action field available for out-of-range entries
- [x] Temperature history viewable and filterable
      **Notes:** `app/api/stores/[storeId]/haccp/temperature-logs/route.ts`.

---

### [HACCP] — Corrective actions

**Status:** Done
**Priority:** Medium
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Corrective actions created when checks fail or temps out of range
- [x] Actions linked to source check or temperature log
- [x] Resolution tracked with who resolved and when
- [x] Open/unresolved actions filterable
      **Notes:** `app/api/stores/[storeId]/haccp/corrective-actions/route.ts`.

---

### [HACCP] — Dashboard

**Status:** Done
**Priority:** Medium
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Compliance summary (pass rate, overdue checks)
- [x] Open corrective actions count displayed
- [x] Recent temperature issues highlighted
- [x] Links to detailed sub-pages
- [x] Data scoped to current store
      **Notes:** `app/api/stores/[storeId]/haccp/dashboard/route.ts`.

---

## Area 14 — Invoice Processing

### [Invoices] — Invoice upload and storage (existing)

**Status:** Done
**Priority:** Medium
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] User can upload invoice PDF or image
- [x] File stored in Supabase Storage
- [x] Invoice record created with status and metadata
- [x] Invoice list page with status filter
- [x] Invoice detail page shows line items
      **Notes:** `app/api/stores/[storeId]/invoices/route.ts`, `app/(dashboard)/invoices/page.tsx`.

---

### [Invoices] — Complete Google Document AI OCR integration

**Status:** To Do
**Priority:** Medium
**Labels:** backend
**Acceptance Criteria:**

- [ ] Google Document AI processor configured and documented
- [ ] `GOOGLE_CLOUD_PROJECT_ID` and processor ID added to env var docs
- [ ] `lib/services/ocr.ts` reliably extracts vendor, date, total, and line items
- [ ] Extracted data mapped to invoice form fields
- [ ] OCR confidence score displayed per field
- [ ] Fallback to manual entry when OCR fails
      **Notes:** `lib/services/ocr.ts` exists but extraction is unreliable. Needs proper Document AI processor setup.

---

### [Invoices] — Implement invoice-to-PO matching

**Status:** To Do
**Priority:** Medium
**Labels:** backend
**Acceptance Criteria:**

- [ ] System suggests matching POs based on supplier and date proximity
- [ ] Line-item-level reconciliation compares quantities and prices
- [ ] Discrepancies flagged (price differences, missing items, quantity mismatches)
- [ ] Confidence score displayed for suggested matches
- [ ] User can accept or reject suggested matches
- [ ] Manual PO linking continues to work as fallback
      **Notes:** Invoice schema has `purchase_order_id` field. Currently manual-only. Need matching algorithm in backend.

---

## Area 15 — Reports & Analytics

### [Reports] — AI demand forecast

**Status:** Done
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Forecast generated from historical stock data
- [x] Risk levels assigned per item (critical/high/medium/low)
- [x] Suggested order quantities calculated
- [x] Optimal order dates recommended
- [x] Weekday demand patterns visualized
- [x] Executive summary highlights urgent actions
      **Notes:** `lib/forecasting/engine.ts`, `app/(dashboard)/reports/forecast/page.tsx`.

---

### [Reports] — Food cost report

**Status:** Done
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Report shows theoretical food cost from recipes
- [x] Actual COGS calculated from purchase history
- [x] Variance between theoretical and actual highlighted
- [x] Per-category and per-item breakdowns
- [x] Filterable by date range
      **Notes:** `app/api/stores/[storeId]/reports/food-cost/route.ts`.

---

### [Reports] — Store benchmarking

**Status:** Done
**Priority:** Medium
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Compare KPIs across multiple stores
- [x] Rankings by waste, stock accuracy, food cost
- [x] Health score per store
- [x] Visual charts for comparison
- [x] Only available to users with 2+ stores
      **Notes:** `app/api/reports/benchmark/route.ts`.

---

### [Reports] — Daily summary report

**Status:** Done
**Priority:** Medium
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Summary shows stock movements for the day
- [x] Shift hours and labor cost included
- [x] Waste logged during the day itemized
- [x] Report generated for any selected date
      **Notes:** `app/api/reports/daily-summary/route.ts`.

---

### [Reports] — Low-stock report

**Status:** Done
**Priority:** Medium
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] Report lists all items below par level
- [x] Items sorted by urgency (critical > low)
- [x] Current stock vs par level shown per item
- [x] Supplier info included for reordering context
      **Notes:** `app/api/reports/low-stock/route.ts`.

---

## Area 16 — Alerts & Notifications

### [Alerts] — Alert preferences and cron

**Status:** Done
**Priority:** High
**Labels:** backend
**Acceptance Criteria:**

- [x] User configures alert preferences per store
- [x] Alerts delivered at preferred hour
- [x] Frequency options: daily, weekly, never
- [x] Alert history stored and retrievable
- [x] Cron runs hourly and processes scheduled alerts
      **Notes:** `app/api/cron/send-alerts/route.ts`, `lib/services/alertService.ts`.

---

### [Notifications] — Email notifications

**Status:** Done
**Priority:** High
**Labels:** backend
**Acceptance Criteria:**

- [x] Email sent for configured events (shift assigned, payslip, PO update, etc.)
- [x] Users can opt in/out per event type
- [x] Low-stock alerts formatted with item details
- [x] Emails sent via Resend
- [x] Notification failures logged, not thrown
      **Notes:** `lib/email.ts`, `lib/email-alerts.ts`, `lib/services/notifications.ts`.

---

### [Notifications] — Implement push notification subscription flow

**Status:** To Do
**Priority:** Medium
**Labels:** backend, frontend
**Acceptance Criteria:**

- [ ] "Enable push notifications" button in settings or profile
- [ ] Browser permission prompt triggered
- [ ] Push subscription stored in database (new `push_subscriptions` table)
- [ ] Server sends push via Web Push API for configured events
- [ ] User can revoke push permission from settings
- [ ] Migration for `push_subscriptions` table
      **Notes:** Service worker handler exists in `public/sw.js` but no subscription management. Needs new DB table, API routes, and UI.

---

### [Notifications] — Build in-app notification inbox

**Status:** To Do
**Priority:** Medium
**Labels:** backend, frontend, database
**Acceptance Criteria:**

- [ ] Notification bell icon in header shows unread count
- [ ] Dropdown or page shows notification history
- [ ] Notifications markable as read (individually and "mark all read")
- [ ] Click-through navigates to relevant page
- [ ] New `notifications` table with `user_id`, `type`, `title`, `body`, `read_at`, `link`
- [ ] Migration for `notifications` table with RLS
- [ ] API routes: GET list, PATCH mark-read
      **Notes:** Currently all notifications are email-only. `components/notifications/NotificationBell.tsx` exists but is likely minimal.

---

## Area 17 — Developer Platform

### [API Keys] — Backend API key management

**Status:** Done
**Priority:** Medium
**Labels:** backend
**Acceptance Criteria:**

- [x] Owner can create API keys with scoped permissions
- [x] Key displayed once at creation, stored as hash
- [x] Keys can have optional expiry dates
- [x] Keys revoked via soft-delete
      **Notes:** `app/api/stores/[storeId]/api-keys/route.ts`, `lib/api/api-keys.ts`.

---

### [API Keys] — Wire up API key management UI

**Status:** To Do
**Priority:** Medium
**Labels:** frontend
**Acceptance Criteria:**

- [ ] API key management section in settings page (Owner only)
- [ ] List of active keys showing prefix, scopes, expiry, and created date
- [ ] "Create Key" button opens form with scope checkboxes and optional expiry
- [ ] Key value shown once in a copy-to-clipboard modal after creation
- [ ] "Revoke" button with confirmation dialog
      **Notes:** `components/settings/ApiKeyForm.tsx` exists. Needs to be imported and rendered. Backend fully functional.

---

### [Webhooks] — Backend webhook management

**Status:** Done
**Priority:** Medium
**Labels:** backend
**Acceptance Criteria:**

- [x] Owner can register webhook URLs with event subscriptions
- [x] Webhooks signed with HMAC-SHA256
- [x] Webhook can be deleted
- [x] Event types well-defined
      **Notes:** `app/api/stores/[storeId]/webhooks/route.ts`, `lib/services/webhooks.ts`.

---

### [Webhooks] — Wire up webhook management UI

**Status:** To Do
**Priority:** Medium
**Labels:** frontend
**Acceptance Criteria:**

- [ ] Webhook management section in settings page (Owner only)
- [ ] List of registered webhooks with URL, event subscriptions, status
- [ ] "Add Webhook" form with URL input and event type checkboxes
- [ ] Delete button with confirmation
- [ ] "Test" button sends a sample payload to the URL
      **Notes:** `components/settings/WebhookForm.tsx` exists. Backend functional.

---

### [API] — Public API v1

**Status:** Done
**Priority:** Medium
**Labels:** backend
**Acceptance Criteria:**

- [x] External systems can query inventory via API key
- [x] Stock operations available via API
- [x] API key scopes enforce read/write permissions
- [x] Rate limiting applied
      **Notes:** `app/api/v1/inventory/route.ts`, `app/api/v1/stock/route.ts`.

---

## Area 18 — Offline & PWA

### [Offline] — Offline queue and sync (existing)

**Status:** Done
**Priority:** Medium
**Labels:** frontend
**Acceptance Criteria:**

- [x] Stock counts, receptions, and waste reports can be submitted offline
- [x] Operations queued in IndexedDB and synced on reconnect
- [x] Duplicate operations deduplicated via hash
      **Notes:** `lib/offline/db.ts`, `lib/offline/sync.ts`.

---

### [Offline] — Add sync status indicator to app shell

**Status:** To Do
**Priority:** Medium
**Labels:** frontend
**Acceptance Criteria:**

- [ ] Pending sync count visible in navbar or sidebar when offline operations are queued
- [ ] Indicator shows "Syncing..." during sync
- [ ] Indicator shows "Sync failed" with retry button on error
- [ ] Sync errors surfaced to user (not silently swallowed)
      **Notes:** `components/offline/OfflineIndicator.tsx` exists but may only show online/offline status. Needs queue visibility.

---

### [PWA] — Add bitmap icons to manifest

**Status:** To Do
**Priority:** Low
**Labels:** frontend, design
**Acceptance Criteria:**

- [ ] `manifest.json` includes 192x192 and 512x512 PNG icons
- [ ] At least one icon with `purpose: "maskable"` for Android adaptive icons
- [ ] App installable on Chrome, Safari, and Edge without icon warnings
- [ ] Splash screen renders correctly on mobile
      **Notes:** Currently only has `icon.svg` with `purpose: "any"`. Many browsers require bitmap icons.

---

## Area 19 — Marketing & Legal

### [Marketing] — Landing page

**Status:** Done
**Priority:** Medium
**Labels:** frontend
**Acceptance Criteria:**

- [x] Unauthenticated users see marketing landing page
- [x] Authenticated users see dashboard
- [x] Landing page includes hero, features, integrations, pricing, CTA
- [x] Scroll-reveal animations and counters functional
- [x] Responsive on mobile and desktop
      **Notes:** `app/page.tsx`, `components/marketing/`.

---

### [Marketing] — Pricing page

**Status:** Done
**Priority:** Medium
**Labels:** frontend
**Acceptance Criteria:**

- [x] Pricing page shows all plan tiers with features
- [x] Currency auto-detected by locale
- [x] Volume discounts displayed
- [x] ROI calculator functional
      **Notes:** `app/(marketing)/pricing/page.tsx`.

---

### [Legal] — Legal pages

**Status:** Done
**Priority:** Low
**Labels:** frontend
**Acceptance Criteria:**

- [x] Privacy policy accessible
- [x] Terms of service accessible
- [x] Cookie policy accessible
      **Notes:** `app/(legal)/privacy/`, `terms/`, `cookies/`.

---

## Area 20 — Platform Operations

### [Audit] — Activity / audit log

**Status:** Done
**Priority:** High
**Labels:** backend, frontend
**Acceptance Criteria:**

- [x] All state-changing operations create audit log entries
- [x] Activity page shows chronological log with filters
- [x] Filter by action type, user, date range
- [x] RLS prevents users from viewing other stores' logs
      **Notes:** `lib/audit.ts`, `app/(dashboard)/activity/page.tsx`.

---

### [Cron] — Data archival cron

**Status:** Done
**Priority:** Low
**Labels:** backend
**Acceptance Criteria:**

- [x] Cron runs weekly at 3 AM UTC Sunday
- [x] Old stock history and audit logs archived
- [x] Cron authenticated by `CRON_SECRET`
      **Notes:** `app/api/cron/archive-data/route.ts`, `vercel.json`.

---

## Area 21 — Dead Code Cleanup

### [Cleanup] — Delete deprecated hook files

**Status:** To Do
**Priority:** Medium
**Labels:** code-quality
**Acceptance Criteria:**

- [ ] `hooks/useStoreInventory.old.ts` deleted
- [ ] `hooks/useStoreUsers.old.ts` deleted
- [ ] `hooks/useStores.old.ts` deleted
- [ ] `components/providers/AuthProvider.tsx.backup` deleted
- [ ] No imports reference these files
- [ ] Tests still pass after deletion
      **Notes:** All confirmed unused in AUDIT.md Section 8.

---

### [Cleanup] — Remove deprecated functions from lib/auth.ts

**Status:** To Do
**Priority:** Medium
**Labels:** backend, code-quality
**Acceptance Criteria:**

- [ ] `hasGlobalAccess()` removed
- [ ] `isStoreScopedRole()` removed
- [ ] `canAccessStoreLegacy()` removed
- [ ] `getDefaultStoreId()` removed
- [ ] `canManageStores()` removed
- [ ] `canViewAllStores()` removed
- [ ] All callers verified to use replacement functions
- [ ] Tests updated to remove coverage of deprecated functions
      **Notes:** All 6 functions marked `@deprecated` in `lib/auth.ts`.

---

### [Cleanup] — Remove legacy database columns

**Status:** To Do
**Priority:** Low
**Labels:** database
**Acceptance Criteria:**

- [ ] Migration drops `profiles.store_id` column
- [ ] Migration drops `profiles.role` column
- [ ] Migration drops `inventory_items.category` column (text; replaced by `category_id`)
- [ ] No code references these columns
- [ ] `types/database.ts` regenerated after migration
      **Notes:** Legacy from single-tenant era. Verify no code still reads these before dropping.

---

### [Cleanup] — Remove orphan documentation files

**Status:** To Do
**Priority:** Low
**Labels:** code-quality
**Acceptance Criteria:**

- [ ] `ARCHITECTURE_CHANGES.md` deleted
- [ ] `CONTRIBUTING.md` deleted (or kept if project needs it)
- [ ] `MIGRATION_GUIDE.md` deleted
- [ ] `PLAN.md` deleted
- [ ] `notes.md` deleted
- [ ] `docs/` directory removed (25+ files)
      **Notes:** None of these are referenced by app code. Decide per-file whether to keep any for contributor onboarding.

---

## Area 22 — GitHub Issues (Bugs)

### [Bug] — Move @testing-library/dom to devDependencies

**Status:** To Do
**Priority:** High
**Labels:** bug, code-quality
**Acceptance Criteria:**

- [ ] `@testing-library/dom` moved from `dependencies` to `devDependencies` in `package.json`
- [ ] `npm ci --omit=dev` does not install testing libraries
- [ ] Production bundle size unchanged or smaller
- [ ] CI tests still pass
      **Notes:** GitHub Issue #1. Testing library should not ship to production.

---

### [Bug] — Global error boundary does not report to Sentry

**Status:** To Do
**Priority:** High
**Labels:** bug, security
**Acceptance Criteria:**

- [ ] `app/global-error.tsx` calls `Sentry.captureException(error)` in `useEffect`
- [ ] Sentry receives error reports from unhandled exceptions
- [ ] Error boundary still renders user-friendly error UI
      **Notes:** GitHub Issue #2. `@sentry/nextjs` is installed but global error boundary doesn't use it.

---

### [Bug] — Create custom 404 page

**Status:** To Do
**Priority:** Medium
**Labels:** frontend, enhancement
**Acceptance Criteria:**

- [ ] `app/not-found.tsx` exists with branded design
- [ ] Shows helpful navigation (link to dashboard or home)
- [ ] Matches app design system
      **Notes:** GitHub Issue #3. Currently shows Next.js default 404.

---

### [Bug] — Viewport meta tag blocks pinch-to-zoom

**Status:** To Do
**Priority:** High
**Labels:** bug, accessibility
**Acceptance Criteria:**

- [ ] Viewport meta tag allows `user-scalable=yes` and `maximum-scale` >= 5
- [ ] Pinch-to-zoom works on all mobile pages
- [ ] Layout does not break when zoomed
      **Notes:** GitHub Issue #4. WCAG 1.4.4 compliance issue.

---

### [Bug] — Muted text color fails WCAG AA contrast

**Status:** To Do
**Priority:** Medium
**Labels:** accessibility, design
**Acceptance Criteria:**

- [ ] `--muted-foreground` CSS variable updated to meet 4.5:1 contrast ratio
- [ ] All muted text passes WCAG AA on both light background
- [ ] Spot-check with contrast checker tool
      **Notes:** GitHub Issue #6. Affects `text-muted-foreground` utility class used throughout.

---

### [Performance] — Lazy-load heavy libraries (recharts, xlsx)

**Status:** To Do
**Priority:** Medium
**Labels:** performance, frontend
**Acceptance Criteria:**

- [ ] `recharts` loaded via `dynamic(() => import(...), { ssr: false })` on chart pages
- [ ] `xlsx` loaded dynamically only when export is triggered
- [ ] Initial bundle size reduced (measure before/after)
- [ ] Charts still render correctly after lazy loading
      **Notes:** GitHub Issue #7. Both are large libraries (~200KB+ each) that affect initial load.

---

### [Code Quality] — Remove dead dark mode CSS classes

**Status:** To Do
**Priority:** Low
**Labels:** code-quality
**Acceptance Criteria:**

- [ ] Unused `dark:` prefixed classes removed from components
- [ ] Or: dark theme properly implemented if desired
- [ ] No visual regressions
      **Notes:** GitHub Issue #8. `next-themes` is installed but dark mode classes may not be functional.

---

### [Code Quality] — Fix FloatingActionButton hardcoded colors

**Status:** To Do
**Priority:** Low
**Labels:** code-quality, design
**Acceptance Criteria:**

- [ ] `components/ui/floating-action-button.tsx` uses CSS variables instead of hardcoded hex/rgb
- [ ] FAB colors adapt to theme
      **Notes:** GitHub Issue #9.

---

### [Bug] — Fix 3 failing audit log tests

**Status:** To Do
**Priority:** High
**Labels:** bug, testing
**Acceptance Criteria:**

- [ ] `tests/integration/api/audit-logs.test.ts` — all tests pass
- [ ] 500 errors investigated and root cause fixed (likely mock setup issue)
- [ ] CI passes without skipped tests
      **Notes:** GitHub Issue #10. 3 tests return 500 instead of expected 200.

---

### [Bug] — Fix conditional React hook in my-pay page

**Status:** To Do
**Priority:** High
**Labels:** bug, frontend
**Acceptance Criteria:**

- [ ] `app/(dashboard)/my-pay/page.tsx` does not call hooks conditionally
- [ ] Hooks called unconditionally at top of component
- [ ] Early return after all hooks for auth/loading guards
- [ ] No React rules-of-hooks violation
      **Notes:** GitHub Issue #11. Rules of hooks violation can cause unpredictable behavior.

---

### [Code Quality] — Fix 82 lint errors

**Status:** To Do
**Priority:** High
**Labels:** code-quality
**Acceptance Criteria:**

- [ ] `npm run lint` returns 0 errors
- [ ] No lint rules disabled without justification
- [ ] CI lint step passes
      **Notes:** GitHub Issue #12. Run `npm run lint` and fix all errors.

---

## Area 23 — GitHub Issues (UI/Design)

### [UI] — Differentiate StatsCard visual weight across pages

**Status:** To Do
**Priority:** Low
**Labels:** design, frontend
**Acceptance Criteria:**

- [ ] Stats cards on different pages have contextual styling (not identical everywhere)
- [ ] Urgent alerts visually distinct from informational displays
- [ ] At least 2 visual variants of StatsCard
      **Notes:** GitHub Issues #13, #17. Every page uses identical `StatsCard` components with same weight.

---

### [UI] — Replace generic marketing section pattern

**Status:** To Do
**Priority:** Low
**Labels:** design, frontend
**Acceptance Criteria:**

- [ ] Marketing sections use varied layouts (not all pill-badge + heading + card-grid)
- [ ] At least 3 distinct section layouts on landing page
- [ ] Remove AI-generated gradient blobs and dot grids if they add no value
      **Notes:** GitHub Issues #14, #15, #16, #18, #19, #20. Collective UI monotony feedback.

---

## Area 24 — GitHub Issues (Testing Quality)

### [Testing] — Rewrite API tests to verify actual route logic

**Status:** To Do
**Priority:** High
**Labels:** testing
**Acceptance Criteria:**

- [ ] API tests verify database mutations (INSERT/UPDATE/DELETE) actually happen
- [ ] Tests check that audit logging is called with correct parameters
- [ ] Tests verify response body content, not just status codes
- [ ] Remove tests that only verify mock pass-through
      **Notes:** GitHub Issues #21, #23. Tests currently mock everything and only verify that mocks were called.

---

### [Testing] — Remove duplicate role-variant tests

**Status:** To Do
**Priority:** Medium
**Labels:** testing
**Acceptance Criteria:**

- [ ] Identify tests that verify identical behavior across Owner/Manager/Staff
- [ ] Keep one test per behavior, parameterize with `it.each` for roles if needed
- [ ] Remove redundant test copies
- [ ] Net test count reduced without losing coverage
      **Notes:** GitHub Issue #22. Same behavior tested 2-3 times with different roles.

---

### [Testing] — Deduplicate webhook validator tests

**Status:** To Do
**Priority:** Medium
**Labels:** testing
**Acceptance Criteria:**

- [ ] 750+ lines of identical webhook validator tests consolidated
- [ ] Single parameterized test suite covers all 37 providers
- [ ] Each provider's specific behavior (if any) tested separately
      **Notes:** GitHub Issue #24. 37 copies of the same test pattern.

---

### [Testing] — Remove tests that verify constants equal themselves

**Status:** To Do
**Priority:** Low
**Labels:** testing
**Acceptance Criteria:**

- [ ] Tests that assert `ROLE_HIERARCHY === ROLE_HIERARCHY` pattern removed
- [ ] ~320 lines of constant-equality tests deleted
- [ ] Replace with meaningful invariant tests if needed
      **Notes:** GitHub Issue #25.

---

### [Testing] — Remove tests that verify Zod built-ins

**Status:** To Do
**Priority:** Low
**Labels:** testing
**Acceptance Criteria:**

- [ ] Tests that verify Zod's built-in `.email()`, `.min()`, `.max()` behavior removed
- [ ] ~800 lines of Zod validator tests deleted
- [ ] Keep tests for custom validation logic and business rules only
      **Notes:** GitHub Issue #26.

---

### [Testing] — Fix misleading test names

**Status:** To Do
**Priority:** Medium
**Labels:** testing
**Acceptance Criteria:**

- [ ] Test names accurately describe what they verify
- [ ] Tests that claim to "verify X" actually assert X
- [ ] No test names promise behavior that isn't tested
      **Notes:** GitHub Issue #27.

---

### [Testing] — Fix filter tests to verify filter arguments

**Status:** To Do
**Priority:** Medium
**Labels:** testing
**Acceptance Criteria:**

- [ ] Filter tests assert that query parameters are passed correctly to Supabase
- [ ] Tests verify `.eq()`, `.gte()`, `.order()` called with correct values
- [ ] Not just that `.from()` was called
      **Notes:** GitHub Issue #28.

---

### [Testing] — Fix over-mocked offline DB tests

**Status:** To Do
**Priority:** Low
**Labels:** testing
**Acceptance Criteria:**

- [ ] Offline DB tests use real Dexie in-memory database (or fake-indexeddb)
- [ ] Tests verify actual IndexedDB operations, not mock returns
- [ ] Existing test coverage maintained
      **Notes:** GitHub Issue #29.

---

### [Testing] — Fix crypto function tests

**Status:** To Do
**Priority:** Medium
**Labels:** testing
**Acceptance Criteria:**

- [ ] Crypto tests verify actual hashing/generation behavior
- [ ] Tests use real `crypto` module (not mocked return values)
- [ ] API key hash generation tested with known inputs/outputs
      **Notes:** GitHub Issue #30.

---

### [Testing] — Add component and E2E tests

**Status:** To Do
**Priority:** Medium
**Labels:** testing
**Acceptance Criteria:**

- [ ] At least 10 key component tests added (InventoryTable, ShiftForm, StockCountForm, etc.)
- [ ] Tests use `@testing-library/react` with `render()` and `fireEvent`
- [ ] At least 1 E2E test for critical flow (login → inventory → stock count) using Playwright or Cypress
- [ ] CI runs component tests as part of the test suite
      **Notes:** GitHub Issue #31. Currently zero component or E2E tests — all 1163 tests are unit/API tests.

---

## Area 25 — Missing Validation Test Coverage

### [Testing] — Add validation tests for uncovered Zod schemas

**Status:** To Do
**Priority:** Low
**Labels:** testing
**Acceptance Criteria:**

- [ ] Test file for `lib/validations/haccp.ts`
- [ ] Test file for `lib/validations/invoices.ts`
- [ ] Test file for `lib/validations/notifications.ts`
- [ ] Test file for `lib/validations/payroll.ts`
- [ ] Test file for `lib/validations/accounting.ts`
- [ ] Test file for `lib/validations/categories-tags.ts`
- [ ] Test file for `lib/validations/supplier-portal.ts`
- [ ] Tests cover custom business rules, not Zod built-in validators
      **Notes:** AUDIT.md Section 9 flagged these schemas as having no test files.

---

## Area 26 — Security Remediation

### [Security] — Rotate leaked Resend and Stripe API keys

**Status:** To Do
**Priority:** Urgent
**Labels:** security, backend
**Acceptance Criteria:**

- [ ] Resend API key rotated in Resend dashboard and updated in production env vars
- [ ] Stripe secret key rotated in Stripe dashboard and updated in production env vars
- [ ] Stripe webhook secret updated if it changed during rotation
- [ ] Verify email sending still works after Resend key rotation
- [ ] Verify billing flows still work after Stripe key rotation
- [ ] Git history scrubbed or secrets confirmed revoked (old values no longer valid)
      **Notes:** Discovered in `docs/audits/security-remediation-report.md` — keys were committed to git history and need rotation even though they were later removed from tracked files.

---

### [Security] — Add `is_billing_owner` guard to billing page

**Status:** To Do
**Priority:** High
**Labels:** security, frontend, backend
**Acceptance Criteria:**

- [ ] Billing page (`app/(dashboard)/[storeId]/billing/page.tsx`) checks `is_billing_owner` flag, not just Owner role
- [ ] Non-billing-owner Owners see a message explaining they can't manage billing
- [ ] API endpoints for billing operations (`/api/billing/*`) reject requests from non-billing-owners
- [ ] Only the user with `is_billing_owner = true` in `store_users` can modify subscription or payment methods
      **Notes:** Discovered in `notes.md`. The billing page may rely solely on Owner role, but the data model supports `is_billing_owner` as a separate flag for stores with multiple owners.

---

## Area 27 — Type Safety

### [Types] — Regenerate database types to remove HACCP `as any` casts

**Status:** To Do
**Priority:** Medium
**Labels:** backend, types
**Acceptance Criteria:**

- [ ] Run `npm run db:types` to regenerate `types/database.ts` with HACCP tables included
- [ ] Remove all `as any` casts in HACCP-related files (`lib/services/haccp.ts`, hooks, API routes)
- [ ] TypeScript compiles with no errors in HACCP code paths
- [ ] HACCP API tests still pass
      **Notes:** HACCP tables were added in later migrations but `npm run db:types` was never re-run, so code uses `as any` to work around missing types.
