

# Plan: P&L por Proyecto/Presupuesto usando Financial Requests

## Decisión Tomada

Calcular el P&L directamente desde `financial_requests`, sin depender de `liquidation_items`. Los items manuales de liquidación se asociarán posteriormente de otra manera.

---

## Fuente de Datos: `financial_requests`

Toda la información necesaria está en la tabla `financial_requests`:

| Campo | Uso en P&L |
|-------|------------|
| `sale_amount` | Ingreso por request |
| `cost_to_agency` | Coste estimado por request |
| `billed_invoice_id` | Si NOT NULL → ingreso facturado |
| `liquidation_id` | Si NOT NULL → coste liquidado |
| `status` | Estado actual (completed, in_progress, etc.) |
| `budget_id` | Vinculación a presupuesto |
| `operational_requests.operational_project_id` | Vinculación a proyecto |

---

## Métricas de P&L

Para cada proyecto o presupuesto:

```text
INGRESOS
├── Estimado:    SUM(sale_amount) de todos los requests
├── Facturado:   SUM(sale_amount) WHERE billed_invoice_id IS NOT NULL
└── Pendiente:   Estimado - Facturado

COSTES
├── Estimado:    SUM(cost_to_agency) de todos los requests
├── Liquidado:   SUM(cost_to_agency) WHERE liquidation_id IS NOT NULL
└── Pendiente:   Estimado - Liquidado

MARGEN
├── Real:        Facturado - Liquidado
├── Estimado:    Ingresos Estimados - Costes Estimados
└── %:           (Margen / Ingresos) × 100
```

---

## Archivos a Crear

### 1. Hook de P&L: `src/hooks/useEntityPnL.tsx`

Hook reutilizable que calcula P&L para proyectos y presupuestos:

```typescript
interface EntityPnL {
  // Ingresos
  estimatedRevenue: number;
  invoicedRevenue: number;
  pendingToInvoice: number;
  
  // Costes
  estimatedCosts: number;
  liquidatedCosts: number;
  pendingToLiquidate: number;
  
  // Margen
  realMargin: number;           // invoicedRevenue - liquidatedCosts
  realMarginPercent: number;
  estimatedMargin: number;      // estimatedRevenue - estimatedCosts
  estimatedMarginPercent: number;
  
  // Contadores
  totalRequests: number;
  invoicedRequests: number;
  liquidatedRequests: number;
}

export const useProjectPnL = (projectId: string) => EntityPnL;
export const useBudgetPnL = (budgetId: string) => EntityPnL;
```

**Query para Proyecto:**
```sql
SELECT 
  SUM(fr.sale_amount) as estimated_revenue,
  SUM(CASE WHEN fr.billed_invoice_id IS NOT NULL THEN fr.sale_amount ELSE 0 END) as invoiced_revenue,
  SUM(fr.cost_to_agency) as estimated_costs,
  SUM(CASE WHEN fr.liquidation_id IS NOT NULL THEN fr.cost_to_agency ELSE 0 END) as liquidated_costs,
  COUNT(*) as total_requests,
  COUNT(fr.billed_invoice_id) as invoiced_requests,
  COUNT(fr.liquidation_id) as liquidated_requests
FROM financial_requests fr
JOIN operational_requests orq ON orq.financial_request_id = fr.id
WHERE orq.operational_project_id = :projectId
```

**Query para Presupuesto:**
```sql
SELECT 
  SUM(sale_amount) as estimated_revenue,
  SUM(CASE WHEN billed_invoice_id IS NOT NULL THEN sale_amount ELSE 0 END) as invoiced_revenue,
  SUM(cost_to_agency) as estimated_costs,
  SUM(CASE WHEN liquidation_id IS NOT NULL THEN cost_to_agency ELSE 0 END) as liquidated_costs,
  COUNT(*) as total_requests,
  COUNT(billed_invoice_id) as invoiced_requests,
  COUNT(liquidation_id) as liquidated_requests
FROM financial_requests
WHERE budget_id = :budgetId
```

---

### 2. Componente Visual: `src/components/shared/FinancialControllingCard.tsx`

Tarjeta reutilizable que muestra el P&L:

```text
┌─────────────────────────────────────────────────────────────┐
│ 💰 Controlling Financiero                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  INGRESOS                          COSTES                   │
│  ─────────                         ──────                   │
│  Estimado:    2.500,00 €           Estimado:   1.200,00 €   │
│  Facturado:   1.800,00 € (72%)     Liquidado:    900,00 €   │
│  Pendiente:     700,00 €           Pendiente:    300,00 €   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  MARGEN                                                     │
│  ──────                                                     │
│  Real (Fact-Liq):    900,00 € (50%)                         │
│  Estimado:         1.300,00 € (52%)                         │
│                                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │██████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│     │
│  │    Facturado           Pendiente                  │     │
│  └────────────────────────────────────────────────────┘     │
│                                                             │
│  📊 15 requests | 12 facturados | 10 liquidados             │
└─────────────────────────────────────────────────────────────┘
```

---

## Archivos a Modificar

### 3. Detalle de Proyecto Operacional

**Archivo:** `src/pages/operations/OperationalProjectDetail.tsx`

Añadir después de "Project Info Card" (línea ~360):

```tsx
import { useProjectPnL } from '@/hooks/useEntityPnL';
import { FinancialControllingCard } from '@/components/shared/FinancialControllingCard';

// En el componente
const { data: pnl, isLoading: loadingPnL } = useProjectPnL(id || '');

// En el render, después de la tarjeta de info:
<FinancialControllingCard 
  data={pnl}
  isLoading={loadingPnL}
  title="Controlling Financiero del Proyecto"
/>
```

---

### 4. Detalle de Presupuesto

**Archivo:** `src/pages/PresupuestoDetalle.tsx`

Añadir tarjeta financiera en la pestaña "Resumen" o como nueva pestaña "Controlling":

```tsx
import { useBudgetPnL } from '@/hooks/useEntityPnL';
import { FinancialControllingCard } from '@/components/shared/FinancialControllingCard';

const { data: pnl, isLoading: loadingPnL } = useBudgetPnL(id || '');

// En las tabs:
<TabsContent value="controlling">
  <FinancialControllingCard 
    data={pnl}
    isLoading={loadingPnL}
    title="Controlling Financiero del Presupuesto"
  />
</TabsContent>
```

---

### 5. Nuevo Reporte: P&L por Proyecto

**Archivo:** `src/pages/Reportes.tsx`

Añadir nuevo tipo de reporte `pnl_by_project`:

```tsx
// Nuevo tipo de reporte
type ReportType = 'revenue_vs_costs' | 'margin_by_client' | 'liquidations_by_specialist' | 'requests_summary' | 'pnl_by_project';

// Nueva tarjeta de reporte
{
  id: 'pnl_by_project',
  title: 'P&L por Proyecto',
  description: 'Cuenta de resultados por proyecto y presupuesto',
  icon: FileBarChart,
}
```

**Vista del reporte:**

| Cliente | Proyecto/Presupuesto | Ingr. Fact. | Costes Liq. | Margen | % |
|---------|----------------------|-------------|-------------|--------|---|
| ASENDIA | ePAQ GO Translations | 1.409€ | 409€ | 1.000€ | 71% |
| ASENDIA | Switzerland Campaign | 2.100€ | 1.175€ | 925€ | 44% |
| ... | ... | ... | ... | ... | ... |
| **TOTAL** | | **3.509€** | **1.584€** | **1.925€** | **55%** |

---

## Resumen de Cambios

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/hooks/useEntityPnL.tsx` | Nuevo | Hook con `useProjectPnL` y `useBudgetPnL` |
| `src/components/shared/FinancialControllingCard.tsx` | Nuevo | Componente visual de P&L |
| `src/pages/operations/OperationalProjectDetail.tsx` | Modificar | Añadir tarjeta de controlling |
| `src/pages/PresupuestoDetalle.tsx` | Modificar | Añadir pestaña o sección de controlling |
| `src/pages/Reportes.tsx` | Modificar | Añadir reporte "P&L por Proyecto" |

---

## Ventajas de Este Enfoque

1. **Simplicidad**: Una sola fuente de datos (`financial_requests`)
2. **Consistencia**: Mismos campos que ya se usan en otras partes del sistema
3. **Rendimiento**: Queries simples sin JOINs complejos a `liquidation_items`
4. **Escalabilidad**: Los items manuales de liquidación se pueden añadir después
5. **Precisión**: El `cost_to_agency` registrado en cada request refleja el coste real pactado

