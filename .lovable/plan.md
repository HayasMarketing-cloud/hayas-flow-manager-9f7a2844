

# Plan: Integrar Comisiones en el P&L del Proyecto

## Situación Actual

El P&L actual calcula:
- **Ingresos**: `SUM(sale_amount)` de `financial_requests`
- **Costes**: `SUM(cost_to_agency)` de `financial_requests` (liquidados)
- **Margen**: `Ingresos - Costes`

Las comisiones están en `sales_commissions` con:
- `budget_id`: Vincula la comisión al presupuesto
- `contract_id`: Vincula la comisión al contrato
- `commission_amount`: Importe de la comisión
- `commission_type`: am, pm, sales

---

## Cambios Propuestos

### 1. Extender la interfaz `EntityPnL`

Añadir nuevos campos para comisiones:

```typescript
export interface EntityPnL {
  // ... campos existentes ...
  
  // Comisiones (nuevo)
  commissionCosts: number;       // Total comisiones del proyecto
  commissionAM: number;          // Comisiones AM
  commissionPM: number;          // Comisiones PM
  commissionSales: number;       // Comisiones de venta
  
  // Margen ajustado (nuevo)
  totalCosts: number;            // liquidatedCosts + commissionCosts
  adjustedMargin: number;        // invoicedRevenue - totalCosts
  adjustedMarginPercent: number;
}
```

### 2. Modificar `useProjectPnL` y `useBudgetPnL`

Añadir query para obtener comisiones:

```typescript
// Para presupuesto
const { data: commissions } = await supabase
  .from('sales_commissions')
  .select('commission_type, commission_amount')
  .eq('budget_id', budgetId);

// Para proyecto (a través del presupuesto vinculado)
const { data: project } = await supabase
  .from('operational_projects')
  .select('budget_id')
  .eq('id', projectId)
  .single();

const { data: commissions } = await supabase
  .from('sales_commissions')
  .select('commission_type, commission_amount')
  .eq('budget_id', project.budget_id);
```

### 3. Actualizar cálculo de P&L

```typescript
const calculatePnLWithCommissions = (data: any[], commissions: any[]) => {
  const basePnL = calculatePnL(data);
  
  const commissionAM = commissions
    .filter(c => c.commission_type === 'am')
    .reduce((sum, c) => sum + c.commission_amount, 0);
  
  const commissionPM = commissions
    .filter(c => c.commission_type === 'pm')
    .reduce((sum, c) => sum + c.commission_amount, 0);
  
  const commissionSales = commissions
    .filter(c => c.commission_type === 'sales')
    .reduce((sum, c) => sum + c.commission_amount, 0);
  
  const commissionCosts = commissionAM + commissionPM + commissionSales;
  const totalCosts = basePnL.liquidatedCosts + commissionCosts;
  const adjustedMargin = basePnL.invoicedRevenue - totalCosts;
  
  return {
    ...basePnL,
    commissionCosts,
    commissionAM,
    commissionPM,
    commissionSales,
    totalCosts,
    adjustedMargin,
    adjustedMarginPercent: basePnL.invoicedRevenue > 0 
      ? (adjustedMargin / basePnL.invoicedRevenue) * 100 
      : 0,
  };
};
```

---

## 4. Actualizar `FinancialControllingCard`

Mostrar desglose de comisiones en la sección de costes:

```
COSTES
├── Especialistas (liquidados):   900,00 €
├── Comisiones:                   169,00 €
│   ├── AM (5%):                   84,50 €
│   ├── PM (5%):                   84,50 €
│   └── Venta:                      0,00 €
└── Total Costes:               1.069,00 €

MARGEN
├── Real (Fact - Liq):            600,00 € (40%)
└── Ajustado (con comisiones):    431,00 € (29%)
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useEntityPnL.tsx` | Añadir query de comisiones, extender interfaz, ajustar cálculo |
| `src/components/shared/FinancialControllingCard.tsx` | Mostrar desglose de comisiones y margen ajustado |

---

## Visualización Propuesta

```
┌─────────────────────────────────────────────────────────────────┐
│ Controlling Financiero                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INGRESOS                          COSTES                       │
│  Estimado:    2.500€               Especialistas:   900€        │
│  Facturado:   1.500€ (60%)         Comisiones:      169€        │
│  Pendiente:   1.000€               ├─ AM:            85€        │
│  ████████░░░░░░                    ├─ PM:            85€        │
│                                    └─ Venta:          0€        │
│                                    Total:          1.069€       │
│                                    █████████░░░                 │
├─────────────────────────────────────────────────────────────────┤
│  MARGEN                                                         │
│  ┌───────────────────┐  ┌───────────────────┐                   │
│  │ Real              │  │ Ajustado          │                   │
│  │ 600€ (40%)        │  │ 431€ (29%)        │                   │
│  │ (sin comisiones)  │  │ (con comisiones)  │                   │
│  └───────────────────┘  └───────────────────┘                   │
│                                                                 │
│  15 requests | 12 facturados | 10 liquidados | 3 comisiones     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Consideraciones

1. **Comisiones de venta**: Se vinculan al contrato o presupuesto directamente
2. **Comisiones AM/PM**: Se calculan sobre facturas pero se vinculan al presupuesto
3. **Proyectos sin presupuesto**: No tendrán comisiones (se pueden añadir manualmente después)
4. **Reporte consolidado**: También se actualizará `useConsolidatedPnL` para incluir comisiones

