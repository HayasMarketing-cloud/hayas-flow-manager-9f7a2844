

## Fix: Descripción de comisión repetida ("10% sobre 1540") en todos los ítems

### Diagnóstico

He verificado los datos en BD — cada comisión tiene un `base_amount` distinto (280, 560, 700, 1410, 1540). El problema está en que el matching con `.find()` sobre `Object.values(commissionDetails)` es frágil: depende del orden de iteración del objeto y cuando la verificación por factura falla por algún motivo sutil, siempre devuelve el mismo primer resultado.

Además, **`FirmaLiquidacion.tsx` (línea 344-347) NUNCA fue actualizado** — sigue usando matching solo por tipo (`Comisión AM`), sin verificar factura ni importe.

### Solución: Map pre-indexado por código de factura

En lugar de `.find()` iterativo, construir un `Map<invoiceCode, CommissionDetail>` antes de renderizar, y hacer lookup directo O(1):

```typescript
// Construir mapa una sola vez
const commissionByInvoice = new Map<string, CommissionDetail>();
if (commissionDetails) {
  for (const d of Object.values(commissionDetails)) {
    for (const code of d.invoiceCodes) {
      commissionByInvoice.set(code, d);
    }
  }
}

// Lookup directo por factura extraída de la descripción
const invoiceCode = item.description?.match(/Factura Nº\s+(.+)/)?.[1]?.trim();
const detail = invoiceCode ? commissionByInvoice.get(invoiceCode) : undefined;
```

### Archivos a modificar (3)

1. **`src/components/liquidations/GroupedLiquidationItemsTable.tsx`** — Reemplazar `.find()` con map pre-indexado en `useMemo`
2. **`src/utils/pdf/liquidationPDFGenerator.ts`** — Mismo patrón de map pre-indexado
3. **`src/pages/FirmaLiquidacion.tsx`** (líneas 344-347) — Actualizar matching que solo filtra por tipo, aplicar mismo patrón de map

