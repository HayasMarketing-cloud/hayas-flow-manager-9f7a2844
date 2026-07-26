## Diagnóstico

El badge "Sin factura" se pinta cuando `financial_requests.billed_invoice_id` está vacío. En los ejemplos de PRE-2026-045 (y en la mayoría del histórico) los requests no tienen ese campo poblado aunque el presupuesto sí esté facturado:

- 16 requests de PRE-2026-045 → todos con `billed_invoice_id = NULL`.
- La factura 2026/86 (cobrada) está enlazada al presupuesto vía `invoice_budget_allocations` (modelo N:M), no a cada request.
- `invoice_items.financial_request_id` tampoco apunta a esos requests.

Por eso la columna "Factura" marca "Sin factura" en todos: la columna solo mira el vínculo directo request→factura, sin considerar el vínculo indirecto vía presupuesto/contrato.

## Objetivo

Que la columna "Factura" del listado de requests muestre la **factura real asociada**, con:
- **Código de factura** (ej: `2026/86`) como enlace clicable al detalle.
- **Estado real** con badge de color: `Cobrada` (verde) / `Pendiente de cobro` (ámbar) / `Borrador` / `Vencida`, siguiendo `getInvoiceStatusLabel` de `src/lib/invoice-utils.ts`.
- **Indicador de origen del vínculo** (directo vs vía presupuesto/contrato) mediante tooltip, sin ensuciar la celda.
- Badge ámbar "Sin factura" solo cuando genuinamente no hay factura por ningún camino.

## Cambios (solo UI/derivación, sin migración)

### 1. Nuevo hook `useRequestInvoiceLinks`
Ubicación: `src/hooks/useRequestInvoiceLinks.tsx`.

Dado el array de requests del listado, resuelve la factura efectiva de cada uno:

- **P1 – Directo**: si `billed_invoice_id` existe, usa esa factura.
- **P2 – Vía presupuesto**: si el request tiene `budget_id`, consulta `invoice_budget_allocations` filtrando por esos `budget_id` y trae `invoices(id, code, status, invoice_date)`. Selecciona la factura más reciente por `invoice_date`. Si hay varias, guarda el conteo para el tooltip.
- **P3 – Vía contrato**: si el request tiene `contract_id` y no hubo match previo, busca `invoices` con ese `contract_id` cuyo `billing_period_month/year` coincida con `work_month/work_year` del request. Si hay match único, se usa.
- Devuelve `Map<requestId, { invoiceId, code, status, via: 'direct'|'budget'|'contract', extraCount?: number }>`.

Se invalida junto con la query `financial_requests`.

### 2. Ampliar `FlowStatusCell`
`src/components/requests/FlowStatusCell.tsx`:

- Añadir props opcionales `linkVia?: 'direct'|'budget'|'contract'` y `extraCount?: number`.
- Reemplazar el círculo de icono actual + label interno por el badge de estado de factura homogéneo con `InvoiceStatusBadge` (usar `getInvoiceStatusColor` / `getInvoiceStatusLabel` para respetar la nomenclatura "Cobrada / Pendiente de cobro").
- Layout de la celda cuando hay factura:
  - Código `2026/86` en fuente mono, clicable, con hover subrayado y `ExternalLink` icon on hover.
  - Debajo (o al lado en flex): mini-badge con estado ("Cobrada", "Pendiente de cobro", "Borrador", "Vencida").
  - Si `linkVia !== 'direct'`, añadir icono discreto (`Link2`) + tooltip: *"Factura vinculada vía presupuesto PRE-2026-045"* (o contrato).
  - Click navega a `/facturas?highlight={invoiceId}` (comportamiento actual, ya soportado).
- Sin factura por ningún camino → mantener badge ámbar "Sin factura" actual.

### 3. Cablear en el listado
`src/components/requests/RequestTableView.tsx` (y equivalente en `RequestCard.tsx`):

- Consumir el hook con los requests visibles.
- Pasar a `<FlowStatusCell type="invoice" …>` los datos derivados: `linkedId`, `linkedCode`, `linkedStatus`, `linkVia`, `extraCount`.
- Fallback al valor directo del request si el hook aún no ha resuelto.

### 4. Alcance NO incluido

- **No** se rellena `billed_invoice_id` automáticamente. Dashboards, PnL y exports (`useDashboardMensualData`, `useEntityPnL`, `requestsExporter`) siguen contando solo lo explícitamente facturado a nivel request. Este cambio es puramente visual en el listado.
- **No** se aplica bloqueo funcional "no liquidar si no facturado" (capa 2, pendiente).
- **No** se toca la columna "Liquidación" ni las tarjetas de presupuestos/contratos.

## Verificación

- Requests de PRE-2026-045 muestran `2026/86` con badge verde "Cobrada" e icono `Link2` con tooltip "Factura vinculada vía presupuesto PRE-2026-045".
- Un request con `billed_invoice_id` directo mantiene su código y estado, sin icono de vínculo indirecto.
- Un request sin factura ni por budget ni por contract sigue mostrando el badge ámbar "Sin factura".
- Click en el código navega a `/facturas?highlight={id}`.
