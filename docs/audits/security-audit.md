# Security Audit Report — Pre-Launch Penetration Test Review

**Date:** 2026-02-26
**Scope:** Full codebase review — authentication, authorization, input validation, data exposure, API security, dependencies, configuration
**Application:** Multi-tenant restaurant inventory management SaaS

---

## Executive Summary

| Severity | Count |
|----------|-------|
| **CRITICAL** | 1 |
| **HIGH** | 6 |
| **MEDIUM** | 9 |
| **LOW** | 7 |
| **Total actionable** | **23** |

The application has strong fundamentals — Zod validation on all inputs, RLS on all tables, CSRF protection, rate limiting, and proper webhook signature verification. However, the audit uncovered **1 critical secret exposure**, **6 high-severity issues** including auth bypass on the CSV import route and email enumeration on signup, and several medium-severity gaps. All critical and high issues should be fixed before launch.

---

## CRITICAL

### SEC-01: Hardcoded Production Secrets in Committed Documentation

**SEVERITY:** CRITICAL
**LOCATION:**
- `docs/PRIORITY_14_IMPLEMENTATION_COMPLETE.md:286,294`
- `docs/PRIORITY_12_IMPLEMENTATION_COMPLETE.md:244,252`

**DESCRIPTION:** Two docs files contain real production API keys committed to the repository:
```
RESEND_API_KEY=re_xxxx_REDACTED
STRIPE_WEBHOOK_SECRET=whsec_xxxx_REDACTED
```

**EXPLOIT SCENARIO:** Anyone with repo access (team members, past contributors, or if the repo becomes public) can use the Resend key to send emails impersonating the app, and the Stripe webhook secret to forge billing webhook events — triggering fake subscription changes or payment confirmations.

**FIX:**
1. **Immediately rotate both secrets** in Resend dashboard and Stripe dashboard
2. Redact the values in both docs files (replace with `re_xxxx...` / `whsec_xxxx...`)
3. Scrub from git history using `git filter-repo` or BFG Repo Cleaner

**PREVENTION:** Add a pre-commit hook using `gitleaks` or `detect-secrets`. Add `*.md` to the secret scanning scope.

---

## HIGH

### SEC-02: Inventory Import Route Bypasses `withApiAuth`, CSRF, and Rate Limiting

**SEVERITY:** HIGH
**LOCATION:** `app/api/stores/[storeId]/inventory/import/route.ts:70-85`

**DESCRIPTION:** The POST handler for CSV inventory import performs its own ad-hoc authentication using `getSession()` instead of the standard `withApiAuth` middleware. This means:
- No CSRF token validation — vulnerable to cross-site request forgery
- No rate limiting — can be called unlimited times
- `getSession()` does not verify the JWT server-side (see SEC-03)

**EXPLOIT SCENARIO:** A CSRF attack tricks an authenticated user into visiting a malicious page that submits a multipart form POST to `/api/stores/[storeId]/inventory/import`, importing attacker-controlled inventory data. The browser automatically includes the session cookie and the request succeeds because there is no CSRF validation.

**FIX:**
```typescript
// Replace the ad-hoc auth with:
const auth = await withApiAuth(request, {
  allowedRoles: ['Owner', 'Manager'],
  rateLimit: { key: 'api', config: RATE_LIMITS.api },
  requireCSRF: true,
})
if (!auth.success) return auth.response
const { context } = auth

if (!canManageStore(context, storeId)) {
  return apiForbidden('Access denied', context.requestId)
}
```

**PREVENTION:** CI lint rule: every `export async function POST/PUT/PATCH/DELETE` in `app/api/` must call `withApiAuth` or have an explicit `// @security-exempt: <reason>` comment.

---

### SEC-03: `getSession()` Used Instead of `getUser()` — JWT Not Server-Validated

**SEVERITY:** HIGH
**LOCATION:**
- `app/api/stores/[storeId]/inventory/import/route.ts:79`
- `app/api/stores/[storeId]/inventory/template/route.ts:18`

**DESCRIPTION:** These two routes use `supabase.auth.getSession()` which reads the JWT from cookies and decodes it **without** making a server-side verification call. Per Supabase's security docs, a tampered or expired JWT could pass this check. Every other API route uses `withApiAuth` which calls `getUser()` (server-verified).

**EXPLOIT SCENARIO:** A user whose account has been deactivated or session revoked can still import inventory data or download templates using a cached/expired JWT.

**FIX:** Refactor both routes to use `withApiAuth` (which fixes SEC-02 and SEC-03 simultaneously). At minimum, replace `getSession()` with `getUser()`.

**PREVENTION:** Add a grep check in CI: `getSession()` should never appear in `app/api/` files.

---

### SEC-04: POS Webhook Signature Verification Is Optional

**SEVERITY:** HIGH
**LOCATION:** `app/api/pos/webhook/[connectionId]/route.ts:73-84`

**DESCRIPTION:** The POS webhook only verifies the signature if `webhookSecret` is non-empty. If a POS connection has no `webhook_secret` configured, the webhook is processed without any authentication.

```typescript
if (webhookSecret) {  // If empty, entire signature check is SKIPPED
  // ... signature verification ...
}
```

**EXPLOIT SCENARIO:** An attacker discovers a valid `connectionId` (UUID). If that connection has no webhook secret, the attacker POSTs fabricated sale events to `/api/pos/webhook/[connectionId]`, causing phantom stock deductions and corrupting inventory data.

**FIX:**
```typescript
if (!webhookSecret) {
  return NextResponse.json(
    { success: false, error: 'Webhook secret not configured' },
    { status: 403 }
  )
}
```

**PREVENTION:** Make `webhook_secret` a required field when creating POS connections. Add a NOT NULL constraint on the credentials column or validate at the API level.

---

### SEC-05: Signup Endpoint Enables Email Enumeration

**SEVERITY:** HIGH
**LOCATION:** `app/api/auth/signup/route.ts:83-91`

**DESCRIPTION:** The signup route returns HTTP 409 with "An account with this email already exists" for registered emails, and a different response for new emails. This allows attackers to enumerate which email addresses have accounts.

**EXPLOIT SCENARIO:** An attacker scripts requests to `/api/auth/signup` with a list of email addresses. Any 409 response confirms the email has an account. At 10 req/min rate limit, an attacker can enumerate 600 emails/hour per IP. The confirmed emails can be used for targeted phishing or credential stuffing.

**FIX:** Return a generic response regardless of whether the email exists:
```typescript
// Always return the same response
return apiSuccess({
  message: 'If this email is available, a confirmation email has been sent.',
}, { status: 200 })
```

**PREVENTION:** Auth endpoints should never reveal whether a specific email is registered.

---

### SEC-06: HTML Injection in Email Templates

**SEVERITY:** HIGH
**LOCATION:** `lib/email.ts:264,296`

**DESCRIPTION:** User-controlled strings (`storeName`, `inviterName`) are interpolated directly into HTML email templates without encoding:

```typescript
const storeInfo = storeName ? ` at <strong>${storeName}</strong>` : ''
// ...
<strong>${inviterName}</strong> has invited you to join...
```

**EXPLOIT SCENARIO:** An attacker creates a store named `<a href="https://evil.com/phishing">Click here to verify your account</a>`. When invitation emails are sent, the recipient sees a convincing phishing link embedded in the legitimate email. More sophisticated payloads could inject full HTML blocks that mimic the app's UI.

**FIX:** Create and apply an `escapeHtml()` function:
```typescript
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

const storeInfo = storeName ? ` at <strong>${escapeHtml(storeName)}</strong>` : ''
```

Apply to every user-provided value in `getInviteEmailHtml`, `getWelcomeEmailHtml`, `getPaymentFailedEmailHtml`, and any other email templates.

**PREVENTION:** Use a templating library with auto-escaping, or create a linted helper that enforces escaping for all HTML template interpolation.

---

### SEC-07: QuickBooks Query String Injection

**SEVERITY:** HIGH
**LOCATION:** `lib/services/accounting/quickbooks.ts:184`

**DESCRIPTION:** A QuickBooks query is constructed via string interpolation with incorrect escaping:

```typescript
const query = encodeURIComponent(
  `SELECT * FROM Vendor WHERE DisplayName = '${contact.name.replace(/'/g, "\\'")}'`
)
```

The backslash escape (`\\'`) is wrong for QuickBooks' query language, which uses doubled single quotes (`''`).

**EXPLOIT SCENARIO:** A supplier named `Test' OR DisplayName LIKE '%` would break out of the string literal and return unintended vendor records from the connected QuickBooks account. This could leak financial data from the accounting system.

**FIX:**
```typescript
const safeName = contact.name.replace(/'/g, "''")
const query = encodeURIComponent(
  `SELECT * FROM Vendor WHERE DisplayName = '${safeName}'`
)
```

**PREVENTION:** Never use string concatenation for query construction. Document QuickBooks' escaping convention in a shared utility.

---

## MEDIUM

### SEC-08: Inconsistent Password Policies

**SEVERITY:** MEDIUM
**LOCATION:**
- `app/api/auth/signup/route.ts:9-14` (strong: 8 chars + uppercase + lowercase + number)
- `lib/validations/auth.ts:5` (weak: 6 chars only)
- `lib/validations/auth.ts:13` (weak: 6 chars only for reset)

**DESCRIPTION:** Signup requires strong passwords (8+ chars with complexity). But `loginSchema`, `resetPasswordSchema`, and `acceptInviteSchema` only require 6 characters with no complexity. A user who signs up with a strong password can later reset it to "aaaaaa".

**FIX:** Create a single reusable password schema and apply everywhere:
```typescript
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a number')
```

---

### SEC-09: Store DELETE Missing `canManageStore` Check

**SEVERITY:** MEDIUM
**LOCATION:** `app/api/stores/[storeId]/route.ts:235-284`

**DESCRIPTION:** The DELETE handler uses `allowedRoles: ['Owner', 'Manager']` but never calls `canManageStore(context, storeId)` or `canAccessStore(context, storeId)`. This means a user who is an Owner at Store A could attempt to delete Store B. RLS on `context.supabase` mitigates actual damage (the delete query would silently affect 0 rows for a non-member store), but this is a defense-in-depth gap.

**FIX:** Add after line 247:
```typescript
if (!canManageStore(context, storeId)) {
  return apiForbidden('You do not have permission to delete this store', context.requestId)
}
```

---

### SEC-10: CSV Import Missing File Size and Type Validation

**SEVERITY:** MEDIUM
**LOCATION:** `app/api/stores/[storeId]/inventory/import/route.ts:102-114`

**DESCRIPTION:** The CSV import accepts any file without checking size or MIME type. `file.text()` reads the entire file into memory.

**EXPLOIT SCENARIO:** An authenticated user uploads a 2GB file, causing the serverless function to run out of memory and crash.

**FIX:**
```typescript
if (file.size > 5 * 1024 * 1024) {
  return apiBadRequest('File too large. Maximum size is 5MB.', context.requestId)
}
if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
  return apiBadRequest('Only CSV files are accepted.', context.requestId)
}
```

---

### SEC-11: Audit Logs Return Raw Details With No Redaction

**SEVERITY:** MEDIUM
**LOCATION:** `app/api/audit-logs/route.ts:69,183`

**DESCRIPTION:** Audit logs use `select('*')` and return raw `details` JSON containing IP addresses, user emails, user agents, and potentially payroll rates. While restricted to Owner/Manager, Managers could see data they shouldn't (e.g., other Managers' IP addresses).

**FIX:** Redact `ip_address` and `user_agent` for non-Owner roles. Consider filtering sensitive fields from `details` based on `action_category`.

---

### SEC-12: Subscription GET Returns Full Stripe Internal IDs

**SEVERITY:** MEDIUM
**LOCATION:** `app/api/billing/subscriptions/route.ts:170`

**DESCRIPTION:** Uses `select('*')` which returns `stripe_subscription_id`, `stripe_customer_id`, `stripe_payment_method_id` to the client. These are unnecessary for the frontend and represent information disclosure.

**FIX:** Replace `select('*')` with explicit columns: `select('id, store_id, status, trial_start, trial_end, current_period_start, current_period_end, cancel_at_period_end, currency, created_at')`.

---

### SEC-13: Logger Has No Automatic Sensitive Data Sanitization

**SEVERITY:** MEDIUM
**LOCATION:** `lib/logger.ts`

**DESCRIPTION:** The logger passes `{ error: error }` objects verbatim. Database connectivity errors could contain connection strings, query text, or internal PostgreSQL details, all visible in Vercel logs.

**FIX:** Add a sanitize function that redacts fields named `password`, `token`, `secret`, `credentials`, `api_key`, and truncates Error objects to `{ message, name }`.

---

### SEC-14: Unsanitized Search Input in Supplier Search

**SEVERITY:** MEDIUM
**LOCATION:** `app/api/stores/[storeId]/suppliers/route.ts:57`

**DESCRIPTION:** Supplier search passes raw user input to PostgREST `ilike`:
```typescript
query = query.ilike('name', `%${search}%`)
```
Unlike inventory and store routes which use `sanitizeSearchQuery()`, supplier search does not sanitize the `%` and `_` LIKE wildcards.

**FIX:** Apply `sanitizeSearchQuery()`:
```typescript
const sanitizedSearch = sanitizeSearchQuery(search)
if (sanitizedSearch) {
  query = query.ilike('name', `%${sanitizedSearch}%`)
}
```

---

### SEC-15: Signup Auto-Confirms Email Without Verification

**SEVERITY:** MEDIUM
**LOCATION:** `app/api/auth/signup/route.ts:98`

**DESCRIPTION:** `email_confirm: true` means accounts are instantly active without verifying email ownership. Attackers can create accounts with emails they don't own.

**FIX:** Set `email_confirm: false` and implement email verification, or add a verified email confirmation step post-signup.

---

### SEC-16: Rate Limiting Applied After Authentication

**SEVERITY:** MEDIUM
**LOCATION:** `lib/api/middleware.ts:121`

**DESCRIPTION:** In `withApiAuth`, rate limiting runs after `getUser()` (line 100). Unauthenticated requests are rejected at line 103 but not rate-limited, meaning every invalid request still incurs a Supabase `getUser()` API call.

**EXPLOIT SCENARIO:** An attacker sends millions of requests with random auth tokens, exhausting Supabase Auth API quotas without being rate-limited.

**FIX:** Add IP-based rate limiting in the Next.js middleware (before route handlers), or move rate limiting before the `getUser()` call for unauthenticated IP-based limiting.

---

## LOW

### SEC-17: Webhook Endpoints Missing Rate Limiting

**SEVERITY:** LOW
**LOCATION:** `app/api/billing/webhook/route.ts`, `app/api/pos/webhook/[connectionId]/route.ts`

**DESCRIPTION:** Neither webhook endpoint has rate limiting. Each request triggers a database lookup before signature verification. High-volume invalid requests could cause database load.

**FIX:** Add IP-based rate limiting (generous limits like 1000/min are fine since legitimate webhooks can be bursty).

---

### SEC-18: Inventory Template Route Bypasses `withApiAuth`

**SEVERITY:** LOW
**LOCATION:** `app/api/stores/[storeId]/inventory/template/route.ts:18`

**DESCRIPTION:** GET-only route using `getSession()` instead of `withApiAuth`. Lower risk than the import route since it's read-only and returns a static template, but still lacks rate limiting and proper JWT validation.

**FIX:** Refactor to use `withApiAuth` for consistency.

---

### SEC-19: Missing Max Length on Validation Schema String Fields

**SEVERITY:** LOW
**LOCATION:** `lib/validations/inventory.ts:6-8`, `lib/validations/auth.ts:5,23`, `lib/validations/haccp.ts:8-10`

**DESCRIPTION:** Several Zod schemas have `z.string().min(N)` without `.max()`. Fields like `name`, `notes`, `password`, and `description` accept unbounded strings.

**FIX:** Add `.max()` to all string fields: names (255), notes (1000), passwords (200), descriptions (500).

---

### SEC-20: Invoice Upload File Extension From User Filename

**SEVERITY:** LOW
**LOCATION:** `app/api/stores/[storeId]/invoices/route.ts:126`

**DESCRIPTION:** File extension is extracted from the user-provided filename rather than the validated MIME type. A user could upload a JPEG with filename `invoice.html`, and the file would be stored with an `.html` extension.

**FIX:** Derive extension from MIME type:
```typescript
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf'
}
const fileExt = MIME_TO_EXT[file.type] || 'jpg'
```

---

### SEC-21: `requireRoleAtStore` Silently Skips When storeId Not in Query Params

**SEVERITY:** LOW
**LOCATION:** `lib/api/middleware.ts:185-201`

**DESCRIPTION:** This middleware option only checks `store_id` from query parameters, not URL path segments. Currently unused but a latent trap — a developer could rely on it thinking it checks the URL path `storeId`.

**FIX:** Either remove the unused option or fix it to also parse URL path segments.

---

### SEC-22: Onboard Endpoint Lacks Rate Limiting

**SEVERITY:** LOW
**LOCATION:** `app/api/users/onboard/route.ts:10`

**DESCRIPTION:** The onboarding endpoint (public, no auth required) uses admin client but has no rate limiting. Invite tokens are 64-char hex (not brute-forceable), but rate limiting is defense-in-depth.

**FIX:** Add IP-based rate limiting with `RATE_LIMITS.auth`.

---

### SEC-23: Stripe Webhook Secret Empty Fallback

**SEVERITY:** LOW
**LOCATION:** `app/api/billing/webhook/route.ts:32`

**DESCRIPTION:** `process.env.STRIPE_WEBHOOK_SECRET || ''` — if the env var is missing, an empty string is passed to `constructEvent`. Stripe's SDK will reject it, but an explicit check is cleaner.

**FIX:**
```typescript
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
if (!webhookSecret) {
  return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
}
```

---

## Positive Findings (Things Done Well)

| Area | Assessment |
|------|-----------|
| **Supabase RLS** | All tables have RLS policies scoped by `store_id`. Helper functions use `LANGUAGE sql SECURITY DEFINER` (correct). |
| **CSRF Protection** | Double-submit cookie pattern properly enforced on all state-changing routes (except SEC-02). |
| **API Key Security** | Keys are SHA-256 hashed before storage. Scope checking is granular and correct. Cross-store isolation enforced. |
| **Stripe Webhook** | Signature verified with raw body before processing. Event deduplication prevents replays. |
| **Error Sanitization** | `sanitizeApiErrorMessage()` strips stack traces, file paths, connection strings, and sensitive keywords. |
| **Client-Side Exposure** | Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are client-exposed (both are designed to be public). |
| **POS Credential Protection** | POS credentials are never returned in API responses. Only selected safe fields are exposed. |
| **Login Endpoint** | Returns generic "Invalid email or password" — no email enumeration possible on login. |
| **Input Validation** | Zod schemas on all API routes. `sanitizeSearchQuery()`, `sanitizeNotes()`, `sanitizeString()` applied consistently (with noted exceptions). |
| **Webhook Signature Timing** | All POS webhook validators use `crypto.timingSafeEqual()` — no timing oracle attacks. |
| **No Command Injection** | Zero instances of `exec()`, `spawn()`, `eval()`, or `new Function()` in application code. |
| **No Path Traversal** | No filesystem access — all file storage through Supabase Storage with server-generated paths. |
| **No SQL Injection (PostgREST)** | All Supabase queries use parameterized PostgREST filters. No raw SQL in application code. |
| **CORS** | No custom CORS headers — correct default for same-origin SaaS. Cross-origin requests blocked by browsers. |
| **Security Headers** | X-Frame-Options DENY, HSTS, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy all correctly set. |

---

## Remediation Priority

### Fix Before Launch (Critical + High)

| # | Finding | Effort |
|---|---------|--------|
| SEC-01 | Rotate secrets + scrub git history | 30 min |
| SEC-02 | Refactor import route to use `withApiAuth` | 15 min |
| SEC-03 | Fixed by SEC-02 | — |
| SEC-04 | Reject unsigned POS webhooks | 5 min |
| SEC-05 | Generic signup response | 10 min |
| SEC-06 | Add `escapeHtml()` to email templates | 20 min |
| SEC-07 | Fix QuickBooks query escaping | 5 min |

### Fix This Sprint (Medium)

| # | Finding | Effort |
|---|---------|--------|
| SEC-08 | Unified password schema | 15 min |
| SEC-09 | Add `canManageStore` to store DELETE | 5 min |
| SEC-10 | File size/type validation on CSV import | 10 min |
| SEC-11 | Audit log response sanitization | 30 min |
| SEC-12 | Explicit column select on subscriptions | 10 min |
| SEC-13 | Logger sanitization function | 30 min |
| SEC-14 | Sanitize supplier search | 5 min |
| SEC-15 | Email verification on signup | 1-2 hours |
| SEC-16 | Pre-auth rate limiting | 30 min |

### Fix When Convenient (Low)

| # | Finding | Effort |
|---|---------|--------|
| SEC-17 | Webhook rate limiting | 15 min |
| SEC-18 | Template route to `withApiAuth` | 10 min |
| SEC-19 | Max length on all Zod string fields | 30 min |
| SEC-20 | MIME-based file extensions | 10 min |
| SEC-21 | Remove/fix `requireRoleAtStore` | 10 min |
| SEC-22 | Onboard rate limiting | 10 min |
| SEC-23 | Explicit webhook secret check | 5 min |
