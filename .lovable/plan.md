# Plan: P&L por Proyecto/Presupuesto

## ✅ Implementado

Se ha implementado el cálculo de P&L directamente desde `financial_requests`, sin depender de `liquidation_items`.

### Archivos Creados

1. **`src/hooks/useEntityPnL.tsx`** - Hooks para calcular P&L:
   - `useProjectPnL(projectId)` - P&L para proyectos operacionales
   - `useBudgetPnL(budgetId)` - P&L para presupuestos
   - `useConsolidatedPnL()` - P&L consolidado para reportes

2. **`src/components/shared/FinancialControllingCard.tsx`** - Componente visual de P&L

### Archivos Modificados

1. **`src/pages/operations/OperationalProjectDetail.tsx`** - Tarjeta de controlling añadida
2. **`src/pages/PresupuestoDetalle.tsx`** - Nueva pestaña "Controlling" añadida
3. **`src/pages/Reportes.tsx`** - Nuevo reporte "P&L por Proyecto" añadido

### Métricas Disponibles

- Ingresos: Estimado / Facturado / Pendiente
- Costes: Estimado / Liquidado / Pendiente
- Margen: Real (Fact-Liq) / Estimado / Porcentaje

### Pendiente Futuro

- Asociar items manuales de liquidación (comisiones, gestión extra) al P&L por proyecto
