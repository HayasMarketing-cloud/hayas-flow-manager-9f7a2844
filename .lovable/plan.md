## Objetivo
En las cards de Requests (`/solicitudes`) permitir ver y **editar en línea el especialista asignado** desde la propia card, sin abrir el modal.

## Alcance
Solo `src/components/requests/RequestCard.tsx` (vista de cards de la página Requests). No toca la vista de tabla ni el modal.

## Comportamiento
- La fila del especialista (icono 👤) se convierte en un control clickable:
  - Si hay especialista → muestra el nombre; al hacer clic abre un `Popover` con buscador y lista.
  - Si no hay especialista → muestra "+ Asignar especialista" en estilo placeholder.
- Selector con `Command`/`Popover` (patrón shadcn ya usado en el proyecto) con:
  - Input de búsqueda por nombre.
  - Lista de especialistas **activos** (`specialists.active = true`), ordenados por nombre.
  - Opción "Sin especialista" para desasignar.
- Al seleccionar, `UPDATE financial_requests SET specialist_id = ...` y refresco (`onRefresh`).
- Toast de confirmación (reutilizar `handleUpdateField` existente).
- Solo editable si `canManage === true` y la request no está liquidada. En caso contrario, se muestra el nombre como texto plano (comportamiento actual).

## Datos
- Nueva query compartida `['active-specialists-lite']` con `useQuery` (staleTime alto ~5 min) para no repetir fetch por cada card: `select id, name from specialists where active = true order by name`.

## Notas
- No se cambia el modelo de datos ni RLS: la política existente de `financial_requests` ya permite a admin/finanzas/AM/PM asignados actualizar la request.
- No se toca la vista de tabla (`RequestTableView`) en este cambio; se puede replicar en un paso posterior si lo pides.
