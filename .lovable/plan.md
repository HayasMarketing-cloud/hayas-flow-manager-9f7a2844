

# Plan: Preparar Envío de Liquidación a Iolanda

## Problemas Detectados

| Problema | Estado | Impacto |
|----------|--------|---------|
| Botón email visible | ✅ OK | Formato table-based compatible |
| Especialista sin user_id | ⚠️ CRÍTICO | No verá liquidación como especialista |
| Mensaje subir factura | ❌ Falta | No está en el email actual |

---

## Cambio 1: Vincular Especialista a Usuario

El registro de especialista de Iolanda no tiene `user_id` asociado:

| Specialist Email | Specialist user_id | Auth User ID (correcto) |
|------------------|-------------------|-------------------------|
| iolanda@hayas.es | NULL ❌ | 907cc972-b957-47ac-916d-3b6701a92a2e |

**Migración SQL:**
```sql
UPDATE specialists 
SET user_id = '907cc972-b957-47ac-916d-3b6701a92a2e'
WHERE id = '99ed33b0-3c2e-424d-890e-18d366c82e16'
  AND email = 'iolanda@hayas.es';
```

Con esto, cuando Iolanda entre a la app con su usuario `iolanda@hayas.es`, podrá:
- Ver sus liquidaciones en la sección "Liquidaciones"
- La función RLS `is_specialist_liquidation()` funcionará correctamente

---

## Cambio 2: Añadir Mensaje Sobre Factura en Email

Modificar `supabase/functions/send-liquidation-email/index.ts` para añadir el mensaje sobre la subida de facturas.

**HTML actual (línea ~291):**
```html
<p>Por favor, revisa el documento adjunto y <strong>confirma o disputa</strong> 
la liquidación haciendo clic en uno de los botones de abajo:</p>
```

**HTML nuevo:**
```html
<p>Por favor, revisa el documento adjunto y <strong>confirma o disputa</strong> 
la liquidación haciendo clic en el botón de abajo.</p>

<p style="background-color: #f0fdf4; padding: 12px; border-radius: 8px; border-left: 4px solid #10b981; margin: 16px 0;">
  <strong>Nota:</strong> Si estás de acuerdo con la liquidación, puedes proceder a 
  <strong>subir tu factura directamente en la aplicación</strong>, al final del 
  detalle de tu liquidación.
</p>
```

También actualizar el `EmailPreviewModal.tsx` para que la vista previa refleje este mensaje.

---

## Cambio 3: Actualizar Vista Previa del Email

Modificar `src/components/liquidations/EmailPreviewModal.tsx` para incluir el mismo mensaje sobre la factura en la vista previa.

**Añadir después de línea 186:**
```tsx
<div className="bg-green-50 border-l-4 border-green-500 p-3 rounded my-4">
  <p className="text-sm">
    <strong>Nota:</strong> Si estás de acuerdo con la liquidación, puedes proceder a 
    <strong className="text-green-700"> subir tu factura directamente en la aplicación</strong>, 
    al final del detalle de tu liquidación.
  </p>
</div>
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `migrations/link_iolanda_specialist.sql` | Vincular specialist → user_id |
| `supabase/functions/send-liquidation-email/index.ts` | Añadir párrafo sobre subir factura |
| `src/components/liquidations/EmailPreviewModal.tsx` | Añadir mensaje en vista previa |

---

## Verificación Post-Implementación

Después de implementar estos cambios, Iolanda podrá:

1. ✅ Recibir el email con el botón "Revisar y Firmar" visible
2. ✅ Leer en el email que puede subir su factura en la app
3. ✅ Acceder a la app con `iolanda@hayas.es` via Google Auth
4. ✅ Ver su liquidación en la sección "Liquidaciones"
5. ✅ Subir su factura desde la página de firma o desde el detalle de liquidación

---

## Diseño del Nuevo Email

```text
┌─────────────────────────────────────────────────────────────┐
│ Liquidación LIQ-2026-XXX                                    │
├─────────────────────────────────────────────────────────────┤
│ Hola Iolanda Carbone,                                       │
│                                                             │
│ Te enviamos la liquidación correspondiente al período       │
│ Enero 2026.                                                 │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Código:   LIQ-2026-XXX                                  │ │
│ │ Período:  Enero 2026                                    │ │
│ │ Total:    X.XXX,XX €                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Por favor, revisa el documento adjunto y confirma o         │
│ disputa la liquidación haciendo clic en el botón de abajo.  │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 💡 Nota: Si estás de acuerdo con la liquidación,        │ │
│ │ puedes proceder a subir tu factura directamente en la   │ │
│ │ aplicación, al final del detalle de tu liquidación.     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│            ┌─────────────────────────────┐                  │
│            │     Revisar y Firmar        │                  │
│            └─────────────────────────────┘                  │
│                                                             │
│ Este enlace expira en 30 días.                              │
└─────────────────────────────────────────────────────────────┘
```

