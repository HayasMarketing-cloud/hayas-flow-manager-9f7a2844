
## Objetivo
Añadir el campo "Fecha estimada de Facturación al Cliente" (`estimated_invoice_date`) al formulario de alta y edición de presupuestos.

---

## Diagnóstico

### Estado actual de la tabla `budgets`:
La tabla tiene estos campos:
- `id`, `client_id`, `title`, `description`, `total_amount`, `status`
- `valid_until` (fecha de validez del presupuesto)
- `created_by`, `created_at`, `updated_at`
- `accepted_document_url`, `code`, `client_contact_id`
- `am_user_id`, `pm_user_id`, `contract_id`, `proposal_context`

**No existe** el campo `estimated_invoice_date`.

### Formulario actual (`BudgetFormModal.tsx`):
El formulario termina con el campo "Enlace a Project HUB" y luego el editor de items. El nuevo campo irá justo antes del editor de items (al final de la sección de datos generales).

---

## Cambios a realizar

### 1. Migración de base de datos
Añadir columna `estimated_invoice_date` a la tabla `budgets`:

```sql
ALTER TABLE public.budgets 
ADD COLUMN estimated_invoice_date date;

COMMENT ON COLUMN public.budgets.estimated_invoice_date 
IS 'Fecha estimada en que se facturará al cliente';
```

### 2. Modificar formulario (`src/components/budgets/BudgetFormModal.tsx`)

**A. Añadir al estado inicial (líneas 35-46):**
```typescript
const [formData, setFormData] = useState({
  title: '',
  client_id: '',
  client_contact_id: '',
  contract_id: '',
  description: '',
  valid_until: '',
  estimated_invoice_date: '',  // ← Nuevo campo
  status: 'pending',
  accepted_document_url: '',
  am_user_id: '',
  pm_user_id: '',
});
```

**B. Cargar valor en useEffect (líneas 114-143):**
```typescript
if (budget) {
  setFormData({
    // ... campos existentes
    estimated_invoice_date: budget.estimated_invoice_date || '',
  });
} else {
  setFormData({
    // ... campos existentes
    estimated_invoice_date: '',
  });
}
```

**C. Añadir campo en el formulario (después de "Enlace a Project HUB", antes del BudgetItemsEditor):**
```tsx
<div className="space-y-2">
  <Label htmlFor="estimated_invoice_date">
    Fecha Estimada de Facturación al Cliente
  </Label>
  <Input
    id="estimated_invoice_date"
    type="date"
    value={formData.estimated_invoice_date}
    onChange={(e) => setFormData({ ...formData, estimated_invoice_date: e.target.value })}
    disabled={!canEdit}
  />
  <p className="text-xs text-muted-foreground">
    Fecha prevista para emitir la factura al cliente
  </p>
</div>
```

**D. Incluir en `cleanedFormData` (línea 195-201):**
El campo ya se incluirá automáticamente porque está en `formData` y se pasa con el spread operator.

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Base de datos | Migración: añadir columna `estimated_invoice_date` |
| `src/components/budgets/BudgetFormModal.tsx` | Añadir campo al estado, useEffect y UI |

---

## Resultado esperado
Al crear o editar un presupuesto, aparecerá un campo de fecha "Fecha Estimada de Facturación al Cliente" al final de la sección de datos generales (justo antes del editor de líneas de presupuesto).
