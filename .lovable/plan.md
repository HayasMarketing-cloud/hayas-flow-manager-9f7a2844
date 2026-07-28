## Objetivo
Permitir editar liquidaciones en cualquier estado excepto `paid`.

## Estado actual
Frontend restringe edición a `draft | validated | sent | disputed`. La RLS ya permite a admin/finanzas actualizar cualquier estado, así que sólo hay que ampliar la comprobación en cliente.

## Cambios

Reemplazar la condición `isEditable` para incluir también `accepted`, `invoice_received` y `pending_payment` (todo excepto `paid`):

1. `src/components/liquidations/LiquidationCard.tsx` (línea 19)
2. `src/components/liquidations/LiquidationTableView.tsx` (línea 105)
3. `src/pages/LiquidacionDetalle.tsx` (línea 990)
4. `src/components/liquidations/LiquidationFormModal.tsx` (línea 250) — en modo `edit`, editable si `status !== 'paid'`

Regla unificada:
```ts
const isEditable = liquidation.status !== 'paid';
```

## Fuera de alcance
- No se toca RLS (ya lo soporta).
- No se cambia lógica de envío/marcado como pagada.
- Sin cambios de datos.