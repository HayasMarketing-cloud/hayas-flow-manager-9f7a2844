

## Show invoice/budget codes in commission origin column

### Problem
Commissions created directly from invoices (without contract or budget) show an empty origin column. The user wants to see invoice codes there, and budget codes for budget-sourced commissions.

### Changes

**1. `src/pages/Comisiones.tsx` — Fetch invoice codes for all commissions**
After fetching commissions and profiles (around line 110), collect all `invoice_ids` from all commissions, fetch their codes from the `invoices` table, and attach an `invoices` array (with `id` and `code`) to each commission object.

**2. `src/components/commissions/CommissionTableView.tsx` — Update Commission interface and origin rendering**

- Add `invoices?: { id: string; code: string }[] | null` to the `Commission` interface (line ~62).
- Update origin column logic (lines 168-199):
  - If `contract_id` exists → show contract code (current behavior, works fine)
  - Else if `budget_id` exists → show budget code with "Presupuesto" tooltip
  - Else if `invoices` has entries → show invoice codes joined (e.g. "2026/15, 2026/17") with a `FileText` icon and "Factura(s)" tooltip
  - Else → show "-"

### Files changed
- `src/pages/Comisiones.tsx` — fetch invoice codes and attach to commission objects
- `src/components/commissions/CommissionTableView.tsx` — interface + origin column rendering logic

