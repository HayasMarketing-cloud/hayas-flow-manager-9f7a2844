## Análisis confirmado

- El PDF adjunto de `LIQ-2026-042` sigue siendo incoherente internamente:
  - Las líneas y subtotales visibles del propio PDF suman `1.660,02 €`.
  - El pie `TOTAL A PAGAR` muestra `1.380,02 €`.
  - La diferencia sigue siendo `280,00 €`.
- La base de datos está correcta para esa liquidación:
  - `28` items.
  - `sum(liquidation_items.total) = 1.660,02 €`.
  - `liquidations.subtotal = 1.660,02 €`.
- Por tanto, no parece un problema de datos ni de que falten comisiones en la tabla: el PDF incluye las líneas correctas, pero el total final se calcula con código antiguo.
- La causa más probable y sólida: la app tiene `vite-plugin-pwa` con service worker y caché de assets JS. Aunque hayas publicado, tu navegador puede seguir ejecutando un bundle antiguo de la generación PDF. Eso explica que el PDF descargado después de publicar siga saliendo igual que antes.

## Plan de solución

1. **Eliminar la fuente del caché antiguo**
   - Desactivar el service worker/PWA en `vite.config.ts` para que no vuelva a cachear bundles JS de la aplicación.
   - Quitar el registro `registerSW` en `src/main.tsx`.
   - Añadir una limpieza automática al arrancar la app para desregistrar service workers ya instalados y borrar caches existentes en navegadores que ya lo tenían.

2. **Hacer la generación PDF imposible de desincronizar**
   - Refactorizar `src/utils/pdf/liquidationPDFGenerator.ts` para que descarga directa y PDF adjunto de email compartan una única función interna de renderizado.
   - Evitar los dos caminos duplicados actuales (`generateLiquidationPDF` y `generateLiquidationPDFBase64`) para que no puedan volver a divergir.

3. **Añadir validación dura antes de entregar el PDF**
   - Mantener y reforzar el guard de consistencia: suma de grupos, suma de líneas y total final deben coincidir.
   - Comparar también contra el subtotal/calculado de la liquidación cuando venga informado.
   - Si hay discrepancia, bloquear la generación y mostrar error en vez de descargar un PDF incorrecto.

4. **Aplicar el mismo criterio al enlace del email**
   - La página pública `/liquidacion/firmar/:token` seguirá descargando el PDF regenerado con los items actuales, pero ya sin posibilidad de usar JS antiguo cacheado tras la próxima publicación.
   - El adjunto generado al enviar email también usará la misma función interna.

5. **Verificación esperada**
   - Tras publicar esta corrección, al abrir la app una vez, se limpiarán service workers/caches antiguos.
   - Una nueva descarga de `LIQ-2026-042` debe mostrar `TOTAL A PAGAR: 1.660,02 €`.
   - Si alguna futura liquidación tuviera descuadre entre pantalla, tabla y total, el sistema no descargará el PDF y avisará del descuadre.