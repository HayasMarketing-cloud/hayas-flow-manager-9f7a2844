

## Objetivo
Añadir una vista de tabla de milestones (con sus tareas expandibles) en la primera pantalla de Proyectos Operativos. Esta vista permitirá un seguimiento rápido y actualización del estado de milestones/tareas con las columnas solicitadas.

---

## Diseño de la solución

### Nuevas vistas en la página de Proyectos

Se implementarán **dos vistas alternativas** controladas por tabs:
1. **Vista Tarjetas** (actual) - Grid de proyectos con cards
2. **Vista Seguimiento** (nueva) - Tabla de milestones con tareas expandibles

### Columnas de la tabla de seguimiento

| Columna | Descripción | Origen |
|---------|-------------|--------|
| Cliente | Nombre del cliente | `operational_project.client.name` |
| Proyecto | Nombre del proyecto | `operational_project.name` |
| Milestone | Nombre del milestone | `operational_request.name` |
| Presupuesto | Código del presupuesto | `operational_project.budget.code` |
| Contrato | Código del contrato | `operational_project.contract.code` |
| Especialista | Nombre del especialista asignado | `operational_request.assignee_specialist.name` |
| Deadline | Fecha límite del milestone | `operational_request.deadline` |
| Fecha Facturación | Fecha estimada facturación | `budget.estimated_invoice_date` |
| Status | Estado del milestone | `operational_request.status` |
| Tareas | Contador X/Y completadas | Calculado de `tasks` |
| Acciones | Botón expandir tareas, editar estado | Interactivo |

### Funcionalidades clave

1. **Expandir/Colapsar tareas**: Al hacer clic en una fila de milestone, se expande para mostrar sus tareas
2. **Actualización rápida de estado**: Cambiar status de milestone/tarea directamente desde la tabla
3. **Filtros reutilizados**: Usar los mismos filtros que ya existen en `TaskFiltersBar`
4. **Ordenación por deadline**: Por defecto ordenado por fecha límite ascendente

---

## Cambios a realizar

### 1. Nuevo hook: `src/hooks/useProjectMilestones.tsx`

Hook que carga todos los milestones (operational_requests) con sus proyectos, clientes, presupuestos, contratos, tareas y fecha de facturación estimada.

```typescript
// Query que incluye:
// - operational_requests con project, client, budget (con estimated_invoice_date), contract
// - Count de tareas totales y completadas
// - Filtros por cliente, especialista, contrato, presupuesto, mes
// - Visibilidad basada en rol (Admin/AM/PM/Especialista)
```

### 2. Nuevo componente: `src/components/operations/MilestoneTrackingTable.tsx`

Tabla principal con:
- Cabeceras de columnas
- Filas de milestones con indicadores visuales
- Expansión para mostrar tareas inline
- Badges de estado
- Actualización de estado rápida

### 3. Nuevo componente: `src/components/operations/MilestoneRow.tsx` (actualizado)

Fila individual de milestone que:
- Muestra todas las columnas requeridas
- Permite expandir para ver tareas
- Permite cambiar estado del milestone

### 4. Modificar: `src/pages/operations/OperationalProjects.tsx`

Añadir:
- Tabs para alternar entre "Vista Tarjetas" y "Vista Seguimiento"
- Integración de `MilestoneTrackingTable` en la segunda tab
- Reutilización de filtros existentes adaptados

---

## Estructura de archivos

```
src/
├── hooks/
│   └── useProjectMilestones.tsx         # Nuevo - Query de milestones con detalles
├── components/
│   └── operations/
│       ├── MilestoneTrackingTable.tsx   # Nuevo - Tabla principal
│       ├── MilestoneTrackingRow.tsx     # Nuevo - Fila expandible
│       └── MilestoneTasksExpanded.tsx   # Nuevo - Lista de tareas inline
└── pages/
    └── operations/
        └── OperationalProjects.tsx      # Modificado - Añadir tabs y tabla
```

---

## Detalles técnicos

### Query del hook `useProjectMilestones`

```sql
SELECT 
  operational_requests.*,
  operational_project:operational_projects(
    id, name, status, deadline,
    client:clients(id, name),
    contract:contracts(id, title, code),
    budget:budgets(id, title, code, estimated_invoice_date)
  ),
  assignee_specialist:specialists(id, name),
  tasks(id, status)  -- Para contar completadas/total
```

### Estados de milestone con colores

- `pending` → Amarillo
- `in_progress` → Azul  
- `in_review` → Púrpura
- `completed` → Verde

### Indicador de deadline

- Normal: texto gris
- Próximo (< 7 días): texto naranja
- Vencido: texto rojo con fondo rojo claro

---

## Resultado esperado

1. Al entrar en "Proyectos", el usuario ve dos tabs: **"Tarjetas"** y **"Seguimiento"**
2. En la tab "Seguimiento" aparece una tabla con todos los milestones filtrados según su rol
3. Cada fila muestra: Cliente, Proyecto, Milestone, Presupuesto, Contrato, Especialista, Deadline, Fecha Facturación, Status, Tareas (X/Y)
4. Al hacer clic en una fila, se expande mostrando las tareas del milestone
5. Se puede cambiar el estado de milestones y tareas directamente desde la tabla
6. Los filtros permiten buscar por cliente, especialista, contrato, presupuesto, mes

