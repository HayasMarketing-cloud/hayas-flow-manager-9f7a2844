

## Plan: Selección y Edición Masiva de Milestones y Tareas en Vista Seguimiento

### Situación Actual

La vista de seguimiento (`HierarchicalTrackingTable`) ya tiene implementada:
- ✅ Selección de **proyectos** con checkbox
- ✅ Actualización masiva de **estado** para proyectos/milestones seleccionados
- ❌ No hay checkboxes en filas de **milestones**
- ❌ No hay checkboxes en filas de **tareas**
- ❌ Faltan acciones masivas para **especialista** y **deadline**

---

### Cambios Propuestos

#### 1. Añadir Checkboxes en Milestones y Tareas

```text
┌─────────────────────────────────────────────────────────────────────┐
│ ☑ [▼] Proyecto ABC                      │ Estado │ Progreso        │
├─────────────────────────────────────────────────────────────────────┤
│   ☑ [▼] Milestone 1       │ Especialista │ Deadline │ Estado │ 2/5 │
│     ☐   └─ Tarea 1                                                 │
│     ☐   └─ Tarea 2                                                 │
│   ☐ [▼] Milestone 2       │ Especialista │ Deadline │ Estado │ 0/3 │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2. Ampliar Barra de Acciones Masivas

La barra actual solo permite cambiar estado. Se ampliará con:

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ 5 seleccionados │ Estado: [Dropdown▼] │ Especialista: [Dropdown▼] │           │
│                 │ Deadline: [Date]    │ [Aplicar] [Cancelar]                  │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `HierarchicalTrackingTable.tsx` | Ampliar tipo SelectionItem para incluir 'task', añadir selectores de especialista/deadline en barra masiva |
| `MilestoneTrackingRowNested.tsx` | Añadir checkbox + props para selección |
| `TaskTrackingRow.tsx` | Añadir checkbox + props para selección |
| `ProjectTrackingRow.tsx` | Pasar props de selección a MilestoneTrackingRowNested |

---

### Detalles Técnicos

#### Tipo de Selección Ampliado

```typescript
type SelectionItem = {
  type: 'project' | 'milestone' | 'task';
  id: string;
};
```

#### Nuevas Acciones Masivas

```typescript
const handleBulkSpecialistUpdate = async (specialistId: string | null) => {
  const milestoneUpdates = selectedItems.filter(i => i.type === 'milestone');
  const taskUpdates = selectedItems.filter(i => i.type === 'task');
  
  // Actualizar milestones
  for (const item of milestoneUpdates) {
    await supabase
      .from('operational_requests')
      .update({ assignee_specialist_id: specialistId })
      .eq('id', item.id);
  }
  
  // Actualizar tareas
  for (const item of taskUpdates) {
    await supabase
      .from('tasks')
      .update({ assignee_specialist_id: specialistId })
      .eq('id', item.id);
  }
};

const handleBulkDeadlineUpdate = async (deadline: string | null) => {
  // Similar para deadline...
};
```

#### Props Nuevos en Componentes

**MilestoneTrackingRowNested:**
```typescript
interface MilestoneTrackingRowNestedProps {
  milestone: MilestoneWithDetails;
  isExpanded: boolean;
  onToggle: () => void;
  // Nuevos props:
  isSelected?: boolean;
  onSelectChange?: () => void;
  selectedTaskIds?: string[];
  onTaskSelectChange?: (taskId: string) => void;
}
```

**TaskTrackingRow:**
```typescript
interface TaskTrackingRowProps {
  task: Task;
  isLast: boolean;
  // Nuevos props:
  isSelected?: boolean;
  onSelectChange?: () => void;
}
```

---

### Flujo de Usuario

1. Usuario expande proyecto para ver milestones
2. Marca checkboxes en milestones específicos (o tareas)
3. Aparece barra de acciones masivas
4. Selecciona acción: Estado, Especialista, o Deadline
5. Clic en "Aplicar" → actualización en lote
6. Tabla se refresca con los cambios

---

### UI de la Barra de Acciones

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│ 3 milestones, 2 tareas │ Estado: [▼] │ Especialista: [▼] │ Deadline: [📅]     │
│                        │  [Aplicar]  │ [Cancelar]                             │
└────────────────────────────────────────────────────────────────────────────────┘
```

- Muestra desglose por tipo (X proyectos, Y milestones, Z tareas)
- Solo muestra opciones aplicables al tipo seleccionado
- Botón "Aplicar" solo activo cuando hay cambio pendiente

