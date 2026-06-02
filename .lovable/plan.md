# Añadir columna "Origen" a exportaciones CSV

## Objetivo
Incluir en los CSV de **Solicitudes** y **Presupuestos** una nueva columna **Origen** que indique el Contrato o Presupuesto asociado.

## Cambios

### 1. `src/utils/excel/requestsExporter.ts`
- Añadir columna **"Origen"** (entre "Cliente" y "Servicio", para visibilidad).
- Lógica (misma jerarquía que `OriginCell.tsx`):
  - Si `request.budget` → `"Presupuesto: {code} – {title}"`
  - Si no, si `request.contract` → `"Contrato: {title}"`
  - Si no → `"Sin origen"`
- Los datos ya vienen en el query de `Solicitudes.tsx` (`budget:budgets(...)`, `contract:contracts(...)`), no requiere cambios en queries.

### 2. `src/utils/excel/budgetsExporter.ts`
- Añadir columna **"Origen"** (después de "Cliente").
- Lógica:
  - Si `budget.contract` → `"Contrato: {title}"`
  - Si no → `"Directo"` (presupuesto independiente sin contrato padre).

### 3. `src/pages/Presupuestos.tsx`
- Ampliar los dos `.select(...)` sobre `budgets` para incluir el contrato asociado:
  ```
  contract:contracts(id, title, code)
  ```
  (en las dos ramas: filtered por assigned y query default).

### 4. `src/components/clients/ClientBudgetsTab.tsx`
- Si se quiere consistencia visual al exportar desde ficha cliente (no aplica aquí porque no exporta), **no se toca**.

## Resultado
- CSV de Solicitudes muestra de un vistazo si la solicitud vino de Presupuesto (con código) o Contrato.
- CSV de Presupuestos muestra si el presupuesto cuelga de un Contrato marco o es directo.
- Sin cambios en UI ni en lógica de negocio. Solo exportación.
