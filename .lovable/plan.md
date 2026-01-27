

## Plan: Añadir fecha de factura e IRPF a la extracción de datos de factura de especialista

### Cambios sobre el plan original

Se añaden dos campos adicionales a la extracción con IA:

| Campo | Descripción | Tipo |
|-------|-------------|------|
| `invoice_date` | Fecha de emisión de la factura | `string` (YYYY-MM-DD) |
| `irpf_rate` | Porcentaje de retención IRPF | `number` (ej: 15) |
| `irpf_amount` | Importe de la retención IRPF | `number` |

---

### Estructura de datos actualizada

```typescript
interface ExtractedSpecialistInvoice {
  invoice_number: string;
  invoice_date: string | null;        // NUEVO: Fecha de emisión
  period_month: number | null;
  period_year: number | null;
  subtotal: number;
  tax_rate: number;                   // IVA %
  tax_amount: number;                 // Importe IVA
  irpf_rate: number | null;           // NUEVO: Retención IRPF %
  irpf_amount: number | null;         // NUEVO: Importe retención
  total_amount: number;               // Total = subtotal + IVA - IRPF
  specialist_name: string | null;
}
```

---

### Prompt actualizado para Gemini

```text
Analiza esta factura de un profesional/freelance y extrae:

{
  "invoice_number": "número de factura del profesional",
  "invoice_date": "fecha de emisión en formato YYYY-MM-DD",
  "period_month": mes del período facturado (1-12) o null,
  "period_year": año del período facturado o null,
  "subtotal": importe base sin impuestos (número),
  "tax_rate": porcentaje de IVA aplicado (número, ej: 21),
  "tax_amount": importe del IVA (número),
  "irpf_rate": porcentaje de retención IRPF si existe (número, ej: 15) o null,
  "irpf_amount": importe de la retención IRPF (número) o null,
  "total_amount": importe total a pagar (base + IVA - IRPF),
  "specialist_name": nombre del emisor de la factura
}

IMPORTANTE:
- Esta es una factura emitida POR un profesional/freelance
- El IRPF es una retención que SE RESTA del total (común en España: 7%, 15%)
- La fórmula es: total = subtotal + IVA - IRPF
- Si no hay IRPF, usa null para irpf_rate e irpf_amount
- Los importes deben ser números, no strings
```

---

### Impacto en el modal de importación

El modal `SpecialistInvoiceImportModal` mostrará en la fase de revisión:

```text
┌─────────────────────────────────────────────┐
│ Datos extraídos de la factura               │
├─────────────────────────────────────────────┤
│ Nº Factura:    FA-2026-001                  │
│ Fecha:         15/01/2026          <- NUEVO │
│ Período:       Enero 2026                   │
│ ────────────────────────────────────────    │
│ Base imponible:           1.500,00 €        │
│ IVA (21%):                  315,00 €        │
│ IRPF (-15%):               -225,00 €  NUEVO │
│ ────────────────────────────────────────    │
│ TOTAL:                    1.590,00 €        │
└─────────────────────────────────────────────┘
```

---

### Archivos a crear/modificar (actualizado)

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `supabase/functions/extract-specialist-invoice-data/index.ts` | **Crear** | Edge function con extracción de fecha e IRPF |
| `supabase/config.toml` | **Modificar** | Añadir configuración de la nueva función |
| `src/components/liquidations/SpecialistInvoiceImportModal.tsx` | **Crear** | Modal que muestra fecha e IRPF en revisión |
| `src/pages/Liquidaciones.tsx` | **Modificar** | Añadir botón "Importar Factura Especialista" |
| `src/pages/LiquidacionDetalle.tsx` | **Modificar** | Añadir botón alternativo con IA |

---

### Nota sobre almacenamiento

Los campos `irpf_rate`, `irpf_amount` y `invoice_date` se usarán para:
1. **Validación visual**: Confirmar que los datos extraídos son correctos
2. **Matching mejorado**: Comparar el total considerando IRPF
3. **Registro futuro**: Si se decide almacenar estos datos en la tabla `liquidations`, se podría añadir una migración (opcional, no incluido en este plan inicial)

Por ahora, estos datos se usan solo para la validación en el modal, no se persisten en la base de datos.

