

## Plan: Show externally-linked requests in budget "Elementos Vinculados"

### Problem
The "Elementos Vinculados" section only appears when `budget.status === 'approved'`, and uses an exclusive if/else: either "Ver Requests" (if requests exist) or "Generar Requests" (if none). Externally-created requests with a `budget_id` are already fetched by `useBudgetDetail`, but:

1. The section is hidden for non-approved budgets, so you can't see linked requests unless the budget is approved.
2. When external requests exist, the "Generar Requests" button disappears — even if budget items haven't been converted yet.
3. The label says "generadas" (generated), which is inaccurate for externally-linked requests.

### Changes

**File: `src/pages/PresupuestoDetalle.tsx`**

1. **Show "Elementos Vinculados" for any budget with requests or projects linked**, not only approved budgets. Change the condition from `budget.status === 'approved'` to `budget.status === 'approved' || requests.length > 0 || projects.length > 0`.

2. **Change label** from "requests generadas" to "requests vinculadas" (linked).

3. **Show both buttons when appropriate**:
   - "Ver Requests" button: visible when `requests.length > 0`.
   - "Generar Requests" button: visible when the budget is approved AND there are budget items without a corresponding request (items whose `id` is not in any request's `budget_item_id`). Both buttons can coexist.

4. **Update `handleGenerateRequests`** to only generate requests for budget items that don't already have a linked request (filter out items where `budget_item_id` already exists in `requests`).

### Technical detail

```text
// Derive which items still need generation
const generatedItemIds = new Set(
  requests.filter(r => r.budget_item_id).map(r => r.budget_item_id)
);
const ungeneratedItems = items.filter(i => !generatedItemIds.has(i.id));

// Section visibility
budget.status === 'approved' || requests.length > 0 || projects.length > 0

// Buttons (both can render simultaneously)
{requests.length > 0 && <Button>Ver Requests</Button>}
{budget.status === 'approved' && ungeneratedItems.length > 0 && <Button>Generar Requests</Button>}

// handleGenerateRequests uses ungeneratedItems instead of items
```

No database changes required — `financial_requests.budget_id` already supports this.

