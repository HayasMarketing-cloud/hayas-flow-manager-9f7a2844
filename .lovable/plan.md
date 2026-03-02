

## Plan: Enriquecer comisiones en PDF + Eliminar anexo

### Cambios en `src/utils/pdf/liquidationPDFGenerator.ts`

**1. Eliminar sección ANEXO de trabajos pendientes**
- Eliminar bloques de anexo en `generateLiquidationPDF` (líneas 267-329) y `generateLiquidationPDFBase64` (líneas 559-621).
- Eliminar interfaz `PendingRequest`, propiedad `pendingRequests` de `LiquidationData`, y función `getProjectOrBudgetName`.

**2. Añadir soporte para `commissionDetails` en `LiquidationData`**
- Añadir propiedad opcional `commissionDetails` al tipo `LiquidationData` (mismo tipo que en `GroupedLiquidationItemsTable`).

**3. Enriquecer descripciones de comisiones en `buildHierarchicalTableData`**
- Recibir `commissionDetails` como parámetro.
- Cuando un item no tiene `financial_request` y su descripción empieza con "Comisión", buscar en `commissionDetails` el detalle correspondiente.
- Añadir una segunda línea debajo con: `{porcentaje}% sobre {importeBase} — Factura Nº {código}`.

### Cambios en `src/pages/LiquidacionDetalle.tsx`

**4. Pasar `commissionDetails` al generar PDF**
- En `handleDownloadPDF` y `handleSendEmail`, pasar la prop `commissionDetails` (ya disponible en la query `linked-commission-details`) a las funciones `generateLiquidationPDF` y `generateLiquidationPDFBase64`.
- Eliminar la query de `pendingRequests` de ambas funciones ya que el anexo se elimina.

### Archivos afectados
- `src/utils/pdf/liquidationPDFGenerator.ts`
- `src/pages/LiquidacionDetalle.tsx`

