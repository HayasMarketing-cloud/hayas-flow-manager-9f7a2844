

## Plan: Permitir importes negativos en liquidaciones (fix completo)

### Causa raíz identificada

El frontend ya permite introducir valores negativos tras los cambios anteriores, pero **la base de datos los rechaza silenciosamente** por CHECK constraints:

```text
liquidation_items.unit_price  CHECK (unit_price >= 0)  ← BLOQUEA
liquidation_items.total       CHECK (total >= 0)       ← BLOQUEA
liquidations.subtotal         CHECK (subtotal >= 0)    ← BLOQUEA
liquidations.tax_amount       CHECK (tax_amount >= 0)  ← BLOQUEA
liquidations.total_amount     CHECK (total_amount >= 0)← BLOQUEA
```

Además, en `LiquidacionDetalle.tsx` línea 512 hay un `Math.max(0, ...)` que impide que el subtotal baje de 0 al eliminar items.

### Cambios necesarios

**1. Migración SQL** — Eliminar los CHECK constraints que bloquean negativos en liquidaciones:

```sql
-- liquidation_items: permitir unit_price y total negativos
ALTER TABLE public.liquidation_items DROP CONSTRAINT liquidation_items_unit_price_check;
ALTER TABLE public.liquidation_items DROP CONSTRAINT liquidation_items_total_check;

-- liquidations: permitir subtotal, tax_amount y total_amount negativos
ALTER TABLE public.liquidations DROP CONSTRAINT liquidations_subtotal_check;
ALTER TABLE public.liquidations DROP CONSTRAINT liquidations_tax_amount_check;
ALTER TABLE public.liquidations DROP CONSTRAINT liquidations_total_amount_check;
```

> Nota: NO se tocan los constraints de `invoices` ni `invoice_items`, que siguen siendo >= 0.

**2. Frontend** — `src/pages/LiquidacionDetalle.tsx`:

- Línea 512: Eliminar `Math.max(0, ...)` en `removeItemMutation` para permitir que el subtotal sea negativo al eliminar items:
  ```typescript
  // Antes:
  const newSubtotal = Math.max(0, currentSubtotal - (Number(item.total) || 0));
  // Después:
  const newSubtotal = currentSubtotal - (Number(item.total) || 0);
  ```

### Archivos afectados
- Nueva migración SQL (constraints)
- `src/pages/LiquidacionDetalle.tsx` (1 línea)

