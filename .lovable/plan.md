# Plan: Cierre de Mes — Generación Manual de Facturas Borrador (v2)

## Objetivo
Botón "Generar borradores de facturas" que crea facturas en estado `draft` para un mes objetivo. Hoy 3 de junio probaremos con **mayo 2026**.

**Sin cron automático en esta primera versión** — solo ejecución manual desde UI.

---

## 1. Cambios de Base de Datos (migration)

### 1.1. `budgets.payment_plan` (JSONB, nullable)
Plan de pagos multi-hito. Si vacío → se usa `estimated_invoice_date` como hito único al 100%.
```json
[
  { "label": "Anticipo 50%", "percentage": 50, "invoice_date": "2026-06-01" },
  { "label": "Final 50%", "percentage": 50, "invoice_date": "2026-09-01" }
]
```

### 1.2. `invoices.source_milestone_index` (INT, nullable)
Idempotencia: índice único parcial `(budget_id, source_milestone_index) WHERE source_milestone_index IS NOT NULL`.

### 1.3. `contracts.detail_sheet_url` (TEXT, nullable)
URL del Google Sheet maestro del contrato (1 sheet por contrato, 1 pestaña por mes).

---

## 2. Edge Function: `generate-draft-invoices`

**Input**: `{ year, month, dry_run: boolean }`

### A) Facturas de Contratos
1. Contratos `status='active'`
2. Para cada contrato → `financial_requests` con:
   - `contract_id = X`, `status='completed'`, `work_year/work_month` = mes objetivo, sin `billed_invoice_id`
3. Si hay ≥1 request → factura `draft` con:
   - 1 línea: `"{contract.title} - {Mes Año} ({total_horas}h)"` por importe total
   - `notes`: link al `contract.detail_sheet_url`
   - Vincular requests vía `billed_invoice_id`

### B) Facturas de Presupuestos
1. Buscar `budgets` con `status IN ('approved','invoiced')`
2. Para cada budget:
   - Si `payment_plan` existe → hitos con `invoice_date` en mes objetivo
   - Si no → usar `estimated_invoice_date` (hito único 100%)
3. Crear factura `draft` solo si no existe ya `(budget_id, source_milestone_index)`:
   - Líneas copiadas de `budget_items` proporcionalmente al % del hito
   - Setea `budget_id` + `source_milestone_index`

### C) Modo `dry_run`
Preview JSON con facturas a crear + warnings (PO Number faltante, requests `in_progress` no incluidos, contratos sin `detail_sheet_url`). **No** escribe en DB.

---

## 3. UI

### 3.1. Botón en `/facturas`
"Generar borradores del mes…" → modal `GenerateDraftInvoicesModal`:
- Selector año/mes (default: mayo 2026 para el test)
- **Previsualizar** (dry_run) → tabla + warnings
- **Generar borradores** → ejecuta y crea

### 3.2. `BudgetFormModal` + `PaymentPlanEditor` (nuevo)
Sección opcional "Plan de pagos": tabla editable (label, %, fecha). Validación: suma % = 100.

### 3.3. `ContractFormModal`
Input URL Google Sheet (`detail_sheet_url`).

---

## 4. Detalles técnicos

- **Idempotencia contratos**: `billed_invoice_id` en requests evita doble facturación.
- **Idempotencia presupuestos**: índice único parcial.
- **Locale**: nombre de mes en español (`date-fns/locale/es`).
- **Sin Google Sheets API**: el link se introduce manualmente por contrato (futuro: auto-pestaña vía connector).
- **Sin cron**: se añadirá en v2 tras validar la prueba de mayo.

---

## 5. Archivos afectados (~10)
- Migration: `budgets.payment_plan`, `invoices.source_milestone_index` + índice único parcial, `contracts.detail_sheet_url`
- `supabase/functions/generate-draft-invoices/index.ts` (nuevo)
- `src/components/invoices/GenerateDraftInvoicesModal.tsx` (nuevo)
- `src/pages/Facturas.tsx` (botón)
- `src/components/budgets/PaymentPlanEditor.tsx` (nuevo)
- `src/components/budgets/BudgetFormModal.tsx` (integrar editor)
- `src/components/contracts/ContractFormModal.tsx` (campo sheet URL)
- `src/pages/GuiaRapida.tsx` (doc)

---

## Flujo de prueba hoy (3 junio)
1. Aprobar migración
2. Añadir `detail_sheet_url` a contratos relevantes desde su modal
3. Abrir `/facturas` → "Generar borradores del mes…" → seleccionar **Mayo 2026** → **Previsualizar**
4. Revisar warnings (PO faltantes, requests en progreso)
5. Confirmar → se crean facturas `draft` listas para revisión y emisión por finanzas
