

# Plan: Asociación Múltiple entre Facturas y Presupuestos con Conciliación de Importes

## Situación Actual

El modelo actual tiene una **relación 1:1** entre facturas y presupuestos:

```text
┌─────────────┐         ┌─────────────┐
│   Invoice   │────────►│   Budget    │
│  budget_id  │   1:1   │             │
└─────────────┘         └─────────────┘
```

Esto **NO permite**:
- 2 facturas asociadas a 1 presupuesto
- 1 factura asociada a 2 presupuestos
- Tracking del importe conciliado vs pendiente

---

## Propuesta: Nueva Tabla de Conciliación

Crear una tabla intermedia `invoice_budget_allocations` que permita:
- N facturas → 1 presupuesto
- 1 factura → N presupuestos
- Registrar el importe asignado de cada relación

### Nuevo Modelo de Datos

```text
┌─────────────┐     ┌─────────────────────────┐     ┌─────────────┐
│   Invoice   │◄────│ invoice_budget_allocations │────►│   Budget    │
│  (eliminar  │ N:1 │   invoice_id             │ 1:N │             │
│  budget_id) │     │   budget_id              │     │             │
│             │     │   allocated_amount       │     │ total_amount│
└─────────────┘     └─────────────────────────┘     └─────────────┘
```

### Nueva Tabla: invoice_budget_allocations

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| invoice_id | uuid | FK → invoices |
| budget_id | uuid | FK → budgets |
| allocated_amount | numeric | Importe asignado de esta factura a este presupuesto |
| notes | text | Notas opcionales |
| created_at | timestamp | Fecha de creación |

---

## Indicadores de Conciliación

### Para Presupuestos

```text
Presupuesto: PRE-2026-001
Total: €10.000

Facturas asociadas:
├── FAC-2026-015: €6.000 ✓
└── FAC-2026-018: €4.000 ✓

Facturado: €10.000 / €10.000 = 100% ✅
```

### Para Facturas

```text
Factura: FAC-2026-018
Total: €5.000

Presupuestos asociados:
├── PRE-2026-001: €4.000
└── PRE-2026-002: €1.000

Asignado: €5.000 / €5.000 = 100% ✅
```

### Estado de Conciliación

| % Asignado | Estado | Color |
|------------|--------|-------|
| 0% | Sin asignar | Gris |
| 1-99% | Parcial | Amarillo |
| 100% | Completo | Verde |
| >100% | Exceso | Rojo |

---

## Cambios en UI

### 1. Selector de Presupuestos Múltiple

En el modal de factura, reemplazar el selector único por una lista donde puedas:
- Añadir múltiples presupuestos
- Especificar el importe asignado de cada uno
- Ver el balance (importe factura - total asignado)

```text
┌─────────────────────────────────────────────────────────────┐
│ Asociar a Presupuestos                                      │
├─────────────────────────────────────────────────────────────┤
│ Importe factura: €5.000,00                                  │
│                                                             │
│ [+ Añadir Presupuesto]                                      │
│                                                             │
│ ┌───────────────────┬────────────────┬──────────┬─────────┐ │
│ │ Presupuesto       │ Total Presup.  │ Asignado │ 🗑      │ │
│ ├───────────────────┼────────────────┼──────────┼─────────┤ │
│ │ PRE-2026-001      │ €10.000        │ [4000]   │ ×       │ │
│ │ PRE-2026-002      │ €2.000         │ [1000]   │ ×       │ │
│ └───────────────────┴────────────────┴──────────┴─────────┘ │
│                                                             │
│ Total asignado: €5.000 / €5.000  ✅ Conciliado             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Vista en Tabla de Facturas

Mostrar indicador de conciliación:

| Código | Cliente | Total | Conciliación | Estado |
|--------|---------|-------|--------------|--------|
| FAC-001 | Asendia | €5.000 | 100% ✅ | Cobrada |
| FAC-002 | Hayas | €3.000 | 50% ⚠️ | Enviada |

### 3. Vista en Detalle de Presupuesto

Mostrar facturas vinculadas con importes:

```text
Estado de Facturación
─────────────────────
Total presupuesto: €10.000,00

Facturas vinculadas:
• FAC-2026-015  │ €6.000  │ Cobrada  │ [Ver]
• FAC-2026-018  │ €4.000  │ Enviada  │ [Ver]
                ─────────
Facturado:      €10.000,00 (100%) ✅
Pendiente:      €0,00
```

---

## Migración de Datos

1. Crear tabla `invoice_budget_allocations`
2. Migrar datos existentes: Para cada factura con `budget_id`, crear allocation con `allocated_amount = total_amount`
3. Eliminar columna `budget_id` de `invoices` (o deprecarla)

---

## Archivos a Modificar/Crear

### Base de Datos
- Nueva tabla: `invoice_budget_allocations`
- Migración de datos existentes

### Nuevos Componentes
| Archivo | Descripción |
|---------|-------------|
| `src/hooks/useInvoiceBudgetAllocations.tsx` | Hook para gestionar allocations |
| `src/components/invoices/BudgetAllocationEditor.tsx` | Editor de asignaciones múltiples |
| `src/components/invoices/AllocationStatusBadge.tsx` | Badge de estado de conciliación |

### Componentes a Modificar
| Archivo | Cambio |
|---------|--------|
| `InvoiceFormModal.tsx` | Reemplazar selector único por BudgetAllocationEditor |
| `InvoiceTableView.tsx` | Añadir columna de conciliación |
| `ExtractedInvoiceRow.tsx` | Actualizar para allocations |
| `InvoiceUploadModal.tsx` | Actualizar para allocations |
| `PresupuestoDetalle.tsx` | Mostrar facturas vinculadas con importes |
| `useBudgetsForInvoice.tsx` | Calcular % facturado y pendiente |

---

## Sección Técnica

### SQL: Nueva Tabla

```sql
CREATE TABLE invoice_budget_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE RESTRICT,
  allocated_amount NUMERIC NOT NULL CHECK (allocated_amount > 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Un presupuesto solo puede aparecer una vez por factura
  UNIQUE(invoice_id, budget_id)
);

-- Trigger para updated_at
CREATE TRIGGER update_invoice_budget_allocations_updated_at
  BEFORE UPDATE ON invoice_budget_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE invoice_budget_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance and admin can manage allocations"
  ON invoice_budget_allocations FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finanzas'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finanzas'));
```

### SQL: Migración de Datos Existentes

```sql
-- Migrar budget_id existentes a allocations
INSERT INTO invoice_budget_allocations (invoice_id, budget_id, allocated_amount)
SELECT 
  id AS invoice_id,
  budget_id,
  total_amount AS allocated_amount
FROM invoices
WHERE budget_id IS NOT NULL;
```

### Hook: useInvoiceBudgetAllocations

```typescript
interface BudgetAllocation {
  id?: string;
  invoice_id: string;
  budget_id: string;
  budget_code: string;
  budget_title: string;
  budget_total: number;
  allocated_amount: number;
  budget_invoiced_amount: number; // Ya facturado de este presupuesto
  budget_remaining: number; // Pendiente de facturar
}

interface AllocationSummary {
  total_allocated: number;
  invoice_remaining: number; // invoice.total - total_allocated
  is_fully_allocated: boolean;
}
```

### Componente: BudgetAllocationEditor

```typescript
interface BudgetAllocationEditorProps {
  invoiceTotal: number;
  allocations: BudgetAllocation[];
  availableBudgets: Budget[];
  onAllocationsChange: (allocations: BudgetAllocation[]) => void;
  disabled?: boolean;
}

// Permite añadir presupuestos, editar importes, ver balance
```

---

## Resumen de Cambios

| Área | Tipo | Descripción |
|------|------|-------------|
| DB | Nueva tabla | `invoice_budget_allocations` |
| DB | Migración | Mover datos de `budget_id` a allocations |
| UI | Nuevo componente | Editor de allocations múltiples |
| UI | Nuevo componente | Badge de estado de conciliación |
| UI | Modificación | Modal de factura con multi-select |
| UI | Modificación | Tabla de facturas con columna conciliación |
| UI | Modificación | Detalle de presupuesto con facturas vinculadas |
| Hooks | Nuevo | Gestión de allocations y cálculos |

