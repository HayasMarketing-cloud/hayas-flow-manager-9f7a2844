

# Plan: Asociación Directa de Facturas a Presupuesto/Contrato

## Objetivo

Rediseñar la asociación de facturas para que se vinculen **directamente** a:
- **Presupuesto**: Para trabajos puntuales (1 presupuesto = 1 factura)
- **Contrato + Mes/Año**: Para servicios recurrentes

Esto elimina la complejidad del sistema de reconciliación actual que intentaba asociar facturas con solicitudes individuales.

---

## Diagrama del Nuevo Modelo

```text
┌─────────────────────────────────────────────────────────────────┐
│                       FACTURA                                   │
├─────────────────────────────────────────────────────────────────┤
│  Asociar a:                                                     │
│                                                                 │
│  ○ Presupuesto                    ○ Contrato + Período          │
│    [PRE-2025-001 ▼]                 [CON-2025-001 ▼]            │
│                                     [Enero ▼] [2025 ▼]          │
│                                                                 │
│  ○ Sin asociar (facturas históricas)                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Limpieza Completa del Sistema de Reconciliación

### Archivos a ELIMINAR

| Archivo | Razón |
|---------|-------|
| `src/pages/FacturasReconciliar.tsx` | Página de reconciliación obsoleta |
| `src/hooks/useUnassignedInvoices.tsx` | Hook específico de reconciliación |
| `src/hooks/useAvailableRequestsForReconciliation.tsx` | Hook específico de reconciliación |
| `src/components/invoices/ReconciliationRow.tsx` | Componente de reconciliación |
| `src/components/invoices/RequestCheckboxList.tsx` | Lista de selección para reconciliación |

### Archivos a MODIFICAR para eliminar referencias

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Eliminar import y ruta `/facturas/reconciliar` |
| `src/pages/Facturas.tsx` | Eliminar botón "Reconciliar" y Link |

---

## Fase 2: Migración de Base de Datos

Añadir campos directos a la tabla `invoices`:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `budget_id` | uuid (nullable) | FK a presupuesto asociado |
| `contract_id` | uuid (nullable) | FK a contrato asociado |
| `billing_period_month` | integer (1-12, nullable) | Mes del período |
| `billing_period_year` | integer (nullable) | Año del período |

---

## Fase 3: Actualizar Formulario de Factura

### Cambios en `InvoiceFormModal.tsx`

Añadir selector de tipo de asociación con 3 opciones:
1. **Presupuesto**: Mostrar presupuestos aprobados del cliente
2. **Contrato + Período**: Mostrar contratos activos + selector mes/año
3. **Sin asociar**: Para facturas históricas o importadas

Lógica adicional:
- Al asociar a un presupuesto, marcarlo automáticamente como "Facturado"
- Validar que el presupuesto no tenga ya otra factura asociada

---

## Fase 4: Actualizar Vista de Tabla

### Cambios en `InvoiceTableView.tsx`

Reemplazar la columna actual de "Presupuesto/Contrato" (basada en requests) por:
- Mostrar directamente el presupuesto o contrato asociado
- Mostrar el período si es contrato

### Cambios en `Facturas.tsx`

- Actualizar query para incluir relaciones directas
- Eliminar la relación `linked_requests` que ya no será necesaria para mostrar asociaciones

---

## Fase 5: Nuevos Hooks

| Hook | Propósito |
|------|-----------|
| `useBudgetsForInvoice.tsx` | Presupuestos aprobados del cliente sin factura asociada |
| `useContractsForInvoice.tsx` | Contratos activos del cliente |

---

## Inventario Completo de Eliminaciones

### Imports a eliminar en `App.tsx`:
```typescript
// ELIMINAR línea 19
import FacturasReconciliar from "./pages/FacturasReconciliar";

// ELIMINAR línea 95
<Route path="/facturas/reconciliar" element={<ProtectedRoute><FacturasReconciliar /></ProtectedRoute>} />
```

### Código a eliminar en `Facturas.tsx`:
```typescript
// ELIMINAR líneas 257-262 (botón Reconciliar)
<Link to="/facturas/reconciliar">
  <Button variant="outline">
    <Link2 className="h-4 w-4 mr-2" />
    Reconciliar
  </Button>
</Link>

// ELIMINAR import Link2 de lucide-react si ya no se usa
```

---

## Secuencia de Implementación

1. **Paso 1**: Eliminar archivos de reconciliación (5 archivos)
2. **Paso 2**: Limpiar referencias en App.tsx y Facturas.tsx
3. **Paso 3**: Crear migración de base de datos
4. **Paso 4**: Crear hooks `useBudgetsForInvoice` y `useContractsForInvoice`
5. **Paso 5**: Actualizar `InvoiceFormModal.tsx` con nuevo selector
6. **Paso 6**: Actualizar `InvoiceTableView.tsx` para mostrar asociación directa
7. **Paso 7**: Actualizar query en `Facturas.tsx`

---

## Consideraciones

1. **Retrocompatibilidad**: Las facturas existentes sin asociación directa seguirán funcionando
2. **Campo `billed_invoice_id`**: Se mantiene en `financial_requests` pero deja de usarse para nuevas facturas
3. **Estado automático**: Al asociar factura a presupuesto, el presupuesto pasa a "Facturado"
4. **Validación**: Un presupuesto solo puede tener una factura asociada

---

## Sección Técnica

### Migración SQL

```sql
-- Añadir campos de asociación directa a invoices
ALTER TABLE public.invoices 
ADD COLUMN budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL,
ADD COLUMN contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
ADD COLUMN billing_period_month integer CHECK (billing_period_month >= 1 AND billing_period_month <= 12),
ADD COLUMN billing_period_year integer CHECK (billing_period_year >= 2000 AND billing_period_year <= 2100);

-- Crear índices para performance
CREATE INDEX idx_invoices_budget_id ON public.invoices(budget_id);
CREATE INDEX idx_invoices_contract_id ON public.invoices(contract_id);
```

### Query Actualizada de Facturas

```typescript
const { data: invoices } = await supabase
  .from('invoices')
  .select(`
    *,
    client:clients(id, name, code),
    budget:budgets(id, code, title),
    contract:contracts(id, code, title)
  `)
  .order('invoice_date', { ascending: false });
```

### Hook useBudgetsForInvoice

```typescript
export const useBudgetsForInvoice = (clientId?: string) => {
  return useQuery({
    queryKey: ['budgets-for-invoice', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('budgets')
        .select('id, code, title, total_amount')
        .eq('client_id', clientId)
        .eq('status', 'approved')
        .is('invoice_id', null) // Sin factura asociada (via FK inversa)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
};
```

### Selector de Asociación en InvoiceFormModal

```typescript
type AssociationType = 'budget' | 'contract' | 'none';

const [associationType, setAssociationType] = useState<AssociationType>('none');
const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
const [billingMonth, setBillingMonth] = useState<number | null>(null);
const [billingYear, setBillingYear] = useState<number | null>(null);

// Al guardar, actualizar estado del presupuesto
if (associationType === 'budget' && selectedBudgetId) {
  await supabase
    .from('budgets')
    .update({ status: 'invoiced' })
    .eq('id', selectedBudgetId)
    .eq('status', 'approved');
}
```

