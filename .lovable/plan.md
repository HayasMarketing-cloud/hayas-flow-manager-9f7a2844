

## Corregir billing_period en importación de facturas de clientes

### Problema identificado

Las facturas importadas por PDF no guardan el `billing_period_month/year` correctamente:

1. **El selector de período solo aparece si se asocia un contrato** — si se asocia un presupuesto o no se asocia nada, no hay opción de indicar el período de facturación.
2. **El valor por defecto no se guarda** — en el UI, `billingMonth` muestra el mes actual como default, pero al guardar se usa `invoice.editedBillingMonth ?? null`, así que si el usuario no toca el selector, se guarda `null`.
3. **La IA no extrae el período de facturación** — el prompt de extracción no pide el "billing period" (mes de trabajo facturado).

Resultado: las 12 facturas emitidas el 1 de abril para el trabajo de marzo tienen `billing_period = NULL` y no aparecen en el Dashboard de marzo en modo devengado.

### Solución en 3 partes

**1. Auto-derivar el billing period desde la fecha de emisión**

En `ExtractedInvoiceRow.tsx`, calcular automáticamente el billing period como el **mes anterior** a la fecha de emisión (regla de negocio: trabajo del Mes N se factura el 1 del Mes N+1). Este valor se pre-poblará pero será editable.

```text
invoice_date = 2026-04-01 → billing_period = Marzo 2026
invoice_date = 2026-03-02 → billing_period = Febrero 2026
```

**2. Mostrar el selector de período siempre (no solo con contrato)**

Mover el selector de mes/año de facturación fuera del bloque `{contractId && (...)}` para que esté visible siempre, independientemente de si la factura se asocia a contrato, presupuesto o nada.

**3. Garantizar que el valor por defecto se guarde**

En `InvoiceUploadModal.tsx`, cambiar el fallback de `null` al mismo cálculo del mes anterior:
```typescript
const billingMonth = invoice.editedBillingMonth ?? derivedBillingMonth;
const billingYear = invoice.editedBillingYear ?? derivedBillingYear;
```

### Datos históricos

Además, corregir las 12 facturas de abril ya importadas con una migración de datos:
- Facturas con `invoice_date = 2026-04-01` y `billing_period_month IS NULL` → asignar `billing_period_month = 3, billing_period_year = 2026`

### Archivos a modificar

1. **`src/components/invoices/ExtractedInvoiceRow.tsx`** — Calcular billing period automático desde invoice_date; mostrar selector siempre
2. **`src/components/invoices/InvoiceUploadModal.tsx`** — Usar billing period derivado como fallback en lugar de null
3. **Migración de datos** — UPDATE facturas existentes con billing_period null

