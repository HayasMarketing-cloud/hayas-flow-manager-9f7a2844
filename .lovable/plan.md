# Plan: Periodo de facturación robusto en facturas

## Objetivo
Garantizar que toda factura tenga `billing_period_month/year` correcto para que aparezca en el mes adecuado del Dashboard Mensual y del P&L, con tres capas: cálculo automático en BD, edición manual en el modal, y fix del agrupador del P&L.

---

## 1. Migración BD: trigger + backfill

**Trigger `BEFORE INSERT OR UPDATE` en `invoices`** — sólo actúa si `billing_period_month/year` vienen NULL (respeta valor manual):

Jerarquía de cálculo:
1. **Si la factura tiene allocations a presupuestos** (`invoice_budget_allocations`) y todos los presupuestos vinculados tienen `estimated_invoice_date` en el mismo mes → usar `estimated_invoice_date - 1 mes` (regla maestra trabajo N → factura N+1, pero anclada a la fecha real planificada del presupuesto).
2. **Si la factura tiene `budget_id` directo** con `estimated_invoice_date` → mismo cálculo: `estimated_invoice_date - 1 mes`.
3. **Fallback general** → `invoice_date - 1 mes`.

**Backfill histórico:** ejecutar la misma lógica una vez sobre todas las facturas existentes con `billing_period_year IS NULL` (incluye las 4 facturas Asendia de mayo).

## 2. Edición manual en `InvoiceFormModal.tsx`

Añadir bloque "Período de Facturación" debajo de "Fecha de Factura" (~línea 602):
- Dos `Select`: Mes (1-12) + Año (año actual ±2).
- Auto-sugerido aplicando la misma jerarquía que el trigger cuando el usuario cambia `invoice_date`, `budget_id` o las allocations — siempre que el usuario no lo haya tocado manualmente (flag `dirty`).
- Persiste `billing_period_month` y `billing_period_year` tanto en crear como en editar.
- Visible en cualquier estado de factura (también `paid`), para corregir histórico.

## 3. Fix P&L en `useDashboardMensualData.tsx`

Hoy (línea 233): cuando la factura no tiene `contract_id` ni `budget_id`, busca en `allocations` pero la lógica de agrupación por cliente sigue usando `inv.client_id`. Con el trigger + backfill esto ya queda cubierto: las 5 facturas Asendia aparecerán correctamente agrupadas. **No requiere cambios estructurales en el hook**, sólo verificación tras el backfill.

> Si tras el backfill alguna factura quedara aún sin `billing_period`, será visible en el contador `invoicesWithoutPeriod` del bloque de reconciliación.

---

## Detalles técnicos

```text
Trigger invoices_set_billing_period (BEFORE INSERT OR UPDATE)
├─ Si NEW.billing_period_month IS NOT NULL → return (respeta manual)
├─ Buscar estimated_invoice_date vía:
│   a) invoice_budget_allocations → budgets.estimated_invoice_date (si todas mismo mes)
│   b) NEW.budget_id → budgets.estimated_invoice_date
├─ Si encontrado → NEW.billing_period = estimated_invoice_date - 1 mes
└─ Fallback → NEW.billing_period = NEW.invoice_date - 1 mes
```

**Archivos afectados:**
- Nueva migración SQL (trigger + función + backfill UPDATE).
- `src/components/modals/InvoiceFormModal.tsx` (nuevo campo + lógica auto-sugerencia).
- `src/hooks/useDashboardMensualData.tsx` — sin cambios (validación tras backfill).

## Resultado esperado
- Las 5 facturas de Asendia HQ del 04/05/2026 aparecen automáticamente en abril 2026.
- Toda factura futura entra en el mes correcto, priorizando `estimated_invoice_date` del presupuesto cuando exista.
- Casos excepcionales editables manualmente desde el modal de factura.
