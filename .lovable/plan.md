

# Plan: Permitir que Especialistas Suban su Factura con Verificación Digital

## Resumen

Implementar la funcionalidad para que los especialistas puedan subir su propia factura desde la página de firma de liquidación (`/firma/:token`), con verificación digital de importes usando IA y registro de evidencia (IP, fecha/hora).

## Análisis de Permisos Actuales

### Lo que el especialista puede hacer ahora:
- ✅ Ver sus liquidaciones (RLS permite SELECT)
- ✅ Firmar/disputar liquidación (vía Edge Function con service role)
- ❌ Actualizar datos de liquidación (RLS bloquea UPDATE)
- ❌ Subir archivos al bucket `liquidation-invoices` (storage policies bloquean)

### Lo que necesitamos añadir:
- ✅ Subir factura vía Edge Function segura (similar a `process-signature`)
- ✅ Verificación automática de importes con IA
- ✅ Registro de evidencia digital (IP, fecha, hash)

---

## Opción Recomendada: Edge Function Segura

En lugar de modificar RLS y storage policies (lo que podría abrir brechas de seguridad), usaremos una **Edge Function con service role** que:

1. Valida el token de firma (igual que `process-signature`)
2. Verifica que la liquidación está en estado válido
3. Extrae datos de la factura con IA
4. Compara importes automáticamente
5. Sube el archivo al storage
6. Actualiza la liquidación con la URL
7. Registra evidencia digital

---

## Cambios a Implementar

### 1. Nueva Edge Function: `upload-specialist-invoice`

```
supabase/functions/upload-specialist-invoice/index.ts
```

**Funcionalidad:**
- Recibe: `token`, `pdf_base64`
- Valida token de firma (no expirado, pendiente)
- Extrae datos con IA (`extract-specialist-invoice-data`)
- Compara subtotal de factura vs liquidación
- Sube PDF al storage usando service role
- Actualiza `liquidations.specialist_invoice_url`
- Registra evidencia: IP, fecha, resultado de verificación
- Retorna: resultado de verificación + URL

### 2. Nueva columna en `liquidation_signatures` (opcional)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `invoice_uploaded_at` | timestamptz | Fecha de subida de factura |
| `invoice_verification` | jsonb | Resultado de verificación IA |

### 3. Actualizar página `FirmaLiquidacion.tsx`

Añadir sección para subir factura ANTES de firmar:

```
┌────────────────────────────────────────────┐
│        Firma Digital de Liquidación        │
├────────────────────────────────────────────┤
│                                            │
│  📄 Resumen de liquidación                 │
│  ─────────────────────────────             │
│  Código: LIQ-2026-009                      │
│  Total: €512.00                            │
│                                            │
├────────────────────────────────────────────┤
│                                            │
│  📎 Tu Factura (Opcional)                  │
│  ─────────────────────────                 │
│  [Arrastra tu factura PDF o haz clic]      │
│                                            │
│  ✓ Verificación automática de importes    │
│  ✓ Base imponible coincide: €512          │
│                                            │
├────────────────────────────────────────────┤
│                                            │
│  Tu Decisión                               │
│  ─────────────────────────                 │
│  [✓ Aceptar]     [✗ Disputar]              │
│                                            │
└────────────────────────────────────────────┘
```

### 4. Actualizar `LiquidacionDetalle.tsx`

Mostrar el componente `SpecialistInvoiceUpload` también para especialistas (además de admin/finanzas):

```typescript
// Antes
{canAccessFinance() && (
  <SpecialistInvoiceUpload ... />
)}

// Después  
{(canAccessFinance() || isSpecialistOwner) && (
  <SpecialistInvoiceUpload ... />
)}
```

**Nota:** El especialista solo podrá ver y subir desde su propia liquidación.

---

## Flujo de Usuario

### Escenario: Daniela recibe email de liquidación

1. **Email recibido** → Clic en "Ver y Firmar Liquidación"
2. **Página de firma** → Ve resumen de trabajos y total
3. **Subir factura** → Arrastra PDF, IA verifica importes
4. **Verificación** → ✅ Importes coinciden (o ⚠️ discrepancia)
5. **Firmar** → Clic en "Aceptar" o "Disputar"
6. **Confirmación** → Evidencia digital guardada

### Registro de Evidencia

```json
{
  "uploaded_at": "2026-01-28T15:30:00Z",
  "ip_address": "83.45.123.xxx",
  "user_agent": "Mozilla/5.0...",
  "invoice_verification": {
    "subtotal_invoice": 512.00,
    "subtotal_liquidation": 512.00,
    "match": true,
    "tolerance_applied": "±1€"
  }
}
```

---

## Archivos a Crear/Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `supabase/functions/upload-specialist-invoice/index.ts` | Crear | Edge Function para subida segura |
| `supabase/config.toml` | Modificar | Añadir nueva función |
| `src/pages/FirmaLiquidacion.tsx` | Modificar | Añadir sección de subida de factura |
| `src/components/liquidations/SpecialistInvoiceUploadPublic.tsx` | Crear | Componente de subida para página pública |

---

## Seguridad

- ✅ **Sin cambios en RLS**: Todo via Edge Function con service role
- ✅ **Validación de token**: Solo puede subir quien tenga enlace válido
- ✅ **Sin exposición de datos**: El especialista solo ve SU liquidación
- ✅ **Evidencia digital**: IP y timestamp registrados
- ✅ **Verificación IA**: Comprobación automática de importes

---

## Detalle Técnico: Edge Function

```typescript
// Estructura de upload-specialist-invoice
Deno.serve(async (req) => {
  // 1. Obtener token y PDF
  const { token, pdf_base64 } = await req.json();
  
  // 2. Validar token (igual que validate-signature-token)
  const signature = await validateToken(token);
  if (!signature) return error('Token inválido');
  
  // 3. Verificar estado de firma (debe ser 'pending')
  if (signature.status !== 'pending') 
    return error('Ya no se puede subir factura');
  
  // 4. Extraer datos con IA
  const extractedData = await extractInvoiceData(pdf_base64);
  
  // 5. Comparar importes
  const amountsMatch = Math.abs(
    extractedData.subtotal - signature.liquidation.subtotal
  ) <= 1;
  
  // 6. Subir al storage (usando service role)
  const url = await uploadToStorage(liquidationId, pdf_base64);
  
  // 7. Actualizar liquidación
  await supabase.from('liquidations').update({
    specialist_invoice_url: url
  }).eq('id', liquidationId);
  
  // 8. Registrar evidencia en signature
  await supabase.from('liquidation_signatures').update({
    invoice_uploaded_at: new Date().toISOString(),
    invoice_verification: {
      ...extractedData,
      match: amountsMatch,
      ip_address: req.headers.get('x-forwarded-for')
    }
  }).eq('id', signature.id);
  
  // 9. Retornar resultado
  return success({
    amountsMatch,
    invoiceSubtotal: extractedData.subtotal,
    liquidationSubtotal: signature.liquidation.subtotal
  });
});
```

