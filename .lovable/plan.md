

## Fix: Datos de comisión repetidos en liquidación (UI y PDF)

### Problema

En `GroupedLiquidationItemsTable.tsx` (línea 77) y `liquidationPDFGenerator.ts` (línea 559), al buscar el detalle de comisión para cada ítem se usa `.find()` filtrando **solo por tipo** (`Comisión AM`). Como todas las comisiones de Iolanda son tipo AM, siempre devuelve la primera coincidencia (base 1540€) para todos los ítems.

Este problema ya se resolvió en `liquidation-grouping.ts` con el patrón de "pool consumido", pero no se aplicó en estos dos puntos de renderizado.

### Solución

Cambiar la lógica de matching en ambos archivos para que coincida **por tipo + importe + factura** (extraída de la descripción del ítem), en lugar de solo por tipo.

Dado que la descripción del ítem ya contiene la factura específica (ej. `Comisión AM (10%) — Factura Nº 2026/10`), se puede extraer el código de factura de la descripción y cruzar con `detail.invoiceCodes`.

#### 1. `src/components/liquidations/GroupedLiquidationItemsTable.tsx` (líneas 77-80)

Cambiar el `.find()` para que además del tipo, verifique que el código de factura extraído de la descripción coincida con alguno de los `invoiceCodes` del detalle, y/o que el importe coincida. Esto garantiza matching 1:1.

#### 2. `src/utils/pdf/liquidationPDFGenerator.ts` (líneas 559-562)

Mismo cambio: usar el código de factura de la descripción del ítem para hacer match preciso con el detalle de comisión correcto.

### Detalle técnico

Patrón de matching propuesto:
```
// Extraer factura de la descripción: "Comisión AM (10%) — Factura Nº 2026/10"
const invoiceMatch = item.description?.match(/Factura Nº\s+(.+)/);
const invoiceCode = invoiceMatch?.[1]?.trim();

// Match por tipo + factura
const detail = Object.values(commissionDetails).find(d => {
  const typeLabel = d.type === 'am' ? 'AM' : d.type === 'pm' ? 'PM' : 'Venta';
  if (!item.description?.includes(`Comisión ${typeLabel}`)) return false;
  if (invoiceCode && d.invoiceCodes.length) {
    return d.invoiceCodes.includes(invoiceCode);
  }
  return Math.abs(d.percentage * d.baseAmount / 100 - Number(item.total)) < 0.02;
});
```

### Archivos a modificar

- `src/components/liquidations/GroupedLiquidationItemsTable.tsx` — matching preciso en UI
- `src/utils/pdf/liquidationPDFGenerator.ts` — matching preciso en PDF

