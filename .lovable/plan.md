

## Mostrar contrato asociado en agrupación de items de liquidación

### Problema
En la liquidación, los requests que vienen de un **contrato** (sin presupuesto) se agrupan bajo "Sin proyecto/presupuesto", aunque tengan un contrato asociado. Caso real: REQ-2026-177 de Asendia Spain pertenece al contrato `CON-2025-004 — Plan de Marketing Digital y gestion de Leads`, pero aparece huérfano.

Por la regla maestra del proyecto, cada request lleva **o un presupuesto o un contrato** como origen, y la agrupación debe respetar ambos.

### Cambios

**1. `src/pages/LiquidacionDetalle.tsx`** (query de items, ~línea 285)
Añadir `contract:contracts(id, code, title)` junto al `budget` ya seleccionado:
```ts
budget:budgets(id, code, title),
contract:contracts(id, code, title),
operational_request: ...
```

**2. `src/lib/liquidation-grouping.ts`**
- Extender `GroupedProjectBudget.type` para incluir `'contract'`.
- En la lógica de detección (tras evaluar `project` y `budget`), añadir un tercer fallback:
  ```ts
  } else if (item.financial_request?.contract) {
    projectBudgetId = contract.id;
    projectBudgetName = contract.title || contract.code;
    projectBudgetType = 'contract';
  }
  ```
- Orden de precedencia mantenido: **proyecto operativo → presupuesto → contrato → comisión.budget → ninguno**.

**3. `src/components/liquidations/GroupedLiquidationItemsTable.tsx`**
En `renderProjectBudgetHeader`, añadir caso `'contract'`:
- Icono: `FileText` (o similar de lucide-react, distinto a `FileSpreadsheet` del presupuesto).
- Color: `text-blue-600 dark:text-blue-400` para diferenciarlo visualmente del verde (proyecto) y primary (presupuesto).

**4. `supabase/functions/get-liquidation-items/index.ts`**
Añadir `contract:contracts(id, code, title)` a la query de items para que la vista pública del especialista (link de firma) y los PDFs muestren la misma agrupación.

### Resultado en la liquidación de Agustín (marzo)
La sección "Trabajos incluidos" de Asendia Spain mostrará:
```
🏢 Asendia Spain
  📄 Plan de Marketing Digital y gestion de Leads (CON-2025-004)
     REQ-2026-177 — Creación de post para Blog — marzo 2026   180,00 €
```
en lugar del actual "Sin proyecto/presupuesto".

### Archivos afectados
- `src/pages/LiquidacionDetalle.tsx` — query
- `src/lib/liquidation-grouping.ts` — lógica de agrupación
- `src/components/liquidations/GroupedLiquidationItemsTable.tsx` — render del header
- `supabase/functions/get-liquidation-items/index.ts` — paridad con vista especialista

### Consideraciones
- No hay migración de datos: solo lectura/visualización.
- Compatible con liquidaciones existentes; los items que ya tenían `budget` o `project` mantienen su agrupación actual.
- Si un request tuviera tanto `budget_id` como `contract_id` (caso anómalo), prevalece el presupuesto, igual que hoy prevalece el proyecto operativo sobre el presupuesto.

