

## Fix commission edit/view: persist associated data and show source details

### Problem
When opening a commission in edit or view mode, client and source data (invoices, budgets, contracts) don't load because `client_id` is never populated from the commission's joined data. Additionally, the modal should display the code and title of the associated source (invoice, budget, or contract).

### Root Cause
In `CommissionFormModal.tsx` line 231, `clientId` is hardcoded to `''`. The `Commission` interface in the modal doesn't include the joined `contract`, `budget`, or `invoices` data that the parent page already passes. Since all source queries depend on `formData.client_id` being truthy, nothing loads.

### Changes

**1. `src/pages/Comisiones.tsx` — Add `client_id` to joins and invoice fetch**
- Expand contract join to include `client_id`: `contract:contracts(id, title, code, client_id, client:clients(name))`
- Expand budget join to include `client_id`: `budget:budgets(id, title, code, client_id, client:clients(name))`
- When fetching invoice codes, also fetch `client_id` and `invoice_date`: `.select('id, code, client_id, invoice_date')`
- Update `Commission` interface to reflect these additions

**2. `src/components/commissions/CommissionFormModal.tsx` — Populate client_id and show source info**

- **Expand `Commission` interface** to include optional joined data:
  - `contract?: { id: string; title: string; code: string; client_id?: string; client?: { name: string } | null } | null`
  - `budget?: { id: string; title: string; code: string; client_id?: string; client?: { name: string } | null } | null`
  - `invoices?: { id: string; code: string; client_id?: string }[] | null`

- **Fix edit/view `useEffect`** (lines 228-247): Derive `client_id` from commission's joined data:
  ```
  clientId = commission.contract?.client_id 
           || commission.budget?.client_id 
           || commission.invoices?.[0]?.client_id 
           || ''
  ```

- **Add read-only source summary in view/edit mode**: When in view or edit mode and a source exists, display a small info block showing:
  - Contract: code + title
  - Budget: code + title  
  - Invoices: codes joined (e.g. "2026/14 - Leadership Forum")
  
  This ensures source identity is visible even before dependent queries finish loading.

### Files changed
- `src/pages/Comisiones.tsx` — add `client_id` to contract/budget/invoice joins
- `src/components/commissions/CommissionFormModal.tsx` — interface expansion, client_id derivation, source info display

