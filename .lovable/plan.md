
## Funcionalidad: Añadir Requests a Facturación (Cliente)

### Objetivo
Permitir asociar múltiples solicitudes (requests) a una factura existente importada, similar al flujo de "Añadir a Liquidación". Los requests seleccionados actualizarán su campo `billed_invoice_id` para vincularse a la factura elegida.

---

### Comportamiento esperado

1. **Selección de requests** en la tabla de Solicitudes
2. **Botón "Añadir a Facturación"** aparece en la barra de acciones en grupo
3. **Modal de selección** muestra:
   - Lista de requests seleccionados con sus `sale_amount`
   - Selector de factura (solo facturas del mismo cliente, pendientes de cobro)
   - Validación: la suma de `sale_amount` debe coincidir con el `subtotal` de la factura seleccionada
4. **Al confirmar**:
   - Se actualiza `billed_invoice_id` en cada request
   - Se invalidan las queries relacionadas
   - Toast de éxito

---

### Validaciones

| Regla | Descripción |
|-------|-------------|
| Mismo cliente | Todos los requests deben pertenecer al mismo cliente |
| Sin facturar | Solo requests con `billed_invoice_id = null` |
| Factura pendiente | Solo facturas con estado distinto de 'paid' |
| Coincidencia total | `SUM(sale_amount)` = `subtotal` de la factura (tolerancia 0.01€) |

---

### Archivos a crear

| Archivo | Propósito |
|---------|-----------|
| `src/components/invoices/AddToInvoiceModal.tsx` | Modal principal para añadir requests a factura |
| `src/hooks/useAvailableInvoicesForRequests.tsx` | Hook para obtener facturas elegibles por cliente |

---

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Solicitudes.tsx` | Añadir botón "Añadir a Facturación" y estado del modal |
| `src/pages/SolicitudDetalle.tsx` | Añadir botón "+ Factura" en la sección de Estado de Facturación |

---

### Detalles técnicos

**Hook `useAvailableInvoicesForRequests`:**
```typescript
// Obtiene facturas del cliente que NO estén pagadas
const { data } = await supabase
  .from('invoices')
  .select('id, code, subtotal, total_amount, status, due_date')
  .eq('client_id', clientId)
  .neq('status', 'paid')
  .order('invoice_date', { ascending: false });
```

**Modal `AddToInvoiceModal`:**
- Props: `open`, `onOpenChange`, `requestIds`, `onSuccess`
- Validaciones:
  - Verifica que todos los requests sean del mismo cliente
  - Calcula `SUM(sale_amount)` de los requests
  - Compara con el `subtotal` de la factura seleccionada (tolerancia 0.01€)
- Mutation:
  - `UPDATE financial_requests SET billed_invoice_id = <invoiceId> WHERE id IN (...)`
  - Invalidar queries: `financial_requests`, `invoices`

**Estructura del modal:**
```
┌─────────────────────────────────────────────────────────────┐
│  📄 Añadir Solicitudes a Factura                            │
├─────────────────────────────────────────────────────────────┤
│  Cliente: ASENDIA HQ                                        │
│                                                             │
│  ⚠️ 2 solicitudes ya están facturadas y serán omitidas      │
│                                                             │
│  Seleccionar factura:                                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 2026/14 - 03/02/2026 - 1.225,00 € (Pendiente)      ▼│    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Solicitudes a añadir (3):                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Código    │ Título              │ Importe de Venta  │    │
│  ├───────────┼─────────────────────┼───────────────────┤    │
│  │ REQ-001   │ Servicio consultoría│ 500,00 €         │    │
│  │ REQ-002   │ Desarrollo web      │ 625,00 €         │    │
│  │ REQ-003   │ Diseño gráfico      │ 100,00 €         │    │
│  └───────────┴─────────────────────┴───────────────────┘    │
│                                                             │
│  Total de ventas: 1.225,00 €                                │
│  Subtotal factura: 1.225,00 €                               │
│  ✓ Los importes coinciden                                   │
│                                                             │
│                          [Cancelar]  [Añadir 3 Solicitudes] │
└─────────────────────────────────────────────────────────────┘
```

**Indicador de coincidencia:**
- ✓ Verde si `|SUM(sale_amount) - subtotal| <= 0.01`
- ⚠️ Naranja si hay diferencia (con indicación del monto)
- El botón de confirmar se habilita aunque no coincida (para permitir asociaciones parciales o con ajustes)

---

### Flujo desde detalle de solicitud

En la sección "Estado de Facturación" del detalle:
- Si `billed_invoice_id = null` y `canAccessFinance()`:
  - Mostrar botón **"+ Factura"** junto al estado de factura
  - Al hacer clic, abre `AddToInvoiceModal` con solo ese request

---

### Orden de implementación

1. Crear hook `useAvailableInvoicesForRequests`
2. Crear componente `AddToInvoiceModal`
3. Integrar en `Solicitudes.tsx` (acciones en grupo)
4. Integrar en `SolicitudDetalle.tsx` (botón individual)

