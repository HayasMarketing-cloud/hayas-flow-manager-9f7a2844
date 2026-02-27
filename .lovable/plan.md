

## Fix: Include approved commissions in liquidation detail

### Problem
The query on line 352 of `LiquidacionDetalle.tsx` filters commissions by `.eq('status', 'pending')`, but the commissions shown in the screenshot have status `'approved'` (Aprobada). Only approved commissions should be available to add to liquidations — pending ones haven't been validated yet.

### Change in `src/pages/LiquidacionDetalle.tsx`

**Line 352:** Change `.eq('status', 'pending')` to `.in('status', ['pending', 'approved'])` to include both pending and approved commissions. This ensures commissions that have been approved (validated) appear in the liquidation editor.

Additionally, update the mutation (around line 610) that sets commission status to `'paid'` — this remains correct since adding to a liquidation means it will be paid.

### Files changed
- `src/pages/LiquidacionDetalle.tsx` — 1 line change

