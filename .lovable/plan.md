

## Plan: Mostrar factura y porcentaje en comisiones (disponibles y asignadas)

### Problema
1. Las comisiones disponibles no muestran el número de factura porque la búsqueda de `_invoice_codes` solo se ejecuta cuando NO hay presupuesto ni contrato (`!comm.budget && !comm.contract`), pero las comisiones AM frecuentemente tienen ambos.
2. Las comisiones ya insertadas como ítems de liquidación muestran "Comisión AM - Sin origen" porque la descripción se guardó sin la información de factura.
3. En los ítems ya asignados no se muestra el porcentaje ni el importe base de la factura.

### Cambios

**Archivo: `src/pages/LiquidacionDetalle.tsx`**

**1. Query de comisiones disponibles (líneas 357-366)**
- Eliminar la condición `!comm.budget && !comm.contract` para que SIEMPRE se busquen los códigos de factura cuando exista `invoice_ids`, independientemente de presupuesto/contrato.

**2. Descripción al insertar comisiones (líneas 622-635)**
- Priorizar códigos de factura sobre presupuesto/contrato en el `originLabel`.
- Formato: `Comisión AM (10%) — Factura Nº 2026/14`

**3. Enriquecer ítems ya asignados**
- Crear una query adicional que busque en `sales_commissions` las comisiones vinculadas a esta liquidación (`liquidation_id = id`), incluyendo `invoice_ids`, `commission_percentage`, `base_amount` y `commission_type`.
- Para cada comisión encontrada, buscar los códigos de factura correspondientes.
- Pasar estos datos enriquecidos al componente `GroupedLiquidationItemsTable` como prop `commissionDetails`.

**Archivo: `src/components/liquidations/GroupedLiquidationItemsTable.tsx`**

**4. Mostrar info de comisión en ítems asignados**
- Recibir nueva prop `commissionDetails` (mapa de description-pattern → datos de comisión).
- En `renderItemRow`, si el item.description empieza con "Comisión", buscar el detalle correspondiente y mostrar debajo de la descripción: porcentaje, número de factura y total factura.
- Formato en la celda de descripción:
  - Línea 1: `Comisión AM — Factura Nº 2026/14`
  - Línea 2 (texto pequeño): `10% sobre 1.225,00 €`

### Archivos afectados
- `src/pages/LiquidacionDetalle.tsx`
- `src/components/liquidations/GroupedLiquidationItemsTable.tsx`

