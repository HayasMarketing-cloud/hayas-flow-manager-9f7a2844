

## Cambio en alta de comisiones: flujo basado en factura

### Resumen

Simplificar el formulario de nueva comisión para que **siempre** parta de una factura emitida. El flujo será:

1. **Tipo de comisión** (AM/PM/Venta)
2. **Cliente**
3. **Beneficiario**
4. **Factura(s)** del cliente seleccionado
5. Auto-carga de presupuesto/contrato asociado a la factura (si existe)
6. Cálculo automático de comisión sobre el subtotal de la(s) factura(s)

### Viabilidad

Es totalmente viable. La tabla `invoices` ya tiene campos `budget_id` y `contract_id`, y también existe `invoice_budget_allocations` para relaciones N:M. Al seleccionar una factura podemos derivar automáticamente el presupuesto y/o contrato vinculado.

No hay problemas de compatibilidad: el campo `invoice_ids` en `sales_commissions` ya almacena las facturas asociadas, y `budget_id`/`contract_id` seguirán siendo opcionales (se rellenan si la factura los tiene).

### Cambios en `CommissionFormModal.tsx`

| Aspecto | Antes | Después |
|---------|-------|---------|
| Selector "Origen" | Dropdown con 3 opciones (Presupuesto/Contrato/Factura) | **Se elimina**. Siempre es factura |
| Selector Presupuesto/Contrato | Manual, obligatorio según origen | **Automático y read-only**, derivado de la factura seleccionada |
| Selector Facturas | Solo visible con origen "Factura" o después de elegir presupuesto | **Siempre visible** después de seleccionar cliente |
| `base_amount` | Manual o calculado según origen | Siempre calculado del subtotal de facturas seleccionadas |

### Detalle técnico

1. **Eliminar campo `source_type`** del formulario de creación (mantenerlo internamente para edit/view de comisiones antiguas)
2. **Query de facturas**: Tras seleccionar cliente, cargar todas las facturas del cliente (ya existe esta query)
3. **Auto-derivar presupuesto/contrato**: Al seleccionar factura(s), consultar `invoice_budget_allocations` para obtener `budget_id`, y usar `invoices.contract_id` para obtener el contrato. Mostrar esta info como resumen read-only
4. **Payload al guardar**: Seguir guardando `budget_id`, `contract_id` e `invoice_ids` en `sales_commissions` como hasta ahora
5. **Validación**: Requerir al menos una factura seleccionada (en lugar de requerir presupuesto o contrato)
6. **Modo edit/view**: Sin cambios funcionales, sigue mostrando los datos almacenados

### Flujo visual simplificado

```text
Tipo comisión  |  Cliente
─────────────────────────
Beneficiario
─────────────────────────
Facturas del cliente (checkbox list)
  ☑ FAC-2026-001  (5 ene 2026)  1.200,00€
  ☐ FAC-2026-005  (12 feb 2026)   800,00€
─────────────────────────
Origen derivado: PRES-2026-012 — Campaña Q1  (read-only)
─────────────────────────
Cálculo de comisión
  Base: 1.200,00€  |  %: 5  |  Comisión: 60,00€
```

