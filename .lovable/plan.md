

## Fix: Liquidación se marca como "pagada" al aceptar (debería ser "aceptada")

### Problema

En `supabase/functions/process-signature/index.ts`, línea 213:

```typescript
const liquidationStatus = action === 'accept' ? 'paid' : 'disputed';
```

Cuando el especialista acepta la liquidación, el estado pasa directamente a `'paid'` y se setea `paid_at`. Esto es incorrecto: debería quedar como `'accepted'` y esperar a que admin/finanzas la marque como pagada manualmente.

### Cambios

**Archivo: `supabase/functions/process-signature/index.ts`**

1. Línea 213: Cambiar `'paid'` → `'accepted'`
2. Líneas 216-218: Eliminar el bloque que setea `paid_at = now` cuando la acción es `accept`, ya que el pago no ocurre en este momento.

Resultado: Aceptar → status `'accepted'` (sin `paid_at`). Luego el especialista sube factura → status `'pending_payment'` o `'invoice_received'`. Finalmente admin/finanzas marca como pagada → status `'paid'` con `paid_at` y notificación al especialista (flujo ya implementado en `send-liquidation-paid-notification`).

