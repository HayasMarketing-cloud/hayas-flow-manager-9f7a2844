

## Add invoice concept/description to commission invoice selector

### Problem
When creating a commission from invoices, each invoice row only shows code + date + amount. The user wants to also see the invoice line items (concepts) to identify what was billed.

### Changes in `src/components/commissions/CommissionFormModal.tsx`

**1. Expand Invoice interface** (line 47-53): Add `items` field:
```typescript
interface Invoice {
  id: string;
  code: string;
  subtotal: number;
  invoice_date: string;
  client: { name: string } | null;
  items: { description: string }[] | null;
}
```

**2. Expand invoice queries** (lines 174-176 and 188-190): Add `invoice_items` join to both invoice select statements:
```
.select('id, code, subtotal, invoice_date, client:clients(name), items:invoice_items(description)')
```

**3. Update invoice row rendering** (lines 551-579): Below the code/date line, show a truncated list of item descriptions in smaller muted text. Something like:
```
2026/14  (2 feb 2026)                    1.225,00 €
  Consultoría estratégica, Diseño web
```

### Files changed
- `src/components/commissions/CommissionFormModal.tsx` — interface update, query select expansion, UI row enhancement

