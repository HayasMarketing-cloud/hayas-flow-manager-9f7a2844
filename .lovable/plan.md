
# Plan: Actualizar el icono de la app con la nueva imagen

## Resumen
Usaremos la imagen que has subido como el nuevo icono de la aplicación para todas las plataformas (iOS, Android y favicon del navegador).

## Imagen proporcionada
El icono tiene un hermoso degradado de los colores corporativos (verde Hayas a azul profundo) con el símbolo "f" de Flow Manager en blanco. Las esquinas ya están redondeadas, lo cual es perfecto para dispositivos móviles.

---

## Archivos a actualizar

### 1. Copiar la imagen a los iconos PWA
Reemplazar los iconos existentes con la nueva imagen:

| Archivo destino | Uso |
|-----------------|-----|
| `public/icons/icon-180x180.png` | Apple Touch Icon (iPhone) |
| `public/icons/icon-192x192.png` | Android PWA |
| `public/icons/icon-512x512.png` | Android PWA (alta resolución) |
| `public/favicon.png` | Favicon del navegador |

### 2. Actualizar manifest.webmanifest
Dado que el nuevo icono ya tiene su propio fondo con degradado, podemos revertir el `background_color` al color oscuro corporativo o mantenerlo blanco (el fondo del icono ya no dependerá de esta configuración).

**Recomendacion**: Mantener `background_color: "#FFFFFF"` para que la splash screen al abrir la app tenga fondo blanco, lo cual combina bien con el icono.

---

## Secciones tecnicas

### Archivos a copiar
```text
user-uploads://Untitled_design_-_3.png -> public/icons/icon-180x180.png
user-uploads://Untitled_design_-_3.png -> public/icons/icon-192x192.png
user-uploads://Untitled_design_-_3.png -> public/icons/icon-512x512.png
user-uploads://Untitled_design_-_3.png -> public/favicon.png
```

### Nota sobre tamaños
La imagen original se usara para todos los tamaños. Los navegadores y sistemas operativos se encargan de escalar automaticamente. Para una optimizacion perfecta se podrian generar versiones redimensionadas, pero usar la imagen original funcionara bien en la practica.

---

## Resultado esperado
- El icono de la app en la pantalla de inicio mostrara el nuevo diseño con degradado verde-azul
- El favicon en la pestana del navegador mostrara el nuevo icono
- Las tarjetas de redes sociales (Open Graph) usaran el nuevo icono

## Accion requerida despues
Para ver los cambios en el movil, deberas:
1. Eliminar la app de la pantalla de inicio
2. Volver a "Anadir a pantalla de inicio" desde el navegador
