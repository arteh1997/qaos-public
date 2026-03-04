# FEATURES.md — Feature Audit

Generated 2026-03-01. Every feature assessed against live source code.

---

## Summary Table

| #    | Feature                                           | Status   | Effort to Complete |
| ---- | ------------------------------------------------- | -------- | ------------------ |
| 1.1  | Email / Password Authentication                   | Complete | —                  |
| 1.2  | Google OAuth                                      | Complete | —                  |
| 1.3  | Auth Callback & Session                           | Complete | —                  |
| 1.4  | CSRF Protection                                   | Complete | —                  |
| 1.5  | Role-Based Access Control                         | Complete | —                  |
| 2.1  | Store CRUD                                        | Complete | —                  |
| 2.2  | Multi-Store Switching                             | Complete | —                  |
| 2.3  | Store Settings                                    | Partial  | Small              |
| 2.4  | Store Setup Wizard                                | Complete | —                  |
| 3.1  | Inventory Items CRUD                              | Complete | —                  |
| 3.2  | Stock Counting                                    | Complete | —                  |
| 3.3  | Stock Reception (Deliveries)                      | Complete | —                  |
| 3.4  | Stock Adjustments                                 | Complete | —                  |
| 3.5  | Barcode Scanning                                  | Complete | —                  |
| 3.6  | Bulk CSV Import (Inventory)                       | Partial  | Small              |
| 3.7  | Inventory Export (Excel)                          | Partial  | Small              |
| 3.8  | Par Levels & Low-Stock Alerts                     | Complete | —                  |
| 4.1  | Categories CRUD                                   | Partial  | Small              |
| 4.2  | Tags CRUD                                         | Partial  | Small              |
| 5.1  | Recipes & Ingredients                             | Complete | —                  |
| 5.2  | Menu Items & Costing                              | Partial  | Small              |
| 5.3  | Menu Analysis                                     | Complete | —                  |
| 6.1  | Shift Scheduling                                  | Complete | —                  |
| 6.2  | Clock In / Clock Out                              | Complete | —                  |
| 6.3  | Payroll Calculation                               | Complete | —                  |
| 6.4  | Payslip Generation                                | Complete | —                  |
| 7.1  | Supplier CRUD                                     | Complete | —                  |
| 7.2  | Purchase Orders                                   | Complete | —                  |
| 7.3  | Supplier Portal                                   | Complete | —                  |
| 7.4  | EDI Document Processing                           | Complete | —                  |
| 8.1  | Waste Logging                                     | Complete | —                  |
| 8.2  | Waste Analytics                                   | Complete | —                  |
| 9.1  | User Invitation & RBAC                            | Complete | —                  |
| 9.2  | Bulk User Import                                  | Partial  | Small              |
| 9.3  | Billing Ownership Transfer                        | Stub     | Small              |
| 10.1 | Stripe Subscription Billing                       | Complete | —                  |
| 10.2 | Subscription Guards & Feature Gating              | Complete | —                  |
| 10.3 | Volume Discounts                                  | Partial  | Small              |
| 10.4 | Dunning / Failed Payments                         | Missing  | Medium             |
| 11.1 | POS Framework & Registry                          | Complete | —                  |
| 11.2 | Toast Adapter                                     | Complete | —                  |
| 11.3 | Square Adapter                                    | Partial  | Small              |
| 11.4 | Clover Adapter                                    | Broken   | Small              |
| 11.5 | Lightspeed, Revel, TouchBistro, Upserve Adapters  | Stub     | Large              |
| 11.6 | US POS Adapters (30+ providers)                   | Stub     | Large              |
| 12.1 | Xero Integration                                  | Partial  | Medium             |
| 12.2 | QuickBooks Integration                            | Partial  | Medium             |
| 12.3 | FreshBooks, MYOB, Sage, Wave, Zoho Books Adapters | Stub     | Large              |
| 13.1 | HACCP Check Templates                             | Complete | —                  |
| 13.2 | HACCP Daily Checks                                | Complete | —                  |
| 13.3 | HACCP Temperature Logging                         | Complete | —                  |
| 13.4 | HACCP Corrective Actions                          | Complete | —                  |
| 13.5 | HACCP Dashboard                                   | Complete | —                  |
| 14.1 | Invoice Upload & OCR                              | Partial  | Medium             |
| 14.2 | Invoice-to-PO Matching                            | Stub     | Medium             |
| 15.1 | AI Demand Forecast                                | Complete | —                  |
| 15.2 | Food Cost Report                                  | Complete | —                  |
| 15.3 | Store Benchmarking                                | Complete | —                  |
| 15.4 | Daily Summary Report                              | Complete | —                  |
| 15.5 | Low-Stock Report                                  | Complete | —                  |
| 16.1 | Alert Preferences & Cron                          | Complete | —                  |
| 16.2 | Email Notifications                               | Complete | —                  |
| 16.3 | Push Notifications                                | Stub     | Medium             |
| 16.4 | In-App Notification Inbox                         | Missing  | Medium             |
| 17.1 | API Key Management (Back-end)                     | Complete | —                  |
| 17.2 | API Key Management (UI)                           | Stub     | Small              |
| 17.3 | Webhook Management (Back-end)                     | Complete | —                  |
| 17.4 | Webhook Management (UI)                           | Stub     | Small              |
| 17.5 | Public API v1                                     | Complete | —                  |
| 18.1 | Offline Queue & Sync                              | Partial  | Medium             |
| 18.2 | PWA Install                                       | Partial  | Small              |
| 19.1 | Marketing Landing Page                            | Complete | —                  |
| 19.2 | Pricing Page                                      | Complete | —                  |
| 19.3 | Legal Pages                                       | Complete | —                  |
| 20.1 | Activity / Audit Log                              | Complete | —                  |
| 20.2 | Data Archival Cron                                | Complete | —                  |

---

## Area 1 — Authentication & Security

### 1.1 Email / Password Authentication

**Status:** Complete

**What exists:**

- `app/api/auth/signup/route.ts` — sign-up with Supabase Auth
- `app/api/auth/login/route.ts` — login
- `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx` — UI pages
- `lib/validations/auth.ts` — Zod schemas for login/signup
- Rate limiting: `auth` 10/min, `createUser` 5/min

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. User can sign up with email and password
2. User can log in with valid credentials
3. Invalid credentials return 401, not a server error
4. Sign-up rate limited to 5 requests/min
5. Login rate limited to 10 requests/min
6. Passwords validated with Zod schema (min length, complexity)
7. Session cookie set on successful login
8. Duplicate email sign-up returns meaningful error

---

### 1.2 Google OAuth

**Status:** Complete

**What exists:**

- `app/api/auth/callback/route.ts` — OAuth callback handling
- Google sign-in button on login/signup pages
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` configure the Supabase project with Google OAuth

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. User can click "Sign in with Google" and complete OAuth flow
2. Callback route exchanges code for session
3. New users are auto-provisioned a profile on first Google sign-in
4. Existing users with matching email can sign in via Google
5. OAuth errors redirect to login with error message

---

### 1.3 Auth Callback & Session

**Status:** Complete

**What exists:**

- `middleware.ts` — refreshes Supabase session on every request, sets CSRF cookie
- `components/providers/AuthProvider.tsx` — client-side auth context with race-condition protection (`latestRequestIdRef`)
- `lib/supabase/server.ts` — server-side client with cookie-based session
- `lib/supabase/client.ts` — browser client

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Session auto-refreshes via middleware on every request
2. Expired sessions redirect to login
3. AuthProvider loads user profile and stores on mount
4. Race conditions prevented by request sequencing
5. `useAuth()` hook exposes `user`, `profile`, `stores`, `currentStore`, `role`, `storeId`, `signOut`

---

### 1.4 CSRF Protection

**Status:** Complete

**What exists:**

- `middleware.ts` — sets `csrf_token` cookie using double-submit cookie pattern
- `lib/csrf.ts` — `validateCSRFToken()` compares cookie and header
- `hooks/useCSRF.ts` — `csrfFetch()` reads cookie and sends `x-csrf-token` header
- All POST/PUT/PATCH/DELETE API routes set `requireCSRF: true` in `withApiAuth`

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. First page load sets `csrf_token` cookie
2. `csrfFetch()` reads cookie and sends it as `x-csrf-token` header
3. State-changing API requests without valid CSRF token return 403
4. Token rotation occurs on session refresh
5. All POST/PUT/PATCH/DELETE endpoints enforce CSRF via `requireCSRF: true`

---

### 1.5 Role-Based Access Control

**Status:** Complete

**What exists:**

- `store_users` junction table with `user_id`, `store_id`, `role`
- Three roles: `Owner`, `Manager`, `Staff`
- `lib/auth.ts` — permission helpers: `canManageUsersAtStore()`, `canAccessStore()`, `hasAnyStoreAccess()`
- `lib/api/middleware.ts` — `withApiAuth` checks `allowedRoles` per endpoint
- `lib/constants.ts` — `ROLE_HIERARCHY`, `ROLE_PERMISSIONS`, `INVITABLE_ROLES_BY_ROLE`

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Users can have different roles at different stores
2. Owner can perform all actions within their store
3. Manager can manage inventory, shifts, suppliers, but cannot delete store or manage billing
4. Staff can clock in/out, submit counts, view inventory
5. `withApiAuth` rejects requests from users without required role
6. Role hierarchy prevents Managers from inviting Owners
7. RLS enforces store scoping — users only see data for their stores

---

## Area 2 — Store Management

### 2.1 Store CRUD

**Status:** Complete

**What exists:**

- `app/api/stores/route.ts` — GET list, POST create
- `app/api/stores/[storeId]/route.ts` — GET detail, PATCH update, DELETE
- `app/(dashboard)/stores/page.tsx` — store listing
- `app/(dashboard)/stores/[storeId]/page.tsx` — store detail
- Store creation auto-assigns creator as Owner and billing owner

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Authenticated user can create a new store
2. Store creator is auto-assigned Owner role and `is_billing_owner`
3. Owner can update store name, address, operating hours
4. Owner can delete store (cascades all related data via FK)
5. Users see only stores they belong to (RLS)
6. Store list shows role badge per store

---

### 2.2 Multi-Store Switching

**Status:** Complete

**What exists:**

- `useAuth()` exposes `stores` array, `currentStore`, `setCurrentStore()`
- Store selector in sidebar navigation
- All dashboard queries scoped by `currentStore.id`

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Users with multiple stores see a store switcher
2. Switching store updates all dashboard data
3. Selected store persists across page navigation
4. Each store shows the user's role
5. Single-store users do not see the switcher

---

### 2.3 Store Settings

**Status:** Partial

**What exists:**

- `app/(dashboard)/settings/page.tsx` — single flat page with store details, notification preferences, alert preferences
- `StoreForm` dialog for editing name, address, hours
- Weekly hours JSON format and legacy `opening_time`/`closing_time` both handled
- Notification toggles backed by API

**What's missing or broken:**

- No settings sub-pages for API keys, webhooks, or danger zone (delete store)
- `ApiKeyForm` and `WebhookForm` components exist in `components/settings/` but are not rendered anywhere
- No link to billing or integrations from settings — those live at separate top-level routes

**Acceptance criteria:**

1. Owner/Manager can edit store name, address, and operating hours
2. Owner/Manager can toggle inventory alert types (low stock, critical, missing count)
3. Users can configure notification preferences (shift events, payslip, PO updates)
4. Settings page links to API keys, webhooks, integrations, and billing sub-pages
5. Danger zone section with delete store confirmation (Owner only)
6. ~~Settings page currently lacks items 4 and 5~~

---

### 2.4 Store Setup Wizard

**Status:** Complete

**What exists:**

- `hooks/useStoreSetupStatus.ts` — tracks setup completion (has inventory, has shifts, has suppliers)
- Setup prompts shown on dashboard for new stores
- Tests in `tests/hooks/useStoreSetupStatus.test.ts`

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. New store shows setup wizard prompts
2. Wizard tracks: inventory added, shift created, supplier added
3. Progress updates in real time as user completes steps
4. Wizard dismisses once all steps complete
5. Returning users do not see completed wizard steps

---

## Area 3 — Inventory Management

### 3.1 Inventory Items CRUD

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/inventory/route.ts` — GET (paginated, search, category filter), POST
- `app/api/stores/[storeId]/inventory/[itemId]/route.ts` — GET, PATCH, DELETE
- `app/(dashboard)/inventory/page.tsx` — full inventory table with search, filters, bulk actions
- `types/database.ts` — `inventory_items`, `store_inventory` tables
- Validation: `lib/validations/inventory.ts`

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Owner/Manager can add inventory items with name, unit, cost, category, par level
2. Items are listed with current stock, par level, and status indicator
3. Search by name, filter by category, sort by any column
4. PATCH updates item details; DELETE removes item and related stock history
5. Pagination works for large inventories (50+ items per page)
6. Audit logged on create/update/delete

---

### 3.2 Stock Counting

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/stock/count/route.ts` — POST submit count
- `app/(dashboard)/stock-count/page.tsx` — count submission UI
- `stock_history` table records every count with `action_type: 'Count'`
- Offline support: counts can be queued in IndexedDB when offline

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Any staff member can submit a stock count
2. Count records current quantity for each item
3. Variance calculated against previous count
4. Count saved to `stock_history` with timestamp and user
5. Missing counts tracked and alerted via cron
6. Count can be submitted offline and synced later

---

### 3.3 Stock Reception (Deliveries)

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/stock/reception/route.ts` — POST record delivery
- `app/(dashboard)/deliveries/page.tsx` — delivery logging UI
- Links to purchase orders for expected vs received quantity tracking

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. User records received quantities per item
2. Stock levels auto-update on reception
3. Reception linked to purchase order if applicable
4. Variance flagged when received differs from ordered
5. `stock_history` entry created with `action_type: 'Reception'`
6. Audit logged

---

### 3.4 Stock Adjustments

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/stock/adjustment/route.ts` — POST
- Adjustment reason required (waste, theft, damage, etc.)
- `stock_history` entry with `action_type: 'Adjustment'`

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Owner/Manager can adjust stock quantities up or down
2. Adjustment reason is required
3. `stock_history` records adjustment with reason and user
4. Current stock level updated accordingly
5. Audit logged

---

### 3.5 Barcode Scanning

**Status:** Complete

**What exists:**

- `hooks/useBarcodeScanner.ts` — wraps `html5-qrcode` library
- Barcode input field on stock count and reception pages
- `barcodeLookups` table in offline IndexedDB for cached lookups
- Tests in `tests/hooks/useBarcodeScanner.test.ts`

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. User can scan barcode via camera to look up inventory item
2. Manual barcode entry also supported
3. Scanned barcode auto-fills item in count/reception form
4. Barcode lookups cached in IndexedDB for offline use
5. Unrecognized barcode shows "item not found" message

---

### 3.6 Bulk CSV Import (Inventory)

**Status:** Partial

**What exists:**

- `app/api/stores/[storeId]/inventory/import/route.ts` — multipart CSV upload
- `app/api/stores/[storeId]/inventory/template/route.ts` — download CSV template
- `components/inventory/CSVImport.tsx` — import UI
- Handles human-friendly headers (`"Item Name"`, `"Cost Per Unit (£)"`) via alias map
- Per-row Zod validation with error reporting

**What's missing or broken:**

- Import route uses `createClient()` directly instead of `withApiAuth` middleware — bypasses standard rate limiting and CSRF validation
- No progress indicator for large CSV uploads

**Acceptance criteria:**

1. User downloads CSV template with correct headers
2. User uploads filled CSV and sees per-row validation errors before insert
3. Valid rows insert into `inventory_items` and `store_inventory`
4. Duplicate items (by name) are flagged, not silently overwritten
5. Import is rate-limited and CSRF-protected
6. ~~Currently bypasses `withApiAuth` — item 5 not met~~

---

### 3.7 Inventory Export (Excel)

**Status:** Partial

**What exists:**

- `app/api/stores/[storeId]/export/route.ts` — generates multi-sheet `.xlsx` (Shifts, Stock History, Inventory, Users, Summary)
- `lib/export.ts` — export utility functions
- Uses `xlsx` package v0.18.5
- Owner-only, date range filtering via query params

**What's missing or broken:**

- No export button visible in the dashboard UI — only accessible via direct API call
- Report pages reference "CSV export" in descriptions but no per-report CSV download is implemented
- `xlsx` package has known vulnerability (acknowledged in code comment)

**Acceptance criteria:**

1. Owner can export store data as Excel workbook from the dashboard
2. Export includes sheets for inventory, stock history, shifts, and users
3. Date range filters apply to time-series data
4. Export button visible in settings or inventory page
5. ~~No dashboard UI button — items 1 and 4 not met from the user's perspective~~

---

### 3.8 Par Levels & Low-Stock Alerts

**Status:** Complete

**What exists:**

- `store_inventory.par_level` column — target stock level per item
- Low-stock report: `app/api/reports/low-stock/route.ts`
- Alert preferences: configurable threshold multiplier (0.1–2.0× PAR)
- Cron: `/api/cron/send-alerts` checks for missing counts and low stock

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Each item has a configurable par level
2. Items below par level flagged as "low stock"
3. Items below critical threshold (configurable multiplier) flagged as "critical"
4. Email alerts sent based on user alert preferences
5. Low-stock report page shows all items below par

---

## Area 4 — Categories & Tags

### 4.1 Categories CRUD

**Status:** Partial

**What exists:**

- `app/(dashboard)/categories/page.tsx` — category management page
- `app/api/stores/[storeId]/categories/route.ts` (GET, POST)
- `app/api/stores/[storeId]/categories/[categoryId]/route.ts` (PATCH, DELETE)
- `lib/validations/categories-tags.ts` — schemas
- Components: `CategoryList`, `CategoryForm`, `CategoryBadge`, `CategorySelect`
- Supports `name`, `description`, `color`, `sort_order`
- Delete blocked if items assigned; duplicate name check on create

**What's missing or broken:**

- Categories GET fetches `inventory_items` count without filtering by `store_id` — item counts could bleed across stores in multi-tenant context
- No bulk reorder UI (sort_order exists in schema but no drag-and-drop)

**Acceptance criteria:**

1. Owner/Manager can create categories with name, color, description
2. Categories show assigned item count
3. Duplicate category name rejected
4. Delete blocked when items are assigned to category
5. Owner-only delete access
6. Item counts correctly scoped to current store
7. ~~Item 6 not met — missing store_id filter on count query~~

---

### 4.2 Tags CRUD

**Status:** Partial

**What exists:**

- `app/(dashboard)/tags/page.tsx` — tag management page
- `app/api/stores/[storeId]/tags/route.ts` (GET, POST)
- `app/api/stores/[storeId]/tags/[tagId]/route.ts` (PATCH, DELETE)
- `app/api/stores/[storeId]/inventory/[itemId]/tags/route.ts` — assign/remove tags
- Components: `TagList`, `TagForm`, `TagBadge`, `TagSelect`

**What's missing or broken:**

- Tags GET usage count query on `inventory_item_tags` lacks store_id filter — same cross-tenant count leak as categories

**Acceptance criteria:**

1. Owner/Manager can create tags with name, color, description
2. Tags can be assigned to and removed from inventory items
3. Tag usage count displayed accurately
4. Duplicate tag name rejected
5. Tag counts correctly scoped to current store
6. ~~Item 5 not met — missing store_id filter on count query~~

---

## Area 5 — Recipes & Menu

### 5.1 Recipes & Ingredients

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/recipes/route.ts` (GET, POST)
- `app/api/stores/[storeId]/recipes/[recipeId]/route.ts` (PATCH, DELETE)
- `app/api/stores/[storeId]/recipes/[recipeId]/ingredients/route.ts` (GET, POST, DELETE)
- `app/(dashboard)/recipes/page.tsx` — unified "Menu & Costs" page
- `lib/validations/recipes.ts` — schemas
- Components: `IngredientForm`, recipe detail views

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Owner/Manager can create recipes with name and category
2. Ingredients can be added to recipes from inventory items
3. Ingredient quantities and units specified
4. Recipe cost auto-calculated from ingredient costs
5. Recipes can be updated and deleted
6. Audit logged

---

### 5.2 Menu Items & Costing

**Status:** Partial

**What exists:**

- `app/api/stores/[storeId]/menu-items/route.ts` (GET paginated with cost calc, POST)
- `app/api/stores/[storeId]/menu-items/[menuItemId]/route.ts` (PATCH, DELETE)
- `menu_items` table linked 1:1 to `recipes`
- Creating a menu item auto-creates a linked recipe
- Costs tab shows food cost %, profit margin, rating (excellent/good/fair/poor)
- Hooks: `useMenuItems`, `useRecipeDetail`

**What's missing or broken:**

- Only accessible via `/recipes` — no dedicated `/menu` route
- Recipe `yield_quantity`/`yield_unit` fields exist in schema but no UI to set them (defaults to `1 serving`)
- No menu export or print view

**Acceptance criteria:**

1. Owner/Manager can create menu items with selling price
2. Menu item auto-links to a recipe for cost tracking
3. Food cost percentage calculated per item
4. Profit margin and rating displayed
5. Yield quantity and unit configurable per recipe
6. Menu can be exported or printed for kitchen use
7. ~~Items 5 and 6 not met~~

---

### 5.3 Menu Analysis

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/menu-analysis/route.ts` — calculates average food cost %, cost alerts, category breakdowns
- `hooks/useMenuAnalysis.ts`
- Integrated into the "Menu & Costs" page

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Dashboard shows average food cost percentage across all menu items
2. Items with high food cost flagged with alerts
3. Category-level cost breakdown available
4. Analysis updates when menu items or ingredient costs change
5. Data accessible via API for external reporting

---

## Area 6 — Shifts & Payroll

### 6.1 Shift Scheduling

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/shifts/route.ts` (GET, POST)
- `app/api/stores/[storeId]/shifts/[shiftId]/route.ts` (GET, PATCH, DELETE)
- `app/(dashboard)/shifts/page.tsx` — shift calendar/list view
- `lib/validations/shift.ts` — schemas
- `lib/shift-patterns.ts` — shift pattern generation
- Role-gated: Manager/Owner create, Staff view own shifts

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Manager/Owner can create shifts with date, start/end time, assigned staff
2. Staff see only their own shifts
3. Shifts display in calendar or list view
4. Shifts can be updated or cancelled
5. Shift patterns can be auto-generated
6. Notification sent when shift is assigned/updated/cancelled

---

### 6.2 Clock In / Clock Out

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/shifts/clock/route.ts` — clock in
- `app/api/stores/[storeId]/shifts/clock-out/route.ts` — clock out
- Clock button in shift UI
- Auto clock-out on user removal from store

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Staff can clock in to their assigned shift
2. Staff can clock out at end of shift
3. Actual start/end times recorded alongside scheduled times
4. Cannot clock in to someone else's shift
5. Active shift visible in dashboard

---

### 6.3 Payroll Calculation

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/payroll/route.ts` — payroll calculation endpoint
- `app/(dashboard)/payroll/page.tsx` — payroll overview
- Calculates hours worked, overtime, gross pay per employee
- Hourly rate from `store_users.hourly_rate`

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Owner/Manager can generate payroll for a date range
2. Hours calculated from actual clock in/out times
3. Overtime calculated based on configurable threshold
4. Gross pay computed from hours × hourly rate
5. Payroll summary shows per-employee breakdown

---

### 6.4 Payslip Generation

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/payroll/payslip/route.ts` — generate payslip
- Email notification when payslip is available
- Notification preference toggle for payslip emails

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Payslip generated per employee per pay period
2. Payslip shows hours, rate, gross pay, date range
3. Employee notified via email when payslip available (if opted in)
4. Payslip accessible from employee's dashboard
5. Only Owner/Manager can generate payslips

---

## Area 7 — Suppliers & Procurement

### 7.1 Supplier CRUD

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/suppliers/route.ts` (GET, POST)
- `app/api/stores/[storeId]/suppliers/[supplierId]/route.ts` (GET, PATCH, DELETE)
- `app/(dashboard)/suppliers/page.tsx` — supplier list
- `lib/validations/suppliers.ts` — schemas
- Fields: name, email, phone, address, delivery days, minimum order

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Owner/Manager can add suppliers with contact details
2. Supplier list searchable and filterable
3. Supplier details editable
4. Delete cascades or blocks appropriately
5. Audit logged

---

### 7.2 Purchase Orders

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/purchase-orders/route.ts` (GET, POST)
- `app/api/stores/[storeId]/purchase-orders/[orderId]/route.ts` (GET, PATCH, DELETE)
- `app/(dashboard)/purchase-orders/page.tsx`
- Status workflow: `draft → submitted → acknowledged → shipped → partial → received → cancelled`
- Line items with quantities, unit costs

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Owner/Manager can create POs with line items from inventory
2. PO linked to a supplier
3. Status progresses through defined workflow
4. Receiving a PO updates stock levels
5. Partial receiving supported
6. PO can be cancelled at any stage before received
7. Audit logged

---

### 7.3 Supplier Portal

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/supplier-portal/route.ts` — generate/revoke portal tokens
- `app/api/supplier-portal/[token]/route.ts` — token-based auth, PO viewing
- `app/(supplier-portal)/` — supplier-facing UI
- Token-based auth (no Supabase account needed for suppliers)

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Store generates a portal access token for a supplier
2. Supplier accesses portal via unique URL with token
3. Supplier views their purchase orders without logging in
4. Supplier can acknowledge/update PO status
5. Token can be revoked by store owner
6. Expired or invalid tokens rejected

---

### 7.4 EDI Document Processing

**Status:** Complete

**What exists:**

- `lib/services/edi.ts` — EDI document parsing and generation
- Tests in `tests/lib/services/edi.test.ts`
- Supports standard EDI formats for PO exchange

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. System can parse incoming EDI documents from suppliers
2. System can generate outgoing EDI documents for POs
3. Standard EDI formats supported
4. Parsing errors handled gracefully
5. EDI integration testable without live supplier connection

---

## Area 8 — Waste Management

### 8.1 Waste Logging

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/waste/route.ts` (GET, POST)
- `app/(dashboard)/waste/page.tsx` — waste logging UI
- Records item, quantity, reason, timestamp
- `stock_history` entry with `action_type: 'Waste'`
- Offline support: waste reports queued in IndexedDB

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Any staff member can log waste
2. Waste entry includes item, quantity, and reason
3. Stock levels auto-decremented
4. `stock_history` records waste event
5. Waste can be logged offline and synced later
6. Audit logged

---

### 8.2 Waste Analytics

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/waste/analytics/route.ts` — waste trends, top wasted items
- `app/(dashboard)/waste/analytics/page.tsx` — analytics dashboard
- Charts and summary statistics

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Dashboard shows waste trends over time
2. Top wasted items ranked by cost/quantity
3. Waste by reason breakdown available
4. Date range filter supported
5. Data exportable (via general export endpoint)

---

## Area 9 — User Management

### 9.1 User Invitation & RBAC

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/users/route.ts` (GET list, POST add)
- `app/api/stores/[storeId]/users/[userId]/route.ts` (PATCH role, DELETE remove)
- `app/api/users/invite/route.ts` — invite new or existing users
- `app/api/users/invites/route.ts` — list pending invites
- `app/api/users/invites/resend/route.ts` — resend invite email
- `app/(dashboard)/users/page.tsx` — team management with search, role filter
- `lib/services/userInvitation.ts` — invite logic
- Role hierarchy enforcement, duplicate detection, pending invite banner

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Owner/Manager can invite users by email
2. Existing users added immediately; new users receive email invite
3. Pending invitations shown with resend/cancel options
4. Role hierarchy enforced (Manager cannot invite Owner)
5. User removal auto-clocks out active shifts
6. Audit logged for invite, role change, and removal

---

### 9.2 Bulk User Import

**Status:** Partial

**What exists:**

- `app/api/users/bulk-import/route.ts` — JSON body with up to 50 users
- `lib/validations/bulk-import.ts` — `bulkImportSchema`, `bulkUserRowSchema`, CSV parser
- `components/forms/BulkUserImportForm.tsx` — import form component
- Skips existing users and pending invites, sends email invitations

**What's missing or broken:**

- `BulkUserImportForm` component exists but is not rendered in any page — no UI path to bulk import users
- No CSV template download for user import (only inventory template exists)

**Acceptance criteria:**

1. Owner can bulk import up to 50 users via CSV
2. Import form accessible from team management page
3. CSV template downloadable
4. Per-row validation with error reporting before import
5. Existing users and pending invites skipped gracefully
6. ~~Items 2 and 3 not met — form exists but is not mounted~~

---

### 9.3 Billing Ownership Transfer

**Status:** Stub

**What exists:**

- `app/api/stores/[storeId]/billing-owner/route.ts` — API endpoint exists
- Transfer ownership button in store users page UI
- `is_billing_owner` field in `store_users` table

**What's missing or broken:**

- Client-side hook `transferBillingOwnership` is a stub with explicit TODO:
  ```typescript
  // TODO: Implement transferBillingOwnership in useStoreUsers hook
  const transferBillingOwnership = async (_userId: string) => {
    toast.error("Billing ownership transfer is not yet implemented");
  };
  ```
- Clicking the button shows an error toast

**Acceptance criteria:**

1. Owner can transfer billing ownership to another Owner
2. Old billing owner retains Owner role but loses billing responsibility
3. New billing owner's payment method used for future charges
4. Confirmation dialog before transfer
5. Audit logged
6. ~~All items not met — client stub only~~

---

## Area 10 — Billing & Subscriptions

### 10.1 Stripe Subscription Billing

**Status:** Complete

**What exists:**

- `app/api/billing/route.ts` — subscription management
- `app/api/billing/webhook/route.ts` — Stripe webhook handler
- `app/api/billing/create-checkout/route.ts` — Stripe Checkout session creation
- `app/api/billing/portal/route.ts` — Stripe Customer Portal redirect
- `app/(dashboard)/billing/page.tsx` — billing dashboard
- `app/(dashboard)/billing/subscribe/[storeId]/page.tsx` — checkout page
- `lib/stripe/billing-config.ts` — plan tiers, pricing
- `subscriptions` table tracks per-store subscription status

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Store owner can subscribe to a plan via Stripe Checkout
2. Webhook handles `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated/deleted`
3. Subscription status reflected in dashboard
4. Owner can manage payment methods via Stripe Customer Portal
5. Subscription changes (upgrade/downgrade) handled
6. Cancellation handled gracefully with end-of-period access

---

### 10.2 Subscription Guards & Feature Gating

**Status:** Complete

**What exists:**

- `hooks/useSubscriptionGuard.ts` — client-side feature gating
- Plan-based feature limits (item count, user count, etc.)
- Tests in `tests/hooks/useSubscriptionGuard.test.ts`

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Features gated by subscription plan
2. Exceeding plan limits shows upgrade prompt
3. Free tier has defined feature limits
4. Paid tiers unlock additional features
5. Guard checks are client-side with server-side enforcement

---

### 10.3 Volume Discounts

**Status:** Partial

**What exists:**

- `lib/stripe/billing-config.ts` — `VOLUME_DISCOUNTS` constant with tier definitions
- `calculateMonthlyBill()` function
- Pricing page displays volume discount table

**What's missing or broken:**

- Discounts are displayed on the pricing page but it's unclear if they are applied in the actual Stripe Checkout session — the checkout creation route would need to calculate and apply coupon/price adjustments

**Acceptance criteria:**

1. Volume discount tiers defined (e.g., 10% off for 3+ stores)
2. Discount displayed on pricing page
3. Discount automatically applied in Stripe Checkout
4. Discount reflected on invoices
5. ~~Items 3 and 4 need verification against Stripe integration~~

---

### 10.4 Dunning / Failed Payment Handling

**Status:** Missing

**What exists:**

- Stripe webhook handles `invoice.payment_failed` event
- No retry logic, no in-app banner, no email notification for failed payments

**What's missing or broken:**

- No dunning flow: no grace period, no in-app warning, no automated retry sequence
- Failed payment webhook handler updates subscription status but doesn't notify the user
- No "update payment method" prompt when payment fails

**Acceptance criteria:**

1. Failed payment triggers email notification to billing owner
2. In-app banner warns of payment failure
3. Grace period before service degradation
4. Direct link to update payment method
5. Retry sequence follows Stripe best practices
6. ~~All items not met~~

---

## Area 11 — POS Integrations

### 11.1 POS Framework & Registry

**Status:** Complete

**What exists:**

- `lib/services/pos/registry.ts` — provider registry with 36 providers
- `lib/services/pos/types.ts` — `POSProvider` interface: `syncSales()`, `fetchMenuItems()`, `validateConnection()`
- `app/api/stores/[storeId]/pos/route.ts` (GET, POST, DELETE)
- `app/api/stores/[storeId]/pos/sync/route.ts` — trigger sync
- `app/api/stores/[storeId]/pos/webhook/route.ts` — receive POS webhooks
- `app/(dashboard)/integrations/pos/page.tsx` — POS connection UI
- `pos_connections` table stores credentials per store

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Framework supports adding new POS providers via registry pattern
2. Each provider implements `syncSales()`, `fetchMenuItems()`, `validateConnection()`
3. Store can connect/disconnect POS from UI
4. Webhook endpoint validates provider-specific signatures
5. Sync can be triggered manually or via webhook

---

### 11.2 Toast Adapter

**Status:** Complete

**What exists:**

- `lib/services/pos/providers/toast.ts` — full implementation
- `syncSales()` fetches orders, maps to `stock_history` entries
- `fetchMenuItems()` pulls menu from Toast API
- `validateConnection()` tests API credentials
- Webhook validation for Toast-specific headers

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Store can connect Toast POS with API credentials
2. Sales sync pulls orders and decrements inventory
3. Menu items importable from Toast
4. Connection validation confirms API access
5. Toast webhooks received and processed

---

### 11.3 Square Adapter

**Status:** Partial

**What exists:**

- `lib/services/pos/providers/square.ts` — partial implementation
- `syncSales()` implemented
- `validateConnection()` implemented

**What's missing or broken:**

- `fetchMenuItems()` not implemented (missing or returns empty)
- Cannot import menu from Square

**Acceptance criteria:**

1. Store can connect Square POS
2. Sales sync pulls transactions and decrements inventory
3. Menu items importable from Square
4. Connection validation works
5. ~~Item 3 not met — `fetchMenuItems` not implemented~~

---

### 11.4 Clover Adapter

**Status:** Broken

**What exists:**

- `lib/services/pos/providers/clover.ts` — implementation present
- `syncSales()`, `fetchMenuItems()`, `validateConnection()` all defined

**What's missing or broken:**

- Hardcoded sandbox URL (`sandbox.dev.clover.com`) — will not work in production
- Must be switched to `api.clover.com` for live use

**Acceptance criteria:**

1. Store can connect Clover POS
2. Sales sync pulls orders from Clover
3. Menu items importable from Clover
4. Adapter uses production API URL
5. ~~Item 4 not met — hardcoded sandbox URL~~

---

### 11.5 Lightspeed, Revel, TouchBistro, Upserve Adapters

**Status:** Stub

**What exists:**

- `lib/services/pos/providers/lightspeed.ts`
- `lib/services/pos/providers/revel.ts`
- `lib/services/pos/providers/touchbistro.ts`
- `lib/services/pos/providers/upserve.ts`
- All registered in provider registry
- All implement the interface but methods throw `NotImplementedError` or return empty data

**What's missing or broken:**

- No actual API integration — all methods are stubs
- UI shows these as available providers but connecting them will fail

**Acceptance criteria:**

1. Each adapter connects to its respective POS API
2. `syncSales()` pulls real transaction data
3. `fetchMenuItems()` imports real menu data
4. `validateConnection()` tests real API credentials
5. ~~All items not met for all 4 adapters — stubs only~~

---

### 11.6 US POS Adapters (30+ providers)

**Status:** Stub

**What exists:**

- `lib/services/pos/providers/us/` — 30+ provider files (Aloha, Brink, Cake, Dinerware, Dine-in, Epson, Epos Now, Focus POS, Harbour, Heartland, Hungerrush, Ikor, Lavu, Maitre'D, Micros, NCR Aloha, Oracle MICROS, PAR, POSitouch, Qu, Restaurant Manager, Rezku, Simphony, SpeedLine, Squirrel, Xenial, etc.)
- All registered in provider registry
- All implement the `POSProvider` interface

**What's missing or broken:**

- All 30+ adapters are stubs — methods throw `NotImplementedError` or return empty arrays
- No real API integration for any of these providers

**Acceptance criteria:**

1. Each adapter connects to its respective POS API with real credentials
2. Sales data syncs correctly per provider's API format
3. Menu import works per provider
4. Connection validation works per provider
5. ~~All items not met for all 30+ adapters~~

---

## Area 12 — Accounting Integrations

### 12.1 Xero Integration

**Status:** Partial

**What exists:**

- `lib/services/accounting/xero.ts` — adapter with OAuth2 flow
- `app/api/integrations/xero/route.ts` — OAuth callback
- `app/api/stores/[storeId]/accounting/route.ts` — connection management
- `app/api/stores/[storeId]/accounting/sync/route.ts` — sync trigger
- `accounting_connections` table stores tokens
- OAuth token exchange and refresh implemented

**What's missing or broken:**

- Sync logic is partial — push invoices to Xero may not map all fields
- No pull of chart of accounts or bills from Xero
- Token refresh may not handle all edge cases

**Acceptance criteria:**

1. Store connects Xero via OAuth2
2. OAuth tokens stored and refreshed automatically
3. Invoices/expenses pushed to Xero
4. Chart of accounts synced from Xero
5. Sync errors surfaced in UI
6. ~~Items 3-5 partially implemented~~

---

### 12.2 QuickBooks Integration

**Status:** Partial

**What exists:**

- `lib/services/accounting/quickbooks.ts` — adapter with OAuth2 flow
- `app/api/integrations/quickbooks/route.ts` — OAuth callback
- OAuth token exchange and refresh implemented
- Uses same `accounting_connections` table

**What's missing or broken:**

- Sync logic is partial — similar gaps as Xero
- Expense categorization mapping incomplete

**Acceptance criteria:**

1. Store connects QuickBooks via OAuth2
2. OAuth tokens stored and refreshed automatically
3. Invoices/expenses pushed to QuickBooks
4. Chart of accounts synced from QuickBooks
5. Expense categories mapped correctly
6. ~~Items 3-5 partially implemented~~

---

### 12.3 FreshBooks, MYOB, Sage, Wave, Zoho Books Adapters

**Status:** Stub

**What exists:**

- `lib/services/accounting/freshbooks.ts`
- `lib/services/accounting/myob.ts`
- `lib/services/accounting/sage.ts`
- `lib/services/accounting/wave.ts`
- `lib/services/accounting/zoho-books.ts`
- All implement the accounting adapter interface

**What's missing or broken:**

- All 5 adapters are stubs — no real API calls
- No corresponding DB migrations or OAuth routes for these providers
- No UI to connect these providers
- Listed as dead code in AUDIT.md

**Acceptance criteria:**

1. Each adapter connects to its respective accounting API via OAuth
2. OAuth routes exist for each provider
3. Invoices/expenses synced bidirectionally
4. Database migration supports storing tokens for each provider
5. ~~All items not met for all 5 adapters~~

---

## Area 13 — HACCP Food Safety

### 13.1 HACCP Check Templates

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/haccp/templates/route.ts` (GET, POST)
- `app/api/stores/[storeId]/haccp/templates/[templateId]/route.ts` (PATCH, DELETE)
- `haccp_check_templates` table with items JSONB, frequency, active flag
- Template management UI in HACCP section

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Owner/Manager can create check templates with named items
2. Templates support daily, weekly, or per-shift frequency
3. Templates can be activated/deactivated
4. Items stored as structured JSONB
5. Templates scoped to store via RLS

---

### 13.2 HACCP Daily Checks

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/haccp/checks/route.ts` (GET, POST)
- `app/(dashboard)/haccp/checks/page.tsx` — check completion UI
- `haccp_checks` table with template reference, status, items JSONB
- Status: `pass`, `fail`, `partial`

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Staff can complete a check from a template
2. Each item marked pass/fail individually
3. Overall check status derived from item results
4. Check records who completed it and when
5. Failed checks can trigger corrective actions

---

### 13.3 HACCP Temperature Logging

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/haccp/temperatures/route.ts` (GET, POST)
- `app/(dashboard)/haccp/temperatures/page.tsx` — temperature log UI
- `haccp_temperature_logs` table with location, temperature, range check
- Auto-flags out-of-range readings (`is_in_range` column)

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Staff can record temperature for named locations
2. Min/max acceptable range defined per location
3. Out-of-range readings auto-flagged
4. Corrective action field available for out-of-range entries
5. Temperature history viewable and filterable by date/location

---

### 13.4 HACCP Corrective Actions

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/haccp/corrective-actions/route.ts` (GET, POST, PATCH)
- `app/(dashboard)/haccp/corrective-actions/page.tsx`
- `haccp_corrective_actions` table linked to checks or temperature logs
- Resolution tracking with `resolved_by`, `resolved_at`

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Corrective actions created when checks fail or temperatures out of range
2. Actions linked to source check or temperature log
3. Description and action taken recorded
4. Resolution tracked with who resolved and when
5. Open/unresolved actions filterable

---

### 13.5 HACCP Dashboard

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/haccp/dashboard/route.ts` — aggregated metrics
- `app/(dashboard)/haccp/page.tsx` — dashboard overview
- Shows compliance rate, overdue checks, open corrective actions, recent temperature issues

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Dashboard shows compliance summary (pass rate, overdue checks)
2. Open corrective actions count displayed
3. Recent temperature issues highlighted
4. Links to detailed check, temperature, and corrective action pages
5. Data scoped to current store

---

## Area 14 — Invoice Processing

### 14.1 Invoice Upload & OCR

**Status:** Partial

**What exists:**

- `app/api/stores/[storeId]/invoices/route.ts` (GET, POST upload)
- `app/api/stores/[storeId]/invoices/[invoiceId]/route.ts` (GET, PATCH, DELETE)
- `app/(dashboard)/invoices/page.tsx` — invoice management UI
- `invoices` table with status, line items, totals
- `lib/services/ocr.ts` — Google Document AI integration started
- Upload stores PDF/image to Supabase storage

**What's missing or broken:**

- Google Document AI integration is incomplete — OCR processing may not extract structured line items reliably
- No `GOOGLE_CLOUD_PROJECT_ID` or Document AI processor configuration documented
- OCR results not consistently mapped to invoice line items

**Acceptance criteria:**

1. User uploads invoice PDF or photo
2. OCR extracts vendor, date, total, and line items
3. Extracted data pre-fills invoice form for review
4. User can correct OCR results before saving
5. Invoice stored with original file and extracted data
6. ~~Items 2-4 partially met — OCR extraction incomplete~~

---

### 14.2 Invoice-to-PO Matching

**Status:** Stub

**What exists:**

- Invoice schema has `purchase_order_id` field for linking
- UI shows PO reference field

**What's missing or broken:**

- No fuzzy matching logic to suggest PO matches based on supplier, date, or amounts
- No auto-reconciliation between invoice line items and PO line items
- Manual PO linking works but no intelligent matching

**Acceptance criteria:**

1. System suggests matching POs based on supplier and date
2. Line-item-level reconciliation between invoice and PO
3. Discrepancies flagged (price differences, missing items)
4. Auto-match confidence score displayed
5. User can accept/reject suggested matches
6. ~~All items not met — manual linking only~~

---

## Area 15 — Reports & Analytics

### 15.1 AI Demand Forecast

**Status:** Complete

**What exists:**

- `app/api/reports/forecast/route.ts` — forecast endpoint
- `app/(dashboard)/reports/forecast/page.tsx` — full forecast UI
- `lib/forecasting/engine.ts` — statistical forecasting engine
- Executive summary, urgent orders, item drill-down, weekday patterns, stock projections
- Risk levels: critical/high/medium/low
- Days-until-stockout, suggested order quantities and dates

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Forecast generated from historical stock data
2. Risk levels assigned per item based on stockout probability
3. Suggested order quantities calculated
4. Optimal order dates recommended
5. Weekday demand patterns visualized
6. Executive summary highlights urgent actions

---

### 15.2 Food Cost Report

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/reports/food-cost/route.ts`
- `app/(dashboard)/reports/food-cost/page.tsx`
- Compares theoretical (recipe-derived) vs actual COGS
- Per-item and per-category breakdowns
- Variance analysis

**What's missing or broken:** Nothing (though accurate revenue data requires POS integration).

**Acceptance criteria:**

1. Report shows theoretical food cost from recipes
2. Actual COGS calculated from purchase history
3. Variance between theoretical and actual highlighted
4. Per-category and per-item breakdowns available
5. Report filterable by date range

---

### 15.3 Store Benchmarking

**Status:** Complete

**What exists:**

- `app/api/reports/benchmark/route.ts`
- `app/(dashboard)/reports/benchmark/page.tsx`
- Multi-store KPI comparison with charts
- Rankings table, health scores
- Requires 2+ stores

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Compare KPIs across multiple stores
2. Rankings by waste, stock accuracy, food cost
3. Health score per store
4. Visual charts for comparison
5. Only available to users with 2+ stores

---

### 15.4 Daily Summary Report

**Status:** Complete

**What exists:**

- `app/api/reports/daily-summary/route.ts`
- `app/(dashboard)/reports/daily-summary/page.tsx`
- Summarizes daily operations: stock movements, shifts, waste

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Summary shows stock movements for the day
2. Shift hours and labor cost included
3. Waste logged during the day itemized
4. Report generated for any selected date
5. Accessible to Owner/Manager

---

### 15.5 Low-Stock Report

**Status:** Complete

**What exists:**

- `app/api/reports/low-stock/route.ts`
- `app/(dashboard)/reports/low-stock/page.tsx`
- Lists all items below par level
- Sorted by urgency (critical first)

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Report lists all items below par level
2. Items sorted by urgency (critical > low)
3. Current stock vs par level shown per item
4. Supplier info included for reordering context
5. Report refreshes with current data

---

## Area 16 — Alerts & Notifications

### 16.1 Alert Preferences & Cron

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/alert-preferences/route.ts` (GET, PUT)
- `app/api/stores/[storeId]/alert-history/route.ts` (GET)
- `app/api/cron/send-alerts/route.ts` — hourly cron authenticated by `CRON_SECRET`
- `lib/services/alertService.ts` — `processScheduledAlerts()`
- Configurable: frequency (daily/weekly/never), preferred hour, email toggle, threshold multiplier

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. User configures alert preferences per store
2. Alerts delivered at preferred hour
3. Frequency options: daily, weekly, never
4. Alert history stored and retrievable
5. Cron runs hourly and processes scheduled alerts

---

### 16.2 Email Notifications

**Status:** Complete

**What exists:**

- `lib/email.ts` — Resend integration for transactional email
- `lib/email-alerts.ts` — low-stock alert email formatting
- `lib/email-notifications.ts` — event notification emails
- `lib/services/notifications.ts` — notification dispatch
- Notification preferences per event type

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Email sent for configured events (shift assigned, payslip, PO update, etc.)
2. Users can opt in/out per event type
3. Low-stock alerts formatted with item details
4. Emails sent via Resend with proper templates
5. Notification failures logged, not thrown

---

### 16.3 Push Notifications

**Status:** Stub

**What exists:**

- `public/sw.js` — service worker with push notification event handler
- Handler displays notification with title, body, icon

**What's missing or broken:**

- No push subscription management UI (no "Enable notifications" prompt)
- No back-end subscription storage (no `push_subscriptions` table)
- No server-side push sending via Web Push API
- Service worker handler exists but is never triggered

**Acceptance criteria:**

1. User can opt in to browser push notifications
2. Subscription stored server-side
3. Push sent for configured events (shift reminders, alerts)
4. Notification click navigates to relevant page
5. User can revoke push permission
6. ~~All items not met — handler exists but no subscription flow~~

---

### 16.4 In-App Notification Inbox

**Status:** Missing

**What exists:** Nothing — no notification bell, no inbox component, no notification feed table.

**What's missing or broken:**

- All notifications are email-only
- No in-app notification center

**Acceptance criteria:**

1. Notification bell icon in header with unread count
2. Dropdown or page showing notification history
3. Notifications markable as read
4. Click-through to relevant page
5. Real-time updates via Supabase realtime or polling
6. ~~All items not met~~

---

## Area 17 — Developer Platform

### 17.1 API Key Management (Back-end)

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/api-keys/route.ts` (GET, POST, DELETE)
- `lib/api/api-keys.ts` — key generation, hashing, scope definitions, validation
- Key shown once at creation, stored hashed
- Scoped permissions, optional expiry
- Revoke via soft-delete (`is_active: false`)

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Owner can create API keys with scoped permissions
2. Key displayed once at creation, stored as hash
3. Keys can have optional expiry dates
4. Keys revoked via soft-delete
5. Key prefix displayed for identification

---

### 17.2 API Key Management (UI)

**Status:** Stub

**What exists:**

- `components/settings/ApiKeyForm.tsx` — form component exists

**What's missing or broken:**

- `ApiKeyForm` is not imported or rendered in any page
- No settings sub-page for API key management
- Feature only accessible via direct API calls

**Acceptance criteria:**

1. API key management accessible from settings page
2. UI shows list of active keys with prefix and expiry
3. Create key form with scope selection
4. Key displayed once in modal after creation
5. Revoke button with confirmation
6. ~~All items not met — component exists but not mounted~~

---

### 17.3 Webhook Management (Back-end)

**Status:** Complete

**What exists:**

- `app/api/stores/[storeId]/webhooks/route.ts` (GET, POST, DELETE)
- `lib/services/webhooks.ts` — webhook dispatch with HMAC-SHA256 signing
- `WEBHOOK_EVENTS` constants defined
- URL validation, event subscription

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Owner can register webhook URLs with event subscriptions
2. Webhooks signed with HMAC-SHA256
3. Webhook delivery retries on failure
4. Webhook can be deleted
5. Event types well-defined

---

### 17.4 Webhook Management (UI)

**Status:** Stub

**What exists:**

- `components/settings/WebhookForm.tsx` — form component exists

**What's missing or broken:**

- `WebhookForm` is not imported or rendered in any page
- No settings sub-page for webhook management

**Acceptance criteria:**

1. Webhook management accessible from settings page
2. UI shows registered webhooks with event subscriptions
3. Create webhook form with URL and event selection
4. Test webhook button sends sample payload
5. Delete webhook with confirmation
6. ~~All items not met — component exists but not mounted~~

---

### 17.5 Public API v1

**Status:** Complete

**What exists:**

- `app/api/v1/inventory/route.ts` — inventory read via API key
- `app/api/v1/stock/route.ts` — stock operations via API key
- `lib/api/with-api-key.ts` — middleware authenticating by API key header
- Tests in `tests/integration/api/v1-api.test.ts`

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. External systems can query inventory via API key
2. Stock operations available via API
3. API key scopes enforce read/write permissions
4. Rate limiting applied to v1 endpoints
5. API returns standard JSON responses

---

## Area 18 — Offline & PWA

### 18.1 Offline Queue & Sync

**Status:** Partial

**What exists:**

- `lib/offline/db.ts` — Dexie.js with `pendingOperations`, `inventoryCache`, `barcodeLookups` tables
- `lib/offline/sync.ts` — sync pending operations on reconnect
- `hooks/useOfflineSync.ts` — hook managing sync lifecycle
- Supports 3 operation types: `stock_count`, `stock_reception`, `waste_report`
- Deduplication via simple hash

**What's missing or broken:**

- Only 3 operation types supported — most app features have no offline capability
- No visible UI indicator of pending sync operations or queue status
- No conflict resolution for concurrent edits

**Acceptance criteria:**

1. Stock counts, receptions, and waste reports can be submitted offline
2. Operations queued in IndexedDB and synced on reconnect
3. Sync status indicator visible in app shell
4. Duplicate operations detected and deduplicated
5. Sync errors surfaced to user
6. ~~Items 3 and 5 not met~~

---

### 18.2 PWA Install

**Status:** Partial

**What exists:**

- `public/manifest.json` — PWA manifest with `standalone` display mode, shortcuts
- `public/sw.js` — service worker with network-first caching
- `components/PWAInstallPrompt.tsx` — install prompt component
- `app/offline/page.tsx` — offline fallback page

**What's missing or broken:**

- Manifest has no PNG/maskable icons — only `icon.svg` with `purpose: "any"`
- Many browsers require bitmap icons for proper PWA installation and splash screens
- No `purpose: "maskable"` icon for Android adaptive icons

**Acceptance criteria:**

1. App installable as PWA on mobile and desktop
2. Manifest includes required icon sizes (192x192, 512x512)
3. Maskable icon provided for Android
4. Offline fallback page shown when no connection
5. Service worker caches critical assets
6. ~~Items 2 and 3 not met — SVG only~~

---

## Area 19 — Marketing & Legal

### 19.1 Marketing Landing Page

**Status:** Complete

**What exists:**

- `app/page.tsx` — smart landing/dashboard split based on auth state
- `components/marketing/` — Hero, PainPoints, ProductShowcase, Features, Integrations, Pricing, FAQ, CTA, Footer, Header, ScrollReveal, AnimatedCounter, DashboardMockup, TrustBar, Stats

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Unauthenticated users see marketing landing page
2. Authenticated users see dashboard
3. Landing page includes hero, features, integrations, pricing, CTA
4. Scroll-reveal animations and counters functional
5. Page is responsive on mobile and desktop

---

### 19.2 Pricing Page

**Status:** Complete

**What exists:**

- `app/(marketing)/pricing/page.tsx` — pricing page with currency detection, volume discounts, ROI calculator, FAQ
- `hooks/useCurrencyDetection.ts` — adapts currency/symbol by locale
- Live-calculated volume discount table

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Pricing page shows all plan tiers with features
2. Currency auto-detected by locale
3. Volume discounts displayed with tier thresholds
4. ROI calculator helps justify subscription cost
5. FAQ addresses common billing questions

---

### 19.3 Legal Pages

**Status:** Complete

**What exists:**

- `app/(legal)/privacy/page.tsx` — privacy policy
- `app/(legal)/terms/page.tsx` — terms of service
- `app/(legal)/cookies/page.tsx` — cookie policy

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Privacy policy accessible from footer
2. Terms of service accessible from footer
3. Cookie policy accessible from footer
4. Pages render with proper formatting
5. Content covers GDPR-relevant disclosures

---

## Area 20 — Platform Operations

### 20.1 Activity / Audit Log

**Status:** Complete

**What exists:**

- `app/(dashboard)/activity/page.tsx` — audit log viewer
- `app/api/stores/[storeId]/audit-logs/route.ts` (GET with filtering)
- `lib/audit.ts` — `auditLog()` function used throughout the codebase
- `audit_logs` table with user, store, action, details JSONB, timestamp
- RLS enforced — append-only for non-admin users

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. All state-changing operations create audit log entries
2. Activity page shows chronological log with filters
3. Filter by action type, user, date range
4. Log entries include user, action, timestamp, and details
5. RLS prevents users from viewing other stores' logs

---

### 20.2 Data Archival Cron

**Status:** Complete

**What exists:**

- `app/api/cron/archive-data/route.ts` — archives old data
- `vercel.json` — cron schedule: `0 3 * * 0` (3 AM UTC every Sunday)
- Authenticated by `CRON_SECRET`

**What's missing or broken:** Nothing.

**Acceptance criteria:**

1. Cron runs weekly at 3 AM UTC Sunday
2. Old stock history and audit logs archived
3. Archived data removed from active tables
4. Cron authenticated by `CRON_SECRET` to prevent unauthorized execution
5. Errors logged without crashing the cron
