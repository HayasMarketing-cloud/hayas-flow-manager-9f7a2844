

# Plan: Habilitar "Marcar como Pagada" para todos los estados excepto borrador

## Cambio Requerido

Actualmente, el botón "Marcar como Pagada" solo aparece para las liquidaciones en estados:
- `pending_payment`
- `accepted`
- `invoice_received`

El usuario solicita que esté disponible para **todos los estados excepto `draft`**.

## Modificación

**Archivo:** `src/pages/LiquidacionDetalle.tsx`

**Línea 682 - Cambiar de:**
```typescript
const canMarkAsPaid = canAccessFinance() && (liquidation.status === 'pending_payment' || liquidation.status === 'accepted' || liquidation.status === 'invoice_received');
```

**A:**
```typescript
const canMarkAsPaid = canAccessFinance() && liquidation.status !== 'draft';
```

## Estados que ahora podrán marcarse como pagadas

| Estado | Antes | Después |
|--------|-------|---------|
| `draft` (Borrador) | No | No |
| `validated` (Validada) | No | Sí |
| `sent` (Enviada) | No | Sí |
| `accepted` (Aceptada) | Sí | Sí |
| `invoice_received` (Factura recibida) | Sí | Sí |
| `disputed` (Disputada) | No | Sí |
| `pending_payment` (Pendiente de pago) | Sí | Sí |
| `paid` (Pagada) | No | Sí* |

*Nota: Técnicamente el botón aparecerá en `paid`, pero al hacer clic ya está pagada. Podríamos excluir también `paid` para evitar confusión:
```typescript
const canMarkAsPaid = canAccessFinance() && liquidation.status !== 'draft' && liquidation.status !== 'paid';
```

## Resumen de Archivos

| Archivo | Cambio |
|---------|--------|
| `src/pages/LiquidacionDetalle.tsx` | Modificar condición `canMarkAsPaid` en línea 682 |

