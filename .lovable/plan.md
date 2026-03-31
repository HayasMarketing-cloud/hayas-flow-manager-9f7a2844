

## Multi-select de clientes en filtros de Facturas

### Problema actual
El filtro de clientes es un `Select` simple que solo permite elegir un cliente a la vez. Se necesita poder seleccionar múltiples clientes simultáneamente.

### Solución

#### 1. `src/hooks/useInvoiceFilters.tsx` — Cambiar `clientId: string | null` a `clientIds: string[]`

- Actualizar la interfaz `InvoiceFilters` para usar un array de IDs
- Serializar en URL como `clientIds=id1,id2,id3`
- Actualizar `syncToUrl`, `getFiltersFromParams`, `resetFilters`

#### 2. `src/pages/Facturas.tsx` — Reemplazar Select simple por multi-select con Popover + Checkboxes

- Sustituir el `<Select>` de clientes por un `<Popover>` que muestra una lista de checkboxes con los clientes disponibles
- Mostrar badges con los clientes seleccionados en el trigger (o "Todos los clientes" si ninguno seleccionado)
- Botón X para quitar clientes individuales
- Actualizar la query de invoices: cambiar `.eq('client_id', filters.clientId)` por `.in('client_id', filters.clientIds)`
- Actualizar `hasActiveFilters` para usar `filters.clientIds.length > 0`

#### 3. Componente inline de multi-select

Implementar directamente en Facturas.tsx usando `Popover` + `Command` (ya disponibles en el proyecto) para crear un dropdown con búsqueda y checkboxes, similar a patrones comunes de shadcn/ui.

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/hooks/useInvoiceFilters.tsx` | `clientId: string` → `clientIds: string[]`, URL sync |
| `src/pages/Facturas.tsx` | Multi-select UI con Popover+Command, query con `.in()` |

