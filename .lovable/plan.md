

## Plan: Allow Project Managers to see only their assigned budgets and requests

### Problem
The `shouldFilterByAssignment()` function in `useUserRole.ts` treats `project_manager` as "elevated access" (same level as admin/finance), so PMs bypass all client/budget filtering and see **all** data. The desired behavior is that PMs — like AMs — should only see budgets and requests where they are assigned as PM.

### Root cause
```typescript
// Current logic in useUserRole.ts
const shouldFilterByAssignment = () => {
    const hasElevatedAccess = isAdmin() || canAccessFinance() || isProjectManager(); // ← PM is elevated
    const isAmOrPm = isAccountManager() || isProjectManager();
    return isAmOrPm && !hasElevatedAccess; // ← Always false for PM
};
```

### Changes

**File: `src/hooks/useUserRole.ts`**
- Remove `isProjectManager()` from `hasElevatedAccess` in `shouldFilterByAssignment()`, so PMs are treated the same as AMs for filtering purposes.
- This single change makes `shouldFilterByAssignment()` return `true` for PM-only users, which activates the existing filtering logic in `useAssignedClients` and `useUserBudgetIds`.

```typescript
const shouldFilterByAssignment = () => {
    const hasElevatedAccess = isAdmin() || canAccessFinance();  // PM removed
    const isAmOrPm = isAccountManager() || isProjectManager();
    return isAmOrPm && !hasElevatedAccess;
};
```

**File: `src/pages/Presupuestos.tsx`**
- No changes needed — it already uses `useUserBudgetIds()` which queries budgets where `pm_user_id.eq.${user.id}`, and the `needsFiltering` path at line 99-117 already handles filtered queries.

**File: `src/pages/Solicitudes.tsx`**
- No changes needed — it already uses `useAssignedClients()` which gathers client IDs from budgets/contracts where user is AM or PM, and filters requests by `client_id` when `needsFiltering` is true.

**File: `src/pages/operations/OperationalProjects.tsx`**
- Verify no regressions — PMs currently have full access to operational projects. The existing pre-filter by PM assignment on this page should continue working correctly since it uses its own filter logic.

### Impact
- **PM-only users**: Will see only budgets where they're assigned as PM, and requests under those clients' budgets/contracts.
- **Admin, Finance, Admin+PM**: Unchanged — `hasElevatedAccess` still true.
- **AM-only users**: Unchanged — already filtered.
- **Specialists**: Unchanged — separate filtering path.

### Risk check
The memory note says *"project_manager role is treated as elevated access... users with this role bypass client-level filtering"*. This change intentionally reverses that decision per the user's request. Need to verify the Operational Projects page still works correctly for PMs after this change.

