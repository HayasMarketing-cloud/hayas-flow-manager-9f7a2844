

## Mejorar descripción de comisiones en detalle de liquidación

### Problema
En la sección de comisiones disponibles del detalle de liquidación, el texto muestra "Comisión AM - Sin origen" o solo el título del presupuesto/contrato. El usuario quiere ver el concepto completo, por ejemplo: **"10% sobre Factura Nº 2026/14"**.

Además, cuando se insertan como ítems de liquidación, la descripción tampoco incluye este formato.

### Cambios en `src/pages/LiquidacionDetalle.tsx`

**1. Listado de comisiones disponibles (línea 1226 y 1241-1243)**

Cambiar la lógica de `sourceName` para incluir los códigos de factura (ya disponibles via `_invoice_codes`) y reformatear la visualización:

- Línea principal: `Comisión AM — 10% sobre Factura Nº 2026/14`
- Si hay múltiples facturas: `10% sobre Facturas 2026/14, 2026/15`
- Si es presupuesto/contrato: `10% sobre PRE-2026-001 - Título`

**2. Descripción al insertar como ítem de liquidación (líneas 596-601)**

Misma lógica: generar `Comisión AM (10%) — Factura Nº 2026/14` en vez de `Comisión AM - Sin origen`.

**3. Arreglar fallback "Sin origen" en línea 1226**

Actualmente no usa `_invoice_codes` como sí lo hace la mutación (línea 598-600). Añadir el mismo fallback a invoice codes.

### Formato final esperado

En el listado:
- Título: `Comisión AM — Factura Nº 2026/14` (o `Facturas 2026/14, 2026/15`)
- Subtítulo: `10% sobre 1.225,00 €`

Al insertar como ítem:
- Descripción: `Comisión AM (10%) — Factura Nº 2026/14`

### Archivo afectado
- `src/pages/LiquidacionDetalle.tsx`

