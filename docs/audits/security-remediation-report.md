# Security Remediation Report

**Date:** 2026-02-26
**Audit Reference:** `docs/audits/security-audit.md`
**Branch:** `security-remediation`
**Status:** ALL 23 VULNERABILITIES REMEDIATED
**Tests:** 1898 passing (95 files), zero regressions

---

## Executive Summary

All 23 vulnerabilities identified in the pre-launch security audit have been remediated across 5 phases. Additionally, a post-remediation sweep identified and fixed 3 further `select('*')` over-exposure issues on sensitive tables (`subscriptions`, `accounting_connections`).

| Severity | Count | Fixed |
|----------|-------|-------|
| CRITICAL | 1 | 1 |
| HIGH | 6 | 6 |
| MEDIUM | 9 | 9 |
| LOW | 7 | 7 |
| **Total** | **23** | **23** |

---

## Remediation Details

### CRITICAL

#### SEC-01: Hardcoded Production Secrets in Committed Documentation — FIXED

**Files changed:**
- `docs/PRIORITY_14_IMPLEMENTATION_COMPLETE.md` — Redacted `RESEND_API_KEY` and `STRIPE_WEBHOOK_SECRET`
- `docs/PRIORITY_12_IMPLEMENTATION_COMPLETE.md` — Redacted same secrets
- `docs/audits/security-audit.md` — Redacted secret values in examples

**Prevention added:**
- `.gitleaks.toml` created with default ruleset for pre-commit secret scanning

**Remaining action (manual):** Rotate both secrets in Resend and Stripe dashboards, and scrub from git history using `git filter-repo` or BFG Repo Cleaner.

---

### HIGH

#### SEC-02: Inventory Import Route Bypasses `withApiAuth` — FIXED

**File changed:** `app/api/stores/[storeId]/inventory/import/route.ts` (rewritten)

**Changes:**
- Replaced ad-hoc `getSession()` auth with `withApiAuth` middleware
- Added `canManageStore(context, storeId)` authorization check
- Added CSRF validation (`requireCSRF: true`)
- Added rate limiting (`RATE_LIMITS.api`)
- Added file size validation (5MB max) and MIME type validation (CSV only)
- Uses `context.supabase` instead of creating its own client

---

#### SEC-03: `getSession()` Used Instead of `getUser()` — FIXED

**Files changed:**
- `app/api/stores/[storeId]/inventory/import/route.ts` — Fixed by SEC-02 rewrite
- `app/api/stores/[storeId]/inventory/template/route.ts` — Rewritten to use `withApiAuth` + `canAccessStore`

**Verification:** Grep for `getSession` in `app/api/` returns zero results.

---

#### SEC-04: POS Webhook Signature Verification Is Optional — FIXED

**File changed:** `app/api/pos/webhook/[connectionId]/route.ts`

**Changes:**
- Added explicit check: if `!webhookSecret`, return 403 "Webhook secret not configured for this connection"
- Signature verification is now mandatory — no unsigned webhooks accepted

---

#### SEC-05: Signup Endpoint Enables Email Enumeration — FIXED

**File changed:** `app/api/auth/signup/route.ts`

**Changes:**
- Returns generic 200 response for all cases: "If this email is available, a confirmation link has been sent."
- Server-side logging still captures the actual reason for debugging
- Removed the 409 "email already exists" response branch

---

#### SEC-06: HTML Injection in Email Templates — FIXED

**File changed:** `lib/email.ts`

**Changes:**
- Added `escapeHtml()` utility function (escapes `&`, `<`, `>`, `"`, `'`)
- Applied `escapeHtml()` to ALL user-provided values in ALL 7 email templates:
  - `getInviteEmailHtml`: `inviterName`, `storeName`, `roleDisplay`
  - `getAddedToStoreEmailHtml`: `storeName`, `addedByName`, `roleDisplay`
  - `getWelcomeEmailHtml`: `firstName`, `storeName`, `roleDisplay`
  - `getPaymentFailedEmailHtml`: `storeName`
  - `getDisputeNotificationEmailHtml`: `storeName`
  - `getSupplierPortalInviteEmailHtml`: `supplierName`, `storeName`
  - `getTrialEndingEmailHtml`: `storeName`

---

#### SEC-07: QuickBooks Query String Injection — FIXED

**File changed:** `lib/services/accounting/quickbooks.ts`

**Changes:**
- Added `escapeQBQuery()` utility: `value.replace(/'/g, "''")`
- Fixed vendor search query to use proper QuickBooks escaping (doubled single quotes) instead of incorrect backslash escaping

---

### MEDIUM

#### SEC-08: Inconsistent Password Policies — FIXED

**File changed:** `lib/validations/auth.ts` (rewritten)

**Changes:**
- Created unified `passwordSchema`: min(8), max(200), uppercase required, lowercase required, number required
- Applied to `resetPasswordSchema` and `acceptInviteSchema`
- `loginSchema` uses minimal `min(1).max(200)` for legacy account compatibility
- Added `.max(320)` to email fields, `.max(255)` to `fullName`

---

#### SEC-09: Store DELETE Missing `canManageStore` Check — FIXED

**File changed:** `app/api/stores/[storeId]/route.ts`

**Changes:**
- Added `canManageStore(context, storeId)` check in DELETE handler after `withApiAuth`
- Returns 403 "You do not have permission to delete this store" if check fails

---

#### SEC-10: CSV Import Missing File Size and Type Validation — FIXED

**File changed:** `app/api/stores/[storeId]/inventory/import/route.ts`

**Changes (included in SEC-02 rewrite):**
- File size limit: 5MB max
- MIME type validation: only accepts `text/csv`, `application/vnd.ms-excel`, and `.csv` extension fallback
- Returns 400 with descriptive error for violations

---

#### SEC-11: Audit Logs Return Raw Details With No Redaction — FIXED

**File changed:** `app/api/audit-logs/route.ts`

**Changes:**
- Replaced `select('*')` with explicit column list: `id, user_id, store_id, action, action_category, resource_type, resource_id, details, user_name, created_at`
- Added redaction of sensitive fields (`ip_address`, `user_agent`, `ip`, `email`, `user_email`) from `details` JSON for non-Owner users

---

#### SEC-12: Subscription GET Returns Full Stripe Internal IDs — FIXED

**Files changed:**
- `app/api/billing/subscriptions/route.ts` — Replaced `select('*')` with explicit columns excluding Stripe IDs
- `app/api/billing/subscriptions/[subscriptionId]/route.ts` — Same treatment for GET (with store join) and PATCH (internal fetch + response)

**Columns returned:** `id, store_id, billing_user_id, status, plan_id, trial_start, trial_end, current_period_start, current_period_end, cancel_at_period_end, currency, created_at, updated_at`

**Columns excluded from response:** `stripe_subscription_id`, `stripe_customer_id`, `stripe_payment_method_id`

---

#### SEC-13: Logger Has No Automatic Sensitive Data Sanitization — FIXED

**File changed:** `lib/logger.ts` (rewritten)

**Changes:**
- Added `SENSITIVE_KEYS` regex matching: `password`, `token`, `secret`, `credential`, `api_key`, `authorization`, `cookie`, `session`, `private_key`, `access_key`, `refresh`
- Added `sanitizeValue()` that recursively redacts sensitive keys to `[REDACTED]`, truncates strings >500 chars, normalizes Error objects to `{message, name}`
- Applied sanitization to `normalizeContext()` used by all log methods

---

#### SEC-14: Unsanitized Search Input in Supplier Search — FIXED

**File changed:** `app/api/stores/[storeId]/suppliers/route.ts`

**Changes:**
- Added `sanitizeSearchQuery` import
- Applied `sanitizeSearchQuery()` to search parameter before `.ilike()` query
- Wildcards `%` and `_` are now properly escaped

---

#### SEC-15: Signup Auto-Confirms Email Without Verification — FIXED

**File changed:** `app/api/auth/signup/route.ts`

**Changes:**
- Changed `email_confirm: true` to `email_confirm: false`
- Supabase will now send a verification email before activating the account

---

#### SEC-16: Rate Limiting Applied After Authentication — FIXED

**File changed:** `lib/api/middleware.ts`

**Changes:**
- Added IP-based rate limiting (200/min) BEFORE the `getUser()` call
- Unauthenticated flood attacks are now blocked before consuming Supabase Auth API quota
- Uses `x-real-ip` → `x-forwarded-for` → `'anonymous'` IP extraction chain

---

### LOW

#### SEC-17: Webhook Endpoints Missing Rate Limiting — FIXED

**Files changed:**
- `app/api/billing/webhook/route.ts` — Added IP-based rate limiting (1000/min)
- `app/api/pos/webhook/[connectionId]/route.ts` — Added IP-based rate limiting (1000/min)

Both endpoints now rate-limit before any database lookups or signature verification.

---

#### SEC-18: Inventory Template Route Bypasses `withApiAuth` — FIXED

**File changed:** `app/api/stores/[storeId]/inventory/template/route.ts` (rewritten)

**Changes:**
- Replaced `getSession()` with `withApiAuth` + `canAccessStore`
- Added rate limiting
- Read-only GET, no CSRF needed

---

#### SEC-19: Missing Max Length on Validation Schema String Fields — FIXED

**Files changed (8 validation files):**
- `lib/validations/inventory.ts`
- `lib/validations/store.ts`
- `lib/validations/user.ts`
- `lib/validations/shift.ts`
- `lib/validations/recipes.ts`
- `lib/validations/bulk-import.ts`
- `lib/validations/haccp.ts`
- `lib/validations/payroll.ts`

**Changes:** Added `.max()` constraints to all string fields: names (255), notes/descriptions (1000-2000), passwords (200), emails (320).

---

#### SEC-20: Invoice Upload File Extension From User Filename — FIXED

**File changed:** `app/api/stores/[storeId]/invoices/route.ts`

**Changes:**
- Added `MIME_TO_EXT` mapping: `jpeg→jpg`, `png→png`, `webp→webp`, `pdf→pdf`
- File extension is now derived from the validated MIME type, not the user-provided filename
- Falls back to `jpg` for unrecognized types

---

#### SEC-21: `requireRoleAtStore` Silently Skips — FIXED (Removed)

**File changed:** `lib/api/middleware.ts`

**Changes:**
- Removed the unused `requireRoleAtStore` option and its code block entirely
- Eliminates the latent trap for future developers

---

#### SEC-22: Onboard Endpoint Lacks Rate Limiting — FIXED

**File changed:** `app/api/users/onboard/route.ts`

**Changes:**
- Added IP-based rate limiting using `RATE_LIMITS.auth` (10/min)

---

#### SEC-23: Stripe Webhook Secret Empty Fallback — FIXED

**File changed:** `app/api/billing/webhook/route.ts`

**Changes:**
- Added explicit check for `STRIPE_WEBHOOK_SECRET` env var
- Returns 500 "Webhook not configured" if missing, before attempting signature verification
- Provides clear operational error instead of a cryptic Stripe SDK failure

---

## Post-Remediation Sweep Findings (Additional Fixes)

After completing all 23 fixes, a comprehensive codebase sweep identified and resolved 3 additional `select('*')` over-exposure issues:

| File | Table | Fix |
|------|-------|-----|
| `app/api/billing/subscriptions/[subscriptionId]/route.ts` (GET) | `subscriptions` | Explicit columns excluding Stripe IDs |
| `app/api/billing/subscriptions/[subscriptionId]/route.ts` (PATCH, 2 queries) | `subscriptions` | Explicit columns for internal use + response |
| `app/api/stores/[storeId]/accounting/sync/route.ts` | `accounting_connections` | Explicit columns: `id, provider, credentials, config, sync_status` |
| `app/api/stores/[storeId]/accounting/accounts/route.ts` | `accounting_connections` | Explicit columns: `id, provider, credentials, config` |

The sweep also confirmed:
- Zero remaining `getSession()` calls in `app/api/`
- All `.ilike()` calls properly sanitized or using Zod-validated values
- No string interpolation injection risks in Supabase queries (all template literals use server-side values from auth context)
- Remaining `select('*')` calls are on non-sensitive tables (inventory items, HACCP data, shifts, suppliers) scoped by store RLS

---

## Test Impact

| Metric | Before | After |
|--------|--------|-------|
| Total tests | 1897 | 1898 |
| Passing | 1897 | 1898 |
| Failing | 0 | 0 |
| Files | 95 | 95 |

Tests updated to match new security behavior:
- `tests/lib/validations/auth.test.ts` — Rewritten for new password policy (8+ chars with complexity)
- `tests/integration/api/pos.test.ts` — Updated for mandatory webhook signature verification
- `tests/integration/api/pos-expansion.test.ts` — Updated for mandatory webhook signature verification and SEC-04 rejection behavior

---

## Manual Actions Required

1. **Rotate compromised secrets** (SEC-01):
   - Resend API key (`re_HSjf...`) — rotate in [Resend dashboard](https://resend.com)
   - Stripe webhook secret (`whsec_Fy95...`) — rotate in [Stripe dashboard](https://dashboard.stripe.com/webhooks)

2. **Scrub git history** (SEC-01):
   ```bash
   # Using BFG Repo Cleaner:
   bfg --replace-text passwords.txt repo.git
   # Or git filter-repo:
   git filter-repo --blob-callback '...'
   ```

3. **Configure pre-commit hooks**:
   ```bash
   # Install gitleaks
   brew install gitleaks
   # Add to pre-commit config or CI pipeline
   gitleaks detect --source . --config .gitleaks.toml
   ```

---

## Files Modified (Complete List)

| File | SEC IDs |
|------|---------|
| `docs/PRIORITY_14_IMPLEMENTATION_COMPLETE.md` | SEC-01 |
| `docs/PRIORITY_12_IMPLEMENTATION_COMPLETE.md` | SEC-01 |
| `docs/audits/security-audit.md` | SEC-01 |
| `.gitleaks.toml` (new) | SEC-01 |
| `app/api/stores/[storeId]/inventory/import/route.ts` | SEC-02, SEC-03, SEC-10 |
| `app/api/stores/[storeId]/inventory/template/route.ts` | SEC-03, SEC-18 |
| `app/api/pos/webhook/[connectionId]/route.ts` | SEC-04, SEC-17 |
| `app/api/auth/signup/route.ts` | SEC-05, SEC-15 |
| `lib/email.ts` | SEC-06 |
| `lib/services/accounting/quickbooks.ts` | SEC-07 |
| `lib/validations/auth.ts` | SEC-08 |
| `app/api/stores/[storeId]/route.ts` | SEC-09 |
| `app/api/audit-logs/route.ts` | SEC-11 |
| `app/api/billing/subscriptions/route.ts` | SEC-12 |
| `app/api/billing/subscriptions/[subscriptionId]/route.ts` | SEC-12 (sweep) |
| `lib/logger.ts` | SEC-13 |
| `app/api/stores/[storeId]/suppliers/route.ts` | SEC-14 |
| `lib/api/middleware.ts` | SEC-16, SEC-21 |
| `app/api/billing/webhook/route.ts` | SEC-17, SEC-23 |
| `lib/validations/inventory.ts` | SEC-19 |
| `lib/validations/store.ts` | SEC-19 |
| `lib/validations/user.ts` | SEC-19 |
| `lib/validations/shift.ts` | SEC-19 |
| `lib/validations/recipes.ts` | SEC-19 |
| `lib/validations/bulk-import.ts` | SEC-19 |
| `lib/validations/haccp.ts` | SEC-19 |
| `lib/validations/payroll.ts` | SEC-19 |
| `app/api/stores/[storeId]/invoices/route.ts` | SEC-20 |
| `app/api/users/onboard/route.ts` | SEC-22 |
| `app/api/stores/[storeId]/accounting/sync/route.ts` | Sweep |
| `app/api/stores/[storeId]/accounting/accounts/route.ts` | Sweep |
| `tests/lib/validations/auth.test.ts` | Test updates |
| `tests/integration/api/pos.test.ts` | Test updates |
| `tests/integration/api/pos-expansion.test.ts` | Test updates |
