

## Flujo de factura de especialista → pendiente de pago

### Problema

Cuando un especialista sube su factura y el importe coincide, el estado cambia a `invoice_received` pero no avanza a `pending_payment`. El botón "Marcar como Pagada" ya existe en el detalle de liquidación.

### Cambios

1. **`src/components/liquidations/SpecialistInvoiceUpload.tsx`** (líneas 133-136)
   - Cuando el importe coincide (±1€) y el estado es early (`draft`, `validated`, `sent`, `accepted`): cambiar estado a `pending_payment` en vez de `invoice_received`
   - Cuando el importe NO coincide: mantener `invoice_received` (requiere revisión manual)

2. **`src/components/liquidations/SpecialistInvoiceImportModal.tsx`** (líneas 271-285)
   - Misma lógica: si importes coinciden → `pending_payment`; si no coinciden → `invoice_received`

3. **`supabase/functions/upload-specialist-invoice/index.ts`** (si aplica la misma lógica en la subida pública)
   - Verificar si la Edge Function también actualiza el estado y aplicar la misma regla

### Resultado

- Factura subida con importe correcto → estado `pending_payment` → el financiero ve el botón "Marcar como Pagada" y hace clic cuando ejecuta la transferencia
- Factura subida con importe incorrecto → estado `invoice_received` → requiere revisión antes de pasar a pendiente de pago

