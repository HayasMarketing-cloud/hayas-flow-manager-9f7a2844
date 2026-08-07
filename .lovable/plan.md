# F5 — Anticipos a especialistas y regularizaciones

Objetivo: permitir adelantar caja a un especialista mediante una línea de anticipo en su liquidación, y regularizarla más tarde con una línea negativa enlazada, sin tocar el modelo económico del request (unidad indivisible, se liquida una vez, entera, a su coste).

## 1. Modelo de datos

Se **extiende `liquidation_items`**, no se crea tabla nueva. Motivos: el anticipo ya es económicamente una línea de liquidación (importe, descripción, sin request), el PDF, el total firmado, la firma, la validación AM y el marcado de pago consumen esa tabla, y una tabla paralela obligaría a duplicar toda esa lógica.

Columnas nuevas en `public.liquidation_items`:

| Columna | Tipo | Uso |
| --- | --- | --- |
| `item_type` | `liquidation_item_type` (enum: `work`, `advance`, `advance_settlement`) NOT NULL DEFAULT `work` | Clasifica la línea |
| `source_invoice_id` | `uuid NULL REFERENCES public.invoices(id) ON DELETE SET NULL` | Factura de cliente que origina el anticipo |
| `settles_item_id` | `uuid NULL REFERENCES public.liquidation_items(id) ON DELETE RESTRICT` | Autorreferencia: la regularización apunta al anticipo |

Reglas por trigger de validación (no CHECK, dependen de otras filas):

- `advance`: `financial_request_id IS NULL`, `total > 0`, `settles_item_id IS NULL`.
- `advance_settlement`: `financial_request_id IS NULL`, `total < 0`, `settles_item_id` obligatorio y debe apuntar a una línea `advance` **del mismo especialista** (vía `liquidations.specialist_id`).
- `work`: se comporta exactamente como hoy; las líneas actuales quedan como `work` por el DEFAULT.

Nada de saldos persistidos, ni jobs, ni cobertura anticipo→requests.

`public.specialists`: nueva columna `payment_terms text NULL`.

Paso 0 de la migración: `CREATE TABLE _backup_liquidation_items_<fecha> AS SELECT * FROM public.liquidation_items;` y lo mismo para `specialists`.

## 2. Consulta del saldo pendiente

Función `public.specialist_pending_advances(_specialist_id uuid)` — `STABLE SECURITY INVOKER` (respeta la RLS actual de liquidaciones, así que el banner sólo muestra lo que el usuario puede ver):

```sql
SELECT a.id, a.description, a.total AS amount,
       l.id AS liquidation_id, l.code AS liquidation_code,
       l.period_year, l.period_month, a.created_at,
       a.source_invoice_id, i.code AS invoice_code,
       a.total + COALESCE(SUM(s.total), 0) AS pending
FROM liquidation_items a
JOIN liquidations l ON l.id = a.liquidation_id
LEFT JOIN invoices i ON i.id = a.source_invoice_id
LEFT JOIN liquidation_items s ON s.settles_item_id = a.id
WHERE a.item_type = 'advance' AND l.specialist_id = _specialist_id
GROUP BY a.id, l.id, i.code
HAVING a.total + COALESCE(SUM(s.total), 0) > 0.005;
```

Las regularizaciones son negativas, por eso se suman. `pending` nunca se guarda.

## 3. Ficheros afectados

**Backend**
- Migración: enum, 3 columnas, trigger de validación, `payment_terms`, función de saldo, respaldos.
- `supabase/functions/get-liquidation-items/index.ts`: devolver `item_type`, `settles_item_id`, y el código de la factura de origen, para que el PDF del especialista (vía token) tenga los mismos datos que la vista interna.
- `supabase/functions/process-signature/index.ts`: no cambia su lógica; ya usa `liquidations.subtotal`, que pasa a incluir anticipos y regularizaciones (ver §5).

**Frontend**
- `src/lib/liquidation-advances.ts` (nuevo): tipos, `isAdvance/isSettlement`, `splitItemsByType`, hook `useSpecialistPendingAdvances(specialistId)`.
- `src/lib/liquidation-grouping.ts`: excluir las líneas de anticipo/regularización del árbol Cliente → Proyecto; se devuelven aparte en un bloque propio.
- `src/lib/liquidation-totals.ts`: `grandTotal` sigue siendo la suma de **todas** las líneas (los negativos restan); se añade `advances` y `advancesTotal` a la vista.
- `src/components/liquidations/LiquidationFormModal.tsx`: bloque "Anticipos" junto al de conceptos manuales — alta de anticipo (importe, nota, selector opcional de factura de cliente) y alta de regularización (selector de anticipo pendiente + importe negativo). Banner informativo de anticipos pendientes y nota de `payment_terms`.
- `src/components/liquidations/PendingAdvancesBanner.tsx` (nuevo): banner discreto (`Alert`, no modal) con fecha, nota, factura de origen, importe y pendiente por anticipo.
- `src/pages/LiquidacionDetalle.tsx`: sección visual diferenciada para anticipos/regularizaciones + banner.
- `src/components/liquidations/GroupedLiquidationItemsTable.tsx`: renderiza el bloque separado.
- `src/utils/pdf/liquidationPDFGenerator.ts`: bloque PDF (ver §4).
- `src/components/modals/SpecialistFormModal.tsx` y `src/pages/EspecialistaDetalle.tsx`: campo `payment_terms`.

## 4. Render en PDF

Tras la tabla jerárquica de trabajos y antes del total general, un bloque propio:

```text
ANTICIPOS Y REGULARIZACIONES
Descripción                                  Fecha       Importe
Anticipo hito 50% — Factura FAC-2026-071     12/06/2026  1.500,00 €
Regularización anticipo 12/06/2026            07/08/2026  -1.500,00 €
                            Subtotal anticipos:      0,00 €
```

- Cabecera en gris para distinguirlo del azul de trabajos.
- Importes negativos en rojo y con signo.
- El **TOTAL GENERAL** sigue siendo `subtotal` (trabajos + anticipos + regularizaciones); `ensureConsistentView` sigue comparándolo contra el `subtotal` de BD, así que una discrepancia sigue siendo visible.
- En liquidación de equipo, los anticipos se muestran en el bloque del especialista al que pertenecen (líder o miembro), nunca agregados.

## 5. Efecto en `process-signature`

Ninguno estructural. La función firma `liquidation.subtotal` y lo muestra al especialista; como los anticipos y regularizaciones son líneas de la misma liquidación, `subtotal` ya es el importe neto que se le abonará. Lo que **firma** el especialista es por tanto el neto, que es lo correcto: si en el mes hay una regularización de un anticipo cobrado antes, firma la cantidad que realmente recibirá. Los emails y el PDF adjunto usan la misma cifra, así que no hay divergencia entre lo firmado y lo mostrado.

Sí se revisa que el recálculo de `subtotal` en `LiquidationFormModal` (líneas ~392-397 y ~462-470) incluya las nuevas líneas, y que `SpecialistInvoiceImportModal` compare la factura del especialista contra el neto.

## 6. Riesgos

- **Total firmado distinto del esperado por el especialista**: si nadie le explicó el anticipo, ve un mes con importe reducido. Mitigación: el bloque del PDF nombra el anticipo y su fecha.
- **Borrado de un anticipo ya regularizado**: `ON DELETE RESTRICT` en `settles_item_id` lo impide con error de BD; se traduce a mensaje legible en la UI.
- **Regularización que excede el saldo**: permitida (axioma: avisar, no bloquear), con aviso en el modal antes de guardar.
- **Anticipos de otro especialista**: el selector y el trigger filtran por `liquidations.specialist_id`.
- **Paridad vista interna / vista pública del especialista**: si `get-liquidation-items` no devuelve los nuevos campos, el PDF por token pierde el bloque. Va en el mismo despliegue.
- **RLS**: los anticipos heredan las políticas de `liquidation_items`; no se añaden políticas nuevas, así que el alcance de AM/finanzas/especialista no cambia.

## 7. Checks

1. Crear anticipo de 1.500 € vinculado a una factura de cliente → PDF con bloque diferenciado, factura citada y total general correcto.
2. Nueva liquidación del mismo especialista → banner listando el anticipo con fecha, nota, factura, importe y pendiente 1.500 €.
3. Añadir regularización de -1.500 € enlazada → `specialist_pending_advances` devuelve 0 filas para ese especialista.
4. Regularización de -2.000 € sobre saldo de 1.500 € → aviso en UI, guardado permitido, pendiente derivado negativo no mostrado como pendiente.
5. Flujo completo de firma de una liquidación con anticipo: envío con PDF, apertura del enlace, importe mostrado = neto, firma → estado `accepted`, aviso Slack correcto.
6. Liquidación mensual de contrato de un especialista con anticipo pendiente → banner presente, ciclo (requests, validación AM, marcado de pago) intacto.
7. `payment_terms` editable en `SpecialistFormModal`, visible en el maestro y como nota al crear/editar liquidaciones de ese especialista.
8. Intento de borrar un anticipo regularizado → error legible, no éxito silencioso.
9. Trigger: insertar `advance_settlement` con importe positivo, o `advance` con `financial_request_id` → rechazados.
10. Liquidación de equipo con anticipo del líder → aparece sólo en su bloque; totales de equipo cuadran.

## Complejidad estimada

| Punto | Complejidad |
| --- | --- |
| Migración + trigger + función de saldo | Media |
| UI de alta y banner | Media |
| PDF y paridad edge function | Media |
| `payment_terms` | Baja |
