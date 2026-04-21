

## Permitir múltiples facturas por liquidación (incluyendo histórico)

### Objetivo
Habilitar la subida de N facturas por liquidación, **funcionando también para liquidaciones ya creadas y firmadas, y para casos donde ya hay una factura subida** (como la de Santiago Riggio de marzo). La factura existente se conservará como la primera del listado y se podrán añadir más sin perder nada.

### Flujo para liquidaciones existentes (caso Santiago Riggio marzo)
1. Migración hace **backfill**: por cada `liquidations` con `specialist_invoice_url IS NOT NULL`, inserta automáticamente una fila en la nueva tabla `liquidation_invoices` con esa URL y los datos de extracción IA guardados en `liquidation_signatures.invoice_verification`.
2. Al abrir esa liquidación (admin o especialista vía link de firma), aparece la factura ya subida como primer item de la lista.
3. Botón "Añadir otra factura" disponible **independientemente del estado** de la liquidación (excepto `paid` y `draft`), incluyendo `accepted`, `invoice_received` y `pending_payment`.
4. Subir una segunda factura recalcula el sumatorio y, si destapa diferencia con el subtotal, baja el estado de `pending_payment` a `invoice_received` hasta cuadrar.

### Modelo de datos
Nueva tabla `liquidation_invoices`:
```text
id, liquidation_id (FK cascade), file_url, file_name, storage_path,
invoice_number, invoice_date, subtotal, tax_amount, irpf_amount,
total_amount, ai_extracted (jsonb), uploaded_by, uploaded_at
```
RLS: idéntica a `liquidations` (admin/finanzas todo; especialista dueño y team leader leen e insertan los suyos; vista pública vía Edge Function con token).

Storage: rutas únicas `${liquidationId}/${invoiceId}-${slug(name)}.pdf` para no pisar archivos.

`liquidations.specialist_invoice_url` se mantiene apuntando a la última factura subida (compatibilidad con Keepango, PDFs y exports).

### Migración / Backfill
SQL único:
- Crear tabla `liquidation_invoices` + RLS.
- `INSERT INTO liquidation_invoices` por cada liquidación con `specialist_invoice_url` no nulo, copiando URL, derivando `file_name`/`storage_path` desde la URL, y rellenando datos económicos desde `liquidation_signatures.invoice_verification` cuando existan.
- No se borra nada del modelo antiguo.

### UI

**Admin (`SpecialistInvoiceUpload` + detalle liquidación):**
- Lista con todas las facturas (la histórica aparece como primera).
- Cada fila: nombre, importe, fecha, ver, eliminar.
- Botón "Añadir factura" siempre visible salvo `paid`/`draft`.
- Pie con resumen: suma de bases vs subtotal, badge verde (±1€) o naranja.

**Especialista (`SpecialistInvoiceUploadPublic` con token):**
- Misma lista + botón "Añadir otra factura".
- Mensaje: "Si tu importe se factura desde varias entidades, puedes añadir varias facturas. La suma de las bases imponibles debe igualar el importe de la liquidación."

**Página `EspecialistaDetalle`:**
- Sustituir enlace único `specialist_invoice_url` por listado de facturas por liquidación.

### Backend

- **`upload-specialist-invoice`**: cambia a `INSERT` en `liquidation_invoices` (no UPDATE en `liquidations`). Tras insertar, recalcula sumatorio y ajusta estado:
  - Si `|suma - subtotal| ≤ 1€` → `pending_payment`
  - Si difiere y antes estaba `pending_payment` → vuelve a `invoice_received`
  - Sigue actualizando `specialist_invoice_url` con la última URL para compatibilidad.
- **`get-liquidation-items`**: añade array `invoices` al payload para la vista del especialista.
- **Notificación** admin/finanzas: incluye contador "Factura N · suma X€ / subtotal Y€".
- Eliminar factura: borra archivo de Storage y reevalúa estado.

### Plan de prueba con Santiago Riggio (marzo)
1. Tras la migración, abrir su liquidación de marzo desde admin → debe verse la factura ya subida como primer item del listado.
2. Como admin, pulsar "Añadir factura" y subir un PDF de prueba → aparece como segundo item, recalcula suma.
3. Si la suma cuadra, estado se mantiene `pending_payment`/`accepted`; si no, baja a `invoice_received`.
4. Generar el link de firma público y validar que el especialista ve ambas facturas y puede añadir más.
5. Probar borrar la factura nueva → vuelve al estado anterior, queda solo la histórica.

### Archivos afectados
- Migración SQL nueva (tabla + RLS + backfill).
- `src/components/liquidations/SpecialistInvoiceUpload.tsx` — refactor a lista.
- `src/components/liquidations/SpecialistInvoiceUploadPublic.tsx` — refactor a lista.
- `src/pages/LiquidacionDetalle.tsx` — pasar lista de facturas.
- `src/pages/FirmaLiquidacion.tsx` — pasar lista a vista pública.
- `src/pages/EspecialistaDetalle.tsx` — listar facturas por liquidación.
- `supabase/functions/upload-specialist-invoice/index.ts` — insertar fila + recálculo de estado.
- `supabase/functions/get-liquidation-items/index.ts` — incluir array de facturas.
- `src/lib/notification-utils.ts` — incluir contador y suma.
- `src/integrations/supabase/types.ts` — autogenerado.

### Consideraciones
- Tolerancia ±1€ aplicada al **sumatorio**, no a cada factura individual.
- Bucket `liquidation-invoices` ya es público.
- Compatibilidad total: nada se rompe en exports, PDFs ni Keepango porque `specialist_invoice_url` sigue rellenándose.
- Estados desde los que se permite añadir factura: `accepted`, `invoice_received`, `pending_payment`. Bloqueado en `draft` y `paid`.

