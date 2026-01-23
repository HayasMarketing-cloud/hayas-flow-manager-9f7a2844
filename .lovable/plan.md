
# Plan: Mejorar el contraste del icono de la app móvil

## Problema identificado
En la captura de pantalla se ve que el icono de Flow Manager tiene fondo oscuro (`#0A1628`), lo que hace que no contraste bien con los demás iconos del dispositivo que típicamente tienen fondos claros.

## Solución propuesta
Cambiar el `background_color` del manifest PWA a blanco o un color claro corporativo, para que el área detrás del icono sea clara y contraste mejor.

## Opciones de color

| Opción | Color | Resultado |
|--------|-------|-----------|
| **Blanco puro** | `#FFFFFF` | Máximo contraste, limpio y profesional |
| **Tofu Digital** | `#F4F7F6` | Color corporativo claro, sutil tinte verde |
| **Hayas Green** | `#2FA36B` | Color primario corporativo, más distintivo |

**Recomendación**: Usar **blanco puro** (`#FFFFFF`) como la mayoría de apps profesionales (como se ve en Keepango en tu captura), ya que proporciona el mejor contraste y apariencia limpia.

---

## Cambios a realizar

### 1. Actualizar manifest.webmanifest
**Archivo:** `public/manifest.webmanifest`

- Cambiar `background_color` de `#0A1628` a `#FFFFFF`
- Opcionalmente cambiar `theme_color` para mantener coherencia (o dejarlo oscuro para la barra de estado)

```json
{
  "background_color": "#FFFFFF",
  "theme_color": "#0A1628"
}
```

### 2. Crear nuevos iconos con fondo blanco (Recomendado)
Para un mejor resultado, los iconos PNG deberían tener fondo blanco incorporado en lugar de transparente:

**Archivos a actualizar:**
- `public/icons/icon-180x180.png` (Apple Touch Icon)
- `public/icons/icon-192x192.png`
- `public/icons/icon-512x512.png`

**Nota:** Si no tienes los iconos con fondo blanco, al menos cambiar el `background_color` del manifest mejorará significativamente la apariencia en la mayoría de dispositivos.

---

## Sección técnica

### Cambio en manifest.webmanifest (líneas 5-6)
```json
{
  "name": "Flow Manager",
  "short_name": "Flow Manager",
  "description": "ERP de hayas para la preparación de presupuestos, gestión de proyectos, liquidaciones a especialistas y facturación a clientes.",
  "theme_color": "#0A1628",
  "background_color": "#FFFFFF",
  ...
}
```

### Consideración sobre Apple Touch Icon
Para iOS específicamente, el sistema usa el Apple Touch Icon (`icon-180x180.png`) referenciado en `index.html`. Si el icono tiene fondo transparente, iOS aplicará su propio fondo. Con el cambio del `background_color`, debería mejorar.

---

## Resultado esperado
El icono de Flow Manager en la pantalla de inicio del móvil aparecerá con fondo blanco, similar al icono de Keepango en la captura, proporcionando mejor contraste y una apariencia más profesional.
