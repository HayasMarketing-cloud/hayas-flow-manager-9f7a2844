
# Plan: Permitir Revertir Estado de Facturas Cobradas

## Problema Identificado

Actualmente las facturas con estado "Cobrada" (paid):
1. No muestran el menú de cambio de estado (porque `statusTransitions['paid'] = []`)
2. No pueden ser seleccionadas para operaciones masivas (checkbox deshabilitado)
3. No hay forma de "desconciliar" una factura para re-asociarla a un pago diferente

## Solución Propuesta

Añadir la posibilidad de revertir el estado de una factura "Cobrada" a "Pendiente de cobro" (sent), permitiendo:
- Corregir errores de conciliación
- Re-asociar facturas a pagos diferentes
- Volver a seleccionar la factura para operaciones bulk

### Consideraciones

Al revertir una factura cobrada:
1. Se debe eliminar el vínculo con el pago existente (si lo hay) en `invoice_payments`
2. Se debe limpiar la fecha de cobro (`paid_at = null`)
3. Opcionalmente mostrar una advertencia si hay un pago asociado

---

## Cambios por Archivo

### `src/components/invoices/InvoiceStatusActions.tsx`

| Cambio | Descripción |
|--------|-------------|
| Línea 26 | Añadir transición `paid: ['sent']` para permitir revertir a "Enviada" |
| Nueva lógica | Al cambiar de `paid` a `sent`, limpiar `paid_at` y eliminar vínculos en `invoice_payments` |

### `src/components/invoices/InvoiceTableView.tsx` (Opcional)

| Cambio | Descripción |
|--------|-------------|
| Mantener como está | Las facturas cobradas no necesitan seleccionarse para pagos masivos, solo cambiar estado individualmente |

---

## Nueva UI

En la tabla de facturas, al hacer clic en el menú de acciones de una factura "Cobrada":

```text
┌──────────────────────┐
│ ↩ Revertir a Enviada │  ← Nueva opción
└──────────────────────┘
```

También se podría añadir un icono de advertencia si la factura está vinculada a un pago.

---

## Flujo de Reversión

```text
Usuario hace clic en "Revertir a Enviada"
           │
           ▼
    ¿Tiene pago asociado?
           │
     ┌─────┴─────┐
     │           │
    Sí          No
     │           │
     ▼           ▼
 Eliminar     Actualizar
 registro     status='sent'
 invoice_     paid_at=null
 payments
     │           │
     └─────┬─────┘
           │
           ▼
   Toast: "Factura revertida"
   Actualizar lista
```

---

## Sección Técnica

### Cambio en statusTransitions

```typescript
const statusTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['paid', 'overdue', 'cancelled'],
  paid: ['sent'],  // ← NUEVO: permitir revertir
  overdue: ['paid', 'cancelled'],
  cancelled: [],
};
```

### Nueva Lógica de Mutación

```typescript
const updateStatusMutation = useMutation({
  mutationFn: async (newStatus: InvoiceStatus) => {
    setIsUpdating(true);
    const updates: Record<string, any> = { status: newStatus };
    
    if (newStatus === 'sent' && currentStatus === 'draft') {
      updates.sent_at = new Date().toISOString();
    } else if (newStatus === 'paid') {
      updates.paid_at = new Date().toISOString();
    } else if (newStatus === 'sent' && currentStatus === 'paid') {
      // REVERTIR: limpiar paid_at y eliminar vínculos de pago
      updates.paid_at = null;
      
      // Eliminar registros de invoice_payments
      await supabase
        .from('invoice_payments')
        .delete()
        .eq('invoice_id', invoiceId);
    }

    const { error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', invoiceId);

    if (error) throw error;
  },
  // ...
});
```

### Label para la Transición

```typescript
// Añadir label específico para la reversión
const getTransitionLabel = (from: InvoiceStatus, to: InvoiceStatus): string => {
  if (from === 'paid' && to === 'sent') {
    return 'Revertir a Pendiente';
  }
  return statusLabels[to];
};
```

---

## Resumen de Cambios

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `InvoiceStatusActions.tsx` | Modificar | Añadir transición `paid → sent` con limpieza de datos |

---

## Alternativa: Menú Contextual en la Tabla

También se podría añadir un botón específico "Revertir cobro" que solo aparezca para facturas cobradas, separado del menú de estados. Esto sería más explícito pero requiere más cambios de UI.

**Recomendación**: Implementar la solución en `InvoiceStatusActions` ya que es la forma consistente de manejar cambios de estado y requiere mínimos cambios.
