

## Plan: Permitir importes negativos en conceptos manuales de liquidaciones

### Problema
La validación actual rechaza importes ≤ 0, impidiendo añadir abonos o regularizaciones con importe negativo.

### Cambios

**`src/pages/LiquidacionDetalle.tsx`**
- Cambiar validación de `amount <= 0` a `amount === 0` (permitir negativos).
- Eliminar `min="0"` del input de importe (aparece en dos lugares: sección borrador y sección no-borrador).

**`src/components/liquidations/LiquidationFormModal.tsx`**
- Cambiar validación `newManualAmount <= 0` a `!newManualAmount || newManualAmount === 0`.
- Eliminar `min="0"` del input de importe del modal.

### Archivos afectados
- `src/pages/LiquidacionDetalle.tsx`
- `src/components/liquidations/LiquidationFormModal.tsx`

