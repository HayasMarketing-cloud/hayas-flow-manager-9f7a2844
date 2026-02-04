
## Plan: Edición Inline en Vista Seguimiento + Botón Crear Tareas

### Resumen
Añadiremos capacidades de edición rápida directamente en la tabla de "Vista Seguimiento" para permitir:
1. **Edición inline** de campos clave (especialista, deadline, estado) tanto a nivel de proyecto como de milestone
2. **Botón "Añadir tarea"** visible en cada fila de milestone para crear tareas rápidamente sin expandir
3. **Operaciones en bulk** (selección múltiple + actualización masiva de estado)

### Cambios a Implementar

#### 1. Milestone Tracking Row - Edición Inline + Botón Tareas
**Archivo**: `src/components/operations/MilestoneTrackingRowNested.tsx`

Modificaciones:
- Convertir la celda de "Especialista" a un **Select inline editable**
- Convertir "Deadline" a un **Input type=date editable**
- El "Estado" ya tiene un Select, mantenerlo
- Añadir un **botón "+" (Plus)** al lado del contador de tareas para crear una tarea rápidamente
- Al hacer clic en "+", mostrar un **input inline** para escribir el nombre de la tarea y crearla con Enter

#### 2. Project Tracking Row - Estado Editable
**Archivo**: `src/components/operations/ProjectTrackingRow.tsx`

Modificaciones:
- Convertir el Badge de estado a un **Select inline** para cambiar el estado del proyecto directamente
- Añadir **Deadline editable** para proyectos

#### 3. Hierarchical Tracking Table - Bulk Actions
**Archivo**: `src/components/operations/HierarchicalTrackingTable.tsx`

Modificaciones:
- Añadir columna de checkboxes para selección
- Añadir barra de acciones en bulk cuando hay selección (cambiar estado en masa)
- Mantener la barra de progreso/contadores existente

#### 4. Hooks de Mutación - Reutilizar existentes + nuevos
- Reutilizar `useUpdateMilestoneStatus` de `useProjectMilestones.tsx`
- Crear `useUpdateMilestone` para actualizar campos adicionales (specialist, deadline)
- Crear `useUpdateProjectStatus` para actualizar estado de proyecto
- Reutilizar `useRequestTasks` para crear tareas inline

#### 5. Task Tracking Row - Mejoras
**Archivo**: `src/components/operations/TaskTrackingRow.tsx`

Añadir:
- Celda editable para **especialista asignado** a la tarea
- **Deadline editable** para tareas

### Detalle de Cambios por Archivo

| Archivo | Cambio |
|---------|--------|
| `src/components/operations/MilestoneTrackingRowNested.tsx` | Select inline para especialista, input date para deadline, botón + para crear tareas, input inline de nueva tarea |
| `src/components/operations/ProjectTrackingRow.tsx` | Select inline para estado del proyecto, input date para deadline |
| `src/components/operations/TaskTrackingRow.tsx` | Select para especialista, input date para deadline |
| `src/components/operations/HierarchicalTrackingTable.tsx` | Columna de checkboxes, barra de bulk actions |
| `src/hooks/useProjectMilestones.tsx` | Nuevo hook `useUpdateMilestone` para campos adicionales |
| `src/hooks/useOperationalProjects.tsx` | Nuevo hook `useUpdateProjectField` |

### Mockup Visual (Milestone Row)

```
[v] [>] Desarrollo de app web benchmark...  | Ariel Odasso [v]  | 15/01 [📅] | Pendiente [v] | [2/5 tareas] [+]
                                              ↑ Select          ↑ Date picker  ↑ Select       ↑ Crear tarea
```

### Flujo de Crear Tarea Inline

1. Usuario hace clic en botón "+" junto al contador de tareas
2. Aparece un input debajo del milestone: `[ Nueva tarea... ]`
3. Usuario escribe nombre y presiona Enter
4. Tarea se crea con:
   - Especialista: heredado del milestone
   - Deadline: heredado del milestone  
   - Estado: "pending"
5. Input desaparece y contador se actualiza

### Notas Técnicas

- Los Select inline usarán estilos compactos (`h-7 w-[130px] text-xs`)
- Los inputs de fecha usarán formato ISO para enviar al backend
- Las mutaciones usarán `toast.success` para feedback
- Se mantiene sincronización bidireccional milestone ↔ financial_request para especialista
- Los cambios en bulk invalidarán queries de `project-milestones` y `operational-projects`

### Riesgos
- Bajo: son modificaciones de UI sobre infraestructura existente
- Los hooks de mutación ya existen y funcionan correctamente
