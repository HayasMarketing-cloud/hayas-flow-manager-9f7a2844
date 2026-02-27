

## Problem

The error "Could not find a relationship between 'financial_requests' and 'operational_projects'" occurs in `src/pages/Liquidaciones.tsx` when sending a liquidation email. The query incorrectly tries to join `financial_requests` directly to `operational_projects`, but there is no direct foreign key between these tables. The correct path is `financial_requests → operational_requests → operational_projects`.

The same incorrect query pattern appears twice in the file (lines 326-333 and 347-354).

## Fix

Replace the direct `operational_project:operational_projects(name)` join with the correct indirect path through `operational_requests`:

**File: `src/pages/Liquidaciones.tsx`** (two locations: ~line 326-333 and ~line 347-354)

Change:
```
financial_request:financial_requests(
  id, title, cost_to_agency,
  client:clients(name),
  budget:budgets(code, title),
  operational_project:operational_projects(name)
)
```

To:
```
financial_request:financial_requests(
  id, title, cost_to_agency,
  client:clients(name),
  budget:budgets(code, title),
  operational_request:operational_requests!financial_request_id(
    id,
    operational_project:operational_projects(id, name)
  )
)
```

This matches the pattern already used correctly in `LiquidacionDetalle.tsx` (line 293).

The downstream code that reads `operational_project` from these items (in `liquidation-grouping.ts` line 35) already expects `item.financial_request?.operational_request?.[0]?.operational_project`, so no additional changes are needed.

