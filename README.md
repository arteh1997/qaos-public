# Restaurant Inventory Management System

Multi-tenant restaurant inventory management SaaS application with POS integration, supplier management, recipe costing, HACCP food safety compliance, and real-time stock tracking. Built for restaurants, food trucks, and multi-location food businesses. Users belong to stores via a `store_users` junction table with role-based access (Owner / Manager / Staff).

## Tech Stack

| Category      | Technology                                                    |
| ------------- | ------------------------------------------------------------- |
| Framework     | Next.js 16 (App Router, React Server Components)              |
| UI            | React 19, TypeScript 5 (strict mode)                          |
| Database      | Supabase (PostgreSQL + Auth + Row-Level Security + PostgREST) |
| Styling       | Tailwind CSS 4, Radix UI via shadcn/ui                        |
| State         | TanStack Query v5                                             |
| Billing       | Stripe (multi-currency: GBP, USD, EUR, SAR, AED, AUD, CAD)    |
| Email         | Resend (transactional)                                        |
| Rate Limiting | Upstash Redis (sliding window)                                |
| Validation    | Zod 4, React Hook Form                                        |
| Testing       | Vitest (1,163 tests across 95 files)                          |
| Offline/PWA   | Dexie.js (IndexedDB)                                          |
| Charts        | Recharts                                                      |
| Scanning      | html5-qrcode (barcode)                                        |
| Monitoring    | Sentry, Vercel Analytics + Speed Insights                     |

## Features

### Core Inventory

- **Multi-store inventory** with per-store stock levels, PAR levels, and unit costs
- **Stock counts** with variance tracking and audit trails
- **Deliveries & receptions** with automatic stock level updates
- **Low stock alerts** with configurable thresholds and email notifications
- **Waste tracking** with reason codes (spoilage, damaged, expired, overproduction)
- **Bulk CSV import/export** for inventory items

### Supplier Management

- **Supplier directory** with contact info and payment terms
- **Purchase orders** with full lifecycle (draft, submitted, acknowledged, shipped, partial, received, cancelled)
- **Supplier portal** (token-authenticated, no user account needed) for suppliers to view orders, upload invoices, and update catalogs

### Recipe & Menu Costing

- **Recipe builder** with ingredient costs and yield calculations
- **Menu items** with selling price and food cost percentage
- **Menu analysis** (contribution margin, food cost %)

### POS Integration

- **37 POS provider adapters** — Square adapter fully implemented; remaining 36 are stub adapters with interface scaffolding only
- **Webhook-based sale processing** with automatic inventory deduction (Square only)
- **Item mapping** between POS menu items and inventory items

### Accounting Integration

- **Xero** — OAuth flow and adapter code exist but untested; bill sync is partial
- **QuickBooks Online** — OAuth flow and adapter code exist but untested; bill sync is partial

### Invoice OCR

- **Google Document AI** — integration code exists but is partial (no review UI, no fuzzy matching implemented)
- Requires `GOOGLE_CLOUD_PROJECT_ID` and `GOOGLE_DOCUMENT_AI_PROCESSOR_ID` env vars

### HACCP Food Safety

- **Check templates** (daily/weekly/shift frequency)
- **Temperature logging** with safe range alerts
- **Corrective actions** linked to checks
- **Compliance dashboard** with scoring

### Workforce

- **Shift scheduling** with timetable view
- **Clock in/out** with attendance tracking
- **Payroll** with hourly rates and pay run management

### Reports & Forecasting

- **AI demand forecast** (SMA, WMA, exponential smoothing with seasonality)
- **Daily summary**, **low stock**, **benchmark**, **food cost** reports
- **Activity log** with full audit trail

### Billing

- **Per-store Stripe subscriptions** with trial support
- **Multi-currency** (GBP, USD, EUR, SAR, AED, AUD, CAD)
- **Invoice history** and payment method management

### Public API

- **API key authentication** (`rk_live_` format) with granular scopes
- **v1 endpoints** for inventory and stock operations

---

## Getting Started

### Prerequisites

- Node.js 20.9+ (see `engines` in package.json)
- npm
- A [Supabase](https://supabase.com) project
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for migrations)

### Installation

```bash
git clone <repo-url>
cd restaurant-inventory-management-system
npm install
```

### Environment Variables

Create a `.env.local` file:

```bash
# === Required ===

# Supabase project URL (e.g., https://xxx.supabase.co)
NEXT_PUBLIC_SUPABASE_URL=

# Supabase anonymous/public key
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Supabase service role key — never expose client-side
SUPABASE_SERVICE_ROLE_KEY=


# === Optional (features degrade gracefully without these) ===

# Resend — transactional emails (invitations, alerts)
RESEND_API_KEY=

# Stripe — SaaS billing
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=                # whsec_ prefix

# Upstash Redis — production rate limiting (falls back to in-memory Map in dev)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Cron jobs — authenticates scheduled endpoints
CRON_SECRET=

# Xero accounting integration
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=
XERO_REDIRECT_URI=

# QuickBooks accounting integration
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_REDIRECT_URI=

# Google Document AI — invoice OCR scanning
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=
```

### Database Setup

Supabase manages PostgreSQL. Migrations live in `supabase/migrations/` (000-065).

```bash
# Push all migrations to your Supabase project
supabase db push

# Regenerate TypeScript types from the database schema
npm run db:types
```

This generates `types/database.ts`. RLS is enabled on all tables, scoped by `store_id` via a `get_user_store_ids()` helper function.

### Run the Dev Server

```bash
npm run dev
# Open http://localhost:3000
```

---

## Scripts

| Command                 | Description                             |
| ----------------------- | --------------------------------------- |
| `npm run dev`           | Start dev server (localhost:3000)       |
| `npm run build`         | Production build                        |
| `npm run lint`          | ESLint                                  |
| `npm run test`          | Vitest in watch mode                    |
| `npm run test:run`      | Run all 1,163 tests once                |
| `npm run test:coverage` | Coverage report                         |
| `npm run test:ui`       | Vitest browser UI                       |
| `npm run db:types`      | Regenerate database types from Supabase |

### Running specific tests

```bash
# Single file
npx vitest run tests/integration/api/inventory.test.ts

# Pattern match
npx vitest run -t "should return 401"
```

Test setup is in `tests/setup.ts`. API tests mock Supabase client, CSRF, and rate limiting. RLS tests require real Supabase credentials (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

---

## Project Structure

```
app/
  (auth)/                        Auth pages (login, signup, onboard, forgot-password)
  (dashboard)/                   47 protected dashboard pages
    inventory/                   Inventory list, stock count, low stock, value
    suppliers/                   Supplier directory, purchase orders, deliveries
    recipes/                     Recipe builder, menu items, menu analysis
    waste/                       Waste tracking
    shifts/                      Scheduling, timetable, my-shifts
    reports/                     Daily summary, low stock, forecast, benchmark, food cost
    haccp/                       Templates, checks, temperatures, corrective actions
    users/                       User management, invitations
    settings/                    Store settings, alert preferences
    billing/                     Subscription, payment methods, invoices
    integrations/                POS connections, accounting
    categories/                  Category management
    tags/                        Tag management
    activity/                    Audit activity log
    payroll/                     Pay runs, rates, my-pay
    profile/                     User profile
  (supplier-portal)/             Supplier portal (token-authenticated)
  (marketing)/                   Public marketing pages
  api/                           110 API route handlers
    stores/[storeId]/            Core store-scoped CRUD (inventory, suppliers, recipes, etc.)
    auth/                        Signup, login
    billing/                     Stripe checkout, portal, webhooks
    integrations/                POS OAuth, Xero, QuickBooks
    pos/webhook/                 POS sale event webhooks
    supplier-portal/             Token-authenticated supplier endpoints
    v1/                          Public API (API key auth)
    cron/                        Scheduled jobs (alerts, archival)
    reports/                     Analytics, forecast, benchmark

components/                      154 React components
  ui/                            shadcn/ui primitives (Button, Dialog, Sheet, etc.)
  dashboard/                     Dashboard-specific (OwnerDashboard, StaffDashboard)
  providers/                     AuthProvider, QueryProvider
  layout/                        Sidebar, DashboardShell, PageHeader

hooks/                           50 custom hooks
  useAuth.ts                     Auth context consumer
  useStoreInventory.ts           Inventory queries + optimistic mutations
  useSuppliers.ts                Supplier CRUD
  usePurchaseOrders.ts           PO lifecycle
  useRecipes.ts                  Recipe builder
  useHACCP.ts                    Food safety hooks
  useCSRF.ts                     CSRF token management
  useForecast.ts                 AI demand forecasting
  ...

lib/                             107 utility files
  api/                           middleware.ts, response.ts, api-keys.ts, with-supplier-auth.ts
  supabase/                      client.ts (browser), server.ts (SSR), admin.ts (bypass RLS)
  services/
    pos/                         POS service core, 37 adapters, webhook validators
    accounting/                  Xero adapter, QuickBooks adapter, types
    invoice-ocr.ts               Document AI integration
    supplier-portal.ts           Token auth service
    stockOperations.ts           Stock count/reception logic
    alertService.ts              Scheduled alert processing
  forecasting/engine.ts          Multi-method statistical forecasting
  validations/                   Zod schemas (store, inventory, user, shift, suppliers, etc.)
  auth.ts                        Permission checking (multi-tenant)
  audit.ts                       Audit logging
  rate-limit.ts                  Redis rate limiter
  csrf.ts                        Double-submit cookie CSRF
  email.ts                       Resend templates
  constants.ts                   Roles, permissions matrix, routes
  logger.ts                      Structured JSON logger

types/
  database.ts                    Generated from Supabase schema
  index.ts                       App types (AppRole, StoreUser, InventoryItem, etc.)

tests/                           95 test files
  integration/api/               API route tests (mock Supabase, CSRF, rate limiting)
  integration/rls/               RLS tests (require real Supabase credentials)
  hooks/                         Hook tests
  lib/                           Utility tests

supabase/migrations/             65+ SQL migrations (000-065)
```

---

## Role Permissions

Three roles: **Owner**, **Manager**, **Staff**. Legacy role names (`Admin`) map to `Owner`.

| Permission             |       Owner        | Manager | Staff |
| ---------------------- | :----------------: | :-----: | :---: |
| Create store           |         Y          |         |       |
| Store settings         |         Y          |    Y    |       |
| Delete store           | Y (billing owner)  |         |       |
| Invite users           |         Y          |         |       |
| Manage users           |         Y          |    Y    |       |
| Manage inventory items |         Y          |    Y    |       |
| Stock count            |         Y          |    Y    |   Y   |
| Stock reception        |         Y          |    Y    |   Y   |
| Stock adjustment       |         Y          |    Y    |       |
| Manage shifts          |         Y          |    Y    |       |
| View reports           |         Y          |    Y    |   Y   |
| Manage billing         | Billing owner only |         |       |

Billing access is controlled by the `is_billing_owner` flag on `store_users`, not by role.

---

## Deployment

Target platform: **Vercel**. Build with `npm run build`. No Docker container. No CI/CD pipeline currently configured.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for technical architecture, [FEATURES.md](./FEATURES.md) for feature status, and [LINEAR-ISSUES.md](./LINEAR-ISSUES.md) for the development backlog.

---

## License

This project is proprietary software. All rights reserved.
