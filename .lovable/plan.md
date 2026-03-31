

## Correcciones en modal "Nuevo Milestone"

### Problemas identificados

1. **Cliente no aparece**: El `useEffect` en línea 154-158 auto-setea `client_id` cuando cambia `selectedProject`, pero el `client_id` del proyecto puede no estar cargado a tiempo o el `setValue` no dispara re-render del Select controlado. El problema es una race condition: cuando se pasa `projectId` como prop, el `reset` en línea 175-180 solo setea `operational_project_id` sin `client_id`, y el effect depende de que `projects` ya esté cargado.

2. **Campos a eliminar**: "Asignar Usuario" (líneas 368-387) y "Tipo de Revisor" (líneas 411-428).

3. **Placeholder incorrecto**: "Descripción detallada del request" → "Descripción detallada del milestone".

### Cambios en `src/components/operations/OperationalRequestFormModal.tsx`

1. **Fix cliente**: En el `useEffect` de reset (línea 160), cuando hay `projectId`, buscar el proyecto en la lista y setear también `client_id`. Además, añadir `projects` como dependencia del effect.

2. **Eliminar campo "Asignar Usuario"**: Quitar el select de `assignee_user_id` (líneas 368-387), dejar solo "Asignar Especialista" ocupando el ancho completo. Eliminar también el query de `users` (líneas 110-120) y el campo del schema/form.

3. **Eliminar campo "Tipo de Revisor"**: Quitar el select de `reviewer_type` (líneas 411-428), dejar "Estado" ocupando ancho completo. Eliminar del schema.

4. **Cambiar placeholder**: Línea 480, cambiar a "Descripción detallada del milestone".

5. **Cambiar placeholder nombre**: Línea 293, cambiar "Nombre del request" → "Nombre del milestone".

6. **Reorganizar layout**: Sin los campos eliminados, "Asignar Especialista" y "Estado" quedan en una fila de 2 columnas.

