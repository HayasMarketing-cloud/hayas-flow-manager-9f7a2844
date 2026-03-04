

## Plan: Optimizar flujo de firma y subida de factura del especialista

### Problema actual
La sección de subida de factura se muestra **antes** de que el especialista acepte la liquidación (líneas 355-364 de `FirmaLiquidacion.tsx`). Además, en el email se menciona "subir tu factura al final del detalle" lo cual es confuso porque el especialista no tiene acceso al detalle interno de la app.

### Solución propuesta

**Flujo optimizado en 2 pasos:**

1. El especialista ve la liquidación y elige Aceptar o Disputar
2. **Solo tras aceptar**, se muestra la sección de subida de factura en la pantalla de confirmación (la que ya muestra "Liquidación Aceptada")

### Cambios

**`src/pages/FirmaLiquidacion.tsx`**
- Eliminar el componente `SpecialistInvoiceUploadPublic` de la vista principal (antes de la decisión, líneas 355-364)
- Añadirlo en la pantalla de "ya procesado" (`isAlreadyProcessed || processMutation.isSuccess`) solo cuando `status === 'accepted'`, debajo de la evidencia digital
- Pasar `liquidationSubtotal` y `token` como ya se hace

**`supabase/functions/send-liquidation-email/index.ts`**
- Eliminar el párrafo de "Nota: puedes subir tu factura..." (líneas 319-323) del HTML del email, ya que ahora la subida se ofrece tras aceptar, no antes

**`src/components/liquidations/EmailPreviewModal.tsx`**
- Eliminar la sección de "Nota sobre subida de factura" (líneas 152-159) del preview del email para que coincida con el email real

### Archivos afectados
- `src/pages/FirmaLiquidacion.tsx` (mover componente de upload a la vista post-aceptación)
- `supabase/functions/send-liquidation-email/index.ts` (eliminar párrafo de factura del email)
- `src/components/liquidations/EmailPreviewModal.tsx` (eliminar sección de factura del preview)

