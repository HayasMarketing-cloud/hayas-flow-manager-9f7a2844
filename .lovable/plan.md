

## Solucionar favicon con borde blanco

### Problema

El navegador sigue mostrando el icono con borde blanco en la pestaña. Esto ocurre porque existe un archivo `public/favicon.ico` antiguo (con el borde blanco) que algunos navegadores priorizan automáticamente sobre el `favicon.png` declarado en el HTML.

### Solucion

1. **Reemplazar `public/favicon.ico`** con la nueva imagen sin borde blanco (`IMG_6222.PNG`), para que cualquier navegador que busque `/favicon.ico` automaticamente obtenga el icono correcto.

2. **Reemplazar `public/favicon.png`** nuevamente con la imagen actualizada (por si la copia anterior no se aplico correctamente o hay cache).

### Nota sobre cache

Despues de publicar, es posible que necesites hacer un "hard refresh" en el navegador (Ctrl+Shift+R en Windows o Cmd+Shift+R en Mac) para ver el cambio, ya que los favicons se cachean agresivamente. En movil, puede ser necesario borrar cache o reinstalar la PWA.

### Archivos a modificar

- `public/favicon.ico` -- reemplazar con el nuevo icono
- `public/favicon.png` -- reemplazar con el nuevo icono (confirmacion)

No hay cambios de codigo necesarios.

