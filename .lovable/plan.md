

## Problem

In `CommissionFormModal.tsx` line 143, budgets are queried with `.eq('status', 'accepted')`, but the budget status values are: `pending`, `sent`, `approved`, `rejected`, `invoiced`. There is no `accepted` status -- it should be `approved`.

Additionally, budgets that are already `invoiced` should also be available for commission assignment (since commissions are based on invoiced amounts).

## Fix

**File: `src/components/commissions/CommissionFormModal.tsx`** -- Change line 143:

```typescript
// From:
.eq('status', 'accepted')

// To:
.in('status', ['approved', 'invoiced'])
```

Single line change.

