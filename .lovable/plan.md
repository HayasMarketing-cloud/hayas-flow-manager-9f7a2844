

# Plan: Cambiar "Pagada" a "Cobrada" en Facturas a Clientes

## Objetivo

Actualizar la terminología en la sección de Facturas emitidas a clientes, cambiando "Pagada" por "Cobrada" y "Pendiente de pago" por "Pendiente de cobro", ya que esto refleja mejor la realidad del negocio (se cobra a clientes, se paga a proveedores).

## Cambios de Terminología

| Término Actual | Nuevo Término |
|----------------|---------------|
| Pagada | Cobrada |
| Pagadas | Cobradas |
| Pendiente de pago | Pendiente de cobro |
| Marcar Pagada | Marcar Cobrada |
| Marcar como Pagadas | Marcar como Cobradas |
| marcadas como pagadas | marcadas como cobradas |

## Archivos a Modificar

### 1. `src/lib/invoice-utils.ts`
Centro de la lógica de estados. Renombrar las funciones para usar terminología de cobro:
- `getInvoiceStatusLabel()`: Cambiar "Pagada" → "Cobrada"
- `getInvoiceStatusLabel()`: Cambiar "Pendiente de pago" → "Pendiente de cobro"
- Añadir comentarios para clarificar que estos son términos específicos para facturas **emitidas** a clientes

### 2. `src/components/invoices/InvoiceStatusActions.tsx`
Botones de acción de estado:
- Línea 34: `paid: 'Pagada'` → `paid: 'Cobrada'`
- Línea 72: Mensaje toast "marcada como Pagada" → "marcada como Cobrada"
- Línea 104: Botón "Marcar Pagada" → "Marcar Cobrada"

### 3. `src/pages/Facturas.tsx`
Listado principal de facturas:
- Línea 55: Toast "marcadas como pagadas" → "marcadas como cobradas"
- Línea 293: SelectItem "Pagada" → "Cobrada"
- Línea 451: Botón bulk "Marcar como Pagadas" → "Marcar como Cobradas"

### 4. `src/components/invoices/BulkPaymentModal.tsx`
Modal de cobro masivo:
- Línea 55: Toast "marcadas como pagadas" → "marcadas como cobradas"
- Título del modal: Considerar cambiar "Registrar Pago Masivo" → "Registrar Cobro Masivo"
- Labels: "Facturas a marcar como pagadas" → "Facturas a marcar como cobradas"
- Botón: "Registrar Pago" → "Registrar Cobro"

### 5. `src/pages/Reportes.tsx`
Sección de reportes:
- Línea 736: Condición de texto "Pagada" → "Cobrada"

## Nota sobre Diferenciación de Facturas

Se añadirán comentarios en el código para clarificar que:
- **Facturas a clientes (emitidas)**: Se "cobran" - Status "Cobrada" / "Pendiente de cobro"
- **Facturas de proveedores (recibidas)**: Se "pagan" - Status "Pagada" / "Pendiente de pago" (a implementar en el futuro)

Esto prepara la base para cuando se implemente la gestión de facturas de proveedores.

## Sección Técnica

### Cambio en invoice-utils.ts

```typescript
// === FACTURAS EMITIDAS A CLIENTES ===
// Para facturas emitidas usamos terminología de "cobro" (ingresos)
// Nota: Las futuras facturas de proveedores usarán terminología de "pago" (gastos)

export const getInvoiceStatusLabel = (status: InvoiceStatus): string => {
  if (status === 'paid') {
    return 'Cobrada';  // Cliente invoice = collected
  }
  return 'Pendiente de cobro';
};
```

### Cambio en InvoiceStatusActions.tsx

```typescript
const statusLabels: Record<InvoiceStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  paid: 'Cobrada',  // Changed from 'Pagada'
  overdue: 'Vencida',
  cancelled: 'Cancelada',
};
```

### Cambio en BulkPaymentModal.tsx

```typescript
<DialogTitle className="flex items-center gap-2">
  <CreditCard className="h-5 w-5" />
  Registrar Cobro Masivo  {/* Changed from 'Pago Masivo' */}
</DialogTitle>
```

## Resumen de Archivos

| Archivo | Tipo de Cambio |
|---------|---------------|
| `src/lib/invoice-utils.ts` | Labels de estado + comentarios |
| `src/components/invoices/InvoiceStatusActions.tsx` | Labels, botones, toasts |
| `src/pages/Facturas.tsx` | Selectores, botones, toasts |
| `src/components/invoices/BulkPaymentModal.tsx` | Título, labels, botón, toast |
| `src/pages/Reportes.tsx` | Texto de estado |

