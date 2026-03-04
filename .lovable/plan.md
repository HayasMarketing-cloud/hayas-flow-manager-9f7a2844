

## Plan: Permitir marcar como pagada desde estado "Factura recibida"

### Problema
En `LiquidationTableView.tsx`, las liquidaciones seleccionables para pago masivo solo incluyen `pending_payment` y `accepted`, pero **no `invoice_received`**. Esto impide seleccionar la liquidación LIQ-2026-014 para marcarla como pagada desde la lista.

El botón "Marcar como Pagada" en la vista de **detalle** sí funciona (línea 848: `canMarkAsPaid = status !== 'draft' && status !== 'paid'`), pero desde la **lista** no se puede seleccionar ni actuar sobre ella.

### Cambios

**`src/components/liquidations/LiquidationTableView.tsx`** — Añadir `invoice_received` a los estados "pagables":

- Línea 38-39: Añadir `invoice_received` al filtro de `payableLiquidations`
- Línea 65: Añadir `invoice_received` a la función `isPayable`

```typescript
// Antes:
const payableLiquidations = liquidations.filter(
  liq => liq.status === 'pending_payment' || liq.status === 'accepted'
);
const isPayable = (status: string) => status === 'pending_payment' || status === 'accepted';

// Después:
const payableLiquidations = liquidations.filter(
  liq => liq.status !== 'draft' && liq.status !== 'paid'
);
const isPayable = (status: string) => status !== 'draft' && status !== 'paid';
```

Esto alinea la lógica de la lista con la del detalle, permitiendo marcar como pagada cualquier liquidación que no sea borrador ni ya pagada (incluidos `sent`, `accepted`, `invoice_received`, `pending_payment`, `validated`, `disputed`).

### Archivos afectados
- `src/components/liquidations/LiquidationTableView.tsx` (2 líneas)

