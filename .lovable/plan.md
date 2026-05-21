## Contexto

El modal `RequestFormModal` recibe los datos vía `initialData` desde el padre (`Solicitudes.tsx` o `SolicitudDetalle.tsx`). Si la caché de React Query está obsoleta (caso REQ-2026-315 con horas mostradas como 0), el modal se abre con valores antiguos hasta que se invalida manualmente.

Queries implicadas (detectadas en el código):
- `['financial_request', id]` — detalle (SolicitudDetalle.tsx:66)
- `['financial-requests']` — listado/derivados (varios)

Nota: el queryKey real usa guion bajo (`financial_request`), no guion. Se usará ese.

## Cambio propuesto

Centralizar el refresco dentro del propio `RequestFormModal` para cubrir todas las vías de apertura (listado, detalle, otros) sin duplicar lógica en cada padre.

En el `useEffect` que se dispara al abrir (línea 434), añadir antes del `form.reset`:

```ts
if (initialData?.id) {
  queryClient.invalidateQueries({ queryKey: ['financial_request', initialData.id] });
  queryClient.invalidateQueries({ queryKey: ['financial-requests'] });
}
```

`queryClient` ya existe en el componente (línea 97).

## Resultado

- Al abrir el modal de edición, se fuerza refetch del detalle y del listado.
- El padre recibe el dato fresco y lo vuelve a pasar como `initialData`, lo que dispara de nuevo el `useEffect` y resetea el formulario con los valores actualizados (horas, tarifas, coste, etc.).
- Solo afecta a edición (cuando hay `initialData.id`); no impacta la creación.

## Archivos a modificar

- `src/components/modals/RequestFormModal.tsx` — añadir las 2 invalidaciones dentro del `useEffect` de apertura.
