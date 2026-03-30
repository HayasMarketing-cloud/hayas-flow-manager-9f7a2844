

## Simplificar filtros de fecha en Solicitudes

### Problema

Hay dos filtros de fecha que parecen duplicados y confunden:
- **"Todos los períodos"** → filtra por `created_at` (fecha de creación)
- **"Todos los meses"** → filtra por `work_month`/`work_year` (mes de trabajo)

Ambos generan listas de meses casi idénticas y no queda claro cuál usar. El usuario pide un único filtro de fecha que filtre por mes/año.

### Propuesta

**Eliminar "Período creación"** y quedarnos solo con **"Mes trabajo"** renombrado a **"Período"**, que filtra por `work_month`/`work_year` con fallback a `created_at` (lógica que ya existe en líneas 107-120).

### Cambios

1. **`src/pages/Solicitudes.tsx`**
   - Eliminar el select "Período creación" (líneas 640-677)
   - Renombrar el select "Mes trabajo" a **"Período"** (placeholder: "Todos los períodos")
   - Eliminar del `useRequestFilters` los parámetros `year`/`month` del botón "Limpiar filtros"
   - Eliminar la lógica de query que filtra por `created_at` con `year`/`month` (líneas 96-105)

2. **`src/hooks/useRequestFilters.tsx`**
   - Eliminar `year` y `month` del tipo `RequestFilters` y de `buildParams`
   - Mantener solo `workMonth`/`workYear` como filtro de fecha

### Resultado

Un único selector "Período" que filtra solicitudes por mes de trabajo, con fallback automático a fecha de creación para solicitudes sin `work_month`/`work_year`.

