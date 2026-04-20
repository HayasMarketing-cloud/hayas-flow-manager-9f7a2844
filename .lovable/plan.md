
Crear página de detalle de especialista accesible desde el listado, mostrando sus liquidaciones y facturas asociadas.

## Alcance

**Nueva ruta:** `/especialistas/:id` (`EspecialistaDetalle.tsx`)

**Acceso desde el listado:** Hacer las cards de `Especialistas.tsx` clicables (navegar al detalle). El botón de editar (lápiz) seguirá abriendo el modal sin propagar el click.

## Estructura de la página de detalle

1. **Header**: Nombre, tipo (badge), estado activo, email, sitio web (link), botón "Editar" (admin) y botón "Volver".
2. **Resumen rápido**: tarifa por hora, equipo (si es team leader o miembro), notas.
3. **Tabs/Secciones**:
   - **Liquidaciones**: Tabla con código, periodo (mes/año), estado (badge), subtotal, total, fecha pago. Cada fila clicable → navega a `/liquidaciones/:id` (ya existe `LiquidacionDetalle`) donde se ve el detalle completo y se puede descargar el PDF generado.
   - **Facturas recibidas**: Lista de las facturas PDF que el especialista ha subido (`liquidations.specialist_invoice_url` + `liquidation_signatures.invoice_uploaded_at`). Cada fila muestra liquidación asociada, fecha de subida, estado de verificación, y botones **Ver** (abre PDF en nueva pestaña) y **Descargar**.

## Datos a consultar

- `specialists` por `id` (datos básicos, ya filtrados por RLS).
- `liquidations` filtradas por `specialist_id` con campos: `id, code, period_year, period_month, status, subtotal, total_amount, paid_at, specialist_invoice_url, created_at`.
- `liquidation_signatures` (join opcional) para `invoice_uploaded_at` y `invoice_verification`.

Solo accesible para `admin` y roles con `canAccessOperations` (igual que el listado).

## Archivos

**Nuevos:**
- `src/pages/EspecialistaDetalle.tsx`
- `src/hooks/useSpecialistDetail.tsx` (fetch del especialista + liquidaciones + facturas)

**Modificados:**
- `src/App.tsx` — registrar la ruta `/especialistas/:id` dentro del layout protegido.
- `src/pages/Especialistas.tsx` — envolver cada Card en navegación al detalle (con `stopPropagation` en el botón editar).

## Consideraciones técnicas

- Reutilizar componentes existentes: `LiquidationStatusBadge`, `Card`, `Table`, `Button`, `Badge`.
- PDFs de facturas: el bucket `liquidation-invoices` es público → enlace directo a `specialist_invoice_url` con `target="_blank"` para ver, y atributo `download` para descargar.
- PDF de liquidación: ya se genera en `LiquidacionDetalle` mediante `liquidationPDFGenerator` — no se duplica, se enlaza al detalle existente.
- Sin cambios de DB ni nuevas migraciones.
