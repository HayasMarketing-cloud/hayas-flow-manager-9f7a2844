# Añadir filtro "Sin facturar" al selector de estado del listado de presupuestos

## Objetivo
En el listado de presupuestos, el selector de **Estado** debe ofrecer una opción "Sin facturar" que muestre los presupuestos que aún no están facturados al 100 %, incluyendo tanto los que tienen 0 % facturado como los que están facturados parcialmente (por ejemplo, al 50 %).

## Cambios propuestos

### 1. `src/pages/Presupuestos.tsx`
- Añadir una opción sintética `not_fully_invoiced` al `<Select>` de estado, con etiqueta **"Sin facturar"**, situada junto a las opciones de estado derivado existentes.
- Actualizar la lógica de filtrado client-side en el `useMemo` de `budgets`:
  - Cuando `filters.status === 'not_fully_invoiced'`, conservar el presupuesto si su estado efectivo (`getEffectiveBudgetStatus(b.status, s)`) no es `'invoiced'`, es decir, si el porcentaje facturado real es menor al 100 % (umbral actual 99,5 %).
- Mantener el comportamiento actual para el resto de estados (Pendiente, Enviado, Aprobado, Rechazado, Facturado parcial, Facturado).
- Asegurar que `hasActiveFilters` detecte la nueva opción como filtro activo.

## Criterios de aceptación
- El selector de estado muestra la opción "Sin facturar".
- Al seleccionarla, aparecen presupuestos con 0 % facturado y presupuestos parcialmente facturados.
- Los presupuestos facturados al 100 % quedan excluidos.
- El resto de filtros (cliente, año/mes, estado de facturación) siguen combinándose correctamente con la nueva opción.
