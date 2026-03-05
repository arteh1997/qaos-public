# AUDIT.md — Full Codebase Audit

Generated 2026-03-01.

---

## 1. Tech Stack

| Layer                   | Technology                           | Version           |
| ----------------------- | ------------------------------------ | ----------------- |
| **Language**            | TypeScript                           | ^5                |
| **Runtime**             | Node.js                              | >=20.9.0          |
| **Framework**           | Next.js (App Router)                 | ^16.1.6           |
| **UI Library**          | React                                | 19.2.3            |
| **Styling**             | Tailwind CSS                         | ^4                |
| **Component Library**   | Radix UI (via shadcn/ui)             | various           |
| **Icons**               | Lucide React                         | ^0.562.0          |
| **State Management**    | TanStack React Query                 | ^5.90.20          |
| **Forms**               | React Hook Form                      | ^7.71.1           |
| **Validation**          | Zod                                  | ^4.3.5            |
| **Database**            | PostgreSQL (Supabase)                | —                 |
| **Auth**                | Supabase Auth (email + Google OAuth) | —                 |
| **ORM / Client**        | @supabase/supabase-js                | ^2.90.1           |
| **SSR Auth**            | @supabase/ssr                        | ^0.8.0            |
| **Payments**            | Stripe                               | ^17.5.0           |
| **Stripe React**        | @stripe/react-stripe-js              | ^3.1.1            |
| **Stripe JS**           | @stripe/stripe-js                    | ^5.5.0            |
| **Email**               | Resend                               | ^4.0.0            |
| **Rate Limiting**       | @upstash/redis                       | ^1.36.2           |
| **Error Tracking**      | @sentry/nextjs                       | ^10.40.0          |
| **Analytics**           | @vercel/analytics                    | ^1.6.1            |
| **Speed Insights**      | @vercel/speed-insights               | ^1.3.1            |
| **Charts**              | Recharts                             | ^3.7.0            |
| **Date Utils**          | date-fns                             | ^4.1.0            |
| **Date Picker**         | react-day-picker                     | ^9.13.0           |
| **Barcode Scanner**     | html5-qrcode                         | ^2.3.8            |
| **Excel Export**        | xlsx                                 | ^0.18.5           |
| **Toasts**              | Sonner                               | ^2.0.7            |
| **Dark Mode**           | next-themes                          | ^0.4.6            |
| **Offline / IndexedDB** | Dexie                                | ^4.3.0            |
| **CSS Utility Merge**   | tailwind-merge                       | ^3.4.0            |
| **Class Variants**      | class-variance-authority             | ^0.7.1            |
| **Class Names**         | clsx                                 | ^2.1.1            |
| **Animations**          | tw-animate-css                       | ^1.4.0            |
| **Hosting**             | Vercel                               | —                 |
| **CI/CD**               | GitHub Actions                       | —                 |
| **Test Runner**         | Vitest                               | ^2.1.0            |
| **Test UI**             | @vitest/ui                           | ^2.1.0            |
| **Coverage**            | @vitest/coverage-v8                  | ^2.1.0            |
| **DOM Testing**         | @testing-library/react + jsdom       | ^16.0.0 / ^25.0.0 |
| **Linting**             | ESLint (next config)                 | ^9                |
| **PostCSS**             | @tailwindcss/postcss                 | ^4                |

---

## 2. File Tree

Every file and directory outside `node_modules`, `.next`, `.git`.

```
.
├── .github/
│   └── workflows/
│       └── ci.yml                              # GitHub Actions: lint → typecheck → test → build
├── .gitignore                                   # Standard Next.js + Node ignores
├── .gitleaks.toml                               # Secret scanning rules
├── .interface-design/
│   └── system.md                                # Design system tokens & patterns
├── .nvmrc                                       # Node version pinning
├── ARCHITECTURE_CHANGES.md                      # Architectural change log
├── CLAUDE.md                                    # AI assistant instructions
├── CONTRIBUTING.md                              # Contributor guidelines
├── MIGRATION_GUIDE.md                           # Database migration guide
├── PLAN.md                                      # Project plan
├── README.md                                    # Project readme
├── app/
│   ├── (dashboard)/                             # Protected dashboard route group
│   │   ├── activity/
│   │   │   ├── loading.tsx                      # Skeleton loader for activity page
│   │   │   └── page.tsx                         # Audit log / activity feed
│   │   ├── billing/
│   │   │   ├── loading.tsx                      # Skeleton loader for billing
│   │   │   ├── page.tsx                         # Billing overview (plans, payment methods)
│   │   │   └── subscribe/
│   │   │       └── [storeId]/
│   │   │           └── page.tsx                 # Stripe checkout for a specific store
│   │   ├── categories/
│   │   │   ├── loading.tsx                      # Skeleton loader
│   │   │   └── page.tsx                         # Category management
│   │   ├── dashboard/
│   │   │   └── page.tsx                         # Alternate dashboard entry point
│   │   ├── deliveries/
│   │   │   └── page.tsx                         # Stock reception / delivery tracking
│   │   ├── error.tsx                            # Dashboard error boundary
│   │   ├── haccp/
│   │   │   ├── checks/
│   │   │   │   └── page.tsx                     # HACCP daily checks
│   │   │   ├── corrective-actions/
│   │   │   │   └── page.tsx                     # HACCP corrective actions log
│   │   │   ├── loading.tsx                      # Skeleton loader
│   │   │   ├── page.tsx                         # HACCP dashboard overview
│   │   │   ├── temperatures/
│   │   │   │   └── page.tsx                     # Temperature monitoring logs
│   │   │   └── templates/
│   │   │       └── page.tsx                     # HACCP checklist template management
│   │   ├── integrations/
│   │   │   ├── accounting/
│   │   │   │   └── page.tsx                     # Accounting software connections
│   │   │   ├── loading.tsx                      # Skeleton loader
│   │   │   ├── page.tsx                         # Integration hub (POS + accounting)
│   │   │   ├── quickbooks/
│   │   │   │   └── page.tsx                     # QuickBooks OAuth setup
│   │   │   └── xero/
│   │   │       └── page.tsx                     # Xero OAuth setup
│   │   ├── inventory/
│   │   │   ├── loading.tsx                      # Skeleton loader
│   │   │   └── page.tsx                         # Main inventory list (inline edit, CSV import)
│   │   ├── inventory-value/
│   │   │   └── page.tsx                         # Inventory valuation report
│   │   ├── invoices/
│   │   │   ├── [invoiceId]/
│   │   │   │   └── page.tsx                     # Invoice detail with OCR line items
│   │   │   └── page.tsx                         # Invoice list
│   │   ├── layout.tsx                           # Dashboard shell (navbar + sidebar)
│   │   ├── loading.tsx                          # Dashboard-level skeleton
│   │   ├── low-stock/
│   │   │   └── page.tsx                         # Items below PAR level
│   │   ├── my-pay/
│   │   │   └── page.tsx                         # Staff: view own pay stubs
│   │   ├── my-shifts/
│   │   │   └── page.tsx                         # Staff: view own shift schedule
│   │   ├── payroll/
│   │   │   └── page.tsx                         # Payroll management (pay runs)
│   │   ├── profile/
│   │   │   ├── loading.tsx                      # Skeleton loader
│   │   │   └── page.tsx                         # User profile settings
│   │   ├── recipes/
│   │   │   ├── loading.tsx                      # Skeleton loader
│   │   │   └── page.tsx                         # Recipe builder & food costing
│   │   ├── reports/
│   │   │   ├── benchmark/
│   │   │   │   └── page.tsx                     # Store performance benchmarking
│   │   │   ├── daily-summary/
│   │   │   │   └── page.tsx                     # Daily operational summary
│   │   │   ├── food-cost/
│   │   │   │   └── page.tsx                     # Food cost analysis
│   │   │   ├── forecast/
│   │   │   │   └── page.tsx                     # Demand forecasting
│   │   │   ├── loading.tsx                      # Skeleton loader
│   │   │   ├── low-stock/
│   │   │   │   └── page.tsx                     # Low stock report
│   │   │   └── page.tsx                         # Reports hub
│   │   ├── settings/
│   │   │   ├── loading.tsx                      # Skeleton loader
│   │   │   └── page.tsx                         # Store settings (webhooks, API keys)
│   │   ├── shifts/
│   │   │   ├── loading.tsx                      # Skeleton loader
│   │   │   ├── page.tsx                         # Shift management
│   │   │   └── timetable/
│   │   │       └── page.tsx                     # Weekly timetable view
│   │   ├── stock-count/
│   │   │   └── page.tsx                         # Stock count submission
│   │   ├── stores/
│   │   │   ├── [storeId]/
│   │   │   │   ├── categories/
│   │   │   │   │   └── page.tsx                 # Store-scoped category management
│   │   │   │   ├── layout.tsx                   # Store page wrapper (scopes to store)
│   │   │   │   ├── pos/
│   │   │   │   │   └── page.tsx                 # POS connection for this store
│   │   │   │   ├── stock/
│   │   │   │   │   └── page.tsx                 # Store-specific stock view
│   │   │   │   ├── stock-reception/
│   │   │   │   │   └── page.tsx                 # Store-specific delivery reception
│   │   │   │   ├── subscription-expired/
│   │   │   │   │   └── page.tsx                 # Subscription lapsed warning
│   │   │   │   ├── tags/
│   │   │   │   │   └── page.tsx                 # Store-scoped tag management
│   │   │   │   └── users/
│   │   │   │       └── page.tsx                 # Store-scoped user management
│   │   │   └── new/
│   │   │       └── page.tsx                     # Create new store
│   │   ├── suppliers/
│   │   │   ├── loading.tsx                      # Skeleton loader
│   │   │   └── page.tsx                         # Supplier management
│   │   ├── tags/
│   │   │   ├── loading.tsx                      # Skeleton loader
│   │   │   └── page.tsx                         # Tag management
│   │   ├── users/
│   │   │   ├── loading.tsx                      # Skeleton loader
│   │   │   └── page.tsx                         # User management
│   │   └── waste/
│   │       ├── loading.tsx                      # Skeleton loader
│   │       └── page.tsx                         # Waste tracking & logging
│   ├── (legal)/
│   │   ├── cookies/
│   │   │   └── page.tsx                         # Cookie policy
│   │   ├── layout.tsx                           # Legal pages layout
│   │   ├── privacy/
│   │   │   └── page.tsx                         # Privacy policy
│   │   └── terms/
│   │       └── page.tsx                         # Terms of service
│   ├── (marketing)/
│   │   ├── layout.tsx                           # Marketing pages layout
│   │   └── pricing/
│   │       └── page.tsx                         # Pricing page
│   ├── (onboarding)/
│   │   ├── layout.tsx                           # Onboarding layout
│   │   └── onboarding/
│   │       └── page.tsx                         # Multi-step store setup wizard
│   ├── (public)/
│   │   ├── accept-invite/
│   │   │   └── page.tsx                         # Accept store invite via token
│   │   ├── forgot-password/
│   │   │   └── page.tsx                         # Password reset request
│   │   ├── login/
│   │   │   └── page.tsx                         # Login (email + Google OAuth)
│   │   ├── onboard/
│   │   │   └── page.tsx                         # Initial user onboarding
│   │   └── reset-password/
│   │       └── page.tsx                         # Set new password
│   ├── (supplier-portal)/
│   │   ├── layout.tsx                           # Supplier portal layout
│   │   └── portal/
│   │       ├── catalog/
│   │       │   └── page.tsx                     # Supplier: browse catalog
│   │       ├── invoices/
│   │       │   └── page.tsx                     # Supplier: invoice history
│   │       ├── orders/
│   │       │   ├── [poId]/
│   │       │   │   └── page.tsx                 # Supplier: PO detail
│   │       │   └── page.tsx                     # Supplier: PO list
│   │       └── page.tsx                         # Supplier portal home
│   ├── api/                                     # — API routes documented in Section 4 —
│   │   ├── alerts/missing-counts/route.ts
│   │   ├── audit-logs/route.ts
│   │   ├── auth/callback/route.ts
│   │   ├── auth/login/route.ts
│   │   ├── auth/signup/route.ts
│   │   ├── billing/invoices/route.ts
│   │   ├── billing/payment-methods/[pmId]/route.ts
│   │   ├── billing/payment-methods/route.ts
│   │   ├── billing/setup-intent/route.ts
│   │   ├── billing/subscriptions/[subscriptionId]/route.ts
│   │   ├── billing/subscriptions/route.ts
│   │   ├── billing/webhook/route.ts
│   │   ├── cron/archive-data/route.ts
│   │   ├── cron/send-alerts/route.ts
│   │   ├── csrf/route.ts
│   │   ├── health/route.ts
│   │   ├── integrations/pos/[provider]/auth/route.ts
│   │   ├── integrations/pos/[provider]/callback/route.ts
│   │   ├── integrations/quickbooks/auth/route.ts
│   │   ├── integrations/quickbooks/callback/route.ts
│   │   ├── integrations/quickbooks/disconnect/route.ts
│   │   ├── integrations/xero/auth/route.ts
│   │   ├── integrations/xero/callback/route.ts
│   │   ├── integrations/xero/disconnect/route.ts
│   │   ├── inventory/[itemId]/route.ts
│   │   ├── inventory/route.ts
│   │   ├── pos/webhook/[connectionId]/route.ts
│   │   ├── reports/analytics/route.ts
│   │   ├── reports/benchmark/route.ts
│   │   ├── reports/daily-summary/route.ts
│   │   ├── reports/forecast/route.ts
│   │   ├── reports/low-stock/route.ts
│   │   ├── shifts/[shiftId]/clock-in/route.ts
│   │   ├── shifts/[shiftId]/clock-out/route.ts
│   │   ├── shifts/[shiftId]/route.ts
│   │   ├── shifts/route.ts
│   │   ├── stores/[storeId]/accounting/accounts/route.ts
│   │   ├── stores/[storeId]/accounting/config/route.ts
│   │   ├── stores/[storeId]/accounting/route.ts
│   │   ├── stores/[storeId]/accounting/sync/route.ts
│   │   ├── stores/[storeId]/alert-history/route.ts
│   │   ├── stores/[storeId]/alert-preferences/route.ts
│   │   ├── stores/[storeId]/api-keys/route.ts
│   │   ├── stores/[storeId]/billing-owner/route.ts
│   │   ├── stores/[storeId]/categories/[categoryId]/route.ts
│   │   ├── stores/[storeId]/categories/route.ts
│   │   ├── stores/[storeId]/export/route.ts
│   │   ├── stores/[storeId]/haccp/checks/route.ts
│   │   ├── stores/[storeId]/haccp/corrective-actions/[actionId]/route.ts
│   │   ├── stores/[storeId]/haccp/corrective-actions/route.ts
│   │   ├── stores/[storeId]/haccp/dashboard/route.ts
│   │   ├── stores/[storeId]/haccp/temperature-logs/route.ts
│   │   ├── stores/[storeId]/haccp/templates/[templateId]/route.ts
│   │   ├── stores/[storeId]/haccp/templates/route.ts
│   │   ├── stores/[storeId]/history/route.ts
│   │   ├── stores/[storeId]/inventory/[itemId]/route.ts
│   │   ├── stores/[storeId]/inventory/[itemId]/tags/route.ts
│   │   ├── stores/[storeId]/inventory/batch/route.ts
│   │   ├── stores/[storeId]/inventory/import/route.ts
│   │   ├── stores/[storeId]/inventory/route.ts
│   │   ├── stores/[storeId]/inventory/template/route.ts
│   │   ├── stores/[storeId]/invoices/[invoiceId]/apply/route.ts
│   │   ├── stores/[storeId]/invoices/[invoiceId]/route.ts
│   │   ├── stores/[storeId]/invoices/route.ts
│   │   ├── stores/[storeId]/menu-analysis/route.ts
│   │   ├── stores/[storeId]/menu-items/[menuItemId]/route.ts
│   │   ├── stores/[storeId]/menu-items/route.ts
│   │   ├── stores/[storeId]/notification-preferences/route.ts
│   │   ├── stores/[storeId]/payroll/earnings/route.ts
│   │   ├── stores/[storeId]/payroll/pay-runs/[payRunId]/route.ts
│   │   ├── stores/[storeId]/payroll/pay-runs/route.ts
│   │   ├── stores/[storeId]/payroll/rates/[userId]/route.ts
│   │   ├── stores/[storeId]/payroll/rates/route.ts
│   │   ├── stores/[storeId]/pos/events/route.ts
│   │   ├── stores/[storeId]/pos/mappings/route.ts
│   │   ├── stores/[storeId]/pos/menu-items/route.ts
│   │   ├── stores/[storeId]/pos/route.ts
│   │   ├── stores/[storeId]/purchase-orders/[poId]/receive/route.ts
│   │   ├── stores/[storeId]/purchase-orders/[poId]/route.ts
│   │   ├── stores/[storeId]/purchase-orders/route.ts
│   │   ├── stores/[storeId]/recipes/[recipeId]/ingredients/route.ts
│   │   ├── stores/[storeId]/recipes/[recipeId]/route.ts
│   │   ├── stores/[storeId]/recipes/route.ts
│   │   ├── stores/[storeId]/reports/food-cost/route.ts
│   │   ├── stores/[storeId]/route.ts
│   │   ├── stores/[storeId]/stock-count/route.ts
│   │   ├── stores/[storeId]/stock-reception/route.ts
│   │   ├── stores/[storeId]/suppliers/[supplierId]/items/route.ts
│   │   ├── stores/[storeId]/suppliers/[supplierId]/portal-tokens/route.ts
│   │   ├── stores/[storeId]/suppliers/[supplierId]/route.ts
│   │   ├── stores/[storeId]/suppliers/route.ts
│   │   ├── stores/[storeId]/tags/[tagId]/route.ts
│   │   ├── stores/[storeId]/tags/route.ts
│   │   ├── stores/[storeId]/users/[userId]/route.ts
│   │   ├── stores/[storeId]/users/route.ts
│   │   ├── stores/[storeId]/waste-analytics/route.ts
│   │   ├── stores/[storeId]/waste/route.ts
│   │   ├── stores/[storeId]/webhooks/route.ts
│   │   ├── stores/route.ts
│   │   ├── supplier-portal/catalog/route.ts
│   │   ├── supplier-portal/invoices/route.ts
│   │   ├── supplier-portal/orders/[poId]/route.ts
│   │   ├── supplier-portal/orders/route.ts
│   │   ├── users/account-type/route.ts
│   │   ├── users/bulk-import/route.ts
│   │   ├── users/invite/route.ts
│   │   ├── users/invites/resend/route.ts
│   │   ├── users/invites/route.ts
│   │   ├── users/onboard/route.ts
│   │   ├── users/onboard/validate/route.ts
│   │   ├── v1/inventory/route.ts
│   │   └── v1/stock/route.ts
│   ├── global-error.tsx                         # Root error boundary
│   ├── globals.css                              # Tailwind base + theme CSS variables
│   ├── icon.svg                                 # App icon
│   ├── layout.tsx                               # Root layout (providers, fonts, analytics)
│   ├── offline/
│   │   └── page.tsx                             # Offline fallback page (PWA)
│   └── page.tsx                                 # Home: marketing landing or dashboard redirect
├── components/
│   ├── CommandPalette.tsx                        # Cmd+K command palette
│   ├── ErrorBoundary.tsx                        # Reusable error boundary
│   ├── GlobalKeyboardShortcuts.tsx              # App-wide keyboard shortcut handler
│   ├── PWAInstallPrompt.tsx                     # PWA install prompt banner
│   ├── WebVitals.tsx                            # Core Web Vitals reporter
│   ├── billing/
│   │   ├── BillingInfoCard.tsx                  # Subscription info display
│   │   ├── InvoiceHistory.tsx                   # Stripe invoice list
│   │   ├── PaymentForm.tsx                      # Stripe payment form
│   │   ├── PaymentMethodsCard.tsx               # Saved payment methods
│   │   ├── PlanOverviewCard.tsx                 # Current plan details
│   │   └── StoreSubscriptionList.tsx            # Per-store subscription status
│   ├── cards/
│   │   ├── LowStockCard.tsx                     # Low stock alert card
│   │   ├── StatsCard.tsx                        # Dashboard KPI card
│   │   └── StoreCard.tsx                        # Store summary card
│   ├── categories/
│   │   ├── CategoryBadge.tsx                    # Colored category badge
│   │   ├── CategoryForm.tsx                     # Create/edit category form
│   │   ├── CategoryList.tsx                     # Category listing
│   │   └── CategorySelect.tsx                   # Category dropdown selector
│   ├── charts/
│   │   ├── CategoryBreakdownChart.tsx           # Category distribution pie chart
│   │   ├── ForecastChart.tsx                    # Demand forecast line chart
│   │   ├── InventoryHealthChart.tsx             # Inventory health overview
│   │   ├── StockActivityChart.tsx               # Stock movement bar chart
│   │   ├── StockTrendChart.tsx                  # Stock level trend line
│   │   ├── StoreComparisonChart.tsx             # Multi-store comparison
│   │   ├── TopMovingItemsChart.tsx              # Top items by movement
│   │   └── index.ts                             # Chart barrel export
│   ├── dashboard/
│   │   ├── OwnerDashboard.tsx                   # Owner/Manager dashboard (KPIs, charts)
│   │   └── StaffDashboard.tsx                   # Staff dashboard (shifts, low stock)
│   ├── dialogs/
│   │   ├── ConfirmDialog.tsx                    # Generic confirmation modal
│   │   ├── KeyboardShortcutsHelp.tsx            # Keyboard shortcuts reference
│   │   ├── ParLevelDialog.tsx                   # Set inventory PAR level
│   │   ├── StockUpdateDialog.tsx                # Quick stock quantity update
│   │   └── TempPasswordDialog.tsx               # Temporary password display
│   ├── forms/
│   │   ├── AcceptInviteForm.tsx                 # Accept store invitation
│   │   ├── BulkUserImportForm.tsx               # CSV user import
│   │   ├── EditClockTimesDialog.tsx             # Manual clock time adjustment
│   │   ├── ForgotPasswordForm.tsx               # Password reset request
│   │   ├── InventoryItemForm.tsx                # Create/edit inventory item
│   │   ├── InviteUserForm.tsx                   # Send user invitation
│   │   ├── LoginForm.tsx                        # Email/password + OAuth login
│   │   ├── ResetPasswordForm.tsx                # Set new password
│   │   ├── ShiftForm.tsx                        # Create/edit shift
│   │   ├── SignupForm.tsx                       # New user registration
│   │   ├── StockCountForm.tsx                   # Stock count submission
│   │   ├── StockReceptionForm.tsx               # Stock delivery reception
│   │   ├── StoreForm.tsx                        # Create/edit store
│   │   └── UserForm.tsx                         # Create/edit user
│   ├── help/
│   │   └── PageGuide.tsx                        # Contextual help tooltip
│   ├── integrations/
│   │   ├── AccountMappingForm.tsx               # GL account mapping for accounting
│   │   ├── IntegrationCard.tsx                  # Integration provider card
│   │   └── pos/
│   │       ├── ConnectionWizard.tsx             # POS connection setup wizard
│   │       ├── MenuSyncTable.tsx                # POS menu item mapping table
│   │       └── ProviderSelector.tsx             # POS provider selection grid
│   ├── inventory/
│   │   └── CSVImport.tsx                        # CSV import for inventory items
│   ├── invoices/
│   │   ├── InvoiceLineItemTable.tsx             # OCR-extracted line items
│   │   └── InvoiceUploadForm.tsx                # Invoice upload form
│   ├── layout/
│   │   ├── DashboardShell.tsx                   # Main dashboard wrapper
│   │   ├── Header.tsx                           # Navbar header
│   │   ├── MobileNav.tsx                        # Responsive mobile navigation
│   │   ├── Navbar.tsx                           # Top navigation bar
│   │   ├── Sidebar.tsx                          # Left sidebar navigation
│   │   ├── StorePageWrapper.tsx                 # Store-scoped page wrapper
│   │   ├── StoreSelector.tsx                    # Store switcher dropdown
│   │   └── UserNav.tsx                          # User profile dropdown menu
│   ├── marketing/
│   │   ├── AnimatedCounter.tsx                  # Animated number counter
│   │   ├── CTA.tsx                              # Call-to-action section
│   │   ├── DashboardMockup.tsx                  # Dashboard preview image
│   │   ├── FAQ.tsx                              # Frequently asked questions
│   │   ├── Features.tsx                         # Feature highlights grid
│   │   ├── Footer.tsx                           # Marketing page footer
│   │   ├── Header.tsx                           # Marketing page header/nav
│   │   ├── Hero.tsx                             # Landing page hero section
│   │   ├── Integrations.tsx                     # Integration logos showcase
│   │   ├── PainPoints.tsx                       # Problem/solution section
│   │   ├── Pricing.tsx                          # Pricing tiers
│   │   ├── ProductShowcase.tsx                  # Product screenshots
│   │   ├── ScrollReveal.tsx                     # Scroll-triggered animations
│   │   ├── Stats.tsx                            # Statistics section
│   │   ├── TrustBar.tsx                         # Trust indicators bar
│   │   └── index.ts                             # Marketing barrel export
│   ├── notifications/
│   │   └── NotificationBell.tsx                 # Notification bell icon
│   ├── offline/
│   │   └── OfflineIndicator.tsx                 # Offline status banner
│   ├── providers/
│   │   ├── AuthProvider.tsx                     # Auth context (user, stores, role)
│   │   ├── AuthProvider.tsx.backup              # Backup of auth provider
│   │   ├── QueryProvider.tsx                    # TanStack Query provider
│   │   └── StripeProvider.tsx                   # Stripe Elements provider
│   ├── recipes/
│   │   ├── IngredientForm.tsx                   # Add recipe ingredient
│   │   ├── MenuItemForm.tsx                     # Create/edit menu item
│   │   └── RecipeForm.tsx                       # Create/edit recipe
│   ├── scanner/
│   │   ├── BarcodeScanner.tsx                   # Barcode scanning component
│   │   └── BarcodeScannerSheet.tsx              # Scanner in bottom sheet
│   ├── settings/
│   │   ├── ApiKeyForm.tsx                       # Create/manage API keys
│   │   └── WebhookForm.tsx                      # Create/manage webhooks
│   ├── store/
│   │   └── setup/
│   │       ├── SetupStepCard.tsx                # Setup wizard step card
│   │       ├── StoreSetupWizard.tsx             # Multi-step store setup
│   │       ├── index.ts                         # Setup barrel export
│   │       └── steps/
│   │           ├── HoursSetupStep.tsx           # Set store operating hours
│   │           ├── InventorySetupStep.tsx        # Initial inventory setup
│   │           ├── MenuSetupStep.tsx             # Menu configuration step
│   │           ├── SuppliersSetupStep.tsx        # Supplier setup step
│   │           └── TeamSetupStep.tsx             # Team member invite step
│   ├── supplier-portal/
│   │   └── PortalLayout.tsx                     # Supplier portal layout wrapper
│   ├── suppliers/
│   │   ├── PortalTokenManager.tsx               # Generate supplier portal tokens
│   │   ├── PurchaseOrderForm.tsx                # Create/edit purchase order
│   │   ├── ReceiveDeliveryDialog.tsx            # Receive delivery dialog
│   │   └── SupplierForm.tsx                     # Create/edit supplier
│   ├── tables/
│   │   ├── InventoryTable.tsx                   # Inventory items data table
│   │   ├── PendingInvitesTable.tsx              # Pending user invitations
│   │   ├── ShiftsTable.tsx                      # Shift schedule table
│   │   ├── StockHistoryTable.tsx                # Stock movement history
│   │   ├── StockTable.tsx                       # Current stock levels
│   │   ├── StoresTable.tsx                      # Store listing table
│   │   └── UsersTable.tsx                       # User management table
│   ├── tags/
│   │   ├── TagBadge.tsx                         # Colored tag badge
│   │   ├── TagForm.tsx                          # Create/edit tag
│   │   ├── TagList.tsx                          # Tag listing
│   │   └── TagSelect.tsx                        # Tag multi-select
│   ├── timetable/
│   │   ├── QuickShiftModal.tsx                  # Quick shift creation modal
│   │   ├── StaffWeeklyView.tsx                  # Per-staff weekly schedule
│   │   ├── TimelineView.tsx                     # Timeline visualization
│   │   └── WeeklyTimetable.tsx                  # Full weekly timetable grid
│   ├── ui/                                      # shadcn/ui primitives
│   │   ├── accordion.tsx                        # Collapsible accordion
│   │   ├── alert-dialog.tsx                     # Confirmation alert dialog
│   │   ├── alert.tsx                            # Alert banner
│   │   ├── avatar.tsx                           # User avatar
│   │   ├── badge.tsx                            # Status badge
│   │   ├── button.tsx                           # Button with variants
│   │   ├── calendar.tsx                         # Date calendar picker
│   │   ├── card.tsx                             # Card container
│   │   ├── checkbox.tsx                         # Checkbox input
│   │   ├── collapsible.tsx                      # Collapsible section
│   │   ├── date-range-picker.tsx                # Date range picker
│   │   ├── dialog.tsx                           # Modal dialog
│   │   ├── dropdown-menu.tsx                    # Dropdown menu
│   │   ├── empty-state.tsx                      # Empty state placeholder
│   │   ├── floating-action-button.tsx           # FAB button
│   │   ├── form.tsx                             # Form wrapper (react-hook-form)
│   │   ├── input.tsx                            # Text input
│   │   ├── label.tsx                            # Form label
│   │   ├── page-header.tsx                      # Page title header
│   │   ├── popover.tsx                          # Popover
│   │   ├── progress.tsx                         # Progress bar
│   │   ├── radio-group.tsx                      # Radio button group
│   │   ├── scroll-area.tsx                      # Scrollable area
│   │   ├── select.tsx                           # Select dropdown
│   │   ├── separator.tsx                        # Horizontal/vertical separator
│   │   ├── sheet.tsx                            # Side sheet
│   │   ├── skeleton.tsx                         # Loading skeleton
│   │   ├── skeletons.tsx                        # Preset skeleton layouts
│   │   ├── sonner.tsx                           # Sonner toast provider
│   │   ├── switch.tsx                           # Toggle switch
│   │   ├── table.tsx                            # Data table
│   │   ├── tabs.tsx                             # Tab navigation
│   │   ├── textarea.tsx                         # Multi-line text input
│   │   ├── time-picker.tsx                      # Time picker
│   │   └── tooltip.tsx                          # Tooltip
│   └── waste/
│       ├── WasteAnalyticsCharts.tsx             # Waste analytics visualizations
│       └── WasteLogForm.tsx                     # Waste logging form
├── components.json                              # shadcn/ui config (New York style)
├── docs/
│   ├── API.md                                   # API documentation
│   ├── APPLY_THESE_MIGRATIONS.md                # Migration instructions
│   ├── ARCHITECTURE.md                          # Architecture overview
│   ├── CLIENT_PRESENTATION_GUIDE.md             # Client demo guide
│   ├── FEATURE_SUMMARY.md                       # Feature list
│   ├── FINAL_SCHEMA_STATE.md                    # Current DB schema state
│   ├── MIGRATION_035_APPLY_NOW.md               # Specific migration notes
│   ├── PRIORITY_10_IMPLEMENTATION_SUMMARY.md    # Sprint 10 summary
│   ├── PRIORITY_11_AUTHPROVIDER_RACE_CONDITIONS_FIX.md # Auth race condition fix
│   ├── PRIORITY_11_IMPLEMENTATION_COMPLETE.md   # Sprint 11 summary
│   ├── PRIORITY_12_IMPLEMENTATION_COMPLETE.md   # Sprint 12 summary
│   ├── PRIORITY_13_IMPLEMENTATION_COMPLETE.md   # Sprint 13 summary
│   ├── PRIORITY_14_IMPLEMENTATION_COMPLETE.md   # Sprint 14 summary
│   ├── PRIORITY_9_IMPLEMENTATION_SUMMARY.md     # Sprint 9 summary
│   ├── REFACTORING_REPORT.md                    # Refactoring notes
│   ├── TECHNICAL_COFOUNDER_ASSESSMENT.md        # Technical assessment
│   ├── TEST_FIXES_SUMMARY.md                    # Test fix notes
│   ├── UPSTASH_REDIS_SETUP.md                   # Redis setup guide
│   ├── api-design.md                            # API design principles
│   ├── architecture/
│   │   ├── ARCHITECTURE_ANALYSIS.md             # Architecture deep-dive
│   │   └── SECURITY_AUDIT.md                    # Security audit report
│   ├── architecture-analysis.md                 # Architecture analysis
│   ├── audits/
│   │   ├── architecture-audit.md                # Architecture audit
│   │   ├── architecture-remediation-report.md   # Remediation steps
│   │   ├── code-refactoring-audit.md            # Code quality audit
│   │   ├── code-refactoring-remediation-report.md # Refactoring actions
│   │   ├── database-optimization.md             # DB optimization audit
│   │   ├── db-optimization-remediation-report.md # DB optimization actions
│   │   ├── documentation-audit.md               # Documentation audit
│   │   ├── performance-audit.md                 # Performance audit
│   │   ├── performance-remediation-report.md    # Performance actions
│   │   ├── security-audit.md                    # Security audit
│   │   └── security-remediation-report.md       # Security actions
│   ├── database-optimization.md                 # DB optimization guide
│   ├── disaster-recovery.md                     # DR plan
│   └── testing-guide.md                         # Testing guide
├── hooks/
│   ├── index.ts                                 # Hooks barrel export
│   ├── useAccountingConnection.ts               # Accounting provider connection
│   ├── useAlertPreferences.ts                   # Alert preferences CRUD
│   ├── useAnalytics.ts                          # Analytics event tracking
│   ├── useAuditLogs.ts                          # Audit log fetching
│   ├── useAuth.ts                               # Auth context hook
│   ├── useAutoRefresh.ts                        # Auto-refresh data at interval
│   ├── useBarcodeScanner.ts                     # Barcode scanner input
│   ├── useBenchmark.ts                          # Performance benchmarking
│   ├── useBilling.ts                            # Billing/subscription management
│   ├── useCSRF.ts                               # CSRF token + csrfFetch helper
│   ├── useCategories.ts                         # Category CRUD
│   ├── useCurrencyDetection.ts                  # Auto-detect store currency
│   ├── useForecast.ts                           # Demand forecasting
│   ├── useFormDraft.ts                          # Auto-save form drafts to localStorage
│   ├── useHACCP.ts                              # HACCP checks/templates CRUD
│   ├── useInventory.ts                          # Inventory CRUD (TanStack Query)
│   ├── useInvoices.ts                           # Invoice CRUD
│   ├── useItemTags.ts                           # Item tag management
│   ├── useKeyboardShortcuts.ts                  # Keyboard shortcut registration
│   ├── useMenuAnalysis.ts                       # Menu cost/profit analysis
│   ├── useNotificationPreferences.ts            # Notification preferences
│   ├── useNotifications.ts                      # Notification display
│   ├── useOfflineSync.ts                        # Offline sync with IndexedDB
│   ├── usePageGuide.ts                          # Contextual help content
│   ├── usePayroll.ts                            # Payroll data fetching
│   ├── usePendingInvites.ts                     # Pending user invites
│   ├── usePosConnections.ts                     # POS connection CRUD
│   ├── usePosProviders.ts                       # POS provider list
│   ├── usePurchaseOrders.ts                     # Purchase order CRUD
│   ├── useRecipes.ts                            # Recipe CRUD
│   ├── useReports.ts                            # Report data fetching
│   ├── useShifts.ts                             # Shift CRUD
│   ├── useStockCount.ts                         # Stock count form state
│   ├── useStockReception.ts                     # Stock reception form state
│   ├── useStore.ts                              # Single store fetching
│   ├── useStoreInventory.old.ts                 # DEPRECATED: old store inventory hook
│   ├── useStoreInventory.ts                     # Store inventory (TanStack Query)
│   ├── useStoreSetupStatus.ts                   # Store setup wizard completion
│   ├── useStoreUsers.old.ts                     # DEPRECATED: old store users hook
│   ├── useStoreUsers.ts                         # Store users (TanStack Query)
│   ├── useStores.old.ts                         # DEPRECATED: old stores hook
│   ├── useStores.ts                             # User's stores (TanStack Query)
│   ├── useSubscriptionGuard.ts                  # Feature gating by subscription
│   ├── useSupplierPortal.ts                     # Supplier portal access
│   ├── useSuppliers.ts                          # Supplier CRUD
│   ├── useTags.ts                               # Tag CRUD
│   ├── useUrlFilters.ts                         # URL-based filter state
│   ├── useUsers.ts                              # User management
│   └── useWasteTracking.ts                      # Waste log CRUD
├── lib/
│   ├── api/
│   │   ├── api-keys.ts                          # API key hashing & validation
│   │   ├── middleware.ts                         # withApiAuth: session, RBAC, CSRF, rate limit
│   │   ├── response.ts                          # apiSuccess, apiError, apiBadRequest, apiForbidden
│   │   ├── with-api-key.ts                      # API key authentication middleware
│   │   └── with-supplier-auth.ts                # Supplier portal token auth
│   ├── audit.ts                                 # auditLog(supabase, options)
│   ├── auth.ts                                  # Role/permission helpers, store access checks
│   ├── constants.ts                             # Roles, permissions, public routes, limits
│   ├── csrf.ts                                  # CSRF token generation/validation
│   ├── debug.ts                                 # Debug utilities
│   ├── email-alerts.ts                          # Low-stock email alerts
│   ├── email-notifications.ts                   # Transactional email notifications
│   ├── email.ts                                 # Resend email client & templates
│   ├── env.ts                                   # Environment variable validation
│   ├── export.ts                                # CSV/JSON data export helpers
│   ├── forecasting/
│   │   └── engine.ts                            # Time-series demand forecasting
│   ├── help/
│   │   └── page-guides.ts                       # Contextual help content per page
│   ├── logger.ts                                # Structured logging utility
│   ├── offline/
│   │   ├── db.ts                                # Dexie IndexedDB schema
│   │   └── sync.ts                              # Offline-to-online sync strategy
│   ├── rate-limit.ts                            # Upstash Redis + in-memory rate limiter
│   ├── services/
│   │   ├── accounting/
│   │   │   ├── freshbooks.ts                    # FreshBooks adapter
│   │   │   ├── myob.ts                          # MYOB adapter
│   │   │   ├── quickbooks.ts                    # QuickBooks Online adapter
│   │   │   ├── sage.ts                          # Sage adapter
│   │   │   ├── token-manager.ts                 # OAuth token refresh manager
│   │   │   ├── types.ts                         # Common accounting types
│   │   │   ├── wave.ts                          # Wave accounting adapter
│   │   │   ├── xero.ts                          # Xero adapter
│   │   │   └── zoho-books.ts                    # Zoho Books adapter
│   │   ├── alertService.ts                      # Alert generation & delivery
│   │   ├── billingEventHandlers.ts              # Stripe webhook event handlers
│   │   ├── edi.ts                               # EDI document processing
│   │   ├── food-cost.ts                         # Food cost calculation engine
│   │   ├── invoice-ocr.ts                       # Google Document AI OCR
│   │   ├── notifications.ts                     # Notification dispatch
│   │   ├── pos/
│   │   │   ├── adapters/
│   │   │   │   ├── aldelo-express.ts            # Aldelo Express POS
│   │   │   │   ├── cake.ts                      # CAKE POS
│   │   │   │   ├── clover.ts                    # Clover POS
│   │   │   │   ├── digital-dining.ts            # Digital Dining POS
│   │   │   │   ├── epos-now.ts                  # Epos Now POS
│   │   │   │   ├── focus-pos.ts                 # Focus POS
│   │   │   │   ├── foodics.ts                   # Foodics POS
│   │   │   │   ├── future-pos.ts                # Future POS
│   │   │   │   ├── gastrofix.ts                 # Gastrofix POS
│   │   │   │   ├── gotab.ts                     # GoTab POS
│   │   │   │   ├── harbortouch.ts               # Harbortouch POS
│   │   │   │   ├── heartland.ts                 # Heartland POS
│   │   │   │   ├── hungerrush.ts                # HungerRush POS
│   │   │   │   ├── iiko.ts                      # iiko POS
│   │   │   │   ├── lavu.ts                      # Lavu POS
│   │   │   │   ├── lightspeed.ts                # Lightspeed POS
│   │   │   │   ├── maitred.ts                   # Maitre'D POS
│   │   │   │   ├── ncr-voyix.ts                 # NCR Voyix POS
│   │   │   │   ├── oracle-micros.ts             # Oracle MICROS POS
│   │   │   │   ├── par-brink.ts                 # PAR Brink POS
│   │   │   │   ├── positouch.ts                 # POSitouch POS
│   │   │   │   ├── posrocket.ts                 # POSRocket POS
│   │   │   │   ├── qu-pos.ts                    # Qu POS
│   │   │   │   ├── revel.ts                     # Revel POS
│   │   │   │   ├── shopify-pos.ts               # Shopify POS
│   │   │   │   ├── sicom.ts                     # SICOM POS
│   │   │   │   ├── speedline.ts                 # SpeedLine POS
│   │   │   │   ├── spoton.ts                    # SpotOn POS
│   │   │   │   ├── square.ts                    # Square POS
│   │   │   │   ├── squirrel.ts                  # Squirrel POS
│   │   │   │   ├── sumup.ts                     # SumUp POS
│   │   │   │   ├── tevalis.ts                   # Tevalis POS
│   │   │   │   ├── toast.ts                     # Toast POS
│   │   │   │   ├── touchbistro.ts               # TouchBistro POS
│   │   │   │   ├── upserve.ts                   # Upserve POS
│   │   │   │   ├── xenial.ts                    # Xenial POS
│   │   │   │   └── zettle.ts                    # Zettle POS
│   │   │   ├── types.ts                         # Common POS event types
│   │   │   └── webhook-validators.ts            # Per-provider webhook validation
│   │   ├── pos.ts                               # POS provider registry & factory
│   │   ├── stockOperations.ts                   # Stock count/reception logic
│   │   ├── supplier-portal.ts                   # Supplier portal business logic
│   │   ├── userInvitation.ts                    # User invitation flow
│   │   └── webhooks.ts                          # Outgoing webhook dispatch
│   ├── shift-patterns.ts                        # Shift pattern generation
│   ├── stripe/
│   │   ├── billing-config.ts                    # Billing plan definitions
│   │   ├── config.ts                            # Stripe client config
│   │   └── server.ts                            # Stripe server-side operations
│   ├── supabase/
│   │   ├── admin.ts                             # Admin client (bypasses RLS)
│   │   ├── client.ts                            # Browser client
│   │   ├── middleware.ts                        # Cookie handling for SSR
│   │   └── server.ts                            # Server client (respects RLS)
│   ├── utils.ts                                 # cn(), general utilities
│   ├── utils/
│   │   ├── format-shift.ts                      # Shift time formatting
│   │   ├── storage.ts                           # localStorage helpers
│   │   └── units.ts                             # Unit conversion (kg↔lb, etc.)
│   └── validations/
│       ├── accounting.ts                        # Accounting config schemas
│       ├── auth.ts                              # Login, signup, password schemas
│       ├── bulk-import.ts                       # CSV import schemas
│       ├── categories-tags.ts                   # Category & tag schemas
│       ├── haccp.ts                             # HACCP check schemas
│       ├── inventory.ts                         # Inventory item schemas
│       ├── invoices.ts                          # Invoice schemas
│       ├── notifications.ts                     # Notification preference schemas
│       ├── payroll.ts                           # Payroll schemas
│       ├── recipes.ts                           # Recipe schemas
│       ├── shift.ts                             # Shift schemas
│       ├── store.ts                             # Store schemas
│       ├── supplier-portal.ts                   # Supplier portal schemas
│       ├── suppliers.ts                         # Supplier schemas
│       └── user.ts                              # User schemas
├── middleware.ts                                # Next.js middleware (CSRF, auth redirect, headers)
├── next.config.ts                               # Next.js config (headers, Sentry)
├── notes.md                                     # Developer notes
├── package-lock.json                            # Dependency lockfile
├── package.json                                 # Project manifest
├── postcss.config.mjs                           # PostCSS with Tailwind
├── public/
│   ├── file.svg                                 # File icon
│   ├── globe.svg                                # Globe icon
│   ├── icon.svg                                 # App icon
│   ├── images/
│   │   └── dashboard-screenshot.png             # Marketing screenshot
│   ├── manifest.json                            # PWA manifest
│   ├── sw.js                                    # Service worker
│   └── window.svg                               # Window icon
├── scripts/
│   └── verify-rls-policies.ts                   # RLS policy verification script
├── sentry.client.config.ts                      # Sentry client-side config
├── sentry.edge.config.ts                        # Sentry edge runtime config
├── sentry.server.config.ts                      # Sentry server-side config
├── supabase/
│   └── migrations/                              # 66 migration files (000–065)
│       ├── 000_diagnose_migration_state.sql     # Diagnostic query
│       ├── 001_performance_indexes.sql          # Performance indexes
│       ├── 001_rollback_partial_migration.sql   # Rollback script
│       ├── 002_cleanup_duplicates.sql           # Duplicate policy cleanup
│       ├── 002_fix_rls_performance.sql          # RLS performance fix
│       ├── 003_cleanup_duplicate_policies.sql   # Policy cleanup
│       ├── 004_add_store_hours.sql              # Store hours columns
│       ├── 005_multi_tenant_schema.sql          # Multi-tenant schema (store_users)
│       ├── 006_multi_tenant_rls.sql             # Multi-tenant RLS policies
│       ├── 007_fix_rls_recursion.sql            # RLS recursion fix
│       ├── 008_simple_rls_fix.sql               # Simplified RLS fix
│       ├── 009_update_role_constraint.sql        # Role constraint update
│       ├── 010_co_owner_protection.sql          # Co-owner billing protection
│       ├── 011_user_invites.sql                 # User invitations table
│       ├── 012_add_phone_to_profiles.sql        # Phone number column
│       ├── 013_audit_logs.sql                   # Audit logs table
│       ├── 014_fix_store_users_insert_policy.sql # Insert policy fix
│       ├── 015_billing_enhancements.sql         # Billing/subscription tables
│       ├── 016_inventory_items_store_scoping.sql # Inventory store scoping
│       ├── 016_inventory_items_store_scoping_fixed.sql # Fixed version
│       ├── 017_webhook_deduplication.sql        # Webhook dedup
│       ├── 018_fix_audit_logs_rls.sql           # Audit log RLS fix
│       ├── 019_fix_inventory_items_rls.sql      # Inventory RLS fix
│       ├── 020_fix_store_users_rls_policies.sql # Store users RLS fix
│       ├── 021_fix_store_users_rls_recursion.sql # Recursion fix
│       ├── 022_fix_store_users_insert_recursion.sql # Insert recursion fix
│       ├── 023_fix_insert_rls_final.sql         # Final insert RLS fix
│       ├── 024_simple_insert_policy.sql         # Simplified insert policy
│       ├── 025_enforce_audit_logs_immutability.sql # Immutable audit logs
│       ├── 026_fix_insert_no_recursion.sql      # No-recursion insert
│       ├── 027_audit_logs_truly_immutable.sql   # Truly immutable audit logs
│       ├── 028_fix_shifts_rls.sql               # Shifts RLS fix
│       ├── 029_shifts_rls_field_level.sql       # Field-level shifts RLS
│       ├── 030_shifts_staff_update_function.sql  # Staff shift update function
│       ├── 031_nuclear_fix_all.sql              # Comprehensive RLS rewrite
│       ├── 032_fix_recursion_with_security_definer.sql # Security definer fix
│       ├── 033_fix_remaining_recursion_and_immutability.sql # Remaining fixes
│       ├── 034_fix_delete_recursion.sql         # Delete recursion fix
│       ├── 035_fix_insert_recursion.sql         # Insert recursion fix
│       ├── 036_fix_get_user_store_ids.sql       # get_user_store_ids fix
│       ├── 037_simplify_insert_policy.sql       # Simplified insert policy
│       ├── 038_item_categories_and_tags.sql     # Categories & tags tables
│       ├── 039_alert_preferences_and_history.sql # Alerts tables
│       ├── 040_waste_tracking.sql               # Waste log table
│       ├── 041_recipe_costing.sql               # Recipes & menu items tables
│       ├── 042_suppliers_and_purchase_orders.sql # Suppliers & PO tables
│       ├── 043_api_keys_and_webhooks.sql        # API keys & webhooks tables
│       ├── 044_pos_integrations.sql             # POS connection tables
│       ├── 045_cost_currency_gbp.sql            # Default currency to GBP
│       ├── 046_cleanup_inactive_inventory_items.sql # Cleanup inactive items
│       ├── 047_audit_log_user_name.sql          # Add user name to audit logs
│       ├── 048_simplify_po_statuses.sql         # Simplify PO status enum
│       ├── 049_merge_driver_into_staff.sql      # Merge Driver role into Staff
│       ├── 050_payroll.sql                      # Payroll tables (shifts, pay runs)
│       ├── 051_setup_completed_at.sql           # Store setup completion tracking
│       ├── 052_notification_preferences.sql     # Notification preferences table
│       ├── 053_invoices.sql                     # Invoice & line items tables
│       ├── 054_accounting_and_oauth.sql         # Accounting connections & OAuth
│       ├── 055_supplier_portal.sql              # Supplier portal tokens & activity
│       ├── 056_store_country_currency.sql       # Store country/currency columns
│       ├── 057_expand_pos_providers.sql         # Expand POS provider list
│       ├── 058_expand_accounting_providers.sql  # Expand accounting providers
│       ├── 059_supplier_edi.sql                 # EDI support for suppliers
│       ├── 060_remove_intro_pricing.sql         # Remove intro pricing
│       ├── 061_expand_pos_providers_us.sql      # US POS providers
│       ├── 062_haccp_food_safety.sql            # HACCP tables
│       ├── 063_performance_indexes.sql          # Additional perf indexes
│       ├── 064_archival_tables.sql              # Data archival tables
│       ├── 065_low_stock_function_and_indexes.sql # Low stock function
│       ├── README.md                            # Migration documentation
│       └── verify_rls_policies.sql              # RLS verification query
├── tests/
│   ├── TEST_COVERAGE_PLAN.md                    # Test coverage plan
│   ├── hooks/                                   # Hook tests (jsdom environment)
│   │   ├── useAutoRefresh.test.ts
│   │   ├── useBarcodeScanner.test.ts
│   │   ├── useCSRF.test.ts
│   │   ├── useFormDraft.test.ts
│   │   ├── useOfflineSync.test.ts
│   │   ├── useStoreSetupStatus.test.ts
│   │   └── useSubscriptionGuard.test.ts
│   ├── integration/
│   │   ├── api/                                 # API route integration tests
│   │   │   ├── alert-preferences.test.ts
│   │   │   ├── analytics.test.ts
│   │   │   ├── api-keys.test.ts
│   │   │   ├── audit-logs.test.ts
│   │   │   ├── auth-callback.test.ts
│   │   │   ├── auth.test.ts
│   │   │   ├── benchmark.test.ts
│   │   │   ├── billing-webhook.test.ts
│   │   │   ├── billing.test.ts
│   │   │   ├── bulk-import.test.ts
│   │   │   ├── categories.test.ts
│   │   │   ├── cron-alerts.test.ts
│   │   │   ├── csrf.test.ts
│   │   │   ├── daily-summary.test.ts
│   │   │   ├── food-cost-report.test.ts
│   │   │   ├── forecast.test.ts
│   │   │   ├── haccp-checks.test.ts
│   │   │   ├── haccp-corrective-actions.test.ts
│   │   │   ├── haccp-dashboard.test.ts
│   │   │   ├── haccp-temperatures.test.ts
│   │   │   ├── haccp-templates.test.ts
│   │   │   ├── health.test.ts
│   │   │   ├── inventory-item.test.ts
│   │   │   ├── inventory.test.ts
│   │   │   ├── invoices.test.ts
│   │   │   ├── menu-analysis.test.ts
│   │   │   ├── missing-counts.test.ts
│   │   │   ├── notification-preferences.test.ts
│   │   │   ├── pos-expansion.test.ts
│   │   │   ├── pos.test.ts
│   │   │   ├── purchase-orders.test.ts
│   │   │   ├── quickbooks-integration.test.ts
│   │   │   ├── recipes.test.ts
│   │   │   ├── reports.test.ts
│   │   │   ├── shift-detail.test.ts
│   │   │   ├── shifts-clock-out.test.ts
│   │   │   ├── shifts-clock.test.ts
│   │   │   ├── shifts.test.ts
│   │   │   ├── stock-operations.test.ts
│   │   │   ├── stock-reception.test.ts
│   │   │   ├── store-detail.test.ts
│   │   │   ├── store-inventory-cost.test.ts
│   │   │   ├── stores.test.ts
│   │   │   ├── supplier-portal.test.ts
│   │   │   ├── suppliers.test.ts
│   │   │   ├── tags.test.ts
│   │   │   ├── users-invite.test.ts
│   │   │   ├── v1-api.test.ts
│   │   │   ├── waste-analytics.test.ts
│   │   │   ├── waste-report.test.ts
│   │   │   ├── webhooks.test.ts
│   │   │   └── xero-integration.test.ts
│   │   └── rls/                                 # RLS tests (need real Supabase)
│   │       ├── README.md
│   │       ├── audit-logs-rls.test.ts
│   │       ├── inventory-items-rls.test.ts
│   │       ├── shifts-rls.test.ts
│   │       └── store-users-rls.test.ts
│   ├── lib/
│   │   ├── api/
│   │   │   ├── middleware.test.ts
│   │   │   └── response.test.ts
│   │   ├── api-keys.test.ts
│   │   ├── audit.test.ts
│   │   ├── auth.test.ts
│   │   ├── billing-config.test.ts
│   │   ├── constants.test.ts
│   │   ├── csrf.test.ts
│   │   ├── email-alerts.test.ts
│   │   ├── export.test.ts
│   │   ├── forecasting/
│   │   │   └── engine.test.ts
│   │   ├── offline/
│   │   │   ├── db.test.ts
│   │   │   └── sync.test.ts
│   │   ├── rate-limit.test.ts
│   │   ├── services/
│   │   │   ├── alertService.test.ts
│   │   │   ├── edi.test.ts
│   │   │   ├── food-cost.test.ts
│   │   │   ├── notifications.test.ts
│   │   │   └── pos/
│   │   │       ├── new-providers.test.ts
│   │   │       ├── pos.test.ts
│   │   │       ├── us-providers.test.ts
│   │   │       └── webhook-validators.test.ts
│   │   ├── shift-patterns.test.ts
│   │   ├── utils/
│   │   │   └── units.test.ts
│   │   ├── utils.test.ts
│   │   └── validations/
│   │       ├── auth.test.ts
│   │       ├── bulk-import.test.ts
│   │       ├── inventory.test.ts
│   │       ├── recipes.test.ts
│   │       ├── shift.test.ts
│   │       ├── store.test.ts
│   │       ├── suppliers.test.ts
│   │       └── user.test.ts
│   ├── setup.ts                                 # Vitest global setup
│   └── utils/
│       ├── rls-test-helpers.ts                  # RLS test utilities
│       └── test-helpers.ts                      # Common test helpers
├── tsconfig.json                                # TypeScript config (strict, @/ alias)
├── types/
│   ├── billing.ts                               # Billing-specific types
│   ├── database.ts                              # Auto-generated Supabase types
│   ├── index.ts                                 # Application type definitions
│   └── setup.ts                                 # Setup wizard types
├── vercel.json                                  # Vercel config (cron: archive-data Sun 3am)
└── vitest.config.ts                             # Vitest config (jsdom for hooks, coverage)
```

---

## 3. Database Schema — Mermaid ERD

Every table, every column, types, and foreign key relationships. Derived from `types/database.ts` and `supabase/migrations/`.

```mermaid
erDiagram
    stores {
        uuid id PK
        text name
        text address
        boolean is_active
        time opening_time
        time closing_time
        jsonb weekly_hours
        uuid billing_user_id FK
        text subscription_status
        text country
        text currency
        timestamptz created_at
        timestamptz updated_at
    }

    profiles {
        uuid id PK
        text email
        text full_name
        text phone
        user_role role "Owner|Manager|Staff|Admin"
        uuid store_id FK
        boolean is_platform_admin
        uuid default_store_id FK
        text stripe_customer_id
        user_status status "Invited|Active|Inactive"
        timestamptz created_at
        timestamptz updated_at
    }

    store_users {
        uuid id PK
        uuid store_id FK
        uuid user_id FK
        store_user_role role "Owner|Manager|Staff"
        boolean is_billing_owner
        numeric hourly_rate
        uuid invited_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    subscriptions {
        uuid id PK
        uuid store_id FK
        uuid billing_user_id FK
        text stripe_subscription_id
        text stripe_customer_id
        text stripe_payment_method_id
        text stripe_price_id
        subscription_status status "trialing|active|past_due|canceled|unpaid"
        timestamptz trial_start
        timestamptz trial_end
        timestamptz current_period_start
        timestamptz current_period_end
        boolean cancel_at_period_end
        text currency
        timestamptz created_at
        timestamptz updated_at
    }

    billing_events {
        uuid id PK
        uuid subscription_id FK
        uuid store_id FK
        uuid user_id FK
        text event_type
        text stripe_event_id
        integer amount_cents
        text currency
        text status
        jsonb metadata
        timestamptz created_at
    }

    user_invites {
        uuid id PK
        text email
        store_user_role role
        uuid store_id FK
        uuid_array store_ids
        text token
        uuid invited_by FK
        timestamptz expires_at
        timestamptz used_at
        timestamptz created_at
        timestamptz updated_at
    }

    audit_logs {
        uuid id PK
        uuid user_id FK
        text user_email
        text action
        text action_category
        uuid store_id FK
        text resource_type
        text resource_id
        jsonb details
        text ip_address
        text user_agent
        timestamptz created_at
    }

    inventory_items {
        uuid id PK
        text name
        text category
        uuid category_id FK
        text unit_of_measure
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    item_categories {
        uuid id PK
        uuid store_id FK
        text name
        text description
        text color
        integer sort_order
        timestamptz created_at
        timestamptz updated_at
    }

    item_tags {
        uuid id PK
        uuid store_id FK
        text name
        text description
        text color
        timestamptz created_at
    }

    inventory_item_tags {
        uuid inventory_item_id FK
        uuid tag_id FK
        timestamptz created_at
    }

    store_inventory {
        uuid id PK
        uuid store_id FK
        uuid inventory_item_id FK
        numeric quantity
        numeric par_level
        numeric unit_cost
        text cost_currency
        timestamptz last_updated_at
        uuid last_updated_by FK
    }

    stock_history {
        uuid id PK
        uuid store_id FK
        uuid inventory_item_id FK
        stock_action_type action_type "Count|Reception|Adjustment|Waste|Sale"
        numeric quantity_before
        numeric quantity_after
        numeric quantity_change
        uuid performed_by FK
        text notes
        timestamptz created_at
    }

    shifts {
        uuid id PK
        uuid store_id FK
        uuid user_id FK
        timestamptz start_time
        timestamptz end_time
        timestamptz clock_in_time
        timestamptz clock_out_time
        text notes
        timestamptz created_at
        timestamptz updated_at
    }

    daily_counts {
        uuid id PK
        uuid store_id FK
        date count_date
        uuid submitted_by FK
        timestamptz submitted_at
    }

    waste_log {
        uuid id PK
        uuid store_id FK
        uuid inventory_item_id FK
        numeric quantity
        text reason
        text notes
        numeric estimated_cost
        uuid reported_by FK
        timestamptz reported_at
        timestamptz created_at
    }

    recipes {
        uuid id PK
        uuid store_id FK
        text name
        text description
        text category
        numeric yield_quantity
        text yield_unit
        integer prep_time_minutes
        boolean is_active
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    recipe_ingredients {
        uuid id PK
        uuid recipe_id FK
        uuid inventory_item_id FK
        numeric quantity
        text unit_of_measure
        text notes
        timestamptz created_at
        timestamptz updated_at
    }

    menu_items {
        uuid id PK
        uuid store_id FK
        uuid recipe_id FK
        text name
        text description
        text category
        numeric selling_price
        text currency
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    suppliers {
        uuid id PK
        uuid store_id FK
        text name
        text email
        text phone
        text address
        text contact_person
        text payment_terms
        text notes
        boolean is_active
        text edi_webhook_url
        text edi_webhook_secret
        boolean edi_enabled
        timestamptz created_at
        timestamptz updated_at
    }

    supplier_items {
        uuid id PK
        uuid supplier_id FK
        uuid inventory_item_id FK
        text supplier_sku
        numeric unit_cost
        text currency
        integer lead_time_days
        numeric min_order_quantity
        boolean is_preferred
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    purchase_orders {
        uuid id PK
        uuid store_id FK
        uuid supplier_id FK
        text po_number
        text status
        date order_date
        date expected_delivery_date
        date actual_delivery_date
        numeric total_amount
        text currency
        text notes
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    purchase_order_items {
        uuid id PK
        uuid purchase_order_id FK
        uuid inventory_item_id FK
        uuid supplier_item_id FK
        numeric quantity_ordered
        numeric quantity_received
        numeric unit_price
        text notes
        timestamptz created_at
    }

    alert_preferences {
        uuid id PK
        uuid store_id FK
        uuid user_id FK
        boolean low_stock_enabled
        boolean critical_stock_enabled
        boolean missing_count_enabled
        numeric low_stock_threshold
        text alert_frequency
        boolean email_enabled
        integer preferred_hour
        timestamptz created_at
        timestamptz updated_at
    }

    alert_history {
        uuid id PK
        uuid store_id FK
        uuid user_id FK
        text alert_type
        text channel
        text subject
        integer item_count
        text status
        text error_message
        jsonb metadata
        timestamptz sent_at
        timestamptz acknowledged_at
    }

    api_keys {
        uuid id PK
        uuid store_id FK
        uuid created_by FK
        text name
        text key_prefix
        text key_hash
        text_array scopes
        boolean is_active
        timestamptz last_used_at
        timestamptz expires_at
        timestamptz created_at
        timestamptz updated_at
    }

    webhook_endpoints {
        uuid id PK
        uuid store_id FK
        uuid created_by FK
        text url
        text secret
        text_array events
        boolean is_active
        text description
        timestamptz created_at
        timestamptz updated_at
    }

    webhook_deliveries {
        uuid id PK
        uuid webhook_endpoint_id FK
        uuid store_id FK
        text event_type
        jsonb payload
        text status
        integer response_status
        text response_body
        integer attempt_count
        timestamptz last_attempt_at
        timestamptz delivered_at
        timestamptz created_at
    }

    pos_connections {
        uuid id PK
        uuid store_id FK
        text provider
        text name
        boolean is_active
        jsonb credentials
        jsonb config
        timestamptz last_synced_at
        text sync_status
        text sync_error
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    pos_item_mappings {
        uuid id PK
        uuid pos_connection_id FK
        uuid store_id FK
        text pos_item_id
        text pos_item_name
        uuid inventory_item_id FK
        numeric quantity_per_sale
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    pos_sale_events {
        uuid id PK
        uuid pos_connection_id FK
        uuid store_id FK
        text external_event_id
        text event_type
        jsonb items
        numeric total_amount
        text currency
        timestamptz occurred_at
        timestamptz processed_at
        text status
        text error_message
        timestamptz created_at
    }

    pay_runs {
        uuid id PK
        uuid store_id FK
        date period_start
        date period_end
        text status "draft|approved|paid"
        text notes
        numeric total_amount
        text currency
        uuid approved_by FK
        timestamptz approved_at
        uuid paid_by FK
        timestamptz paid_at
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    pay_run_items {
        uuid id PK
        uuid pay_run_id FK
        uuid user_id FK
        numeric hourly_rate
        numeric total_hours
        numeric overtime_hours
        numeric adjustments
        text adjustment_notes
        numeric gross_pay
        uuid_array shift_ids
        timestamptz created_at
        timestamptz updated_at
    }

    invoices {
        uuid id PK
        uuid store_id FK
        uuid supplier_id FK
        uuid purchase_order_id FK
        text file_path
        text file_name
        text file_type
        integer file_size_bytes
        text invoice_number
        date invoice_date
        date due_date
        numeric subtotal
        numeric tax_amount
        numeric total_amount
        text currency
        jsonb extracted_data
        text ocr_provider
        numeric ocr_confidence
        jsonb ocr_raw_response
        timestamptz ocr_processed_at
        text status
        text applied_reception_id
        uuid reviewed_by FK
        timestamptz reviewed_at
        text notes
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    invoice_line_items {
        uuid id PK
        uuid invoice_id FK
        text description
        numeric quantity
        numeric unit_price
        numeric total_price
        text unit_of_measure
        uuid inventory_item_id FK
        numeric match_confidence
        text match_status
        integer sort_order
        timestamptz created_at
        timestamptz updated_at
    }

    accounting_connections {
        uuid id PK
        uuid store_id FK
        text provider
        jsonb credentials
        jsonb config
        boolean is_active
        timestamptz last_synced_at
        text sync_status
        text sync_error
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    accounting_sync_log {
        uuid id PK
        uuid connection_id FK
        uuid store_id FK
        text entity_type
        text entity_id
        text external_id
        text direction
        text status
        text error_message
        jsonb payload
        timestamptz created_at
    }

    integration_oauth_states {
        uuid id PK
        uuid store_id FK
        text provider
        text state_token
        jsonb redirect_data
        timestamptz expires_at
        timestamptz used_at
        uuid created_by FK
        timestamptz created_at
    }

    supplier_portal_tokens {
        uuid id PK
        uuid supplier_id FK
        uuid store_id FK
        text token_hash
        text token_prefix
        boolean can_view_orders
        boolean can_upload_invoices
        boolean can_update_catalog
        boolean can_update_order_status
        text name
        boolean is_active
        timestamptz last_used_at
        timestamptz expires_at
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    supplier_portal_activity {
        uuid id PK
        uuid supplier_id FK
        uuid store_id FK
        uuid token_id FK
        text action
        jsonb details
        text ip_address
        text user_agent
        timestamptz created_at
    }

    haccp_check_templates {
        uuid id PK
        uuid store_id FK
        text name
        text description
        text frequency "daily|weekly|shift"
        jsonb items
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    haccp_checks {
        uuid id PK
        uuid store_id FK
        uuid template_id FK
        uuid completed_by FK
        timestamptz completed_at
        text status "pass|fail|partial"
        jsonb items
        text notes
        timestamptz created_at
    }

    haccp_temperature_logs {
        uuid id PK
        uuid store_id FK
        text location_name
        numeric temperature_celsius
        uuid recorded_by FK
        timestamptz recorded_at
        boolean is_in_range
        numeric min_temp
        numeric max_temp
        text corrective_action
        timestamptz created_at
    }

    haccp_corrective_actions {
        uuid id PK
        uuid store_id FK
        uuid check_id FK
        uuid temp_log_id FK
        text description
        text action_taken
        uuid resolved_by FK
        timestamptz resolved_at
        timestamptz created_at
    }

    %% ── Relationships ──

    stores ||--o{ store_users : "has members"
    stores ||--o{ subscriptions : "has subscription"
    stores ||--o{ billing_events : "has billing events"
    stores ||--o{ store_inventory : "holds inventory"
    stores ||--o{ stock_history : "tracks stock changes"
    stores ||--o{ shifts : "schedules shifts"
    stores ||--o{ daily_counts : "tracks daily counts"
    stores ||--o{ waste_log : "logs waste"
    stores ||--o{ recipes : "has recipes"
    stores ||--o{ menu_items : "has menu items"
    stores ||--o{ suppliers : "has suppliers"
    stores ||--o{ purchase_orders : "creates POs"
    stores ||--o{ alert_preferences : "has alert prefs"
    stores ||--o{ alert_history : "has alert history"
    stores ||--o{ api_keys : "has API keys"
    stores ||--o{ webhook_endpoints : "has webhooks"
    stores ||--o{ webhook_deliveries : "has deliveries"
    stores ||--o{ pos_connections : "has POS connections"
    stores ||--o{ pos_item_mappings : "has POS mappings"
    stores ||--o{ pos_sale_events : "has sale events"
    stores ||--o{ pay_runs : "has pay runs"
    stores ||--o{ invoices : "has invoices"
    stores ||--o{ accounting_connections : "has accounting"
    stores ||--o{ item_categories : "has categories"
    stores ||--o{ item_tags : "has tags"
    stores ||--o{ audit_logs : "has audit logs"
    stores ||--o{ haccp_check_templates : "has HACCP templates"
    stores ||--o{ haccp_checks : "has HACCP checks"
    stores ||--o{ haccp_temperature_logs : "has temp logs"
    stores ||--o{ haccp_corrective_actions : "has corrective actions"
    stores ||--o{ user_invites : "has invites"
    stores ||--o{ integration_oauth_states : "has OAuth states"

    profiles ||--o{ store_users : "belongs to stores"
    profiles ||--o{ shifts : "assigned shifts"
    profiles ||--o{ audit_logs : "performed actions"
    profiles ||--o{ alert_preferences : "has alert prefs"
    profiles ||--o{ alert_history : "received alerts"
    profiles ||--o{ pay_run_items : "has pay items"

    stores }o--|| profiles : "billing_user_id"
    profiles }o--o| stores : "store_id (legacy)"
    profiles }o--o| stores : "default_store_id"
    subscriptions }o--|| profiles : "billing_user_id"

    store_users }o--|| stores : "store_id"
    store_users }o--|| profiles : "user_id"
    store_users }o--o| profiles : "invited_by"

    inventory_items }o--o| item_categories : "category_id"
    inventory_items ||--o{ store_inventory : "stocked at stores"
    inventory_items ||--o{ stock_history : "has history"
    inventory_items ||--o{ waste_log : "has waste"
    inventory_items ||--o{ recipe_ingredients : "used in recipes"
    inventory_items ||--o{ supplier_items : "supplied by"
    inventory_items ||--o{ purchase_order_items : "ordered in POs"
    inventory_items ||--o{ invoice_line_items : "matched to invoices"
    inventory_items ||--o{ inventory_item_tags : "tagged"
    inventory_items ||--o{ pos_item_mappings : "mapped to POS"

    inventory_item_tags }o--|| inventory_items : "inventory_item_id"
    inventory_item_tags }o--|| item_tags : "tag_id"

    store_inventory }o--|| profiles : "last_updated_by"

    stock_history }o--o| profiles : "performed_by"
    daily_counts }o--o| profiles : "submitted_by"
    waste_log }o--|| profiles : "reported_by"

    recipes ||--o{ recipe_ingredients : "has ingredients"
    recipes ||--o{ menu_items : "has menu items"
    recipes }o--o| profiles : "created_by"

    recipe_ingredients }o--|| recipes : "recipe_id"
    recipe_ingredients }o--|| inventory_items : "inventory_item_id"

    menu_items }o--o| recipes : "recipe_id"

    suppliers ||--o{ supplier_items : "supplies items"
    suppliers ||--o{ purchase_orders : "receives POs"
    suppliers ||--o{ supplier_portal_tokens : "has portal tokens"

    supplier_items }o--|| suppliers : "supplier_id"
    supplier_items }o--|| inventory_items : "inventory_item_id"

    purchase_orders ||--o{ purchase_order_items : "has line items"
    purchase_orders }o--|| suppliers : "supplier_id"
    purchase_orders }o--o| profiles : "created_by"

    purchase_order_items }o--|| purchase_orders : "purchase_order_id"
    purchase_order_items }o--|| inventory_items : "inventory_item_id"
    purchase_order_items }o--o| supplier_items : "supplier_item_id"

    webhook_endpoints ||--o{ webhook_deliveries : "has deliveries"
    webhook_endpoints }o--|| profiles : "created_by"
    webhook_deliveries }o--|| webhook_endpoints : "webhook_endpoint_id"

    api_keys }o--|| profiles : "created_by"

    pos_connections ||--o{ pos_item_mappings : "has mappings"
    pos_connections ||--o{ pos_sale_events : "has events"
    pos_connections }o--|| profiles : "created_by"

    pos_item_mappings }o--|| pos_connections : "pos_connection_id"
    pos_item_mappings }o--|| inventory_items : "inventory_item_id"

    pos_sale_events }o--|| pos_connections : "pos_connection_id"

    pay_runs ||--o{ pay_run_items : "has items"
    pay_runs }o--o| profiles : "approved_by"
    pay_runs }o--o| profiles : "paid_by"
    pay_runs }o--o| profiles : "created_by"

    pay_run_items }o--|| pay_runs : "pay_run_id"
    pay_run_items }o--|| profiles : "user_id"

    invoices ||--o{ invoice_line_items : "has line items"
    invoice_line_items }o--|| invoices : "invoice_id"
    invoice_line_items }o--o| inventory_items : "inventory_item_id"

    accounting_connections ||--o{ accounting_sync_log : "has sync logs"
    accounting_sync_log }o--|| accounting_connections : "connection_id"

    supplier_portal_tokens }o--|| suppliers : "supplier_id"
    supplier_portal_activity }o--|| suppliers : "supplier_id"
    supplier_portal_activity }o--o| supplier_portal_tokens : "token_id"

    haccp_checks }o--o| haccp_check_templates : "template_id"
    haccp_corrective_actions }o--o| haccp_checks : "check_id"
    haccp_corrective_actions }o--o| haccp_temperature_logs : "temp_log_id"
```

### Database Enums

| Enum                  | Values                                                 |
| --------------------- | ------------------------------------------------------ |
| `user_role`           | `Owner`, `Manager`, `Staff`, `Admin`                   |
| `user_status`         | `Invited`, `Active`, `Inactive`                        |
| `store_user_role`     | `Owner`, `Manager`, `Staff`                            |
| `stock_action_type`   | `Count`, `Reception`, `Adjustment`, `Waste`, `Sale`    |
| `subscription_status` | `trialing`, `active`, `past_due`, `canceled`, `unpaid` |

### Database Functions

| Function                                   | Args   | Returns                                              |
| ------------------------------------------ | ------ | ---------------------------------------------------- |
| `get_user_store_ids()`                     | none   | `SETOF UUID` — stores the current user has access to |
| `is_store_subscription_active(p_store_id)` | `UUID` | `boolean`                                            |
| `get_trial_days_remaining(p_store_id)`     | `UUID` | `integer`                                            |
| `cleanup_expired_invites()`                | none   | `integer` — number cleaned                           |
| `get_items_by_category(p_store_id)`        | `UUID` | table of category_id, name, color, item_count        |

---

## 4. API Routes

Every endpoint, its method, description, auth, and CSRF requirement.

| Path                                                         | Methods                | Description                              | Auth                                          | CSRF                 |
| ------------------------------------------------------------ | ---------------------- | ---------------------------------------- | --------------------------------------------- | -------------------- |
| `/api/alerts/missing-counts`                                 | GET                    | List items missing daily counts          | withApiAuth: Owner, Manager, Staff            | No                   |
| `/api/audit-logs`                                            | GET                    | Retrieve audit logs with filtering       | withApiAuth: Owner, Manager                   | No                   |
| `/api/auth/callback`                                         | GET                    | Handle OAuth callback (Google)           | None (OAuth state)                            | No                   |
| `/api/auth/login`                                            | POST                   | Sign in with email/password              | Rate limit only                               | No                   |
| `/api/auth/signup`                                           | POST                   | Create a new account                     | Rate limit only                               | No                   |
| `/api/billing/invoices`                                      | GET                    | List Stripe billing invoices             | withApiAuth: Owner                            | No                   |
| `/api/billing/payment-methods`                               | GET, POST              | List / attach payment methods            | withApiAuth: Owner                            | POST: Yes            |
| `/api/billing/payment-methods/[pmId]`                        | DELETE, PATCH          | Remove / set default payment method      | withApiAuth: Owner                            | Yes                  |
| `/api/billing/setup-intent`                                  | POST                   | Create Stripe setup intent               | withApiAuth: Owner                            | Yes                  |
| `/api/billing/subscriptions`                                 | GET, POST              | List / create subscriptions              | withApiAuth: Owner (POST)                     | POST: Yes            |
| `/api/billing/subscriptions/[subscriptionId]`                | GET, PATCH             | Get / update-cancel subscription         | withApiAuth: Owner (PATCH)                    | PATCH: Yes           |
| `/api/billing/webhook`                                       | POST                   | Handle Stripe webhook events             | Stripe signature                              | No                   |
| `/api/cron/archive-data`                                     | POST                   | Archive old data (weekly)                | CRON_SECRET bearer                            | No                   |
| `/api/cron/send-alerts`                                      | POST                   | Send missing count alert emails          | CRON_SECRET bearer                            | No                   |
| `/api/csrf`                                                  | GET                    | Generate/return CSRF token               | None                                          | No                   |
| `/api/health`                                                | GET                    | Health check (auth, DB, queries)         | None                                          | No                   |
| `/api/integrations/pos/[provider]/auth`                      | GET                    | Initiate POS OAuth flow                  | withApiAuth: Owner, Manager                   | No                   |
| `/api/integrations/pos/[provider]/callback`                  | GET                    | POS OAuth callback                       | None (OAuth state)                            | No                   |
| `/api/integrations/quickbooks/auth`                          | GET                    | Initiate QuickBooks OAuth                | withApiAuth: Owner, Manager                   | No                   |
| `/api/integrations/quickbooks/callback`                      | GET                    | QuickBooks OAuth callback                | None (OAuth state)                            | No                   |
| `/api/integrations/quickbooks/disconnect`                    | POST                   | Disconnect QuickBooks                    | withApiAuth: Owner, Manager                   | Yes                  |
| `/api/integrations/xero/auth`                                | GET                    | Initiate Xero OAuth                      | withApiAuth: Owner, Manager                   | No                   |
| `/api/integrations/xero/callback`                            | GET                    | Xero OAuth callback                      | None (OAuth state)                            | No                   |
| `/api/integrations/xero/disconnect`                          | POST                   | Disconnect Xero                          | withApiAuth: Owner, Manager                   | Yes                  |
| `/api/inventory`                                             | GET, POST              | List / create inventory items            | withApiAuth: Owner, Manager (POST)            | POST: Yes            |
| `/api/inventory/[itemId]`                                    | GET, PATCH, DELETE     | Get / update / soft-delete item          | withApiAuth: Owner, Manager (mut.)            | PATCH/DELETE: Yes    |
| `/api/pos/webhook/[connectionId]`                            | POST                   | Receive POS sale webhook                 | POS webhook signature                         | No                   |
| `/api/reports/analytics`                                     | GET                    | Inventory analytics (trends)             | withApiAuth: Owner, Manager                   | No                   |
| `/api/reports/benchmark`                                     | GET                    | Industry benchmark comparison            | withApiAuth: Owner, Manager                   | No                   |
| `/api/reports/daily-summary`                                 | GET                    | Daily operational summary                | withApiAuth: Owner, Manager, Staff            | No                   |
| `/api/reports/forecast`                                      | GET                    | Demand forecasting                       | withApiAuth: Owner, Manager                   | No                   |
| `/api/reports/low-stock`                                     | GET                    | Items below PAR level                    | withApiAuth: Owner, Manager, Staff            | No                   |
| `/api/shifts`                                                | GET, POST              | List / create shifts                     | withApiAuth: Owner, Manager (POST)            | POST: Yes            |
| `/api/shifts/[shiftId]`                                      | GET, PATCH, DELETE     | Get / update / delete shift              | withApiAuth: Owner, Manager (mut.)            | PATCH/DELETE: Yes    |
| `/api/shifts/[shiftId]/clock-in`                             | POST                   | Clock in to shift                        | withApiAuth (any role)                        | Yes                  |
| `/api/shifts/[shiftId]/clock-out`                            | POST                   | Clock out of shift                       | withApiAuth (any role)                        | Yes                  |
| `/api/stores`                                                | GET, POST              | List / create stores                     | withApiAuth (any role)                        | POST: Yes            |
| `/api/stores/[storeId]`                                      | GET, PATCH, DELETE     | Get / update / delete store              | withApiAuth: Owner, Manager (mut.)            | PATCH/DELETE: Yes    |
| `/api/stores/[storeId]/accounting`                           | GET                    | Accounting connection status             | withApiAuth: Owner, Manager                   | No                   |
| `/api/stores/[storeId]/accounting/accounts`                  | GET                    | Chart of accounts from provider          | withApiAuth: Owner, Manager                   | No                   |
| `/api/stores/[storeId]/accounting/config`                    | GET, PUT               | Get / update GL mapping config           | withApiAuth: Owner, Manager                   | PUT: Yes             |
| `/api/stores/[storeId]/accounting/sync`                      | POST                   | Trigger manual accounting sync           | withApiAuth: Owner, Manager                   | Yes                  |
| `/api/stores/[storeId]/alert-history`                        | GET                    | Alert notification history               | withApiAuth: Owner, Manager                   | No                   |
| `/api/stores/[storeId]/alert-preferences`                    | GET, PUT               | Get / update alert preferences           | withApiAuth: Owner, Manager                   | PUT: Yes             |
| `/api/stores/[storeId]/api-keys`                             | GET, POST, DELETE      | List / create / revoke API keys          | withApiAuth: Owner                            | POST/DELETE: Yes     |
| `/api/stores/[storeId]/billing-owner`                        | PUT                    | Transfer billing ownership               | withApiAuth: Owner                            | Yes                  |
| `/api/stores/[storeId]/categories`                           | GET, POST              | List / create categories                 | withApiAuth: All (GET), Owner/Manager (POST)  | POST: Yes            |
| `/api/stores/[storeId]/categories/[categoryId]`              | PATCH, DELETE          | Update / delete category                 | withApiAuth: Owner, Manager                   | Yes                  |
| `/api/stores/[storeId]/export`                               | GET                    | Export store data (CSV/XLSX)             | withApiAuth: Owner                            | No                   |
| `/api/stores/[storeId]/haccp/checks`                         | GET, POST              | List / submit HACCP checks               | withApiAuth: All roles                        | POST: Yes            |
| `/api/stores/[storeId]/haccp/corrective-actions`             | GET, POST              | List / create corrective actions         | withApiAuth: All roles                        | POST: Yes            |
| `/api/stores/[storeId]/haccp/corrective-actions/[actionId]`  | PUT                    | Update corrective action                 | withApiAuth: Owner, Manager                   | Yes                  |
| `/api/stores/[storeId]/haccp/dashboard`                      | GET                    | HACCP compliance dashboard               | withApiAuth: All roles                        | No                   |
| `/api/stores/[storeId]/haccp/temperature-logs`               | GET, POST              | List / record temperature logs           | withApiAuth: All roles                        | POST: Yes            |
| `/api/stores/[storeId]/haccp/templates`                      | GET, POST              | List / create HACCP templates            | withApiAuth: Owner, Manager (POST)            | POST: Yes            |
| `/api/stores/[storeId]/haccp/templates/[templateId]`         | GET, PUT, DELETE       | Get / update / delete template           | withApiAuth: Owner, Manager (mut.)            | PUT/DELETE: Yes      |
| `/api/stores/[storeId]/history`                              | GET                    | Stock history for store                  | withApiAuth (any role)                        | No                   |
| `/api/stores/[storeId]/inventory`                            | GET                    | List store inventory                     | withApiAuth (any role)                        | No                   |
| `/api/stores/[storeId]/inventory/[itemId]`                   | PATCH, DELETE          | Update / remove store item               | withApiAuth: Owner, Manager                   | Yes                  |
| `/api/stores/[storeId]/inventory/[itemId]/tags`              | GET, POST, DELETE      | List / add / remove item tags            | withApiAuth: Owner, Manager (mut.)            | POST/DELETE: Yes     |
| `/api/stores/[storeId]/inventory/batch`                      | PATCH, DELETE          | Batch update / delete items              | withApiAuth: Owner, Manager                   | Yes                  |
| `/api/stores/[storeId]/inventory/import`                     | POST                   | Import items from CSV                    | Session auth (manual)                         | No                   |
| `/api/stores/[storeId]/inventory/template`                   | GET                    | Download CSV import template             | Session auth (manual)                         | No                   |
| `/api/stores/[storeId]/invoices`                             | GET, POST              | List / upload invoices                   | withApiAuth: Owner, Manager                   | POST: Yes            |
| `/api/stores/[storeId]/invoices/[invoiceId]`                 | GET, PATCH             | Get / update invoice (OCR)               | withApiAuth: Owner, Manager                   | PATCH: Yes           |
| `/api/stores/[storeId]/invoices/[invoiceId]/apply`           | POST                   | Apply invoice to inventory               | withApiAuth: Owner, Manager                   | Yes                  |
| `/api/stores/[storeId]/menu-analysis`                        | GET                    | Menu profitability analysis              | withApiAuth: Owner, Manager                   | No                   |
| `/api/stores/[storeId]/menu-items`                           | GET, POST              | List / create menu items                 | withApiAuth: Owner, Manager                   | POST: Yes            |
| `/api/stores/[storeId]/menu-items/[menuItemId]`              | PUT, DELETE            | Update / delete menu item                | withApiAuth: Owner, Manager                   | Yes                  |
| `/api/stores/[storeId]/notification-preferences`             | GET, PUT               | Get / update notification prefs          | withApiAuth (any role)                        | PUT: Yes             |
| `/api/stores/[storeId]/payroll/earnings`                     | GET                    | Payroll earnings for date range          | withApiAuth: All roles                        | No                   |
| `/api/stores/[storeId]/payroll/pay-runs`                     | GET, POST              | List / create pay runs                   | withApiAuth: Owner, Manager (POST)            | POST: Yes            |
| `/api/stores/[storeId]/payroll/pay-runs/[payRunId]`          | GET, PATCH, DELETE     | Get / update / delete pay run            | withApiAuth: Owner, Manager (mut.)            | PATCH/DELETE: Yes    |
| `/api/stores/[storeId]/payroll/rates`                        | GET                    | List hourly rates for staff              | withApiAuth: Owner, Manager                   | No                   |
| `/api/stores/[storeId]/payroll/rates/[userId]`               | PATCH                  | Update user hourly rate                  | withApiAuth: Owner, Manager                   | Yes                  |
| `/api/stores/[storeId]/pos`                                  | GET, POST, DELETE      | List / create / delete POS connections   | withApiAuth: Owner (mut.)                     | POST/DELETE: Yes     |
| `/api/stores/[storeId]/pos/events`                           | GET                    | List recent POS sale events              | withApiAuth: Owner, Manager                   | No                   |
| `/api/stores/[storeId]/pos/mappings`                         | GET, POST, DELETE      | List / create / delete POS mappings      | withApiAuth: Owner, Manager                   | POST/DELETE: Yes     |
| `/api/stores/[storeId]/pos/menu-items`                       | GET                    | Fetch POS menu items for mapping         | withApiAuth: Owner, Manager                   | No                   |
| `/api/stores/[storeId]/purchase-orders`                      | GET, POST              | List / create POs                        | withApiAuth: Owner, Manager                   | POST: Yes            |
| `/api/stores/[storeId]/purchase-orders/[poId]`               | GET, PUT, DELETE       | Get / update / delete PO                 | withApiAuth: Owner, Manager                   | PUT/DELETE: Yes      |
| `/api/stores/[storeId]/purchase-orders/[poId]/receive`       | POST                   | Receive PO items into inventory          | withApiAuth: Owner, Manager                   | Yes                  |
| `/api/stores/[storeId]/recipes`                              | GET, POST              | List / create recipes                    | withApiAuth: All (GET), Owner/Manager (POST)  | POST: Yes            |
| `/api/stores/[storeId]/recipes/[recipeId]`                   | GET, PUT, DELETE       | Get / update / delete recipe             | withApiAuth: Owner, Manager (mut.)            | PUT/DELETE: Yes      |
| `/api/stores/[storeId]/recipes/[recipeId]/ingredients`       | POST, DELETE           | Add / remove recipe ingredients          | withApiAuth: Owner, Manager                   | Yes                  |
| `/api/stores/[storeId]/reports/food-cost`                    | GET                    | Actual vs theoretical food cost          | withApiAuth: Owner, Manager                   | No                   |
| `/api/stores/[storeId]/stock-count`                          | POST                   | Submit stock count                       | withApiAuth: All roles                        | Yes                  |
| `/api/stores/[storeId]/stock-reception`                      | POST                   | Record stock delivery                    | withApiAuth: All roles                        | Yes                  |
| `/api/stores/[storeId]/suppliers`                            | GET, POST              | List / create suppliers                  | withApiAuth: Owner, Manager                   | POST: Yes            |
| `/api/stores/[storeId]/suppliers/[supplierId]`               | GET, PUT, DELETE       | Get / update / delete supplier           | withApiAuth: Owner, Manager                   | PUT/DELETE: Yes      |
| `/api/stores/[storeId]/suppliers/[supplierId]/items`         | GET, POST, PUT, DELETE | CRUD supplier catalog items              | withApiAuth: Owner, Manager                   | POST/PUT/DELETE: Yes |
| `/api/stores/[storeId]/suppliers/[supplierId]/portal-tokens` | GET, POST              | List / create portal tokens              | withApiAuth: Owner, Manager                   | POST: Yes            |
| `/api/stores/[storeId]/tags`                                 | GET, POST              | List / create tags                       | withApiAuth: All (GET), Owner/Manager (POST)  | POST: Yes            |
| `/api/stores/[storeId]/tags/[tagId]`                         | PATCH, DELETE          | Update / delete tag                      | withApiAuth: Owner, Manager                   | Yes                  |
| `/api/stores/[storeId]/users`                                | GET, POST              | List / add store users                   | withApiAuth: All (GET), Owner/Manager (POST)  | POST: Yes            |
| `/api/stores/[storeId]/users/[userId]`                       | PATCH, DELETE          | Update role / remove user                | withApiAuth: Owner, Manager                   | Yes                  |
| `/api/stores/[storeId]/waste`                                | GET, POST              | Get waste log / record waste             | withApiAuth: Owner, Manager (GET), All (POST) | POST: Yes            |
| `/api/stores/[storeId]/waste-analytics`                      | GET                    | Waste analytics (trends, top items)      | withApiAuth: Owner, Manager                   | No                   |
| `/api/stores/[storeId]/webhooks`                             | GET, POST, DELETE      | List / create / delete webhooks          | withApiAuth: Owner                            | POST/DELETE: Yes     |
| `/api/supplier-portal/catalog`                               | GET, PUT               | List / bulk-update supplier catalog      | withSupplierAuth: can_update_catalog          | No                   |
| `/api/supplier-portal/invoices`                              | GET, POST              | List / upload supplier invoices          | withSupplierAuth: can_upload_invoices         | No                   |
| `/api/supplier-portal/orders`                                | GET                    | List POs for supplier                    | withSupplierAuth: can_view_orders             | No                   |
| `/api/supplier-portal/orders/[poId]`                         | GET, PATCH             | Get PO / update status                   | withSupplierAuth: can_view/update_orders      | No                   |
| `/api/users/account-type`                                    | GET                    | Check if user can create stores          | withApiAuth (any role)                        | No                   |
| `/api/users/bulk-import`                                     | POST                   | Bulk import users via CSV                | withApiAuth: Owner                            | Yes                  |
| `/api/users/invite`                                          | POST                   | Invite a user                            | withApiAuth: Owner, Manager                   | Yes                  |
| `/api/users/invites`                                         | GET, DELETE            | List / cancel pending invites            | Session auth (manual)                         | DELETE: Yes          |
| `/api/users/invites/resend`                                  | POST                   | Resend invitation email                  | Session auth (manual)                         | Yes                  |
| `/api/users/onboard`                                         | POST                   | Complete onboarding for invited user     | Token-based (no user auth)                    | Yes                  |
| `/api/users/onboard/validate`                                | GET                    | Validate invitation token                | None (public)                                 | No                   |
| `/api/v1/inventory`                                          | GET                    | Public API: list inventory               | withApiKey: inventory:read                    | No                   |
| `/api/v1/stock`                                              | GET, POST              | Public API: stock history / submit count | withApiKey: stock:read/write                  | No                   |

---

## 5. Pages / Screens

Every user-facing page, its URL, and purpose.

| URL                                      | Route Group       | Description                                    |
| ---------------------------------------- | ----------------- | ---------------------------------------------- |
| `/`                                      | root              | Landing page (marketing) or dashboard redirect |
| `/login`                                 | (public)          | Email/password login with Google OAuth         |
| `/forgot-password`                       | (public)          | Password reset request form                    |
| `/reset-password`                        | (public)          | Set new password form                          |
| `/accept-invite`                         | (public)          | Accept store invite via token                  |
| `/onboard`                               | (public)          | Initial user onboarding                        |
| `/onboarding`                            | (onboarding)      | Multi-step store setup wizard                  |
| `/pricing`                               | (marketing)       | Pricing tiers page                             |
| `/terms`                                 | (legal)           | Terms of service                               |
| `/privacy`                               | (legal)           | Privacy policy                                 |
| `/cookies`                               | (legal)           | Cookie policy                                  |
| `/offline`                               | root              | PWA offline fallback                           |
| `/dashboard`                             | (dashboard)       | Alternate dashboard entry                      |
| `/inventory`                             | (dashboard)       | Main inventory list (inline edit, CSV import)  |
| `/inventory-value`                       | (dashboard)       | Inventory valuation report                     |
| `/low-stock`                             | (dashboard)       | Items below PAR level                          |
| `/stock-count`                           | (dashboard)       | Stock count submission UI                      |
| `/deliveries`                            | (dashboard)       | Stock reception / delivery tracking            |
| `/recipes`                               | (dashboard)       | Recipe builder & food costing                  |
| `/suppliers`                             | (dashboard)       | Supplier management                            |
| `/categories`                            | (dashboard)       | Category management                            |
| `/tags`                                  | (dashboard)       | Tag management                                 |
| `/users`                                 | (dashboard)       | User management                                |
| `/shifts`                                | (dashboard)       | Shift management                               |
| `/shifts/timetable`                      | (dashboard)       | Weekly timetable view                          |
| `/my-shifts`                             | (dashboard)       | Staff: own shift schedule                      |
| `/my-pay`                                | (dashboard)       | Staff: own pay stubs                           |
| `/payroll`                               | (dashboard)       | Payroll management (pay runs)                  |
| `/waste`                                 | (dashboard)       | Waste tracking & logging                       |
| `/invoices`                              | (dashboard)       | Invoice list                                   |
| `/invoices/[invoiceId]`                  | (dashboard)       | Invoice detail with OCR line items             |
| `/reports`                               | (dashboard)       | Reports hub                                    |
| `/reports/daily-summary`                 | (dashboard)       | Daily operational summary                      |
| `/reports/low-stock`                     | (dashboard)       | Low stock report                               |
| `/reports/forecast`                      | (dashboard)       | Demand forecasting                             |
| `/reports/food-cost`                     | (dashboard)       | Food cost analysis                             |
| `/reports/benchmark`                     | (dashboard)       | Store performance benchmarking                 |
| `/billing`                               | (dashboard)       | Billing overview (plans, payments)             |
| `/billing/subscribe/[storeId]`           | (dashboard)       | Stripe checkout for store                      |
| `/settings`                              | (dashboard)       | Store settings (webhooks, API keys)            |
| `/profile`                               | (dashboard)       | User profile settings                          |
| `/activity`                              | (dashboard)       | Audit log / activity feed                      |
| `/integrations`                          | (dashboard)       | Integration hub (POS + accounting)             |
| `/integrations/accounting`               | (dashboard)       | Accounting software connections                |
| `/integrations/quickbooks`               | (dashboard)       | QuickBooks OAuth setup                         |
| `/integrations/xero`                     | (dashboard)       | Xero OAuth setup                               |
| `/haccp`                                 | (dashboard)       | HACCP dashboard overview                       |
| `/haccp/checks`                          | (dashboard)       | HACCP daily checks                             |
| `/haccp/templates`                       | (dashboard)       | HACCP template management                      |
| `/haccp/temperatures`                    | (dashboard)       | Temperature monitoring                         |
| `/haccp/corrective-actions`              | (dashboard)       | Corrective actions log                         |
| `/stores/new`                            | (dashboard)       | Create new store                               |
| `/stores/[storeId]/stock`                | (dashboard)       | Store-specific stock view                      |
| `/stores/[storeId]/stock-reception`      | (dashboard)       | Store-specific delivery reception              |
| `/stores/[storeId]/users`                | (dashboard)       | Store-scoped user management                   |
| `/stores/[storeId]/categories`           | (dashboard)       | Store-scoped categories                        |
| `/stores/[storeId]/tags`                 | (dashboard)       | Store-scoped tags                              |
| `/stores/[storeId]/pos`                  | (dashboard)       | POS connection for store                       |
| `/stores/[storeId]/subscription-expired` | (dashboard)       | Subscription lapsed warning                    |
| `/portal`                                | (supplier-portal) | Supplier portal home                           |
| `/portal/catalog`                        | (supplier-portal) | Supplier: browse catalog                       |
| `/portal/orders`                         | (supplier-portal) | Supplier: PO list                              |
| `/portal/orders/[poId]`                  | (supplier-portal) | Supplier: PO detail                            |
| `/portal/invoices`                       | (supplier-portal) | Supplier: invoice history                      |

---

## 6. Environment Variables

Every `process.env.*` reference found in the codebase. No actual values included.

| Variable                                | Required | Purpose                                               |
| --------------------------------------- | -------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`              | Yes      | Supabase project URL (client-side)                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`         | Yes      | Supabase anon/public key (client-side)                |
| `SUPABASE_SERVICE_ROLE_KEY`             | Yes      | Supabase service role key (server-side, bypasses RLS) |
| `NEXT_PUBLIC_APP_URL`                   | No       | App base URL (defaults to localhost:3000)             |
| `NEXT_PUBLIC_APP_NAME`                  | No       | App display name                                      |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`    | No       | Stripe publishable key (client-side)                  |
| `STRIPE_SECRET_KEY`                     | No       | Stripe secret key (server-side)                       |
| `STRIPE_WEBHOOK_SECRET`                 | No       | Stripe webhook signing secret                         |
| `STRIPE_PRICE_ID`                       | No       | Stripe subscription price ID                          |
| `RESEND_API_KEY`                        | No       | Resend email service API key                          |
| `EMAIL_FROM`                            | No       | Sender email address                                  |
| `UPSTASH_REDIS_REST_URL`                | No       | Upstash Redis URL (production rate limiting)          |
| `UPSTASH_REDIS_REST_TOKEN`              | No       | Upstash Redis auth token                              |
| `CRON_SECRET`                           | No       | Bearer token for cron job auth (min 16 chars)         |
| `SENTRY_DSN`                            | No       | Sentry error tracking DSN (server)                    |
| `NEXT_PUBLIC_SENTRY_DSN`                | No       | Sentry DSN (client-side)                              |
| `SENTRY_AUTH_TOKEN`                     | No       | Sentry build-time auth token                          |
| `GOOGLE_CLOUD_PROJECT_ID`               | No       | Google Cloud project (invoice OCR)                    |
| `GOOGLE_DOCUMENT_AI_PROCESSOR_ID`       | No       | Document AI processor ID                              |
| `GOOGLE_DOCUMENT_AI_LOCATION`           | No       | Document AI location (defaults to 'eu')               |
| `NODE_ENV`                              | Implicit | Environment (dev/production/test)                     |
| `VITEST`                                | Implicit | Set by Vitest test runner                             |
| **Xero OAuth**                          |          |                                                       |
| `XERO_CLIENT_ID`                        | No       | Xero OAuth client ID                                  |
| `XERO_CLIENT_SECRET`                    | No       | Xero OAuth client secret                              |
| `XERO_REDIRECT_URI`                     | No       | Xero OAuth redirect URI                               |
| **QuickBooks OAuth**                    |          |                                                       |
| `QUICKBOOKS_CLIENT_ID`                  | No       | QuickBooks OAuth client ID                            |
| `QUICKBOOKS_CLIENT_SECRET`              | No       | QuickBooks OAuth client secret                        |
| `QUICKBOOKS_REDIRECT_URI`               | No       | QuickBooks OAuth redirect URI                         |
| **FreshBooks OAuth**                    |          |                                                       |
| `FRESHBOOKS_CLIENT_ID`                  | No       | FreshBooks OAuth client ID                            |
| `FRESHBOOKS_CLIENT_SECRET`              | No       | FreshBooks OAuth client secret                        |
| `FRESHBOOKS_REDIRECT_URI`               | No       | FreshBooks OAuth redirect URI                         |
| **MYOB OAuth**                          |          |                                                       |
| `MYOB_CLIENT_ID`                        | No       | MYOB OAuth client ID                                  |
| `MYOB_CLIENT_SECRET`                    | No       | MYOB OAuth client secret                              |
| `MYOB_REDIRECT_URI`                     | No       | MYOB OAuth redirect URI                               |
| **Sage OAuth**                          |          |                                                       |
| `SAGE_CLIENT_ID`                        | No       | Sage OAuth client ID                                  |
| `SAGE_CLIENT_SECRET`                    | No       | Sage OAuth client secret                              |
| `SAGE_REDIRECT_URI`                     | No       | Sage OAuth redirect URI                               |
| **Wave OAuth**                          |          |                                                       |
| `WAVE_CLIENT_ID`                        | No       | Wave OAuth client ID                                  |
| `WAVE_CLIENT_SECRET`                    | No       | Wave OAuth client secret                              |
| `WAVE_REDIRECT_URI`                     | No       | Wave OAuth redirect URI                               |
| **Zoho OAuth**                          |          |                                                       |
| `ZOHO_CLIENT_ID`                        | No       | Zoho Books OAuth client ID                            |
| `ZOHO_CLIENT_SECRET`                    | No       | Zoho Books OAuth client secret                        |
| `ZOHO_REDIRECT_URI`                     | No       | Zoho Books OAuth redirect URI                         |
| **POS: Square**                         |          |                                                       |
| `SQUARE_APPLICATION_ID`                 | No       | Square OAuth app ID                                   |
| `SQUARE_APPLICATION_SECRET`             | No       | Square OAuth secret                                   |
| `SQUARE_REDIRECT_URI`                   | No       | Square OAuth redirect                                 |
| **POS: Toast**                          |          |                                                       |
| `TOAST_CLIENT_ID`                       | No       | Toast OAuth client ID                                 |
| `TOAST_CLIENT_SECRET`                   | No       | Toast OAuth client secret                             |
| `TOAST_REDIRECT_URI`                    | No       | Toast OAuth redirect                                  |
| **POS: Clover**                         |          |                                                       |
| `CLOVER_APP_ID`                         | No       | Clover app ID                                         |
| `CLOVER_APP_SECRET`                     | No       | Clover app secret                                     |
| **POS: Lightspeed**                     |          |                                                       |
| `LIGHTSPEED_CLIENT_ID`                  | No       | Lightspeed OAuth client ID                            |
| `LIGHTSPEED_CLIENT_SECRET`              | No       | Lightspeed OAuth client secret                        |
| `LIGHTSPEED_REDIRECT_URI`               | No       | Lightspeed OAuth redirect                             |
| **POS: Shopify**                        |          |                                                       |
| `SHOPIFY_CLIENT_ID`                     | No       | Shopify OAuth client ID                               |
| `SHOPIFY_CLIENT_SECRET`                 | No       | Shopify OAuth client secret                           |
| `SHOPIFY_REDIRECT_URI`                  | No       | Shopify OAuth redirect                                |
| **POS: Others**                         |          |                                                       |
| `ZETTLE_CLIENT_ID/SECRET/REDIRECT_URI`  | No       | Zettle POS OAuth                                      |
| `SUMUP_CLIENT_ID/SECRET/REDIRECT_URI`   | No       | SumUp POS OAuth                                       |
| `SPOTON_CLIENT_ID/SECRET/REDIRECT_URI`  | No       | SpotOn POS OAuth                                      |
| `REVEL_CLIENT_ID/SECRET/REDIRECT_URI`   | No       | Revel POS OAuth                                       |
| `FOODICS_CLIENT_ID/SECRET/REDIRECT_URI` | No       | Foodics POS OAuth                                     |
| `GOTAB_CLIENT_ID/SECRET/REDIRECT_URI`   | No       | GoTab POS OAuth                                       |
| `UPSERVE_CLIENT_ID/SECRET/REDIRECT_URI` | No       | Upserve POS OAuth                                     |
| `CAKE_CLIENT_ID/SECRET/REDIRECT_URI`    | No       | CAKE POS OAuth                                        |

---

## 7. Third-Party Integrations

| Service                      | Purpose                                                                                                                                                                                                                                                           | Files                                                               | Env Vars                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Supabase**                 | PostgreSQL database, Auth (email + Google OAuth), Storage, RLS                                                                                                                                                                                                    | `lib/supabase/*.ts`                                                 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`              |
| **Stripe**                   | Subscription billing, payment methods, invoices, webhooks                                                                                                                                                                                                         | `lib/stripe/*.ts`, `components/billing/*.tsx`                       | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| **Resend**                   | Transactional emails (invites, alerts, notifications, payslips)                                                                                                                                                                                                   | `lib/email.ts`, `lib/email-alerts.ts`, `lib/email-notifications.ts` | `RESEND_API_KEY`, `EMAIL_FROM`                                                                        |
| **Upstash Redis**            | Production rate limiting (sliding window). In-memory Map fallback in dev                                                                                                                                                                                          | `lib/rate-limit.ts`                                                 | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                                  |
| **Sentry**                   | Error tracking (client, server, edge)                                                                                                                                                                                                                             | `sentry.*.config.ts`                                                | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`                                           |
| **Vercel**                   | Hosting, CI/CD, analytics, speed insights, cron jobs                                                                                                                                                                                                              | `vercel.json`, `@vercel/analytics`, `@vercel/speed-insights`        | —                                                                                                     |
| **Google Cloud Document AI** | Invoice OCR (extract line items from uploaded invoices)                                                                                                                                                                                                           | `lib/services/invoice-ocr.ts`                                       | `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_DOCUMENT_AI_PROCESSOR_ID`, `GOOGLE_DOCUMENT_AI_LOCATION`           |
| **Xero**                     | Accounting integration (push invoices as bills, contact sync)                                                                                                                                                                                                     | `lib/services/accounting/xero.ts`, API routes                       | `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`                                           |
| **QuickBooks Online**        | Accounting integration (bill sync, chart of accounts)                                                                                                                                                                                                             | `lib/services/accounting/quickbooks.ts`, API routes                 | `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_REDIRECT_URI`                         |
| **FreshBooks**               | Accounting adapter (defined, limited integration)                                                                                                                                                                                                                 | `lib/services/accounting/freshbooks.ts`                             | `FRESHBOOKS_CLIENT_ID/SECRET/REDIRECT_URI`                                                            |
| **MYOB**                     | Accounting adapter (defined, limited integration)                                                                                                                                                                                                                 | `lib/services/accounting/myob.ts`                                   | `MYOB_CLIENT_ID/SECRET/REDIRECT_URI`                                                                  |
| **Sage**                     | Accounting adapter (defined, limited integration)                                                                                                                                                                                                                 | `lib/services/accounting/sage.ts`                                   | `SAGE_CLIENT_ID/SECRET/REDIRECT_URI`                                                                  |
| **Wave**                     | Accounting adapter (defined, limited integration)                                                                                                                                                                                                                 | `lib/services/accounting/wave.ts`                                   | `WAVE_CLIENT_ID/SECRET/REDIRECT_URI`                                                                  |
| **Zoho Books**               | Accounting adapter (defined, limited integration)                                                                                                                                                                                                                 | `lib/services/accounting/zoho-books.ts`                             | `ZOHO_CLIENT_ID/SECRET/REDIRECT_URI`                                                                  |
| **Square**                   | POS integration (menu sync, sale events, OAuth)                                                                                                                                                                                                                   | `lib/services/pos/adapters/square.ts`                               | `SQUARE_APPLICATION_ID/SECRET/REDIRECT_URI`                                                           |
| **Toast**                    | POS integration                                                                                                                                                                                                                                                   | `lib/services/pos/adapters/toast.ts`                                | `TOAST_CLIENT_ID/SECRET/REDIRECT_URI`                                                                 |
| **Clover**                   | POS integration                                                                                                                                                                                                                                                   | `lib/services/pos/adapters/clover.ts`                               | `CLOVER_APP_ID/APP_SECRET`                                                                            |
| **Lightspeed**               | POS integration                                                                                                                                                                                                                                                   | `lib/services/pos/adapters/lightspeed.ts`                           | `LIGHTSPEED_CLIENT_ID/SECRET/REDIRECT_URI`                                                            |
| **Shopify POS**              | POS integration                                                                                                                                                                                                                                                   | `lib/services/pos/adapters/shopify-pos.ts`                          | `SHOPIFY_CLIENT_ID/SECRET/REDIRECT_URI`                                                               |
| **Zettle**                   | POS integration                                                                                                                                                                                                                                                   | `lib/services/pos/adapters/zettle.ts`                               | `ZETTLE_CLIENT_ID/SECRET/REDIRECT_URI`                                                                |
| **SumUp**                    | POS integration                                                                                                                                                                                                                                                   | `lib/services/pos/adapters/sumup.ts`                                | `SUMUP_CLIENT_ID/SECRET/REDIRECT_URI`                                                                 |
| **SpotOn**                   | POS integration                                                                                                                                                                                                                                                   | `lib/services/pos/adapters/spoton.ts`                               | `SPOTON_CLIENT_ID/SECRET/REDIRECT_URI`                                                                |
| **Revel**                    | POS integration                                                                                                                                                                                                                                                   | `lib/services/pos/adapters/revel.ts`                                | `REVEL_CLIENT_ID/SECRET/REDIRECT_URI`                                                                 |
| **Foodics**                  | POS integration                                                                                                                                                                                                                                                   | `lib/services/pos/adapters/foodics.ts`                              | `FOODICS_CLIENT_ID/SECRET/REDIRECT_URI`                                                               |
| **GoTab**                    | POS integration                                                                                                                                                                                                                                                   | `lib/services/pos/adapters/gotab.ts`                                | `GOTAB_CLIENT_ID/SECRET/REDIRECT_URI`                                                                 |
| **Upserve**                  | POS integration                                                                                                                                                                                                                                                   | `lib/services/pos/adapters/upserve.ts`                              | `UPSERVE_CLIENT_ID/SECRET/REDIRECT_URI`                                                               |
| **CAKE**                     | POS integration                                                                                                                                                                                                                                                   | `lib/services/pos/adapters/cake.ts`                                 | `CAKE_CLIENT_ID/SECRET/REDIRECT_URI`                                                                  |
| **+ 24 more POS**            | Aldelo Express, Digital Dining, Epos Now, Focus POS, Future POS, Gastrofix, Harbortouch, Heartland, HungerRush, iiko, Lavu, Maitre'D, NCR Voyix, Oracle MICROS, PAR Brink, POSitouch, POSRocket, Qu POS, SICOM, SpeedLine, Squirrel, Tevalis, TouchBistro, Xenial | `lib/services/pos/adapters/*.ts`                                    | Provider-specific (some use API keys, not OAuth)                                                      |

---

## 8. Dead Code

Files, components, functions, or imports that are never used or are explicitly deprecated.

| Path                                           | Type      | Issue                                                                          |
| ---------------------------------------------- | --------- | ------------------------------------------------------------------------------ |
| `hooks/useStoreInventory.old.ts`               | File      | Deprecated old hook, replaced by `useStoreInventory.ts`                        |
| `hooks/useStoreUsers.old.ts`                   | File      | Deprecated old hook, replaced by `useStoreUsers.ts`                            |
| `hooks/useStores.old.ts`                       | File      | Deprecated old hook, replaced by `useStores.ts`                                |
| `components/providers/AuthProvider.tsx.backup` | File      | Backup copy of AuthProvider, not imported anywhere                             |
| `lib/auth.ts` — `hasGlobalAccess()`            | Function  | Marked `@deprecated`, use store-based functions                                |
| `lib/auth.ts` — `isStoreScopedRole()`          | Function  | Marked `@deprecated`, use store-based functions                                |
| `lib/auth.ts` — `canAccessStoreLegacy()`       | Function  | Marked `@deprecated`, use `canAccessStore` with stores array                   |
| `lib/auth.ts` — `getDefaultStoreId()`          | Function  | Marked `@deprecated`, use `getDefaultStore` with stores array                  |
| `lib/auth.ts` — `canManageStores()`            | Function  | Marked `@deprecated`, use `canManageUsersAtStore`                              |
| `lib/auth.ts` — `canViewAllStores()`           | Function  | Marked `@deprecated`, use `hasAnyStoreAccess`                                  |
| `profiles.store_id`                            | DB Column | Legacy column from single-tenant era; replaced by `store_users` junction table |
| `profiles.role`                                | DB Column | Legacy column; roles now per-store via `store_users.role`                      |
| `inventory_items.category`                     | DB Column | Legacy text column; replaced by `category_id` FK to `item_categories`          |
| `lib/services/accounting/freshbooks.ts`        | File      | Adapter defined but no corresponding DB migration or UI                        |
| `lib/services/accounting/myob.ts`              | File      | Adapter defined but no corresponding DB migration or UI                        |
| `lib/services/accounting/sage.ts`              | File      | Adapter defined but no corresponding DB migration or UI                        |
| `lib/services/accounting/wave.ts`              | File      | Adapter defined but no corresponding DB migration or UI                        |
| `lib/services/accounting/zoho-books.ts`        | File      | Adapter defined but no corresponding DB migration or UI                        |
| `ARCHITECTURE_CHANGES.md`                      | File      | Documentation artifact, not referenced by app code                             |
| `CONTRIBUTING.md`                              | File      | Documentation artifact                                                         |
| `MIGRATION_GUIDE.md`                           | File      | Documentation artifact                                                         |
| `PLAN.md`                                      | File      | Documentation artifact                                                         |
| `notes.md`                                     | File      | Developer notes, not referenced                                                |
| `docs/` (entire directory)                     | Directory | 25+ documentation files not referenced by app code                             |

---

## 9. Tests

Every test file, what it covers, and status notes. Total: ~1,163 tests across 96 files.

### Hook Tests (`tests/hooks/`) — 7 files, jsdom environment

| File                           | Covers                                  | Notes |
| ------------------------------ | --------------------------------------- | ----- |
| `useAutoRefresh.test.ts`       | Auto-refresh interval timer logic       |       |
| `useBarcodeScanner.test.ts`    | Barcode scanner input handling          |       |
| `useCSRF.test.ts`              | CSRF token reading and csrfFetch helper |       |
| `useFormDraft.test.ts`         | Auto-save form drafts to localStorage   |       |
| `useOfflineSync.test.ts`       | Offline sync with IndexedDB (Dexie)     |       |
| `useStoreSetupStatus.test.ts`  | Store setup wizard completion tracking  |       |
| `useSubscriptionGuard.test.ts` | Feature gating by subscription plan     |       |

### API Integration Tests (`tests/integration/api/`) — 52 files

| File                               | Covers                                 | Notes |
| ---------------------------------- | -------------------------------------- | ----- |
| `alert-preferences.test.ts`        | GET/PUT alert preferences endpoints    |       |
| `analytics.test.ts`                | GET analytics/trends endpoint          |       |
| `api-keys.test.ts`                 | API key CRUD endpoints                 |       |
| `audit-logs.test.ts`               | Audit log retrieval with filtering     |       |
| `auth-callback.test.ts`            | OAuth callback handling (Google)       |       |
| `auth.test.ts`                     | Login and signup endpoints             |       |
| `benchmark.test.ts`                | Benchmark report endpoint              |       |
| `billing-webhook.test.ts`          | Stripe webhook event handling          |       |
| `billing.test.ts`                  | Billing/subscription CRUD              |       |
| `bulk-import.test.ts`              | Bulk user import via CSV               |       |
| `categories.test.ts`               | Category CRUD endpoints                |       |
| `cron-alerts.test.ts`              | Cron job: send missing count alerts    |       |
| `csrf.test.ts`                     | CSRF token generation endpoint         |       |
| `daily-summary.test.ts`            | Daily summary report endpoint          |       |
| `food-cost-report.test.ts`         | Food cost report endpoint              |       |
| `forecast.test.ts`                 | Demand forecast endpoint               |       |
| `haccp-checks.test.ts`             | HACCP check submission & listing       |       |
| `haccp-corrective-actions.test.ts` | HACCP corrective action CRUD           |       |
| `haccp-dashboard.test.ts`          | HACCP dashboard aggregation            |       |
| `haccp-temperatures.test.ts`       | Temperature log recording & listing    |       |
| `haccp-templates.test.ts`          | HACCP template CRUD                    |       |
| `health.test.ts`                   | Health check endpoint                  |       |
| `inventory-item.test.ts`           | Single inventory item CRUD             |       |
| `inventory.test.ts`                | Store inventory listing & management   |       |
| `invoices.test.ts`                 | Invoice upload, OCR, matching          |       |
| `menu-analysis.test.ts`            | Menu profitability analysis            |       |
| `missing-counts.test.ts`           | Missing stock count alert              |       |
| `notification-preferences.test.ts` | Notification preference CRUD           |       |
| `pos-expansion.test.ts`            | Expanded POS provider list             |       |
| `pos.test.ts`                      | POS connection CRUD & events           |       |
| `purchase-orders.test.ts`          | Purchase order CRUD & receiving        |       |
| `quickbooks-integration.test.ts`   | QuickBooks OAuth & sync                |       |
| `recipes.test.ts`                  | Recipe CRUD with ingredients           |       |
| `reports.test.ts`                  | Report endpoints (low-stock, etc.)     |       |
| `shift-detail.test.ts`             | Single shift CRUD                      |       |
| `shifts-clock-out.test.ts`         | Clock-out endpoint                     |       |
| `shifts-clock.test.ts`             | Clock-in endpoint                      |       |
| `shifts.test.ts`                   | Shift listing & creation               |       |
| `stock-operations.test.ts`         | Stock count submission                 |       |
| `stock-reception.test.ts`          | Stock reception recording              |       |
| `store-detail.test.ts`             | Single store CRUD                      |       |
| `store-inventory-cost.test.ts`     | Inventory cost calculations            |       |
| `stores.test.ts`                   | Store listing & creation               |       |
| `supplier-portal.test.ts`          | Supplier portal token auth & endpoints |       |
| `suppliers.test.ts`                | Supplier CRUD                          |       |
| `tags.test.ts`                     | Tag CRUD                               |       |
| `users-invite.test.ts`             | User invitation flow                   |       |
| `v1-api.test.ts`                   | V1 public API (API key auth)           |       |
| `waste-analytics.test.ts`          | Waste analytics endpoint               |       |
| `waste-report.test.ts`             | Waste reporting endpoint               |       |
| `webhooks.test.ts`                 | Webhook endpoint CRUD & delivery       |       |
| `xero-integration.test.ts`         | Xero OAuth & sync                      |       |

### RLS Integration Tests (`tests/integration/rls/`) — 4 files

| File                          | Covers                                             | Notes                              |
| ----------------------------- | -------------------------------------------------- | ---------------------------------- |
| `audit-logs-rls.test.ts`      | Audit log RLS (append-only, cross-store isolation) | Requires real Supabase credentials |
| `inventory-items-rls.test.ts` | Inventory item RLS (store scoping)                 | Requires real Supabase credentials |
| `shifts-rls.test.ts`          | Shift RLS (store scoping, staff field-level)       | Requires real Supabase credentials |
| `store-users-rls.test.ts`     | Store user RLS (cross-store isolation)             | Requires real Supabase credentials |

### Library Tests (`tests/lib/`) — 29 files

| File                                      | Covers                                               | Notes |
| ----------------------------------------- | ---------------------------------------------------- | ----- |
| `api/middleware.test.ts`                  | `withApiAuth` middleware (session, RBAC, rate limit) |       |
| `api/response.test.ts`                    | API response helpers (apiSuccess, apiError, etc.)    |       |
| `api-keys.test.ts`                        | API key hashing & validation utilities               |       |
| `audit.test.ts`                           | `auditLog()` function                                |       |
| `auth.test.ts`                            | Role/permission helper functions                     |       |
| `billing-config.test.ts`                  | Billing plan configuration                           |       |
| `constants.test.ts`                       | App constants (roles, permissions)                   |       |
| `csrf.test.ts`                            | CSRF token generation/validation                     |       |
| `email-alerts.test.ts`                    | Low-stock email alert formatting                     |       |
| `export.test.ts`                          | CSV/JSON export helpers                              |       |
| `forecasting/engine.test.ts`              | Time-series demand forecasting                       |       |
| `offline/db.test.ts`                      | Dexie IndexedDB schema                               |       |
| `offline/sync.test.ts`                    | Offline sync strategy                                |       |
| `rate-limit.test.ts`                      | Rate limiting (Upstash + in-memory)                  |       |
| `services/alertService.test.ts`           | Alert generation & delivery                          |       |
| `services/edi.test.ts`                    | EDI document processing                              |       |
| `services/food-cost.test.ts`              | Food cost calculation engine                         |       |
| `services/notifications.test.ts`          | Notification dispatch logic                          |       |
| `services/pos/pos.test.ts`                | POS provider registry                                |       |
| `services/pos/new-providers.test.ts`      | New POS provider adapters                            |       |
| `services/pos/us-providers.test.ts`       | US POS provider adapters                             |       |
| `services/pos/webhook-validators.test.ts` | POS webhook validation                               |       |
| `shift-patterns.test.ts`                  | Shift pattern generation                             |       |
| `utils.test.ts`                           | General utilities (cn, etc.)                         |       |
| `utils/units.test.ts`                     | Unit conversion (kg/lb, etc.)                        |       |
| `validations/auth.test.ts`                | Auth Zod schemas                                     |       |
| `validations/bulk-import.test.ts`         | Bulk import schemas                                  |       |
| `validations/inventory.test.ts`           | Inventory schemas                                    |       |
| `validations/recipes.test.ts`             | Recipe schemas                                       |       |
| `validations/shift.test.ts`               | Shift schemas                                        |       |
| `validations/store.test.ts`               | Store schemas                                        |       |
| `validations/suppliers.test.ts`           | Supplier schemas                                     |       |
| `validations/user.test.ts`                | User schemas                                         |       |

### Test Utilities (`tests/utils/`) — 2 files

| File                  | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| `test-helpers.ts`     | Common mock factories, auth context builders   |
| `rls-test-helpers.ts` | RLS test setup (real Supabase client creation) |

### Flagged Test Issues

| Issue                                                                                                                                                    | Details                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| No validation tests for `haccp.ts`, `invoices.ts`, `notifications.ts`, `payroll.ts`, `accounting.ts`, `categories-tags.ts`, `supplier-portal.ts` schemas | Zod schemas exist in `lib/validations/` but no corresponding test files       |
| RLS tests require real credentials                                                                                                                       | 4 RLS test files skip in CI (no `SUPABASE_SERVICE_ROLE_KEY` in test env)      |
| No component/UI tests                                                                                                                                    | No `*.test.tsx` files for React components — only hooks and API routes tested |
