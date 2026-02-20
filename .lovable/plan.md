

## Actualizar icono de Flow Manager (versión sin borde blanco)

Se reemplazará el icono en todas las ubicaciones con la nueva versión (`IMG_6222.PNG`) que tiene el fondo verde/azul completo sin borde blanco.

### Archivos a reemplazar

| Destino | Uso |
|---|---|
| `public/favicon.png` | Favicon del navegador |
| `public/icons/icon-180x180.png` | Apple touch icon (iOS) |
| `public/icons/icon-192x192.png` | PWA manifest (192x192) |
| `public/icons/icon-512x512.png` | PWA manifest (512x512) + Splash screen |
| `src/assets/flowmanager-isotype.png` | Isotipo en sidebar (modo colapsado) |

### Visualizacion esperada

- **Favicon**: Se vera el gradiente verde-azul con la "f" blanca, sin borde.
- **PWA (instalacion movil)**: El icono aparecera con el fondo completo verde-azul. iOS y Android aplican su propia mascara de bordes redondeados sobre el icono, asi que se vera limpio.
- **Splash screen**: El icono grande con el gradiente completo.
- **Sidebar colapsado**: El isotipo se muestra con filtro `brightness-0 invert` (lo convierte a blanco), asi que seguira viendose bien sobre el fondo oscuro del sidebar.

### Sin cambios de codigo

Todos los archivos de referencia (`index.html`, `manifest.webmanifest`, `SplashScreen.tsx`, `AppSidebar.tsx`) ya apuntan a estas rutas. Solo se sustituyen los assets.

