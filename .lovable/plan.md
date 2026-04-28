# Validación de facturas con impuestos + subir facturas en cualquier estado

## Análisis del problema

He revisado todo el flujo de subida de facturas del especialista:

1. **El código ya compara correctamente por base imponible (`subtotal`)** — tanto en `LiquidationInvoicesList.tsx` (línea 32-36) como en `SpecialistInvoiceUpload.tsx` (`recomputeStatus`) y en el edge function `upload-specialist-invoice` (línea 324). En ningún sitio se compara contra `total_amount`.

2. **La causa real del descuadre** está en la **extracción de la IA** (`extract-specialist-invoice-data` y bloque equivalente en `upload-specialist-invoice`). El prompt actual pide `subtotal`, `tax_amount`, `irpf_amount` y `total_amount`, pero:
   - No fuerza a la IA a verificar la coherencia (`subtotal + IVA - IRPF = total`).
   - Cuando hay IVA + IRPF, Gemini a veces confunde el "total a pagar" (líquido) con el subtotal, o devuelve la "base + IVA" como subtotal.
   - No hay fallback de cálculo: si la IA solo extrae bien el total y los porcentajes, no recalculamos la base.

3. **La restricción de estado** está en `SpecialistInvoiceUpload.tsx` línea 56: `const canUpload = !['paid'].includes(currentStatus);`. Hay que quitarla para que admin/finanzas puedan subir incluso en liquidaciones pagadas.

## Cambios a realizar

### 1. Mejorar la extracción AI para obtener siempre la base imponible correcta

**Archivos**: `supabase/functions/extract-specialist-invoice-data/index.ts` y bloque equivalente en `supabase/functions/upload-specialist-invoice/index.ts`.

- Reforzar el prompt con ejemplos explícitos para facturas con IVA 21% e IRPF 7%/15%, dejando claro que `subtotal` = **base imponible** (importe de servicios sin IVA y sin restar IRPF), no el "total a pagar".
- Pedir también `total_with_tax` (subtotal + IVA, antes de IRPF) para tener un campo extra de verificación.
- Añadir lógica de **post-procesado de coherencia** tras parsear el JSON:
  - Si `subtotal`, `tax_amount`, `irpf_amount` y `total_amount` no cumplen `|subtotal + tax_amount - (irpf_amount || 0) - total_amount| <= 1`, intentar reconstruir:
    - Si tenemos `total_amount` + `tax_rate` + `irpf_rate`: `subtotal = total_amount / (1 + tax_rate/100 - irpf_rate/100)`.
    - Si tenemos `tax_amount` + `tax_rate`: `subtotal = tax_amount / (tax_rate/100)`.
  - Loguear claramente la corrección aplicada para depuración.

### 2. Mostrar IVA e IRPF en la lista de facturas para diagnóstico visual

**Archivo**: `src/components/liquidations/LiquidationInvoicesList.tsx`.

- Ampliar `LiquidationInvoiceRow` para incluir `tax_amount` e `irpf_amount` (ya existen en la tabla `liquidation_invoices`).
- En cada fila, mostrar bajo el número de factura: `Base X € · IVA Y € · IRPF Z € · Total T €` para que se vea claramente qué extrajo la IA y por qué cuadra o no cuadra.
- El bloque verde/naranja de validación sigue comparando **suma de bases vs subtotal de liquidación** (sin tocar — ya es lo correcto).

### 3. Cargar también `tax_amount` e `irpf_amount` en el SELECT

**Archivos**: `src/components/liquidations/SpecialistInvoiceUpload.tsx` (función `loadInvoices` y SELECT tras insert) y, por consistencia, el SELECT en `upload-specialist-invoice/index.ts` línea 319.

### 4. Permitir subir facturas en cualquier estado de liquidación

**Archivo**: `src/components/liquidations/SpecialistInvoiceUpload.tsx` línea 56.

- Cambiar `const canUpload = !['paid'].includes(currentStatus);` por `const canUpload = true;`.
- En `recomputeStatus`, cuando `currentStatus === 'paid'` no recalcular el estado (mantener pagada). Solo actualizar `specialist_invoice_url` con la última factura.
- El edge function `upload-specialist-invoice` (subida pública vía firma) se queda como está — ese flujo es solo para el especialista, no para admin/finanzas en una liquidación ya pagada.

## Resumen del comportamiento tras los cambios

- Las facturas con IVA/IRPF se extraen siempre con la base imponible correcta y, si la IA falla, se reconstruye matemáticamente.
- El usuario ve en la UI los importes desglosados (Base / IVA / IRPF / Total) para auditar visualmente.
- La validación verde/naranja sigue siendo `Σ bases imponibles == subtotal liquidación` (±1 €).
- Admin/finanzas pueden añadir o eliminar facturas en cualquier estado, incluida `paid`, sin que el sistema cambie el estado de la liquidación.
