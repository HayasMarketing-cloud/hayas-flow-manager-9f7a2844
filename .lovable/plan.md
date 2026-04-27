## Problema detectado

El **Dashboard Mensual** (modo Cash-flow, que es el default) está filtrando las facturas del cliente por `invoice_date` dentro del mes seleccionado. Eso es **incorrecto** según la regla maestra del proyecto:

> Mes N (trabajo) → factura emitida el día 1 de N+1 → pago el 28 de N+1.

### Verificación con datos reales (Marzo 2026)

Lo que aparece ahora bajo "Marzo 2026" son facturas con `invoice_date = 2026-03-02` que en realidad corresponden al trabajo de **febrero** (`billing_period_month = 2`):
- 2026/19, 2026/20, 2026/21, 2026/22, 2026/23, 2026/24 → todas son del periodo febrero.
- También 2026/26 (980 €) que está colándose por tener `billing_period` en NULL.

Lo que **debería** mostrarse en Marzo son las facturas con `billing_period_month = 3` emitidas el 1 de abril:
- 2026/30, 2026/31, 2026/33, 2026/34, 2026/35, 2026/36, 2026/37, 2026/38, 2026/39, 2026/40, 2026/41, 2026/42 (12 facturas, todas con `invoice_date = 2026-04-01` y periodo marzo).

### Causa raíz

En `src/hooks/useDashboardMensualData.tsx`:
- Modo **`accrual`** (Devengado) ya filtra correctamente por `billing_period_year/month`.
- Modo **`cashflow`** (Cash-flow, default) filtra por `invoice_date` entre el día 1 y el último día del mes seleccionado. Ese rango captura las facturas emitidas a primeros de mes que pertenecen al periodo anterior.

La etiqueta "Cash-flow" sugería filtrar por flujo de caja, pero conceptualmente lo que el usuario quiere ver en "Marzo" es siempre el **trabajo de marzo** (= `billing_period = marzo`). La diferencia entre Cash-flow y Devengado debe estar en **qué importes contabilizar** (sólo cobradas vs. todas), no en qué facturas se incluyen.

## Solución propuesta

Unificar el criterio de **selección de facturas** en ambos modos: siempre filtrar por `billing_period_year/month = mes seleccionado`. La diferencia entre los dos modos queda así:

- **Devengado**: ingresos = suma de `subtotal` de todas las facturas del periodo (estén cobradas o no).
- **Cash-flow**: ingresos = suma de `subtotal` sólo de las facturas del periodo que estén `paid`.

Esto coincide exactamente con la memoria `revenue-calculation-alignment` y con la regla maestra de cash-flow (mes N → cobro 28 de N+1, pero el periodo del trabajo sigue siendo N).

### Tratamiento de facturas sin billing_period

Hay facturas con `billing_period` en NULL (ej. 2026/26, 2026/43, 2026/44). Hoy se cuelan en el modo cashflow del mes en que se emiten. Tras el cambio quedarían **fuera de todos los meses**, lo que es correcto pero hay que dar visibilidad. Opciones:

1. **(Recomendada)** Añadirlas a un nuevo contador en el bloque "Estado del cierre": *"Facturas sin periodo asignado"* con enlace a la lista para que se completen manualmente.
2. Hacer fallback a `invoice_date - 1 mes` (heurístico). Más arriesgado: puede ocultar errores reales.

Propongo la opción 1 (auditoría visible, sin magia).

## Cambios técnicos

### `src/hooks/useDashboardMensualData.tsx`
- Reemplazar la consulta de `invoices` para que **siempre** filtre por `billing_period_year = year` y `billing_period_month = month` (eliminar la rama por `invoice_date`).
- En el cálculo de `revenue` por cliente y por origen, mantener la lógica actual: en `cashflow` sólo cuentan las facturas `paid`; en `accrual` cuentan todas.
- Añadir una segunda consulta ligera para contar facturas con `billing_period_*` en NULL emitidas en el mes (`invoice_date` dentro del mes) y exponerla en `ReconciliationData` como `invoicesWithoutPeriod`.

### `src/pages/DashboardMensual.tsx`
- Añadir la nueva tarjeta en el bloque "Estado del cierre" mostrando `invoicesWithoutPeriod` con icono de alerta y enlace a `/facturas` filtrado por mes (si el filtro lo soporta; si no, sólo el contador).
- Actualizar el subtítulo/descripción para dejar claro que ambos modos muestran el **trabajo del mes** y la diferencia es sólo qué se contabiliza (devengado vs. cobrado).

### Sin migraciones
No se tocan tablas ni RLS. Sólo lectura/visualización.

## Consideraciones

- Los KPIs y agrupaciones por cliente/contrato/presupuesto se recalculan automáticamente al cambiar la fuente de datos.
- La conciliación (`requestsWithoutInvoice`, etc.) ya se basa en `work_year/work_month` de los requests, así que ya estaba correcta y no cambia.
- Las liquidaciones siguen filtrándose por `period_year/period_month`, que también es correcto.
- Tras el cambio, al abrir Marzo 2026 se verán las 12 facturas de abril con periodo marzo (≈ 8.700 €) en lugar de las 7 actuales de febrero.