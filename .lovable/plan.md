

## Fix commission-liquidation linkage and origin display

### Problems identified

1. **Missing `liquidation_id` update from liquidation detail page**: In `LiquidacionDetalle.tsx` line 598-602, when adding commissions from the liquidation detail, it only updates `status: 'paid'` but never sets `liquidation_id` on the commission record. This is why the commissions list shows "-" in the Liquidación column.

2. **"Sin origen" in liquidation items**: In `LiquidacionDetalle.tsx` line 582, the description falls back to "Sin origen" because it only checks `budget` and `contract` but not `invoices`. These are invoice-based commissions with no contract/budget.

3. **Same issue in `AddCommissionToLiquidationModal.tsx`**: The description builder (line 151-157) also doesn't include invoice codes.

4. **Available commissions query doesn't exclude already-linked**: Line 348-354 queries by status only, doesn't filter out commissions already linked to a liquidation.

### Changes

**1. `src/pages/LiquidacionDetalle.tsx`**
- In `addCommissionsMutation` (line 598): add `liquidation_id: id` to the update alongside `status` and `paid_at`
- In the available commissions query (line 348): add `.is('liquidation_id', null)` filter and also fetch `invoice_ids` 
- Expand the select to include invoice data join or fetch invoice codes separately
- Update description builder (line 582): when no budget/contract, look up invoice codes from the commission's `invoice_ids` and display them

**2. `src/components/commissions/AddCommissionToLiquidationModal.tsx`**
- Add `invoices` to the `CommissionForLiquidation` interface
- Update description builder (line 151-157): include invoice codes when no contract/budget exists

### Files changed
- `src/pages/LiquidacionDetalle.tsx` — set `liquidation_id`, filter already-linked, fix description
- `src/components/commissions/AddCommissionToLiquidationModal.tsx` — include invoice codes in description

