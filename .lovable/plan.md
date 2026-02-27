

## Add Commissions Selection to Liquidation Detail

### Problem
When editing a liquidation, there's no way to include commissions configured for the specialist. The user wants a new section (before manual concepts) showing available commissions from `sales_commissions` that can be added as liquidation items.

### How it works
- The specialist's `user_id` maps to `sales_commissions.seller_user_id`
- Query `sales_commissions` where `seller_user_id = specialist.user_id` and status is `pending` (not yet paid)
- Display each commission with its description (type + source) and amount
- User selects one or more commissions via checkboxes, clicks "Añadir"
- Each selected commission is inserted as a `liquidation_item` (no `financial_request_id`, description like "Comisión AM - Presupuesto X", total = `commission_amount`)
- Liquidation subtotal/totals are recalculated
- After adding, the commission status is updated to `paid` (or a reference is stored) to prevent re-adding

### Changes

**File: `src/pages/LiquidacionDetalle.tsx`**

1. Add a new query to fetch pending commissions for the specialist's `user_id`:
```typescript
const { data: availableCommissions } = useQuery({
  queryKey: ['specialist-commissions', liquidation?.specialist?.user_id],
  queryFn: async () => {
    const { data } = await supabase
      .from('sales_commissions')
      .select('*, budget:budgets(code, title), contract:contracts(code, title)')
      .eq('seller_user_id', liquidation.specialist.user_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    return data;
  },
  enabled: !!liquidation?.specialist?.user_id && isEditable,
});
```

2. Add state for selected commission IDs and an "adding commissions" mutation.

3. Add a new `CommissionsSection` Card rendered **before** the "Pending Requests" section (after items table, before pending requests), only when `isEditable && canAccessFinance()`:
   - Title: "Comisiones disponibles"
   - If no commissions: show "No hay comisiones pendientes para este especialista"
   - If commissions exist: show checkboxes with description (type label + budget/contract name), percentage, and amount
   - "Añadir seleccionadas" button that:
     - Inserts each as a `liquidation_item` with description and total
     - Updates liquidation subtotal/tax/total
     - Updates the commission status to `paid` and sets `paid_at`
     - Invalidates queries

4. The section appears in both the team-leader and single-specialist layouts, positioned between the items table and the pending requests section.

### Files changed
- `src/pages/LiquidacionDetalle.tsx` — ~80 lines added (query + UI section + mutation)

