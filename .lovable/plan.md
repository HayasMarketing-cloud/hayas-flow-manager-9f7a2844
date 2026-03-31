

## Fix: Timeline muestra "Pagada" como completada cuando el estado es "Pendiente de pago"

### Problema
El componente `LiquidationProcessTimeline.tsx` usa índices hardcodeados del array `statusOrder` para determinar qué pasos están completados. El array incluye `disputed` en posición 5, lo que desplaza `pending_payment` a índice 6 y `paid` a índice 7. Sin embargo, las comparaciones de los pasos usan números fijos (4, 5, 6) que no coinciden con estos índices reales.

Cuando el estado es `pending_payment` (índice 6):
- Paso "Pendiente de pago": `6 >= 5` → se marca como **completado** (debería ser **current**)
- Paso "Pagada": `6 >= 6` → se marca como **completado** (debería ser **pending**)

**No es un bug de datos** — el estado en base de datos es correcto. Es un bug visual en el timeline.

### Solución

**Archivo: `src/components/liquidations/LiquidationProcessTimeline.tsx`**

Reemplazar los índices hardcodeados por referencias dinámicas usando `getStatusIndex()`:

```typescript
// Línea ~253-261: Paso "Pendiente de pago"
const pendingPaymentIndex = getStatusIndex('pending_payment');
const paidIndex = getStatusIndex('paid');

// Pendiente de pago
status: currentIndex >= paidIndex ? 'completed' 
      : currentIndex >= pendingPaymentIndex ? 'current' 
      : 'pending',

// Pagada
status: currentIndex >= paidIndex ? 'completed' 
      : currentIndex === paidIndex ? 'current'  // (nunca será > paidIndex)
      : 'pending',
```

También corregir la misma lógica en el paso de `showPaymentDate` (línea ~253) para que use `getStatusIndex('invoice_received')` en vez de `4`.

### Resultado
El timeline mostrará correctamente "Pendiente de pago" como estado actual y "Pagada" como pendiente cuando la liquidación está en estado `pending_payment`.

