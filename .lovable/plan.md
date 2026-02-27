

## Analysis

The error occurs because `handleStatusChange` blocks ANY status change from "approved" when there are associated financial requests or operational projects. This includes changing to "invoiced", which is actually a forward progression in the workflow (approved → invoiced) and should not be blocked.

**Is there a negative implication?** No. The "invoiced" status is purely informational — it marks that the client invoice has been issued. The financial requests and operational projects remain valid and unaffected. The blocking logic was designed to prevent reverting to earlier states (like "pending" or "rejected") which could create data inconsistency, but "invoiced" is a natural next step after "approved".

**However**, reverting from "approved" to "pending"/"rejected" while having associated requests/projects IS dangerous and should remain blocked.

## Plan

**Single change in `src/pages/PresupuestoDetalle.tsx`** (~line 387):

Modify the guard condition to allow the transition from `approved` → `invoiced`, while keeping the block for other status changes (e.g., approved → pending, approved → rejected):

```typescript
// Current:
if (previousStatus === 'approved' && newStatus !== 'approved' && hasAssociatedDataForStatusChange) {

// New:
if (previousStatus === 'approved' && newStatus !== 'approved' && newStatus !== 'invoiced' && hasAssociatedDataForStatusChange) {
```

This is a one-line change. No other files need modification.

