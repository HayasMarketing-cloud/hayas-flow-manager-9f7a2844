

## Plan: Fix 4 Specialist View Issues Reported by Iolanda

### Issue 1: Clone request not visible until page refresh
**Root cause**: In `Solicitudes.tsx` (line 314), after cloning, the code calls `queryClient.invalidateQueries({ queryKey: ['financial_requests'] })`. This should work, but the specialist may have a filtered view. The clone in `SolicitudDetalle.tsx` (line 234) navigates to the new request, which is correct.

**Fix**: Ensure both clone handlers (list and detail page) invalidate the query cache AND, on the list page, also invalidate any specialist-specific query keys. Additionally, add a small refetch delay or use `await` on `invalidateQueries` to ensure the UI updates before the toast.

**Files**: `src/pages/Solicitudes.tsx`

---

### Issue 2: Adding requests to a closed liquidation
**Root cause**: The `AddToLiquidationModal.tsx` was updated to allow `draft`, `validated`, and `sent` statuses. However, statuses like `accepted`, `invoice_received`, `paid` should NOT allow adding requests. The `AddRequestsToLiquidationModal.tsx` (used from liquidation detail) has NO status check at all — it always allows adding if the modal is opened. The `LiquidacionDetalle.tsx` gates the "add requests" section with `isEditable`, which includes `sent`. But the real issue is that `isEditable` now includes `sent`, meaning a liquidation the specialist has already accepted can still be edited if re-opened.

**Fix**: No code change needed for `AddRequestsToLiquidationModal` since it's already gated by `isEditable && canAccessFinance()` in `LiquidacionDetalle.tsx`. The current behavior (draft/validated/sent = editable) is the desired admin behavior. However, I need to verify that statuses beyond `sent` (like `accepted`, `invoice_received`, `paid`) are properly blocked. The current check on line 846 already does this correctly. So the real question is: is there a path where a non-editable liquidation still allows adding? Let me check the `AddToLiquidationModal` (used from request list).

Actually, looking at memory note: "If a non-editable liquidation (e.g., 'paid', 'invoice_received') exists, a warning is displayed and the action is disabled." This should already be handled. The issue might be that in the `AddToLiquidationModal` the `sent` status is now considered editable, which IS correct per the admin's request. But for the specialist view, they shouldn't be able to add requests to their own liquidation after it's been sent.

**Fix**: In `AddToLiquidationModal.tsx`, the editable statuses filter should remain as-is since only admin/finance roles can access it. The specialist doesn't use this modal — they can't add requests to liquidations. This issue may already be fixed. Need to confirm there's no other entry point.

---

### Issue 3: Notification 404 error when clicking
**Root cause**: Notifications use `action_url: /solicitudes/${requestId}`. The specialist clicks this in `NotificationDropdown`, which calls `navigate(notification.action_url)`. The page `SolicitudDetalle` loads and queries the request by ID. BUT, the RLS policy for `financial_requests` SELECT requires `specialist_id = get_current_specialist_id()` OR `is_specialist_liquidation(liquidation_id)` OR admin/finance/PM roles. If the specialist is notified about a request that's NOT assigned to them (e.g., a notification about a project update), they'd get no data back, and the page shows a "not found" state.

However, the more likely issue is that the notification `action_url` points to a route that the specialist CAN access but the query returns null due to RLS restrictions, causing a 404-like "not found" page display.

**Fix**: Two approaches:
1. In `SolicitudDetalle.tsx`, improve the "not found" state to show a friendlier message like "No tienes acceso a esta solicitud" instead of a generic 404.
2. In `NotificationDropdown`, check if the user has a specialist-only role and adjust the navigation accordingly, or handle the 404 gracefully.

**Files**: `src/pages/SolicitudDetalle.tsx`

---

### Issue 4: Liquidation PDF format differs for specialist
**Root cause**: The specialist downloads the PDF from `FirmaLiquidacion.tsx`, which calls `generateLiquidationPDF` with items fetched from the edge function `get-liquidation-items`. This edge function returns items with only `financial_request.client.name` — it does NOT include `operational_request` (project) or `budget` data. The `groupItemsByClientAndProject` function in the PDF generator needs these fields to create the hierarchical grouping (Client → Project/Budget → Items).

Without `operational_request` and `budget` data, all items fall into "Sin proyecto/presupuesto" and the grouping looks flat/broken.

**Fix**: Update the edge function `get-liquidation-items` to include `operational_request` and `budget` data in its query, matching the data structure used by the admin view.

**Files**: `supabase/functions/get-liquidation-items/index.ts`

---

### Summary of Changes

| # | Issue | File(s) | Change |
|---|-------|---------|--------|
| 1 | Clone not visible | `src/pages/Solicitudes.tsx` | Ensure `invalidateQueries` is awaited and covers all relevant query keys |
| 2 | Closed liquidation allows adding | Verify current guards are sufficient — likely already fixed | Confirm `isEditable` blocks `accepted`/`paid`/`invoice_received` |
| 3 | Notification 404 | `src/pages/SolicitudDetalle.tsx` | Show "access denied" message instead of generic 404 when RLS blocks the query |
| 4 | PDF format for specialist | `supabase/functions/get-liquidation-items/index.ts` | Add `operational_request` and `budget` joins to match admin query structure |

### Technical Details

**Issue 1 fix** — Change `handleCloneRequest` in `Solicitudes.tsx`:
```typescript
// After successful insert, await the invalidation
await queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
```

**Issue 3 fix** — In `SolicitudDetalle.tsx`, when the query returns no data, distinguish between "not found" and "no access" by showing a message like "No tienes permisos para ver esta solicitud o no existe."

**Issue 4 fix** — Update the edge function select query:
```typescript
.select(`
  id, description, quantity, unit_price, total,
  financial_request:financial_requests(
    id, title, hours, quantity, cost_type,
    client:clients(id, name),
    budget:budgets(id, code, title),
    operational_request:operational_requests!financial_request_id(
      id,
      operational_project:operational_projects(id, name)
    )
  )
`)
```

