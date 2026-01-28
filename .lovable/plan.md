
# Plan: Mostrar Contrato en Columna Origen

## Problema Identificado

Los requests asociados a contratos (sin presupuesto) muestran "---" en la columna Origen. La tabla `financial_requests` tiene un campo `contract_id` que referencia a `contracts`, pero:
- La query no incluye la relación con contratos
- El componente `OriginCell` no soporta mostrar contratos

## Cambios a Realizar

### 1. Solicitudes.tsx - Añadir contrato a la query

Modificar el select para incluir la relación con contratos:

```typescript
// Línea ~60-73
.select(`
  *,
  client:clients(id, name, code),
  service:services(id, name),
  specialist:specialists(id, name),
  budget:budgets(id, title, code, client_contact_id),
  contract:contracts(id, title, code),  // ← AÑADIR
  invoice:invoices(id, code, status),
  liquidation:liquidations(id, code, status),
  operational_request:operational_requests!financial_request_id(
    id,
    operational_project:operational_projects(id, name)
  )
`)
```

### 2. OriginCell.tsx - Soportar contratos

Añadir prop para contrato y mostrarlo con icono diferenciador:

| Prop Nueva | Tipo | Descripción |
|------------|------|-------------|
| `contractId` | `string \| null` | ID del contrato |
| `contractTitle` | `string \| null` | Título del contrato |

Usar un icono distintivo (por ejemplo `FileText` o `ScrollText`) con color diferente (azul) para distinguir contratos de presupuestos.

Prioridad de visualización:
1. Si hay presupuesto → mostrar presupuesto (icono documento, color primary)
2. Si hay contrato (sin presupuesto) → mostrar contrato (icono scroll, color azul)
3. Si hay proyecto operativo → mostrar también (siempre se muestra si existe)

### 3. RequestTableView.tsx - Pasar datos del contrato

Actualizar el uso de `OriginCell`:

```tsx
<OriginCell
  budgetId={request.budget_id}
  budgetCode={request.budget?.code}
  contractId={request.contract_id}
  contractTitle={request.contract?.title}
  operationalProject={request.operational_request?.[0]?.operational_project}
/>
```

### 4. RequestCard.tsx - Pasar datos del contrato

Mismo cambio que en RequestTableView:

```tsx
<OriginCell
  budgetId={request.budget_id}
  budgetCode={request.budget?.code}
  contractId={request.contract_id}
  contractTitle={request.contract?.title}
  operationalProject={request.operational_request?.[0]?.operational_project}
/>
```

## Resultado Visual

| Antes | Después |
|-------|---------|
| `---` | `📜 epAQ GO Services Agreement` (azul) |
| `PRE-2025-201` | `📄 PRE-2025-201` (primary) |

Los contratos se mostrarán con su **título** (no el código) ya que el código es menos descriptivo (ej: "CON-2025-001").

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Solicitudes.tsx` | Añadir `contract:contracts(id, title, code)` al select |
| `src/components/requests/OriginCell.tsx` | Añadir props y lógica para contratos |
| `src/components/requests/RequestTableView.tsx` | Pasar `contractId` y `contractTitle` a OriginCell |
| `src/components/requests/RequestCard.tsx` | Pasar `contractId` y `contractTitle` a OriginCell |

## Detalles Técnicos

### Icono para Contratos
Usar `ScrollText` de lucide-react con clase `text-blue-600` para diferenciarlo visualmente del presupuesto (que usa `FileSpreadsheet` con `text-primary`).

### Navegación
Click en el contrato navega a la página de contratos (la aplicación no tiene vista de detalle de contrato individual según la estructura de archivos).

### Truncado
Aplicar el mismo patrón de truncado (`max-w-[120px] truncate`) con tooltip que muestre el título completo.
