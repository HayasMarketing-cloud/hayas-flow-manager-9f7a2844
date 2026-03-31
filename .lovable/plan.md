

## Notificación y email cuando especialista sube factura

### Situación actual

- **No hay notificación ni email** cuando un especialista sube su factura.
- Hay **dos puntos de subida**:
  1. **Edge Function `upload-specialist-invoice`** — usado desde la página pública de firma (`FirmaLiquidacion.tsx` → `SpecialistInvoiceUploadPublic.tsx`). Este es el flujo principal del especialista.
  2. **Componente `SpecialistInvoiceUpload.tsx`** — usado desde el detalle de liquidación por usuarios internos (admin/finanzas).
- Los emails del sistema se envían via **Google Service Account + Gmail API** (no hay email transaccional Lovable configurado).
- Las notificaciones in-app se crean via `notification-utils.ts` con `notifyByRole()`.

### Plan

#### 1. Añadir notificación in-app + email en el Edge Function `upload-specialist-invoice`

Después del paso 8 (registro de evidencia digital, línea ~323), añadir:

- **Notificación in-app**: Insertar notificaciones para usuarios con roles `admin` y `finanzas` usando el service role client (ya disponible). Consultar `user_roles` para obtener user_ids, luego insertar en `notifications`.
- **Email**: Enviar email via Gmail API (mismo patrón que `process-request-action` y `send-liquidation-paid-notification`). Obtener emails de perfiles con roles admin/finanzas que tengan `@hayas.es`. Incluir en el email: código de liquidación, nombre del especialista, si los importes coinciden o no.

#### 2. Añadir notificación in-app en `SpecialistInvoiceUpload.tsx` (subida interna)

Después de la actualización exitosa de la liquidación (línea ~149), llamar a `notifyByRole(['admin', 'finanzas'], ...)` desde `notification-utils.ts` con datos de la liquidación.

#### 3. Crear helper en `notification-utils.ts`

Añadir `notifySpecialistInvoiceUploaded(liquidationCode, liquidationId, specialistName, amountsMatch)` que notifique a admin y finanzas.

### Archivos a modificar

- `supabase/functions/upload-specialist-invoice/index.ts` — notificaciones in-app + email Gmail API
- `src/lib/notification-utils.ts` — nuevo helper `notifySpecialistInvoiceUploaded`
- `src/components/liquidations/SpecialistInvoiceUpload.tsx` — llamar al helper tras subida exitosa

### Detalle del email

Asunto: `Factura recibida - {liquidationCode} - {specialistName}`

Contenido: código de liquidación, nombre especialista, estado de verificación de importes (coinciden / no coinciden), enlace al detalle de la liquidación.

