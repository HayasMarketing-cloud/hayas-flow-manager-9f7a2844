
# Plan: Pago masivo de facturas

## Resumen

Agregar la funcionalidad para seleccionar varias facturas desde el listado y marcarlas como pagadas en un solo pago, incluyendo la fecha de pago y el importe total. Esta funcionalidad es especialmente util para clientes como Asendia que pagan multiples facturas en un unico pago.

## Flujo de usuario

1. El usuario entra en la pagina de Facturas
2. Cambia a vista de tabla (donde hay checkboxes)
3. Selecciona las facturas que quiere marcar como pagadas
4. Aparece una barra flotante con la accion "Marcar como Pagadas"
5. Al hacer clic, se abre un modal con:
   - Resumen de facturas seleccionadas (codigos y totales)
   - Campo para fecha de pago (por defecto hoy)
   - Campo opcional para importe total recibido (informativo)
   - Campo opcional para notas del pago
6. Al confirmar, todas las facturas se marcan como pagadas con la misma fecha

## Cambios tecnicos

| Archivo | Cambio |
|---------|--------|
| `src/pages/Facturas.tsx` | Agregar estado `selectedIds`, handlers de seleccion, y barra de acciones masivas |
| `src/components/invoices/InvoiceTableView.tsx` | Agregar columna de checkboxes y props de seleccion |
| `src/components/invoices/BulkPaymentModal.tsx` | **Nuevo archivo** - Modal para configurar el pago masivo |

### 1. Modificar InvoiceTableView.tsx

Agregar checkboxes igual que en `RequestTableView`:
- Nueva columna de checkbox en el header
- Checkbox en cada fila para facturas con estado `sent` u `overdue`
- Props nuevas: `selectedIds`, `onSelectAll`, `onSelectOne`

### 2. Modificar Facturas.tsx

```text
Nuevos estados:
- selectedIds: string[] - IDs de facturas seleccionadas
- bulkPaymentModalOpen: boolean - Controla visibilidad del modal

Nuevos handlers:
- handleSelectAll(checked)
- handleSelectOne(id, checked)
- handleBulkPayment() - Abre el modal

UI adicional:
- Barra flotante cuando hay seleccion activa mostrando:
  - "X facturas seleccionadas"
  - Total acumulado de las facturas
  - Boton "Marcar como Pagadas"
```

### 3. Nuevo componente BulkPaymentModal.tsx

```text
Props:
- isOpen: boolean
- onClose: () => void
- invoiceIds: string[]
- invoices: any[] (para mostrar resumen)

Campos del formulario:
- Fecha de pago (date input, default: hoy)
- Importe total recibido (number input, opcional/informativo)
- Notas (textarea, opcional)

Al confirmar:
- Actualiza todas las facturas seleccionadas a status='paid'
- Guarda paid_at con la fecha indicada
- Muestra toast de exito
- Invalida query de facturas
- Limpia seleccion
```

## Logica de seleccion

Solo se podran seleccionar facturas con estado:
- `sent` (Enviada)
- `overdue` (Vencida)

Las facturas en `draft`, `paid` o `cancelled` no tendran checkbox activo ya que no tiene sentido marcarlas como pagadas.

## Estructura del modal de pago masivo

```text
+------------------------------------------+
|  Registrar Pago Masivo              [X]  |
+------------------------------------------+
|                                          |
|  Facturas a marcar como pagadas:         |
|  +------------------------------------+  |
|  | FAC-2025-0001  |  1.500,00 EUR    |  |
|  | FAC-2025-0002  |  2.300,00 EUR    |  |
|  | FAC-2025-0003  |    850,00 EUR    |  |
|  +------------------------------------+  |
|  Total facturas: 4.650,00 EUR            |
|                                          |
|  Fecha de pago:                          |
|  [ 23/01/2026        ] (calendario)      |
|                                          |
|  Importe recibido (opcional):            |
|  [ 4.650,00          ] EUR               |
|                                          |
|  Notas (opcional):                       |
|  [                                   ]   |
|  [                                   ]   |
|                                          |
|           [Cancelar]  [Registrar Pago]   |
+------------------------------------------+
```

## Consideraciones

- El importe recibido es informativo, no se almacena (a menos que se quiera agregar un campo en la tabla de facturas)
- La fecha de pago se aplicara a todas las facturas seleccionadas
- Se limpiara la seleccion despues de completar el pago
- Solo funciona en vista de tabla (la vista de cards no tiene checkboxes)
