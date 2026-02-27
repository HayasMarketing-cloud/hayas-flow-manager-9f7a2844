

## Plan: Restructure Commission Form with Client Selector

### Current Problem
The form flow is: Type → Beneficiary → Source (Budget/Contract) → Select budget/contract → Invoices appear based on client derived from budget/contract. This is indirect and doesn't support selecting invoices directly.

### New Flow
**Type → Client → Beneficiary → Source (Budget/Contract/Factura) → Select source item(s)**

### Changes in `src/components/commissions/CommissionFormModal.tsx`

**1. Add `client_id` to form state** and add `'invoice'` as a new source_type option.

**2. Add client query:**
```typescript
const { data: clients } = useQuery({
  queryKey: ['clients-for-commission'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .order('name');
    if (error) throw error;
    return data;
  },
  enabled: open,
});
```

**3. Filter budgets and contracts by selected client_id** — add `.eq('client_id', formData.client_id)` to both queries, enable them only when `client_id` is set.

**4. When source_type is `'invoice'`**, fetch invoices directly for the selected client (no budget/contract intermediary). The second column becomes a multi-select invoice list.

**5. UI layout changes:**
- Row 1: Tipo de comisión | Cliente *
- Row 2: Beneficiario * | (empty or auto-filled)
- Row 3: Origen (Budget/Contract/Factura) | Select source or invoice list
- Invoice checkbox list appears when source is budget/contract (as before) OR is the main selector when source is "Factura"

**6. Update validation** to handle `source_type === 'invoice'` (require at least one invoice selected).

**7. Update save payload** — when source is `'invoice'`, `contract_id` and `budget_id` are null, only `invoice_ids` is populated.

### Files changed
- `src/components/commissions/CommissionFormModal.tsx` — ~80 lines modified

