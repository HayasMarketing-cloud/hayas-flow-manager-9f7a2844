
## Plan: Hacer los enlaces de solicitudes más visibles en la tabla de Liquidaciones

### Problema identificado

Basándome en el análisis:

1. **El código funciona correctamente**: El `onClick` en `TableRow` navega a `/solicitudes/${item.financial_request.id}` cuando existe el `financial_request.id`
2. **RLS parece estar configurado**: Los especialistas pueden ver sus propias solicitudes
3. **Posible problema de UX**: Los códigos de solicitud no tienen un estilo visual que indique que son clicables (no parecen enlaces)

### Cambios propuestos

**Archivo:** `src/pages/LiquidacionDetalle.tsx`

Hacer el código de la solicitud visualmente clicable añadiendo estilos de enlace:

```tsx
// Líneas 650-652 - Cambiar el estilo del código para que parezca un enlace
<TableCell className="font-mono text-sm">
  {item.financial_request?.id ? (
    <span className="text-primary hover:underline cursor-pointer">
      {item.financial_request?.code}
    </span>
  ) : (
    '-'
  )}
</TableCell>
```

### Verificación adicional

Si después de este cambio visual el usuario sigue sin poder hacer clic, entonces el problema es de RLS y necesitaríamos:
1. Abrir una sesión de navegador como especialista para verificar si `financial_request` viene como `null`
2. Ajustar las políticas RLS para permitir acceso a solicitudes en contexto de liquidaciones

### Resultado esperado

- Los códigos de solicitud se mostrarán en color azul (primario) con subrayado al pasar el cursor
- Será claro para el usuario que puede hacer clic para navegar al detalle
