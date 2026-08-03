# Estado de facturación en el listado de presupuestos

Mostrar en la lista de presupuestos (vista tabla y vista tarjetas) qué porcentaje del presupuesto está ya facturado: 0%, 50%, 100%, o el porcentaje real cuando hay plan de pagos con varias facturas.

## Qué verá el usuario

- Nueva columna **Facturado** en la tabla, y una línea equivalente en cada tarjeta.
- Badge con el porcentaje y el estado:
  - `Sin facturar` (0%)
  - `Parcial 50%` (o el % real) en ámbar
  - `Facturado 100%` en verde
  - `Sobrefacturado` si supera el 100%
- Detalle al pasar el ratón: importe facturado / importe total, número de facturas emitidas y, si el presupuesto tiene plan de pagos, cuántos hitos van emitidos (ej. "1 de 2 hitos · Pago inicial 50%").
- Barra de progreso fina bajo el badge en la vista tarjetas.

## Cómo se calcula

Se reutiliza la misma fuente de verdad que ya usa la ficha del presupuesto (pestaña Controlling): las asignaciones `invoice_budget_allocations` sobre el total del presupuesto, y el `payment_plan` para nombrar los hitos. Así los porcentajes del listado y del detalle siempre coinciden.

## Detalles técnicos

1. Nuevo hook `src/hooks/useBudgetsInvoicedSummary.tsx`:
   - Recibe los `budgetIds` visibles.
   - Una sola consulta a `invoice_budget_allocations` (con `invoice:invoices(id, code, invoice_date, source_milestone_index, budget_id)`) filtrada con `.in('budget_id', ids)`.
   - Reutiliza `resolveMilestonesForBudget` de `useBudgetMilestoneResolver.tsx` para saber qué hitos están cubiertos.
   - Devuelve `Map<budgetId, { invoiced, percent, invoiceCount, milestonesTotal, milestonesCovered, nextMilestoneLabel }>`.
2. Nuevo componente `src/components/budgets/BudgetInvoicedBadge.tsx` con el badge + tooltip (tokens semánticos, sin colores hardcodeados).
3. `src/pages/Presupuestos.tsx`: llamar al hook con los presupuestos ya filtrados y pasar el `Map` a `BudgetTableView` y `BudgetCard`.
4. `BudgetTableView.tsx`: nueva columna "Facturado" antes de "Estado".
5. `BudgetCard.tsx`: badge + barra de progreso en el cuerpo de la tarjeta.

Sin cambios de base de datos ni de lógica de facturación.
