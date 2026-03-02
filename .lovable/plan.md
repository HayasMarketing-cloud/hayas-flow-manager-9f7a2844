

## Add commissions to liquidations from the commissions list

### Context
Currently, commissions can be included in liquidations only from the liquidation detail view. The user wants bidirectional association: from the commissions list, select commissions and add them to a liquidation, and show a link to the associated liquidation in the table.

### Database change
The `sales_commissions` table needs a `liquidation_id` column (nullable UUID, FK to `liquidations`).

```sql
ALTER TABLE public.sales_commissions 
ADD COLUMN liquidation_id UUID REFERENCES public.liquidations(id);
```

### Key challenge: user_id vs specialist_id
Commissions use `seller_user_id` (auth user ID from profiles), while liquidations use `specialist_id` (from `specialists` table). The bridge is `specialists.user_id`. When adding a commission to a liquidation, we need to look up the specialist via `specialists.user_id = commission.seller_user_id`.

### Changes

**1. Database migration** — Add `liquidation_id` column to `sales_commissions`

**2. `src/pages/Comisiones.tsx`**
- Fetch `liquidation_id` (already comes with `*` select) and join liquidation code: add `liquidation:liquidations(id, code)` to the select
- Pass liquidation data to `CommissionTableView`
- Add state for "Add to Liquidation" modal and selected commission IDs

**3. `src/components/commissions/CommissionTableView.tsx`**
- Add `liquidation` field to Commission interface: `{ id: string; code: string } | null`
- Add new "Liquidación" column in the table showing the liquidation code as a link to `/liquidaciones/{id}`, or "-" if none
- Add "Añadir a liquidación" option in the dropdown menu (only when `liquidation_id` is null and status is not 'paid')
- Expose an `onAddToLiquidation` callback prop

**4. New component: `src/components/commissions/AddCommissionToLiquidationModal.tsx`**
- Receives a single commission (with `seller_user_id`, `commission_amount`, description)
- Looks up the specialist via `specialists.user_id = seller_user_id`
- If no specialist found, shows an error message
- Offers "new liquidation" or "existing draft liquidation" for that specialist (same pattern as `AddToLiquidationModal`)
- On submit:
  - Creates or selects liquidation
  - Creates a `liquidation_item` with the commission description and amount
  - Updates `sales_commissions.liquidation_id` with the chosen liquidation
  - Recalculates liquidation totals
  - Invalidates queries

### Files changed
- **Migration**: Add `liquidation_id` to `sales_commissions`
- `src/pages/Comisiones.tsx` — fetch liquidation join, modal state, pass props
- `src/components/commissions/CommissionTableView.tsx` — liquidation column + menu action
- `src/components/commissions/AddCommissionToLiquidationModal.tsx` — new modal (similar pattern to existing `AddToLiquidationModal`)

