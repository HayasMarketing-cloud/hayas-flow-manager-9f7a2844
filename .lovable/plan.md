## Agrupar comisiones por contrato de origen en liquidaciones

### Problema
En la liquidación de marzo de Iolanda Carbone, las comisiones (Comisión AM 10% — Factura Nº 2026/42, etc.) aparecen agrupadas bajo `ASENDIA HQ → Sin proyecto/presupuesto`, en lugar de agruparse bajo el contrato de origen `CON-2025-004 — Plan de Marketing Digital y Branding`.

### Causa raíz
Las facturas que originan estas comisiones provienen de un **contrato** (`contract_id` poblado, `budget_id = NULL`). El código actual sólo enriquece los datos de comisión con el cliente y el presupuesto (`budgetId`) de la factura origen, pero **ignora el contrato**:

1. `src/pages/LiquidacionDetalle.tsx` (query `linkedCommissionDetails`, líneas 376-429): hace join sólo con `budget:budgets(...)`, no recoge `contract:contracts(...)`.
2. `src/lib/liquidation-grouping.ts`: el bloque `else if (commissionSource?.budgetId)` no tiene rama para `contractId`, por lo que las comisiones de facturas-de-contrato caen en `'Sin proyecto/presupuesto'`.
3. `supabase/functions/get-liquidation-items/index.ts`: misma carencia, para mantener paridad con la vista del especialista.

### Solución
Extender el enriquecimiento de comisiones para soportar el origen "contrato" además de "presupuesto", reutilizando la rama `type: 'contract'` que ya renderiza correctamente `GroupedLiquidationItemsTable` (icono azul `FileText`).

### Cambios

**1. `src/pages/LiquidacionDetalle.tsx` — query `linkedCommissionDetails`**
- Añadir `contract:contracts(id, code, title)` al `select` de invoices.
- Poblar en `invoicesMap` los nuevos campos: `contract_id`, `contract_code`, `contract_title`.
- En el `details[comm.id]` añadir: `contractId`, `contractCode`, `contractTitle` (tomados de la primera invoice, con fallback a `comm.contract_id`).

**2. `src/lib/liquidation-grouping.ts`**
- Ampliar la interface `CommissionSourceInfo` con `contractId?`, `contractCode?`, `contractTitle?`.
- En la lógica de fallback de proyecto/presupuesto para comisiones, añadir rama:
  ```
  else if (commissionSource?.budgetId) { ...budget... }
  else if (commissionSource?.contractId) {
    projectBudgetId = commissionSource.contractId;
    projectBudgetName = commissionSource.contractTitle || commissionSource.contractCode || 'Contrato';
    projectBudgetType = 'contract';
  }
  ```
- Prioridad: presupuesto > contrato (igual que hoy proyecto > presupuesto > contrato para requests).

**3. `src/components/liquidations/GroupedLiquidationItemsTable.tsx`**
- Actualizar la interface `CommissionDetail` local para incluir `contractId/contractCode/contractTitle` (sólo tipos; el render del header ya soporta `type: 'contract'`).

**4. `supabase/functions/get-liquidation-items/index.ts`**
- Replicar el enriquecimiento: añadir join con `contracts` y devolver los campos de contrato en `commissionDetails` para mantener paridad con la vista de especialista (PDF y firma).

### Consideraciones
- Sólo lectura/visualización: no se requiere migración de datos.
- Compatibilidad: comisiones cuyo origen sea un presupuesto siguen agrupándose igual que hoy.
- Si una factura tuviera tanto `budget_id` como `contract_id` (caso anómalo), prevalece el presupuesto, alineado con la jerarquía actual.
- Tras desplegar, los usuarios deberán refrescar (Ctrl+F5) para invalidar la caché de React Query de la liquidación abierta.
