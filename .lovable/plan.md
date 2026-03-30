

## Problem Analysis

**LIQ-2026-021** has 6 commission items in `liquidation_items` with description "Comisión AM - Sin origen", but the corresponding `sales_commissions` records have `liquidation_id = NULL`. This means:

1. The query that fetches commission details (`WHERE liquidation_id = id`) returns empty
2. The UI shows the commission rows but with no calculation breakdown (percentage, base amount, invoice codes)

The root cause: when these commissions were originally added, the `sales_commissions.liquidation_id` update either failed silently (likely due to `as any` type casting hiding errors) or was done through an older code path that didn't set it.

**For future liquidations**: The current code paths (both `LiquidacionDetalle` and `LiquidationFormModal`) DO attempt to set `liquidation_id`, and the descriptions now include percentage and origin. However, the `as any` casting on `sales_commissions` operations could still mask failures.

---

## Plan

### 1. Fix historical data for LIQ-2026-021

Run a SQL update to link the orphaned `sales_commissions` records to this liquidation by matching on `seller_user_id` (the specialist's user) and `commission_amount` matching the `liquidation_items.total`.

### 2. Remove unnecessary `as any` casting

In `LiquidacionDetalle.tsx`, remove `as any` from all `sales_commissions` operations. The table IS defined in the TypeScript types, so the casting hides potential errors. This applies to ~4 locations in the file.

### 3. Add fallback display for commission items without linked details

In `GroupedLiquidationItemsTable.tsx`, when `commissionDetails` has no matching entry for a commission item, parse the description itself to show whatever info is embedded (e.g., percentage and origin from the description text), instead of showing nothing.

### 4. Ensure item descriptions always include full traceability

Verify both commission-adding paths (`LiquidacionDetalle` and `LiquidationFormModal`) generate descriptions with the format: `Comisión {type} ({percentage}%) — {origin}`. Both already do this in current code — confirmed.

---

## Technical Details

**File changes:**

| File | Change |
|------|--------|
| `src/pages/LiquidacionDetalle.tsx` | Remove `as any` on `sales_commissions` operations (~4 places) |
| `src/components/liquidations/GroupedLiquidationItemsTable.tsx` | Add fallback: parse commission description for display when no `commissionDetails` match |
| Database (data fix) | UPDATE `sales_commissions` to link the 6 orphaned records to LIQ-2026-021's liquidation ID |

**Data fix query** (will use insert tool):
```sql
-- Match commissions by specialist user_id + amount to liquidation items
UPDATE sales_commissions 
SET liquidation_id = (SELECT id FROM liquidations WHERE code = 'LIQ-2026-021')
WHERE id IN ('<matched commission ids>')
AND liquidation_id IS NULL;
```

This fix resolves the current LIQ-2026-021 issue and hardens the system so future liquidations won't lose commission details.

