
## Actualizar el icono de Flow Manager en toda la aplicación

Se va a usar la imagen subida (`IMG_6220.png`) como el icono unificado de la aplicación en todos los contextos donde se usa actualmente.

### Archivos a copiar

La imagen se copiará a varias ubicaciones para cubrir todos los usos:

| Destino | Uso |
|---|---|
| `public/favicon.png` | Favicon del navegador |
| `public/icons/icon-180x180.png` | Apple touch icon (iOS) |
| `public/icons/icon-192x192.png` | PWA manifest (192x192) |
| `public/icons/icon-512x512.png` | PWA manifest (512x512) + Splash screen |
| `src/assets/flowmanager-isotype.png` | Isotipo usado en el sidebar (modo colapsado) |

Nota: La imagen original es de alta resolución, así que servirá bien para todos los tamaños. Los navegadores y dispositivos la redimensionarán automáticamente.

### Archivos a modificar

1. **`index.html`** -- No requiere cambios, ya apunta a `/favicon.png` y `/icons/icon-180x180.png`.

2. **`public/manifest.webmanifest`** -- No requiere cambios, ya apunta a los iconos en `/icons/`.

3. **`src/components/SplashScreen.tsx`** -- No requiere cambios, ya usa `/icons/icon-512x512.png`.

4. **`src/components/layout/AppSidebar.tsx`** -- No requiere cambios, ya importa `flowmanager-isotype.png`.

### Resumen

Es un cambio puramente de reemplazo de assets. No hay cambios de código, solo se sustituyen los archivos de imagen existentes por el nuevo icono en todas las ubicaciones donde se referencia.
