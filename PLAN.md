# Implementation Plan: Onboarding + Inventory Page Overhaul

## Thinking as the Restaurant Owner

I'm Marcus. I just signed up. I have a restaurant with 40 items, 3 suppliers, and 5 staff. I want to set this up THIS AFTERNOON so tomorrow when my kitchen opens, everyone can use this system.

**My ideal onboarding:** Import inventory (with what I actually have in stock), set my hours, add my suppliers, invite my team. One sitting, fully set up. Don't dump me on the dashboard half-done and make me hunt for settings.

**My ideal inventory page:** I'm standing in the kitchen on my phone. I need to see item name, what's in stock, what I should have (PAR), and what it costs me. I need to change PAR levels when I realise 10 is too low — right there, click and change. No grey boxes, no confusing labels, no hidden columns on mobile.

---

## Phase 1: CSV Template & Import (Backend)

### 1A. Update CSV template
**Files:** `app/api/stores/[storeId]/inventory/template/route.ts`, `inventory-template.csv`

- New columns: `Item Name, Category, Current Stock, Minimum Stock Level, Unit Cost (£)`
- Remove the `Unit (kg/litres/each/etc)` column entirely from the template
- Example rows updated with realistic current stock values:
  ```
  Item Name,Category,Current Stock,Minimum Stock Level,Unit Cost (£)
  Chicken Breast,Proteins,15,10,5.50
  Tomatoes,Produce,8,5,2.00
  Olive Oil,Oils & Condiments,2,3,8.99
  Mozzarella Cheese,Dairy,12,8,12.50
  Paper Towels,Supplies,25,20,3.75
  ```

### 1B. Update import route
**File:** `app/api/stores/[storeId]/inventory/import/route.ts`

- Add header alias: `'current stock'` → `'current_stock'`
- Add `current_stock` to Zod schema (optional, non-negative number, defaults to 0)
- Remove `unit` from required headers — default to `'each'` if missing
- Track `currentStocks` array alongside `parLevels` and `unitCosts`
- Use `currentStocks[index]` for `store_inventory.quantity` instead of hardcoded `0`
- Update expected headers list and error messages

### 1C. Update CSVImport component
**File:** `components/inventory/CSVImport.tsx`

- Update instructions text: remove "units" mention
- Update format info Alert:
  - **Required:** Item Name, Category
  - **Optional:** Current Stock, Minimum Stock Level, Unit Cost (£)
- Update ImportError interface to remove `unit`

---

## Phase 2: Inventory Page Overhaul (Frontend)

### 2A. Remove grey thumbnail placeholder
**File:** `app/(dashboard)/inventory/page.tsx`

- Delete the `<div className="h-10 w-10 rounded border bg-muted...">` block (lines 577-579)
- Item cell shows just name + category subtitle (no icon box)

### 2B. Move Category into Item cell, remove Category column
**File:** `app/(dashboard)/inventory/page.tsx`

- Remove separate Category `<TableHead>` and `<TableCell>` columns
- Show category as muted text below item name (where unit_of_measure used to show)
- This reclaims a full column width for mobile

### 2C. Remove unit from item display
**File:** `app/(dashboard)/inventory/page.tsx`

- Remove `<p className="text-xs text-muted-foreground">{item.unit_of_measure}</p>` from item cell
- Replace with category subtitle (from 2B above)

### 2D. Rename columns
**File:** `app/(dashboard)/inventory/page.tsx`

- `"On hand"` → `"In Stock"` (TableHead, export column)
- `"Cost"` → `"Unit Cost"` (TableHead)
- Update export CSV header too: `'On Hand'` → `'In Stock'`

### 2E. Show all columns on mobile
**File:** `app/(dashboard)/inventory/page.tsx`

- Remove `hidden md:table-cell` from Category (now it's in the Item cell, so N/A)
- Remove `hidden lg:table-cell` from Unit Cost column — show on ALL screens
- Tighten column widths: In Stock `w-[70px]`, PAR `w-[70px]`, Unit Cost `w-[80px]`
- Actions column stays compact `w-[40px]`

### 2F. Add inline PAR level editing
**File:** `app/(dashboard)/inventory/page.tsx`

- Mirror the existing inline cost editing pattern (editingCostId/editingCostValue/handleSaveCost)
- Add: `editingParId`, `editingParValue`, `savingPar` state
- Add: `handleStartParEdit`, `handleSavePar`, `handleParKeyDown` functions
- PAR cell: click to edit (same inline Input pattern as cost)
- Save via PATCH to `/api/stores/${storeId}/inventory/${itemId}` with `{ par_level: value }`
- Show clickable PAR value or "Set" badge (same pattern as cost)

### 2G. Improve Low badge logic
**File:** `app/(dashboard)/inventory/page.tsx`

- Current: `isLowStock = par_level !== null && quantity < par_level`
- New logic:
  - `quantity === 0` → Show "No Stock" badge in muted/grey (not alarming)
  - `0 < quantity < par_level` → Show "Low" badge in red (actionable)
  - `quantity >= par_level` → No badge (healthy)

---

## Phase 3: Setup Wizard Enhancement

### 3A. Add 'suppliers' step to types
**File:** `types/setup.ts`

- Extend `SetupStepId`: `'inventory' | 'hours' | 'team' | 'suppliers'`
- Add `supplierCount` to `SetupStatusData`

### 3B. Update setup status hook
**File:** `hooks/useStoreSetupStatus.ts`

- Add `suppliers` step config (icon: `Truck`, title: "Add Your Suppliers")
- Mark ALL steps `isRequired: true`
- Add supplier count fetch from `suppliers` table
- New completion: `suppliers` → `data.supplierCount > 0`
- `isSetupComplete` = ALL steps complete (not just required ones, since all are required)
- Change step order: inventory → hours → team → suppliers

### 3C. Make wizard sequential
**File:** `components/store/setup/StoreSetupWizard.tsx`

- Pass `isLocked` prop to SetupStepCard
- Step N is locked if step N-1 is NOT complete
- When a step completes, auto-expand the next incomplete step
- Step 1 (inventory) is never locked

### 3D. Add locked state to SetupStepCard
**File:** `components/store/setup/SetupStepCard.tsx`

- Accept `isLocked` prop
- When locked: grey out the card, show lock icon, disable click
- Tooltip or subtle text: "Complete the previous step first"
- Cannot expand when locked

### 3E. Create SuppliersSetupStep
**File:** `components/store/setup/steps/SuppliersSetupStep.tsx` (NEW)

- Simplified inline form (NOT dialog-based like SupplierForm)
- Fields: Supplier Name (required), Contact Person, Phone, Email
- "Add Supplier" button
- Shows list of added suppliers below the form
- Calls POST `/api/stores/[storeId]/suppliers` directly
- On success: calls `onComplete()` to refresh wizard

### 3F. Wire up wizard
**File:** `components/store/setup/StoreSetupWizard.tsx`

- Import SuppliersSetupStep
- Add rendering for `step.id === 'suppliers'`
- Pass appropriate props

---

## Phase 4: Verification

### 4A. Run tests
- `npm run test:run` — all 1201+ tests should pass
- Fix any failures from changed column names or updated imports

### 4B. Build verification
- `npm run build` — clean build, zero TypeScript errors

---

## Files Modified (Summary)

| File | Changes |
|------|---------|
| `app/api/stores/[storeId]/inventory/template/route.ts` | New CSV columns, remove Unit |
| `app/api/stores/[storeId]/inventory/import/route.ts` | Handle Current Stock, optional Unit |
| `inventory-template.csv` | Updated template |
| `components/inventory/CSVImport.tsx` | Updated instructions |
| `app/(dashboard)/inventory/page.tsx` | Major overhaul (columns, mobile, inline PAR) |
| `types/setup.ts` | Add suppliers step |
| `hooks/useStoreSetupStatus.ts` | All required, suppliers step, sequential |
| `components/store/setup/StoreSetupWizard.tsx` | Sequential locking, suppliers step |
| `components/store/setup/SetupStepCard.tsx` | Locked state |
| `components/store/setup/steps/SuppliersSetupStep.tsx` | NEW — supplier onboarding |
