
## Plan: Corregir URL y botón en emails de liquidaciones

### Problemas identificados

He analizado el código y encontrado dos problemas:

#### Problema 1: URL incorrecta desde LiquidacionDetalle

| Archivo | Línea | Código actual | Problema |
|---------|-------|---------------|----------|
| `src/pages/LiquidacionDetalle.tsx` | 441 | `appUrl: window.location.origin` | Usa la URL del navegador (preview) |
| `src/pages/Liquidaciones.tsx` | 272 | `appUrl: 'https://hayas-flow-manager.lovable.app'` | Correcto - usa URL fija |

Cuando envías desde la página de detalle (preview), el email incluye la URL del preview (`preview--hayas-flow-manager.lovable.app`) en lugar de la URL de producción.

#### Problema 2: Botón con emoji problemático

El botón usa el carácter `✓` que algunos clientes de email (Gmail, Outlook) pueden no renderizar bien, causando que el botón se "rompa" o desaparezca.

### Cambios propuestos

#### 1. Corregir URL en LiquidacionDetalle.tsx

**Archivo:** `src/pages/LiquidacionDetalle.tsx`
**Línea:** 441

```typescript
// ANTES
appUrl: window.location.origin,

// DESPUÉS  
appUrl: 'https://hayas-flow-manager.lovable.app',
```

#### 2. Mejorar HTML del botón en el email

**Archivo:** `supabase/functions/send-liquidation-email/index.ts`
**Líneas:** 293-298

El botón actual tiene problemas de compatibilidad con algunos clientes de email. La solución es usar un formato más compatible:

```html
<!-- ANTES -->
<div style="text-align: center; margin: 30px 0;">
  <a href="${signatureUrl}" 
     style="display: inline-block; background-color: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-right: 10px;">
    ✓ Revisar y Firmar
  </a>
</div>

<!-- DESPUÉS: Usar tabla para máxima compatibilidad con email clients -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 30px auto;">
  <tr>
    <td align="center" bgcolor="#10b981" style="border-radius: 8px;">
      <a href="${signatureUrl}" 
         target="_blank" 
         style="display: inline-block; background-color: #10b981; font-size: 16px; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; border: 1px solid #10b981;">
        Revisar y Firmar
      </a>
    </td>
  </tr>
</table>
```

### Resumen de archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/LiquidacionDetalle.tsx` | Usar URL de producción hardcodeada en línea 441 |
| `supabase/functions/send-liquidation-email/index.ts` | Mejorar HTML del botón para compatibilidad con email clients |

### Resultado esperado

Después de estos cambios:
1. Todos los emails (enviados desde cualquier entorno) tendrán la URL correcta de producción
2. El botón "Revisar y Firmar" se mostrará correctamente en todos los clientes de email (Gmail, Outlook, Apple Mail)
3. El enlace llevará directamente a la página de firma en producción
