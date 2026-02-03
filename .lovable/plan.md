
## Plan: Vista Seguimiento con Tabla Jerárquica Proyecto → Milestone → Tareas

### Diagnóstico del Problema Actual

El mensaje "No hay milestones" aparece porque:

1. **Datos existen**: La base de datos tiene 11 proyectos operativos con 76+ milestones
2. **Lógica de filtrado de roles**: El hook `useProjectMilestones` tiene esta condición:
   ```typescript
   if (needsFiltering && assignedClientIds.length === 0) {
     return [];
   }
   ```
   Si el usuario es AM/PM sin clientes asignados directamente (via contratos/presupuestos), retorna vacío aunque los proyectos existan.

3. **Posible causa**: El usuario actual puede tener rol admin o finanzas, pero la lógica no está considerando todos los casos correctamente.

### Solución Propuesta

Crear una nueva tabla jerárquica con 3 niveles de desplegables:

```text
▼ Proyecto: "Localización contenidos – HS 2 PAGES"        | ASENDIA HQ | En Progreso | 18 hitos
   ▼ Milestone: "Translation EN>FR"                       | Iolanda | 15/02 | Pendiente | 3 tareas
      ☐ Tarea 1: "Traducir sección 1"                     | Pendiente
      ☐ Tarea 2: "Review interno"                         | En Progreso
      ☑ Tarea 3: "Entrega final"                          | Completado
   ▶ Milestone: "Translation EN>DE" ...
▼ Proyecto: "Hubspot Requests"
   ...
```

---

### Cambios a Realizar

#### 1. Corregir Hook `useProjectMilestones`

El problema está en la lógica de filtrado. Para admin/finanzas no debería aplicar `needsFiltering`:

**Archivo**: `src/hooks/useProjectMilestones.tsx`

Cambio: Verificar que `needsFiltering` solo sea `true` para AM/PM sin acceso elevado:

```typescript
// Line 57-59: El problema es que si needsFiltering=true pero assignedLoading=true,
// la query devuelve vacío prematuramente

// La condición debe ser más específica:
if (needsFiltering && assignedClientIds.length === 0 && !assignedLoading) {
  return [];
}
```

#### 2. Crear Hook `useTrackingData`

Nuevo hook que agrupa milestones por proyecto para la vista de seguimiento:

**Archivo**: `src/hooks/useTrackingData.tsx`

```typescript
interface ProjectGroup {
  project: {
    id: string;
    name: string;
    status: string | null;
    deadline: string | null;
    client: { id: string; name: string } | null;
    contract: { id: string; code: string } | null;
    budget: { id: string; code: string } | null;
  };
  milestones: MilestoneWithDetails[];
  stats: { total: number; completed: number };
}
```

Este hook:
- Usa `useProjectMilestones` para obtener los datos
- Agrupa los milestones por `operational_project_id`
- Calcula estadísticas de progreso por proyecto

#### 3. Crear Componentes de Tabla Jerárquica

**Archivo 1**: `src/components/operations/HierarchicalTrackingTable.tsx`

Tabla principal con:
- Estado de filas expandidas por niveles (proyectos y milestones)
- Botón "Expandir todo" / "Colapsar todo"
- Columnas: Proyecto/Milestone/Tarea, Cliente, Estado, Especialista, Deadline, Progreso

**Archivo 2**: `src/components/operations/ProjectTrackingRow.tsx`

Fila de nivel 0 (Proyecto):
- Chevron para expandir/colapsar
- Nombre del proyecto
- Badge de estado
- Barra de progreso global
- Al expandir, muestra sus milestones

**Archivo 3**: `src/components/operations/MilestoneTrackingRowNested.tsx`

Fila de nivel 1 (Milestone):
- Indentación visual
- Chevron para expandir tareas
- Nombre, especialista, deadline
- Select para cambiar estado
- Contador de tareas
- Al expandir, muestra las tareas inline

**Archivo 4**: `src/components/operations/TaskTrackingRow.tsx`

Fila de nivel 2 (Tarea):
- Checkbox para marcar completada
- Nombre, descripción, estado
- Enlace a contexto si existe

#### 4. Integrar en OperationalProjects.tsx

Modificar la página para usar el nuevo componente:

```tsx
<TabsContent value="tracking">
  <HierarchicalTrackingTable
    filters={{
      clientId: clientFilter === 'all' ? undefined : clientFilter,
      // ... otros filtros
    }}
  />
</TabsContent>
```

---

### Estructura Visual de la Tabla

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ [Expandir todo] [Colapsar todo]                                    Mostrando X items│
├────────────────────────────────────────────────────────────────────────────────────┤
│ ▼ Localización HS 2 PAGES          ASENDIA HQ    Pendiente    15/03    ████░░ 67% │
│   ├─ ▶ Translation EN>FR           Iolanda       Pendiente    10/03    2/5 tareas │
│   ├─ ▼ Translation EN>DE           Sandra        En Progreso  12/03    4/4 tareas │
│   │    ├─ ☑ Revisar glosario                     Completado   08/03              │
│   │    ├─ ☑ Traducir contenido                   Completado   09/03              │
│   │    ├─ ☐ QA final                             En Progreso  11/03              │
│   │    └─ ☐ Entrega                              Pendiente    12/03              │
│   └─ ▶ Translation EN>IT           Ebelyn        Pendiente    14/03    0/3 tareas │
├────────────────────────────────────────────────────────────────────────────────────┤
│ ▶ Hubspot Requests                 ASENDIA HQ    En Progreso  20/03    ████░░ 50% │
├────────────────────────────────────────────────────────────────────────────────────┤
│ ▶ Videos Europe                    Asendia DE    En Progreso  28/02    ██░░░░ 33% │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Archivos a Crear

| Archivo | Propósito |
|---------|-----------|
| `src/hooks/useTrackingData.tsx` | Hook que agrupa milestones por proyecto |
| `src/components/operations/HierarchicalTrackingTable.tsx` | Tabla principal jerárquica |
| `src/components/operations/ProjectTrackingRow.tsx` | Fila expandible nivel 0 (Proyecto) |
| `src/components/operations/MilestoneTrackingRowNested.tsx` | Fila expandible nivel 1 (Milestone) |
| `src/components/operations/TaskTrackingRow.tsx` | Fila nivel 2 (Tarea) |

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useProjectMilestones.tsx` | Corregir lógica de filtrado para admin/finanzas |
| `src/pages/operations/OperationalProjects.tsx` | Usar nuevo componente `HierarchicalTrackingTable` |

---

### Beneficios

1. **Vista jerárquica clara**: Proyecto → Milestone → Tarea con desplegables
2. **Navegación eficiente**: Expandir/colapsar niveles según necesidad
3. **Consistencia**: Reutiliza patrones de "Mis Tareas" pero adaptado a tabla
4. **Funcionalidad completa**: Cambiar estados, ver progreso, acceder a tareas
5. **Filtros existentes**: Mantiene todos los filtros actuales funcionando
