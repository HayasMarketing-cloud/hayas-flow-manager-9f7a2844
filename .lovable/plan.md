

# Plan: Corregir Modal de Importar Factura

## Problemas Identificados

### 1. Problema de Maquetación (Visible en la imagen)
La tabla de revisión tiene **11 columnas** con anchos fijos que exceden el contenedor:
- Código (w-32), Cliente (w-48), Contrato (w-36), Presupuesto (w-36), Proyecto (w-36), Fecha, Subtotal (w-24), IVA (w-16), Total, Estado (w-28), Acciones (w-20)
- Total aproximado: ~400px+ que no cabe en el modal

### 2. Problema Funcional Crítico
El guardado (`saveMutation`) **NO ESTÁ GUARDANDO** los nuevos campos de asociación directa:
- `budget_id` - Campo nuevo, NO se guarda
- `contract_id` - Campo nuevo, NO se guarda  
- `billing_period_month` - Campo nuevo, NO se guarda
- `billing_period_year` - Campo nuevo, NO se guarda

Los selectores de Contrato/Presupuesto/Proyecto están presentes pero se ignoran al guardar.

### 3. Terminología Incorrecta
El selector de estado muestra "Pagada" pero debería mostrar **"Cobrada"** según el cambio reciente.

---

## Solución Propuesta

### Fase 1: Simplificar la Tabla

Reducir columnas visibles y hacerla responsiva:

| Columna | Ancho | Acción |
|---------|-------|--------|
| Código | w-28 | Mantener (reducir) |
| Cliente | w-40 | Mantener (reducir) |
| Contrato | ELIMINAR | Mover a expandible |
| Presupuesto | ELIMINAR | Mover a expandible |
| Proyecto | ELIMINAR | Mover a expandible |
| Fecha | w-24 | Mantener |
| Subtotal | w-24 | Mantener |
| IVA | w-16 | Mantener |
| Total | w-24 | Mantener |
| Estado | w-28 | Mantener |
| Acciones | w-16 | Mantener |

**Nueva estructura**: 8 columnas principales + sección expandible para asociaciones.

### Fase 2: Corregir el Guardado

Actualizar `saveMutation` para incluir los campos de asociación:

```typescript
// Añadir al insert
budget_id: invoice.editedBudgetId ?? null,
contract_id: invoice.editedContractId ?? null,
billing_period_month: invoice.editedBillingMonth ?? null,
billing_period_year: invoice.editedBillingYear ?? null,
```

También actualizar el estado del presupuesto si se asocia.

### Fase 3: Añadir Selector de Período

Cuando se selecciona un contrato, mostrar selectores de mes/año para el período de facturación.

### Fase 4: Terminología

Cambiar "Pagada" → "Cobrada" en el selector de estado.

---

## Cambios por Archivo

### `src/components/invoices/ExtractedInvoiceRow.tsx`

1. **Reducir columnas principales** de 11 a 8
2. **Mover asociaciones a sección expandible** junto con líneas de factura
3. **Añadir selectores de mes/año** cuando se selecciona contrato
4. **Cambiar estado** "Pagada" → "Cobrada"
5. **Añadir campos** `editedBillingMonth` y `editedBillingYear` al tipo `ExtractedInvoice`

### `src/components/invoices/InvoiceUploadModal.tsx`

1. **Actualizar cabeceras de tabla** (reducir a 8 columnas)
2. **Actualizar saveMutation** para guardar:
   - `budget_id`
   - `contract_id` 
   - `billing_period_month`
   - `billing_period_year`
3. **Añadir lógica** para actualizar estado del presupuesto a 'invoiced'

---

## Nueva Estructura Visual

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Revisar Datos Extraídos                                                     │
│ Se extrajeron 1 factura(s). Revisa los datos antes de guardar.             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Código   │ Cliente        │ Fecha    │ Subtotal │ IVA  │ Total   │ Estado  │▼│
├──────────┼────────────────┼──────────┼──────────┼──────┼─────────┼─────────┼─┤
│ 2026/5   │ Asendia Germany│ 3/1/2026 │ 1070,52  │ 21%  │ 1295,33 │ Enviada │≡│
├──────────┴────────────────┴──────────┴──────────┴──────┴─────────┴─────────┴─┤
│ ▼ Expandido:                                                                 │
│   Asociar a:                                                                 │
│   ○ Presupuesto: [Selector ▼]                                               │
│   ○ Contrato:    [Selector ▼] Período: [Enero ▼] [2026 ▼]                   │
│                                                                              │
│   Líneas de factura: ...                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
│ [Cancelar]                                    [Importar 1 Factura(s)] │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Sección Técnica

### Nuevo Tipo ExtractedInvoice

```typescript
export interface ExtractedInvoice {
  // ... campos existentes ...
  editedBillingMonth?: number | null;
  editedBillingYear?: number | null;
}
```

### Guardado Actualizado

```typescript
const budgetId = invoice.editedBudgetId ?? null;
const contractId = invoice.editedContractId ?? null;
const billingMonth = invoice.editedBillingMonth ?? null;
const billingYear = invoice.editedBillingYear ?? null;

const { data: createdInvoice, error: invoiceError } = await supabase
  .from('invoices')
  .insert({
    code,
    client_id: clientId!,
    invoice_date: data.invoice_date,
    due_date: data.due_date,
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_amount: total,
    status: invoiceStatus,
    notes: `Importada automáticamente desde PDF: ${invoice.fileName}`,
    sent_at: ...,
    paid_at: ...,
    // NUEVOS CAMPOS
    budget_id: budgetId,
    contract_id: contractId,
    billing_period_month: billingMonth,
    billing_period_year: billingYear,
  })
  .select()
  .single();

// Si se asocia a presupuesto, marcarlo como facturado
if (budgetId) {
  await supabase
    .from('budgets')
    .update({ status: 'invoiced' })
    .eq('id', budgetId)
    .eq('status', 'approved');
}
```

### Sección Expandible con Asociaciones

```typescript
{expanded && (
  <tr className="bg-muted/30">
    <td colSpan={8} className="px-4 py-3">
      <div className="space-y-4">
        {/* Selector de tipo de asociación */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label>Presupuesto</Label>
            <Select value={budgetId || 'none'} ...>
              ...
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label>Contrato + Período</Label>
            <div className="flex gap-2">
              <Select value={contractId || 'none'} ...>...</Select>
              {contractId && (
                <>
                  <Select value={billingMonth} ...>{/* Meses */}</Select>
                  <Select value={billingYear} ...>{/* Años */}</Select>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Líneas de factura */}
        {data.line_items && data.line_items.length > 0 && (
          <div>
            <p className="text-sm font-medium">Líneas:</p>
            ...
          </div>
        )}
      </div>
    </td>
  </tr>
)}
```

---

## Resumen de Archivos

| Archivo | Cambio |
|---------|--------|
| `src/components/invoices/ExtractedInvoiceRow.tsx` | Simplificar columnas, mover asociaciones a expandible, añadir período, terminología |
| `src/components/invoices/InvoiceUploadModal.tsx` | Actualizar headers, corregir saveMutation con budget_id/contract_id/período |

