## Objetivo
Alinear la generación de borradores con la regla de negocio: en presupuestos, la fecha seleccionada en la previsualización representa el mes de trabajo a facturar, y los presupuestos correspondientes se identifican por `estimated_invoice_date` en el mes siguiente (N+1).

## Diagnóstico
- La función actual filtra presupuestos por `estimated_invoice_date` dentro del mes seleccionado.
- Por eso, al previsualizar Mayo 2026 aparecen presupuestos con fecha de facturación en mayo, que realmente corresponden a trabajo de abril.
- Los presupuestos que hay que facturar por mayo tienen `estimated_invoice_date` en junio, por ejemplo `PRE-2026-040`, `PRE-2026-039`, `PRE-2026-033`, etc.

## Plan de implementación
1. Cambiar solo la sección de presupuestos en `generate-draft-invoices`:
   - Mantener contratos como están: contratos usan `work_year/work_month` del mes seleccionado.
   - Para presupuestos, calcular el rango de facturación como el mes siguiente al mes seleccionado.
   - Ejemplo: si el usuario elige Mayo 2026, buscar presupuestos con `estimated_invoice_date` o hitos de `payment_plan.invoice_date` en Junio 2026.

2. Evitar duplicados reales de presupuestos:
   - No incluir presupuestos ya totalmente vinculados a facturas mediante `invoice_budget_allocations` o `budget_id` directo.
   - Esto evita que presupuestos con estado `invoiced` vuelvan a aparecer si ya están cubiertos.
   - Si un presupuesto está parcialmente facturado, incluir solo el importe pendiente.

3. Ajustar la factura creada para presupuestos:
   - `invoice_date` será la fecha de facturación del presupuesto/hito, por ejemplo `2026-06-01`.
   - `billing_period_month/year` será el mes seleccionado de trabajo, por ejemplo Mayo 2026.
   - Crear también la asociación en `invoice_budget_allocations`, no solo `budget_id`, para que quede trazabilidad y no reaparezca en futuras previsualizaciones.

4. Ajustar textos de la modal de previsualización:
   - Aclarar que “Presupuestos aprobados” usa fecha de facturación N+1 para el mes de trabajo seleccionado.
   - Mantener el título como `Previsualización — Mayo 2026`, porque ese es el periodo de trabajo.

5. Validación
   - Probar dry-run para Mayo 2026.
   - Confirmar que desaparecen los presupuestos facturados en abril/mayo que pertenecen a abril.
   - Confirmar que aparecen los presupuestos con fecha de facturación en Junio 2026 que pertenecen a Mayo.

## Archivos a tocar
- `supabase/functions/generate-draft-invoices/index.ts`
- `src/components/invoices/GenerateDraftInvoicesModal.tsx`

## Fuera de alcance
- No cambiaré `work_year/work_month` para presupuestos, porque esa regla aplica a requests/contratos.
- No cambiaré el filtro visual de la página de Presupuestos salvo que lo pidamos después; ahí el filtro de “Fecha Facturación” sí debe seguir representando la fecha real de factura.