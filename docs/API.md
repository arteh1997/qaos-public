# API Documentation

110 API route handlers across the application. All authenticated endpoints use JWT-based sessions via Supabase Auth. Responses follow a consistent format. CSRF is required for all state-changing operations.

---

## Authentication

### Standard Auth (`withApiAuth`)

Most endpoints use the `withApiAuth` middleware, which:

1. Validates the Supabase JWT from the session cookie
2. Checks the user's role against `allowedRoles`
3. Applies rate limiting
4. Validates CSRF token for POST/PUT/PATCH/DELETE (if `requireCSRF: true`)
5. Returns an `AuthContext` with `context.user.id`, `context.supabase`, `context.stores`, `context.requestId`

### Supplier Portal Auth (`withSupplierAuth`)

Supplier-facing endpoints use token-based auth. Tokens have the format `sp_live_<64 hex chars>` and are passed via the `Authorization: Bearer <token>` header. Each token has granular permissions: `can_view_orders`, `can_upload_invoices`, `can_update_catalog`, `can_update_order_status`.

### Public API Auth (`withApiKey`)

Public API v1 endpoints use API keys with the format `rk_live_<hex>`. Keys are scoped with permissions like `inventory:read`, `stock:read`, `stock:write`. Pass via `Authorization: Bearer <key>` header.

### Cron Auth

Cron endpoints require `Authorization: Bearer <CRON_SECRET>` header.

---

## CSRF Protection

All state-changing endpoints (POST, PUT, PATCH, DELETE) require CSRF validation using the double-submit cookie pattern:

- The server sets a `csrf_token` cookie on first page load
- The client reads the cookie and sends it as the `x-csrf-token` header
- The server validates that cookie and header match

```bash
# Example: include CSRF in a request
curl -X POST /api/stores/xxx/inventory \
  -H "x-csrf-token: <token-from-cookie>" \
  -H "Cookie: csrf_token=<same-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Tomatoes"}'
```

---

## Rate Limits

| Key | Limit | Window | Used By |
|-----|-------|--------|---------|
| `api` | 100 requests | 1 minute | Most endpoints |
| `auth` | 10 requests | 1 minute | Login, signup |
| `createUser` | 5 requests | 1 minute | User creation |
| `reports` | 20 requests | 1 minute | Report generation |

Rate limit headers are returned on every response:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1709078460
```

Production uses Upstash Redis (sliding window algorithm). Development falls back to an in-memory Map.

---

## Response Format

### Success

```json
{
  "success": true,
  "data": { ... },
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 142,
    "totalPages": 8
  }
}
```

### Error

```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "BAD_REQUEST",
  "requestId": "req_abc123"
}
```

Error codes: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `BAD_REQUEST` (400), `NOT_FOUND` (404), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).

Error messages are automatically sanitized to remove stack traces, file paths, and credentials before being returned to the client.

---

## Endpoints

### System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | Health check (auth, database, authenticated query) |
| GET | `/api/csrf` | None | Get/set CSRF token cookie |

### Auth

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| POST | `/api/auth/signup` | None (rate limit: auth) | No | Create user account with email/password |
| POST | `/api/auth/login` | None (rate limit: auth) | No | Login with brute-force protection |

### Stores

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/stores` | Any role | No | List stores user belongs to (paginated) |
| POST | `/api/stores` | Owner | Yes | Create a new store |
| GET | `/api/stores/[storeId]` | Any role | No | Get single store details |
| PATCH | `/api/stores/[storeId]` | Owner, Manager | Yes | Update store name, settings |
| DELETE | `/api/stores/[storeId]` | Owner | Yes | Delete store (must be empty) |

### Inventory

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/inventory` | Any role | No | List inventory items (multi-tenant, paginated) |
| POST | `/api/inventory` | Owner, Manager | Yes | Create inventory item for a store |
| GET | `/api/inventory/[itemId]` | Any role | No | Get single inventory item |
| PATCH | `/api/inventory/[itemId]` | Owner, Manager | Yes | Update inventory item fields |
| DELETE | `/api/inventory/[itemId]` | Owner, Manager | Yes | Soft-delete inventory item |
| GET | `/api/stores/[storeId]/inventory` | Any role | No | List store inventory with stock levels |
| PATCH | `/api/stores/[storeId]/inventory/[itemId]` | Owner, Manager | Yes | Update stock quantity, PAR level, unit cost |
| DELETE | `/api/stores/[storeId]/inventory/[itemId]` | Owner, Manager | Yes | Soft-delete item with cleanup |
| PATCH | `/api/stores/[storeId]/inventory/batch` | Owner, Manager | Yes | Batch update multiple items |
| DELETE | `/api/stores/[storeId]/inventory/batch` | Owner, Manager | Yes | Batch soft-delete items |
| POST | `/api/stores/[storeId]/inventory/import` | Owner, Manager | No | Bulk import from CSV |
| GET | `/api/stores/[storeId]/inventory/template` | Session auth | No | Download CSV import template |
| GET | `/api/stores/[storeId]/inventory/[itemId]/tags` | Any role | No | Get item's tags |
| POST | `/api/stores/[storeId]/inventory/[itemId]/tags` | Owner, Manager | Yes | Add tag to item |
| DELETE | `/api/stores/[storeId]/inventory/[itemId]/tags` | Owner, Manager | Yes | Remove tag from item |

### Stock Operations

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| POST | `/api/stores/[storeId]/stock-count` | Any role | Yes | Submit stock count (updates inventory + history) |
| POST | `/api/stores/[storeId]/stock-reception` | Any role | Yes | Record stock reception from delivery |
| GET | `/api/stores/[storeId]/history` | Any role | No | Get stock history with filtering and pagination |

### Suppliers

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/stores/[storeId]/suppliers` | Owner, Manager | No | List suppliers with optional search filter |
| POST | `/api/stores/[storeId]/suppliers` | Owner, Manager | Yes | Create supplier |
| GET | `/api/stores/[storeId]/suppliers/[supplierId]` | Owner, Manager | No | Get supplier details |
| PATCH | `/api/stores/[storeId]/suppliers/[supplierId]` | Owner, Manager | Yes | Update supplier |
| DELETE | `/api/stores/[storeId]/suppliers/[supplierId]` | Owner, Manager | Yes | Delete supplier |
| GET | `/api/stores/[storeId]/suppliers/[supplierId]/items` | Owner, Manager | No | List supplier items (catalog) |
| POST | `/api/stores/[storeId]/suppliers/[supplierId]/items` | Owner, Manager | Yes | Add item to supplier catalog |
| GET | `/api/stores/[storeId]/suppliers/[supplierId]/portal-tokens` | Owner, Manager | No | List portal tokens for supplier |
| POST | `/api/stores/[storeId]/suppliers/[supplierId]/portal-tokens` | Owner, Manager | Yes | Generate new portal token |

### Purchase Orders

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/stores/[storeId]/purchase-orders` | Owner, Manager | No | List purchase orders (paginated) |
| POST | `/api/stores/[storeId]/purchase-orders` | Owner, Manager | Yes | Create PO with line items |
| GET | `/api/stores/[storeId]/purchase-orders/[poId]` | Owner, Manager | No | Get PO detail with line items |
| PUT | `/api/stores/[storeId]/purchase-orders/[poId]` | Owner, Manager | Yes | Update PO status, line items |
| DELETE | `/api/stores/[storeId]/purchase-orders/[poId]` | Owner, Manager | Yes | Delete draft PO |
| POST | `/api/stores/[storeId]/purchase-orders/[poId]/receive` | Owner, Manager | Yes | Receive items from PO (updates stock) |

### Recipes & Menu Items

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/stores/[storeId]/recipes` | Any role | No | List recipes with cost calculations |
| POST | `/api/stores/[storeId]/recipes` | Owner, Manager | Yes | Create recipe |
| GET | `/api/stores/[storeId]/recipes/[recipeId]` | Any role | No | Get recipe detail with ingredients |
| PUT | `/api/stores/[storeId]/recipes/[recipeId]` | Owner, Manager | Yes | Update recipe |
| DELETE | `/api/stores/[storeId]/recipes/[recipeId]` | Owner, Manager | Yes | Delete recipe |
| POST | `/api/stores/[storeId]/recipes/[recipeId]/ingredients` | Owner, Manager | Yes | Add/remove recipe ingredients |
| GET | `/api/stores/[storeId]/menu-items` | Owner, Manager | No | List menu items with costs |
| POST | `/api/stores/[storeId]/menu-items` | Owner, Manager | Yes | Create menu item |
| PUT | `/api/stores/[storeId]/menu-items/[menuItemId]` | Owner, Manager | Yes | Update menu item |
| DELETE | `/api/stores/[storeId]/menu-items/[menuItemId]` | Owner, Manager | Yes | Delete menu item |
| GET | `/api/stores/[storeId]/menu-analysis` | Owner, Manager | No | Menu profitability analysis |

### Waste

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/stores/[storeId]/waste` | Owner, Manager | No | Get waste history with filters |
| POST | `/api/stores/[storeId]/waste` | Any role | Yes | Record waste report |
| GET | `/api/stores/[storeId]/waste-analytics` | Owner, Manager | No | Waste analytics and trends |

### Categories & Tags

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/stores/[storeId]/categories` | Any role | No | List categories with item counts |
| POST | `/api/stores/[storeId]/categories` | Owner, Manager | Yes | Create category |
| PATCH | `/api/stores/[storeId]/categories/[categoryId]` | Owner, Manager | Yes | Update category |
| DELETE | `/api/stores/[storeId]/categories/[categoryId]` | Owner, Manager | Yes | Delete category |
| GET | `/api/stores/[storeId]/tags` | Any role | No | List tags with usage counts |
| POST | `/api/stores/[storeId]/tags` | Owner, Manager | Yes | Create tag |
| PATCH | `/api/stores/[storeId]/tags/[tagId]` | Owner, Manager | Yes | Update tag |
| DELETE | `/api/stores/[storeId]/tags/[tagId]` | Owner, Manager | Yes | Delete tag |

### HACCP Food Safety

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/stores/[storeId]/haccp/dashboard` | Any role | No | Compliance score, today's stats |
| GET | `/api/stores/[storeId]/haccp/templates` | Any role | No | List check templates |
| POST | `/api/stores/[storeId]/haccp/templates` | Owner, Manager | Yes | Create template |
| GET | `/api/stores/[storeId]/haccp/templates/[templateId]` | Any role | No | Get template detail |
| PUT | `/api/stores/[storeId]/haccp/templates/[templateId]` | Owner, Manager | Yes | Update template |
| DELETE | `/api/stores/[storeId]/haccp/templates/[templateId]` | Owner, Manager | Yes | Deactivate template |
| GET | `/api/stores/[storeId]/haccp/checks` | Any role | No | List completed checks |
| POST | `/api/stores/[storeId]/haccp/checks` | Any role | Yes | Submit check (pass/fail/partial) |
| GET | `/api/stores/[storeId]/haccp/temperature-logs` | Any role | No | List temperature readings |
| POST | `/api/stores/[storeId]/haccp/temperature-logs` | Any role | Yes | Log temperature reading |
| GET | `/api/stores/[storeId]/haccp/corrective-actions` | Any role | No | List corrective actions |
| POST | `/api/stores/[storeId]/haccp/corrective-actions` | Any role | Yes | Create corrective action |
| PUT | `/api/stores/[storeId]/haccp/corrective-actions/[actionId]` | Owner, Manager | Yes | Resolve corrective action |

### Shifts & Payroll

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/shifts` | Any role | No | List shifts (scoped per role) |
| POST | `/api/shifts` | Owner, Manager | Yes | Create shift |
| GET | `/api/shifts/[shiftId]` | Any role | No | Get shift detail |
| PATCH | `/api/shifts/[shiftId]` | Owner, Manager | Yes | Update shift |
| DELETE | `/api/shifts/[shiftId]` | Owner, Manager | Yes | Delete shift |
| POST | `/api/shifts/[shiftId]/clock-in` | Any role | Yes | Clock in to shift |
| POST | `/api/shifts/[shiftId]/clock-out` | Any role | Yes | Clock out from shift |
| GET | `/api/stores/[storeId]/payroll/rates` | Owner, Manager | No | List hourly rates |
| PATCH | `/api/stores/[storeId]/payroll/rates/[userId]` | Owner, Manager | Yes | Update hourly rate |
| GET | `/api/stores/[storeId]/payroll/earnings` | Any role | No | Calculate earnings for period |
| GET | `/api/stores/[storeId]/payroll/pay-runs` | Any role | No | List pay runs |
| POST | `/api/stores/[storeId]/payroll/pay-runs` | Owner, Manager | Yes | Create pay run from shifts |
| GET | `/api/stores/[storeId]/payroll/pay-runs/[payRunId]` | Any role | No | Get pay run detail |
| PATCH | `/api/stores/[storeId]/payroll/pay-runs/[payRunId]` | Owner, Manager | Yes | Update pay run status |
| DELETE | `/api/stores/[storeId]/payroll/pay-runs/[payRunId]` | Owner, Manager | Yes | Delete pay run |

### Users & Invitations

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| DELETE | `/api/stores/[storeId]/users/[userId]` | Owner, Manager | Yes | Remove user from store |
| POST | `/api/users/invite` | Owner | Yes | Invite user to store |
| GET | `/api/users/invites` | Owner, Manager | No | List pending invitations |
| POST | `/api/users/invites/resend` | Owner | Yes | Resend invitation email |
| POST | `/api/users/bulk-import` | Owner | Yes | Bulk import users from CSV |
| POST | `/api/users/onboard` | Rate limited | Yes | Complete onboarding |
| POST | `/api/users/onboard/validate` | Rate limited | No | Validate onboarding token |
| GET | `/api/users/account-type` | Any role | No | Get account type for current user |
| PUT | `/api/stores/[storeId]/billing-owner` | Owner | Yes | Transfer billing ownership |

### Reports

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/reports/analytics` | Owner, Manager | No | Comprehensive analytics (stock activity, health) |
| GET | `/api/reports/benchmark` | Owner, Manager | No | Multi-store comparative analytics |
| GET | `/api/reports/daily-summary` | Any role | No | Daily summary of counts/receptions |
| GET | `/api/reports/forecast` | Owner, Manager | No | AI-powered demand forecasting |
| GET | `/api/reports/low-stock` | Any role | No | Items below PAR level |
| GET | `/api/stores/[storeId]/reports/food-cost` | Owner, Manager | No | Food cost analysis (requires POS + recipes) |
| GET | `/api/stores/[storeId]/export` | Owner | No | Export store data as Excel |
| GET | `/api/audit-logs` | Owner, Manager | No | Retrieve audit logs with filtering |
| GET | `/api/alerts/missing-counts` | Any role | No | Stores with missing daily counts |
| GET | `/api/stores/[storeId]/alert-history` | Owner, Manager | No | Alert delivery history |
| GET | `/api/stores/[storeId]/alert-preferences` | Owner, Manager | No | Get alert preferences |
| PUT | `/api/stores/[storeId]/alert-preferences` | Owner, Manager | Yes | Update alert preferences |
| GET | `/api/stores/[storeId]/notification-preferences` | Any role | No | Get notification preferences |
| PUT | `/api/stores/[storeId]/notification-preferences` | Any role | Yes | Update notification preferences |

### Invoices (OCR)

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/stores/[storeId]/invoices` | Owner, Manager | No | List invoices |
| POST | `/api/stores/[storeId]/invoices` | Owner, Manager | Yes | Upload invoice file (triggers OCR) |
| GET | `/api/stores/[storeId]/invoices/[invoiceId]` | Owner, Manager | No | Get invoice detail with line items |
| PATCH | `/api/stores/[storeId]/invoices/[invoiceId]` | Owner, Manager | Yes | Update invoice (approve/reject line matches) |
| POST | `/api/stores/[storeId]/invoices/[invoiceId]/apply` | Owner, Manager | Yes | Apply approved invoice to inventory |

### POS Integration

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/stores/[storeId]/pos` | Owner, Manager | No | List POS connections |
| POST | `/api/stores/[storeId]/pos` | Owner | Yes | Create POS connection |
| DELETE | `/api/stores/[storeId]/pos` | Owner | Yes | Delete POS connection |
| GET | `/api/stores/[storeId]/pos/events` | Owner, Manager | No | List recent POS sale events |
| GET | `/api/stores/[storeId]/pos/mappings` | Owner, Manager | No | List POS item mappings |
| POST | `/api/stores/[storeId]/pos/mappings` | Owner, Manager | Yes | Create POS item mapping |
| DELETE | `/api/stores/[storeId]/pos/mappings` | Owner, Manager | Yes | Delete POS item mapping |
| GET | `/api/stores/[storeId]/pos/menu-items` | Owner, Manager | No | Fetch menu items from POS provider |
| GET | `/api/integrations/pos/[provider]/auth` | Owner, Manager | No | Initiate POS OAuth flow (redirects) |
| GET | `/api/integrations/pos/[provider]/callback` | None (OAuth) | No | POS OAuth callback, create connection |
| POST | `/api/pos/webhook/[connectionId]` | HMAC signature | No | Receive POS sale events (webhook) |

### Accounting Integration

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/stores/[storeId]/accounting` | Owner, Manager | No | Get accounting connection status |
| GET | `/api/stores/[storeId]/accounting/accounts` | Owner, Manager | No | Fetch chart of accounts from provider |
| GET | `/api/stores/[storeId]/accounting/config` | Owner, Manager | No | Get GL mapping configuration |
| PUT | `/api/stores/[storeId]/accounting/config` | Owner, Manager | Yes | Update GL mapping configuration |
| POST | `/api/stores/[storeId]/accounting/sync` | Owner, Manager | Yes | Trigger sync of invoices to accounting |
| GET | `/api/integrations/xero/auth` | Owner, Manager | No | Initiate Xero OAuth flow |
| GET | `/api/integrations/xero/callback` | None (OAuth) | No | Xero OAuth callback |
| POST | `/api/integrations/xero/disconnect` | Owner, Manager | Yes | Disconnect Xero |
| GET | `/api/integrations/quickbooks/auth` | Owner, Manager | No | Initiate QuickBooks OAuth flow |
| GET | `/api/integrations/quickbooks/callback` | None (OAuth) | No | QuickBooks OAuth callback |
| POST | `/api/integrations/quickbooks/disconnect` | Owner, Manager | Yes | Disconnect QuickBooks |

### Billing (Stripe)

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/billing/subscriptions` | Owner | No | List store subscriptions |
| POST | `/api/billing/subscriptions` | Owner | Yes | Create subscription |
| GET | `/api/billing/subscriptions/[subscriptionId]` | Owner | No | Get subscription detail |
| PATCH | `/api/billing/subscriptions/[subscriptionId]` | Owner | Yes | Cancel / reactivate subscription |
| GET | `/api/billing/payment-methods` | Owner | No | List payment methods |
| POST | `/api/billing/payment-methods` | Owner | Yes | Add payment method |
| PATCH | `/api/billing/payment-methods/[pmId]` | Owner | Yes | Set default payment method |
| DELETE | `/api/billing/payment-methods/[pmId]` | Owner | Yes | Remove payment method |
| POST | `/api/billing/setup-intent` | Owner | Yes | Create Stripe SetupIntent |
| GET | `/api/billing/invoices` | Owner | No | Fetch invoices from Stripe |
| POST | `/api/billing/webhook` | Stripe signature | No | Stripe webhook (subscription, invoice, dispute events) |

### Supplier Portal (Token Auth)

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/supplier-portal/orders` | Token (can_view_orders) | No | List POs for supplier |
| PATCH | `/api/supplier-portal/orders/[poId]` | Token (can_update_order_status) | No | Update PO status |
| POST | `/api/supplier-portal/invoices` | Token (can_upload_invoices) | No | Upload invoice |
| GET | `/api/supplier-portal/catalog` | Token (can_view_orders) | No | View catalog items |
| PUT | `/api/supplier-portal/catalog` | Token (can_update_catalog) | No | Update catalog items |

### Public API (API Key Auth)

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/v1/inventory` | API key (inventory:read) | No | List inventory items |
| GET | `/api/v1/stock` | API key (stock:read) | No | Get stock history |
| POST | `/api/v1/stock` | API key (stock:write) | No | Submit count/reception |
| GET | `/api/stores/[storeId]/api-keys` | Owner, Manager | No | List API keys |
| POST | `/api/stores/[storeId]/api-keys` | Owner | Yes | Create API key |
| DELETE | `/api/stores/[storeId]/api-keys` | Owner | Yes | Revoke API key |

### Webhooks & Store Config

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| GET | `/api/stores/[storeId]/webhooks` | Owner, Manager | No | List configured webhooks |
| POST | `/api/stores/[storeId]/webhooks` | Owner, Manager | Yes | Register webhook endpoint |

### Cron Jobs

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| POST | `/api/cron/send-alerts` | CRON_SECRET | No | Process and send scheduled alerts (hourly) |
| POST | `/api/cron/archive-data` | CRON_SECRET | No | Archive old stock_history and audit_logs (>12 months, weekly) |
