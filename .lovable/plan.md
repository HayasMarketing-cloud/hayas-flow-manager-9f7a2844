
# Plan: Añadir Estado "Facturado" a Presupuestos

## Objetivo

Añadir un nuevo estado "Facturado" para presupuestos que indica que se ha emitido factura al cliente. Este estado puede marcarse:
- **Automáticamente**: Cuando todas las solicitudes del presupuesto tienen una factura asociada
- **Manualmente**: Desde el formulario de edición del presupuesto

El seguimiento de la factura (cobro) se realizará desde la sección Facturas.

---

## Flujo de Estados de Presupuesto (Actualizado)

```text
┌──────────┐    ┌─────────┐    ┌──────────┐    ┌───────────┐
│ Pendiente│───▸│ Enviado │───▸│ Aprobado │───▸│ Facturado │
└──────────┘    └─────────┘    └──────────┘    └───────────┘
                                    │
                               ┌────▼────┐
                               │Rechazado│
                               └─────────┘
```

---

## Cambios Propuestos

### 1. Actualizar utilidades de estado (`src/lib/budget-utils.ts`)

Añadir color y label para el nuevo estado:

| Estado | Color | Label |
|--------|-------|-------|
| `pending` | Gris | Pendiente |
| `sent` | Azul | Enviado |
| `approved` | Verde | Aprobado |
| `rejected` | Rojo | Rechazado |
| **`invoiced`** | **Morado/Púrpura** | **Facturado** |

### 2. Actualizar filtros en Presupuestos (`src/pages/Presupuestos.tsx`)

Añadir opción "Facturado" al dropdown de filtro de estados:

```text
┌─────────────────────────┐
│ Todos los estados       │
├─────────────────────────┤
│ ✓ Todos los estados     │
│   Pendiente             │
│   Enviado               │
│   Aprobado              │
│   Rechazado             │
│   Facturado  ← NUEVO    │
└─────────────────────────┘
```

### 3. Actualizar formulario de presupuesto (`src/components/budgets/BudgetFormModal.tsx`)

Añadir opción "Facturado" al selector de estado manual.

### 4. Lógica de actualización automática (Opcional - Recomendado)

Crear un mecanismo para marcar automáticamente el presupuesto como "Facturado" cuando:

**Opción A - Trigger de base de datos (más fiable)**:
```sql
-- Trigger que detecta cuando todas las requests de un budget tienen invoice
CREATE OR REPLACE FUNCTION check_budget_fully_invoiced()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si todas las requests del budget tienen billed_invoice_id
  IF NOT EXISTS (
    SELECT 1 FROM financial_requests 
    WHERE budget_id = NEW.budget_id 
    AND billed_invoice_id IS NULL
  ) THEN
    UPDATE budgets SET status = 'invoiced' 
    WHERE id = NEW.budget_id AND status = 'approved';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Opción B - Verificación en el frontend (más simple)**:
Al reconciliar facturas, verificar si el presupuesto asociado queda completamente facturado y ofrecer actualizarlo.

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/lib/budget-utils.ts` | Añadir color y label para `invoiced` |
| `src/pages/Presupuestos.tsx` | Añadir opción de filtro "Facturado" |
| `src/components/budgets/BudgetFormModal.tsx` | Añadir opción de estado "Facturado" |
| `src/components/budgets/BudgetCard.tsx` | Sin cambios (ya usa BudgetStatusBadge) |
| `src/components/budgets/BudgetTableView.tsx` | Sin cambios (ya usa BudgetStatusBadge) |
| `src/pages/PresupuestoDetalle.tsx` | Verificar que muestra el nuevo estado |

## Archivo Nuevo (Opcional)

| Archivo | Descripción |
|---------|-------------|
| Migración SQL | Trigger para actualización automática del estado |

---

## Visualización del Nuevo Estado

```text
┌────────────────────────────────────────────────────────────────┐
│ Presupuesto: Marketing Q1 2026                                 │
│ Cliente: Asendia Spain                        ┌──────────────┐ │
│ Monto: 5.200,00 €                             │  Facturado   │ │
│                                               └──────────────┘ │
│ (badge color: púrpura/morado)                                  │
└────────────────────────────────────────────────────────────────┘
```

---

## Secuencia de Implementación

1. **Paso 1**: Actualizar `budget-utils.ts` con nuevo color y label
2. **Paso 2**: Actualizar dropdown de filtros en `Presupuestos.tsx`
3. **Paso 3**: Actualizar selector de estado en `BudgetFormModal.tsx`
4. **Paso 4 (Opcional)**: Crear trigger de base de datos para automatización
5. **Paso 5**: Añadir lógica en reconciliación para actualizar estado automáticamente

---

## Consideraciones

1. **No requiere migración de esquema**: El campo `status` es TEXT, no enum, por lo que acepta cualquier valor
2. **Retrocompatibilidad**: Los presupuestos existentes mantienen su estado actual
3. **Workflow natural**: Pendiente → Enviado → Aprobado → Facturado
4. **Seguimiento de cobro**: Una vez facturado, el estado de pago se gestiona desde Facturas (pendiente/pagada)

---

## Sección Técnica

### Cambio en `budget-utils.ts`

```typescript
export const getBudgetStatusColor = (status: BudgetStatus): string => {
  const colors: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground',
    sent: 'bg-blue-500 text-white',
    approved: 'bg-green-500 text-white',
    rejected: 'bg-destructive text-destructive-foreground',
    invoiced: 'bg-purple-500 text-white',  // NUEVO
  };
  return colors[status] || 'bg-muted text-muted-foreground';
};

export const getBudgetStatusLabel = (status: BudgetStatus): string => {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    sent: 'Enviado',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    invoiced: 'Facturado',  // NUEVO
  };
  return labels[status] || status;
};
```

### Automatización (ReconciliationRow.tsx)

```typescript
// Después de asociar solicitudes a factura, verificar si el budget queda completamente facturado
const checkBudgetFullyInvoiced = async (budgetId: string) => {
  const { data } = await supabase
    .from('financial_requests')
    .select('id, billed_invoice_id')
    .eq('budget_id', budgetId);
  
  const allInvoiced = data?.every(r => r.billed_invoice_id !== null);
  
  if (allInvoiced) {
    await supabase
      .from('budgets')
      .update({ status: 'invoiced' })
      .eq('id', budgetId)
      .eq('status', 'approved'); // Solo actualizar si estaba aprobado
  }
};
```
