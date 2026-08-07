# F6 — Pagos parciales de liquidaciones: estado, cash-flow, cotejo y facturas

Objetivo: que el pago parcial de una liquidación sea un hecho registrable y coherente en card, detalle, tesorería, PDF y emails. Caso de referencia: LIQ-2026-070 (Leah Pérez, 2.800 €, 1.400 € pagados el 7/8/2026).

## Alcance funcional

### (a) Plan de pagos visible y editable desde el detalle
Nueva sección "Plan de pagos" en el detalle de la liquidación: lista de hitos (concepto, %, importe, fecha prevista, estado) con edición inline y creación del plan si no existe. Reutiliza el editor ya usado en el modal de liquidación.

### (b) "Registrar pago" sustituye a "Marcar como pagada"
El botón actual desaparece. En su lugar, "Registrar pago" abre un diálogo con: hito a saldar (o "pago sin hito" si no hay plan), fecha real de pago e importe (precargado del hito, editable). Al confirmar:
- marca el hito como pagado con su fecha e importe reales;
- recalcula el estado de la liquidación (ver punto 1);
- sólo cuando el pago es el último (cobertura total) pasa a `paid`, fija `paid_at` y envía el email de "liquidación pagada" al especialista.
Un pago parcial no envía email de pagada.

### (c) Estado derivado y chip coherente
El chip de la card y del detalle se calcula del plan: "Pago parcial 50% · pend. 1.400 €". Con cobertura total: "Pagada". El estado `paid` deja de poder fijarse a mano.

### (d) Cash-flow por hitos
`getLiquidationCashOutflow` pasa a derivar de hitos pagados siempre que exista plan; el fallback "status paid → total" queda reservado a liquidaciones sin plan. `getLiquidationCashOutflowForMonth` ya imputa por fecha real: se alinea con la misma base.

### (e) Facturas del especialista sin puntero legacy
El timeline y el email de recepción leen de `liquidation_invoices` (una entrada por factura, con número, importe y fecha). Se muestran todas las entradas con enlace individual. `specialist_invoice_url` deja de escribirse desde el front y desde la edge function; se conserva la columna sólo como histórico de lectura para registros antiguos.

## Las cuatro exigencias

1. **Semántica de estado cerrada.** `status='paid'` sólo cuando la suma de pagos registrados cubre el total (tolerancia 0,005 €). Con pagos parciales el estado queda en `pending_payment`. El email de pagada se dispara únicamente en el pago que completa la cobertura.
2. **Cash-flow corregido.** Base única: hitos pagados con su fecha real. Fallback al total sólo sin plan de pagos.
3. **Asimetría del cotejo resuelta — base imponible como única referencia.** Hoy el candidato se busca por `total_amount` (±5%) y la validación al confirmar compara `subtotal` (±1 €). Se unifica en **base imponible**: `liquidations.subtotal` (neto de impuestos) frente a la base de la factura del especialista, en el matching de candidatos y en la validación al confirmar. Tolerancia ±1% sobre base.
   - La extracción IA del PDF debe identificar y devolver la **base imponible** de la factura (no el total): el prompt y el esquema de salida se ajustan para exigir `subtotal` como campo primario, con IVA/IGIC e IRPF como campos informativos.
   - Cotejo (a) factura por el proyecto completo: base de la factura vs. `subtotal` de la liquidación.
   - Cotejo (b) factura parcial: base de la factura vs. importe de un hito del plan, o vs. pendiente. Los hitos se expresan sobre base.
   - Desajuste → aviso mostrando ambas cifras (base de la factura y base de referencia), nunca bloqueo.
   - Comentario de cabecera en el módulo: "todas las comparaciones de facturas de especialista se hacen sobre base imponible; IVA/IGIC/IRPF varían por régimen fiscal y no son base de cotejo".
4. **Puntero legacy retirado.** Según (e).

## Corrección de datos LIQ-2026-070 (paso final)

- Hito 1 marcado `paid: true`, `paid_at = 2026-08-07`, importe 1.400 €.
- `status` revertido de `paid` a `pending_payment`, `paid_at` a null.
- Resultado esperado: chip "Pago parcial 50% · pend. 1.400 €" y cash-flow de agosto 2026 con 1.400 € de salida para Leah Pérez.

## Detalle técnico

Ficheros afectados:
- `src/lib/liquidation-payment-plan.ts` — helper `registerMilestonePayment`, estado derivado (`deriveLiquidationStatus`), ajuste del fallback de cash-flow.
- `src/pages/LiquidacionDetalle.tsx` (~682-727) — sustituye `markAsPaidMutation` por `registerPaymentMutation`; añade sección de plan de pagos.
- Nuevo `src/components/liquidations/RegisterPaymentDialog.tsx`.
- Nuevo/ampliado `src/components/liquidations/LiquidationPaymentPlanSection.tsx` (detalle).
- `src/components/liquidations/LiquidationPaymentPlanBadge.tsx` — chip con % y pendiente.
- `src/pages/Liquidaciones.tsx` — card usa el chip derivado.
- `src/components/liquidations/LiquidationProcessTimeline.tsx` (225-247) — lista desde `liquidation_invoices`.
- `src/components/liquidations/SpecialistInvoiceUpload.tsx` (100-105) — deja de escribir `specialist_invoice_url`; aviso si la suma de facturas excede el total.
- `supabase/functions/upload-specialist-invoice/index.ts` (388-392) — ídem.
- `src/components/liquidations/SpecialistInvoiceImportModal.tsx` (132-138, 272-279) — cotejo unificado sobre base imponible (±1%), aviso con ambas cifras.
- Función de extracción IA de facturas de especialista — prompt/esquema exigen base imponible como campo primario.
- `src/hooks/useDashboardMensualData.tsx` (424-427) — sin cambio de firma, hereda la base corregida.
- `src/utils/pdf/liquidationPDFGenerator.ts` y `EmailPreviewModal.tsx` — reflejan hitos pagados y facturas recibidas.

Sin migración de esquema: el plan vive en `liquidations.payment_plan` (JSONB) y las facturas en `liquidation_invoices`. La corrección de LIQ-2026-070 es una actualización de datos.

## Riesgos

- Liquidaciones históricas en `paid` sin plan: intactas por el fallback.
- Liquidaciones de equipo: el registro de pago actúa sobre la liquidación cabecera, igual que hoy.
- Cambiar la base de cotejo a total puede reclasificar candidatos de importaciones antiguas; sólo afecta a sugerencias, nunca bloquea.

## Checks (con output literal)

1. Registrar pago parcial en una liquidación de prueba → chip "Pago parcial 50% · pend. X" y estado `pending_payment`; sin email.
2. Registrar el pago final → estado `paid`, `paid_at` fijado y email de pagada enviado una sola vez.
3. Subir una segunda factura de especialista → timeline con dos entradas enlazadas; aviso sólo si la suma supera el total.
4. Cotejo: factura con total dentro de ±2% → candidato propuesto y confirmación sin aviso; fuera de rango → aviso, permite continuar.
5. LIQ-2026-070 corregida: card con chip "50% · pend. 1.400 €", detalle con hito 1 pagado el 7/8/2026, cash-flow de agosto 2026 con 1.400 €.
6. Consulta de estado en BD de LIQ-2026-070 antes y después de la corrección.
