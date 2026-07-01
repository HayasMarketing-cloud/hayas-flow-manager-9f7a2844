## Añadir PO Number / Referencia Cliente inline en cards de Presupuestos

Agregar el campo `client_po_number` en `BudgetCard.tsx` con edición inline (patrón igual al de "notas").

### Cambios

**`src/components/budgets/BudgetCard.tsx`**
- Nueva fila debajo de "Monto Total / Fecha Facturación" (antes de Notas):
  - Label pequeño: `PO / Ref. Cliente`
  - Si hay valor → mostrarlo con icono `Hash` (lucide) y al click convertir en `<Input>` editable.
  - Si no hay valor → placeholder clicable `+ Añadir PO / Referencia...`.
- Estados locales: `editingPo`, `poValue`, `poRef`.
- Guardar en `onBlur` (o Enter) usando el helper existente `handleUpdateField('client_po_number', value || null)`.
- `Esc` cancela; sincronizar con `useEffect` cuando cambia `budget.client_po_number`.
- Sin cambios de permisos (mismo comportamiento que el resto de edición inline de la card).
- Sin migraciones (campo ya existe en la tabla `budgets`).

### Fuera de alcance
- No se toca `BudgetTableView`, formulario de alta/edición, ni detalle. Solo las cards.