# Architecture Documentation

Technical architecture overview of the Restaurant Inventory Management System.

---

## System Diagram

```
                          +-----------------------+
                          |       Browser         |
                          |  (React 19 + Next.js) |
                          +----------+------------+
                                     |
                          +----------v------------+
                          |   Next.js Middleware   |
                          |  Session + CSRF cookie |
                          +----------+------------+
                                     |
                   +-----------------+-----------------+
                   |                                   |
          +--------v--------+               +----------v----------+
          | React Components|               |   API Routes (110)  |
          | (154 components)|               |  withApiAuth()      |
          +--------+--------+               +----------+----------+
                   |                                   |
          +--------v--------+               +----------v----------+
          |  TanStack Query |               | Supabase Client     |
          |  (50 hooks)     |               | (server/admin/SSR)  |
          +--------+--------+               +----------+----------+
                   |                                   |
                   +-----------------------------------+
                                     |
                          +----------v------------+
                          |  PostgreSQL (Supabase) |
                          |  RLS + 65+ migrations  |
                          +----------+------------+
                                     |
              +----------------------+----------------------+
              |              |              |               |
    +---------v---+  +------v------+  +----v------+  +-----v------+
    |   Stripe    |  |   Resend    |  | Upstash   |  | 37 POS     |
    | (billing)   |  |  (email)    |  |  Redis    |  | providers  |
    +-------------+  +-------------+  +-----------+  +-----+------+
                                                            |
                                      +---------------------+
                                      |                     |
                               +------v------+    +---------v--------+
                               |   Xero /    |    | Google Doc AI    |
                               | QuickBooks  |    | (invoice OCR)    |
                               +-------------+    +------------------+
```

---

## Core Data Flows

### 1. Adding Inventory

```
Client POST /api/stores/[storeId]/inventory
  -> Zod schema validation (lib/validations/inventory.ts)
  -> withApiAuth (JWT + role check: Owner/Manager)
  -> CSRF token validation
  -> Supabase insert into inventory_items + store_inventory (with RLS)
  -> Audit log (fire-and-forget: auditLog(adminClient, { action: 'inventory.item_create', ... }))
  -> TanStack Query cache invalidation via onSuccess
  -> apiSuccess(data, { requestId })
```

### 2. POS Sale Processing

```
POS Provider webhook POST /api/pos/webhook/[connectionId]
  -> Look up connection by ID (get provider, secret, store_id)
  -> HMAC-SHA256 signature validation (lib/services/pos/webhook-validators.ts)
  -> Adapter transforms sale event to PosSaleEvent format
  -> processSaleEvent() in lib/services/pos.ts:
     1. Idempotency check (pos_sale_events.external_event_id)
     2. Record event with status=pending
     3. Batch-fetch item mappings (pos_item_mappings)
     4. Batch-fetch current inventory
     5. Calculate deductions (dedup multiple POS items -> same inventory item)
     6. Batch upsert store_inventory
     7. Batch insert stock_history records (action_type='Sale')
     8. Update event status + connection sync timestamp
```

### 3. Stock Count Reconciliation

```
Client POST /api/stores/[storeId]/stock-count
  -> withApiAuth (any role can count)
  -> Zod validation of submitted counts
  -> For each item:
     1. Fetch current store_inventory quantity
     2. Compute variance (submitted - current)
     3. Insert stock_history record (action_type='Count', quantity_before, quantity_after)
     4. Update store_inventory.quantity to submitted value
  -> Audit log with item count and variances
  -> apiSuccess({ itemsUpdated, variances })
```

### 4. Invoice OCR Flow

```
Client POST /api/stores/[storeId]/invoices (upload file)
  -> Store file in Supabase Storage
  -> Insert invoice record (status: pending)
  -> processInvoice() async:
     1. Download file from storage
     2. Send to Google Document AI -> extract fields + line items
     3. Fuzzy-match line items to inventory (supplier items first, then general)
     4. Insert invoice_line_items with match_status (auto_matched/unmatched)
     5. Update invoice status to 'review'
  -> User reviews matches in UI, approves
  -> POST /api/stores/[storeId]/invoices/[id]/apply
     -> Create stock_history records (action_type='Reception')
     -> Update store_inventory quantities
```

---

## Database Schema

40+ tables across 65+ migrations. All tables have RLS enabled, scoped by `store_id` via the `get_user_store_ids()` SQL helper function.

### Core Entities

| Table | Description | Key Fields |
|-------|-------------|------------|
| `stores` | Restaurant locations | name, address, country, currency, is_active, subscription_status |
| `profiles` | User profiles | email, full_name, is_platform_admin, stripe_customer_id |
| `store_users` | Multi-tenant junction | store_id, user_id, role (Owner/Manager/Staff), is_billing_owner, hourly_rate |
| `user_invites` | Pending invitations | email, role, token, store_id, expires_at, used_at |

### Inventory

| Table | Description | Key Fields |
|-------|-------------|------------|
| `inventory_items` | Item catalog (per store) | store_id, name, category_id, unit_of_measure, is_active |
| `store_inventory` | Stock levels per store | store_id, inventory_item_id, quantity, par_level, unit_cost |
| `stock_history` | Append-only audit trail | action_type (Count/Reception/Adjustment/Waste/Sale), quantity_before, quantity_after, performed_by |
| `categories` | Item categories | store_id, name |
| `tags` | Item tags | store_id, name |
| `inventory_item_tags` | Tag junction | inventory_item_id, tag_id |

### Suppliers & Procurement

| Table | Description | Key Fields |
|-------|-------------|------------|
| `suppliers` | Supplier directory | store_id, name, email, contact_person, payment_terms |
| `supplier_items` | Supplier catalog | supplier_id, inventory_item_id, supplier_sku, unit_cost, lead_time_days |
| `purchase_orders` | PO lifecycle | supplier_id, po_number, status, order_date, expected_delivery_date |
| `po_line_items` | PO line items | purchase_order_id, inventory_item_id, quantity_ordered, quantity_received |

### Recipes & Menu

| Table | Description | Key Fields |
|-------|-------------|------------|
| `recipes` | Recipe definitions | store_id, name, yield_quantity, yield_unit |
| `recipe_ingredients` | Recipe composition | recipe_id, inventory_item_id, quantity, unit_of_measure |
| `menu_items` | Menu items with pricing | store_id, recipe_id, selling_price, food_cost_percentage |

### POS Integration

| Table | Description | Key Fields |
|-------|-------------|------------|
| `pos_connections` | Active POS links | store_id, provider, credentials (encrypted), webhook_secret |
| `pos_item_mappings` | POS -> inventory map | connection_id, pos_item_id, inventory_item_id, quantity_per_sale |
| `pos_sale_events` | Processed sale events | connection_id, external_event_id, event_type, status, items_deducted |

### Accounting

| Table | Description | Key Fields |
|-------|-------------|------------|
| `accounting_connections` | Xero/QB links | store_id, provider, credentials, config (gl_mappings) |
| `accounting_sync_log` | Sync history | connection_id, entity_type, external_id, status |
| `integration_oauth_states` | OAuth state tokens | store_id, provider, state_token, expires_at |

### Invoices (OCR)

| Table | Description | Key Fields |
|-------|-------------|------------|
| `invoices` | Scanned invoices | store_id, supplier_id, file_path, ocr_confidence, status |
| `invoice_line_items` | Extracted line items | invoice_id, inventory_item_id, match_status, confidence |

### HACCP Food Safety

| Table | Description | Key Fields |
|-------|-------------|------------|
| `haccp_check_templates` | Check definitions | store_id, name, frequency, items (JSON: yes_no/temperature/text) |
| `haccp_checks` | Completed checks | template_id, completed_by, status (pass/fail/partial) |
| `haccp_temperature_logs` | Temperature readings | store_id, location_name, temperature_celsius, is_in_range |
| `haccp_corrective_actions` | Follow-up actions | check_id, description, action_taken, resolved_at |

### Workforce

| Table | Description | Key Fields |
|-------|-------------|------------|
| `shifts` | Scheduled shifts | store_id, user_id, start_time, end_time, clock_in_time, clock_out_time |
| `pay_runs` | Payroll periods | store_id, period_start, period_end, status, total_amount |

### Billing & Audit

| Table | Description | Key Fields |
|-------|-------------|------------|
| `subscriptions` | Stripe subscriptions | store_id, stripe_subscription_id, status, current_period_end |
| `audit_logs` | Full audit trail | user_id, action, action_category, store_id, details, ip_address |
| `api_keys` | Public API keys | store_id, key_hash, scopes, is_active |
| `alert_preferences` | Alert config | store_id, alert_type, enabled, hour_utc |

### Supplier Portal

| Table | Description | Key Fields |
|-------|-------------|------------|
| `supplier_portal_tokens` | Access tokens | supplier_id, token_hash, permissions (4 booleans), expires_at |
| `supplier_portal_activity` | Activity log | token_id, action, ip_address, details |

### Archive Tables

| Table | Description |
|-------|-------------|
| `stock_history_archive` | Records older than 12 months |
| `audit_logs_archive` | Records older than 12 months |

---

## RLS Strategy

Row-Level Security is enabled on every table. The core pattern:

```sql
-- Helper function (MUST use LANGUAGE sql, not plpgsql, to avoid infinite recursion)
CREATE FUNCTION get_user_store_ids() RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT store_id FROM store_users WHERE user_id = auth.uid()
$$;

-- Typical RLS policy
CREATE POLICY "Users can read their store data"
  ON inventory_items FOR SELECT
  USING (store_id IN (SELECT get_user_store_ids()));
```

Key behaviors:
- RLS **silently filters** rows rather than throwing errors. A query for another store's data returns `[]`, not an error.
- The admin client (`createAdminClient()`) bypasses RLS entirely. It should only be used **after** `withApiAuth` verifies the user.
- `SECURITY DEFINER` on the helper function means it runs with the function creator's permissions, not the caller's. This prevents recursion when the function itself reads from `store_users`.

---

## Third-Party Integrations

### Stripe (Billing)

- **Checkout sessions** for subscription creation
- **Customer portal** for self-service management
- **Webhook events**: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.dispute.created`
- Multi-currency support: GBP, USD, EUR, SAR, AED, AUD, CAD
- Card-country validation maps card country to billing currency

### Resend (Email)

- Invitation emails (with onboarding URL)
- Added-to-store notifications
- Payment failure alerts
- Trial ending reminders
- Dispute notifications
- Supplier portal invitations
- All templates use inline CSS with dark mode support

### POS Providers (37 adapters)

Each adapter in `lib/services/pos/adapters/` implements the `PosProviderAdapter` interface:

```typescript
interface PosProviderAdapter {
  provider: string
  getAuthUrl?(storeId: string, state: string): string  // OAuth providers
  exchangeCode?(code: string): Promise<Credentials>     // OAuth callback
  validateWebhook(payload: string, signature: string, secret: string): boolean
  transformSaleEvent(rawEvent: unknown): PosSaleEvent
}
```

Webhook signature validation uses HMAC-SHA256 for all providers. Most use hex encoding; Clover, Shopify POS use base64; Square prepends the webhook URL to the payload before hashing. The factory-based validator is in `lib/services/pos/webhook-validators.ts`.

### Xero & QuickBooks (Accounting)

Both implement `AccountingProviderAdapter`:

```typescript
interface AccountingProviderAdapter {
  provider: string
  refreshToken(creds: AccountingCredentials): Promise<TokenRefreshResult>
  getAccounts(creds: AccountingCredentials): Promise<AccountingAccount[]>
  findOrCreateContact(creds: AccountingCredentials, contact: AccountingContact): Promise<string>
  createBill(creds: AccountingCredentials, bill: AccountingBill): Promise<SyncResult>
  updateBill(creds: AccountingCredentials, externalId: string, bill: AccountingBill): Promise<SyncResult>
  getBillPaymentStatus(creds: AccountingCredentials, externalId: string): Promise<string>
}
```

OAuth state is stored in `integration_oauth_states` with 10-minute TTL. Token refresh is automatic (checked before each API call).

### Google Document AI (Invoice OCR)

`lib/services/invoice-ocr.ts` processes uploaded invoices:

1. Download from Supabase Storage
2. Send to Document AI (`us` location by default)
3. Parse response into structured `OCRResult` (invoice number, dates, amounts, line items)
4. Fuzzy-match line items against inventory (token overlap + containment scoring, 80+ = auto-match)
5. Supplier items get a +10 confidence bonus

---

## Forecasting Engine

`lib/forecasting/engine.ts` generates 14-day demand predictions using three methods:

| Method | Use Case |
|--------|----------|
| **Simple Moving Average (SMA)** | Baseline. 7-14 day window. |
| **Weighted Moving Average (WMA)** | Recent-biased. More weight to last 3 days. |
| **Exponential Smoothing (ETS)** | Trend-adaptive. Double exponential with alpha/beta. |

Additional features:
- **Day-of-week seasonality** adjustments (indices for Sun-Sat)
- **Confidence intervals** that widen over the forecast horizon
- **Risk assessment**: stockout in 2 days = critical, 5 = high, 10 = medium
- **Order suggestions**: quantity and date based on lead time and projected stockout

---

## Key Architectural Decisions

### Why RLS helpers use `LANGUAGE sql` not `plpgsql`

PL/pgSQL functions create a new execution context that re-evaluates RLS policies, causing infinite recursion when the helper reads from a table that has RLS policies referencing the same helper. Plain SQL functions inline into the query, avoiding the recursion.

### Why audit logging is fire-and-forget

`auditLog()` is called without `await` in most routes. Audit writes should never block the API response or cause user-facing errors. If the write fails, it's logged to the structured logger but the API still returns success.

### Why the admin client is cached as a singleton

`createAdminClient()` returns a cached instance because the service role key is static. Re-creating the client on every request would add unnecessary overhead for the most frequently used server-side client.

### Why HACCP tables use `(context.supabase as any)` casts

The HACCP tables (migration 062) were added after the last `npm run db:types` generation. Until types are regenerated, the generated `Database` type doesn't include these tables, so API routes cast to `any` for HACCP queries. This is a temporary measure.

### Why the POS webhook validator uses a factory

26 of 37 POS providers use byte-for-byte identical HMAC-SHA256 hex validation. A `createHmacValidator('hex' | 'base64')` factory replaces 732 lines with 88 lines while preserving all named exports for adapter imports.
