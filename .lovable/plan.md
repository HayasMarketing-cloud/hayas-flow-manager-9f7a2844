

## Fix: Modal de edición no muestra ítems de miembros del equipo

### Problema
Al editar una liquidación de equipo (ej. Daniela + Sandra), el modal solo carga los `liquidation_items` del líder (`liquidation.id`), mostrando 60€ en vez de los 630€ del equipo completo. La vista "Ver" (`LiquidacionDetalle`) sí muestra todo porque usa otra lógica.

### Causa raíz
En `LiquidationFormModal.tsx`, la query de ítems (línea 977) filtra por `.eq('liquidation_id', liquidation.id)`, ignorando los `member_liquidation_ids` que vienen en el objeto de la liquidación de equipo.

### Solución

**Archivo: `src/components/liquidations/LiquidationFormModal.tsx`**

1. **Modificar la query `liquidationItems`** (línea ~968-984):
   - Si `liquidation.is_team` y tiene `member_liquidation_ids`, usar `.in('liquidation_id', [liquidation.id, ...member_liquidation_ids])` en vez de `.eq('liquidation_id', liquidation.id)`
   - Esto carga los ítems del líder y de todos los miembros

2. **Actualizar la queryKey** para incluir los IDs de miembros y evitar cache stale:
   ```
   queryKey: ['liquidation-items', liquidation?.id, liquidation?.member_liquidation_ids]
   ```

3. **Sección visual en modo edit**: Agrupar los ítems por `liquidation_id` para que se distinga qué ítems pertenecen al líder y cuáles a cada miembro (read-only para los ítems de miembros, editables solo los del líder).

4. **Recálculo de totales**: Asegurar que las funciones de recálculo tras añadir/eliminar ítems también refresquen correctamente cuando es equipo.

### Resultado
El modal de edición mostrará todos los ítems del equipo (630€), con los del líder editables y los de miembros visibles en modo lectura, consistente con la vista de detalle.

