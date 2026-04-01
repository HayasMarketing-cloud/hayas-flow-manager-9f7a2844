

## Añadir filtro de meses y exportación con selección múltiple en Presupuestos

### Cambios necesarios

**1. Actualizar `useBudgetFilters.tsx`**
- Añadir campos `invoiceMonth` y `invoiceYear` al tipo `BudgetFilters` (similar a `workMonth`/`workYear` en requests).

**2. Crear `src/utils/excel/budgetsExporter.ts`**
- Nuevo archivo con función `exportBudgetsToCSV` que exporte los presupuestos seleccionados (o todos) a CSV con columnas: Código, Título, Cliente, Monto Total, Estado, Fecha Facturación.
- Incluir fila de totales al final, mismo patrón que `requestsExporter.ts`.

**3. Actualizar `Presupuestos.tsx`**
- Añadir estado `selectedIds` para selección múltiple.
- Añadir filtro de período (mes/año) que filtre por `estimated_invoice_date` en la query de Supabase.
- Añadir botón "Exportar Excel" en la barra de acciones.
- Añadir barra de acciones en grupo cuando hay seleccionados (con botón exportar y contador).
- Pasar props de selección (`selectedIds`, `onSelectAll`, `onSelectOne`) al `BudgetTableView`.

**4. Actualizar `BudgetTableView.tsx`**
- Añadir columna de checkboxes (header con select-all, filas con checkbox individual).
- Recibir y manejar props de selección.

### Detalles técnicos

- El filtro de mes aplicará sobre `estimated_invoice_date` usando `gte`/`lte` con rango del mes seleccionado.
- La exportación usará la misma utilidad `downloadCSV` de `excelExporter.ts`.
- Cuando hay elementos seleccionados, se exportan solo esos; si no, se exportan todos los filtrados.

