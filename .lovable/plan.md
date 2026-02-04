

## Plan: Solución Definitiva para Vista de Seguimiento Vacía

### Diagnóstico Confirmado

He analizado toda la cadena de hooks y encontré **múltiples puntos de fallo**:

1. **La query compleja con embeds anidados puede fallar silenciosamente** - Si hay un problema con las relaciones (`!fkey_name`), la query falla pero el error no se muestra en la UI.

2. **El componente ignora el estado `error`** - `HierarchicalTrackingTable` solo verifica `isLoading` y `projectGroups.length`, pero NO muestra errores si la query falla.

3. **Timing de hooks puede causar estados intermedios** - Aunque la lógica de `needsFiltering` parece correcta, hay condiciones de carrera potenciales.

### Solución: 3 Cambios Clave

#### Cambio 1: Mostrar Errores en la UI (CRÍTICO)

**Archivo**: `src/components/operations/HierarchicalTrackingTable.tsx`

Actualmente el componente ignora `error`. Si la query falla, muestra "No hay proyectos" en lugar del error real. Esto oculta el problema.

**Cambio**:
- Obtener `error` desde `useTrackingData`
- Si hay error, mostrar un estado de error con:
  - Mensaje descriptivo
  - Botón "Reintentar" 
  - Detalles técnicos colapsables (para debugging)

```tsx
// Antes (línea 26):
const { projectGroups, isLoading, totalProjects, totalMilestones } = useTrackingData(filters);

// Después:
const { projectGroups, isLoading, error, totalProjects, totalMilestones, refetch } = useTrackingData(filters);

// Añadir bloque de error después de isLoading:
if (error) {
  return (
    <div className="text-center py-12">
      <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
      <h3 className="text-lg font-medium mb-2">Error al cargar proyectos</h3>
      <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
      <Button onClick={() => refetch()}>Reintentar</Button>
    </div>
  );
}
```

#### Cambio 2: Exponer `refetch` desde el Hook

**Archivo**: `src/hooks/useTrackingData.tsx`

Añadir `refetch` al retorno del hook para permitir reintentos:

```tsx
// Antes (línea 19):
const { data: milestones, isLoading, error } = useProjectMilestones(filters);

// Después:
const { data: milestones, isLoading, error, refetch } = useProjectMilestones(filters);

// Añadir refetch al return:
return {
  projectGroups,
  milestones,
  isLoading,
  error,
  refetch,  // ← Nuevo
  totalProjects: projectGroups.length,
  totalMilestones: milestones?.length || 0,
};
```

#### Cambio 3: Simplificar la Query de Milestones (Robustez)

**Archivo**: `src/hooks/useProjectMilestones.tsx`

La query actual usa hints de FK explícitos (`!constraint_name`) que pueden fallar si las relaciones no están bien configuradas. Simplificar la query:

**Antes** (líneas 63-90):
```typescript
let query = supabase
  .from('operational_requests')
  .select(`
    ...
    operational_project:operational_projects!operational_requests_operational_project_id_fkey(
      ...
      client:clients!operational_projects_client_id_fkey(id, name),
      ...
    ),
    ...
  `)
```

**Después** (quitar hints de FK):
```typescript
let query = supabase
  .from('operational_requests')
  .select(`
    id,
    name,
    description,
    status,
    deadline,
    context_url,
    notes,
    operational_project_id,
    assignee_specialist_id,
    assignee_user_id,
    client_id,
    created_at,
    operational_project:operational_projects(
      id,
      name,
      status,
      deadline,
      client:clients(id, name),
      contract:contracts(id, title, code),
      budget:budgets(id, title, code, estimated_invoice_date)
    ),
    assignee_specialist:specialists(id, name),
    client:clients(id, name),
    tasks(id, status)
  `)
  .order('deadline', { ascending: true, nullsFirst: false });
```

Esto permite que PostgREST infiera las relaciones automáticamente, lo cual es más robusto.

---

### Flujo de Permisos (Sin Cambios - Ya Correcto)

El flujo actual de permisos YA ES CORRECTO según la matriz:

| Rol | Lógica de Filtrado |
|-----|-------------------|
| **Admin** | `needsFiltering=false` → ve todo (RLS permite via `has_role('admin')`) |
| **Finanzas** | `needsFiltering=false` → ve todo (RLS permite via `has_role('finanzas')`) |
| **AM/PM (sin admin/finanzas)** | `needsFiltering=true` → filtra por `assignedClientIds` |
| **Especialista** | `shouldFilterBySpecialist=true` → filtra por `assignee_specialist_id` |

Las RLS policies en `operational_requests` ya cubren estos casos:
- Admin/Finanzas/PM: acceso global via `has_role()`
- AM: acceso por clientes asignados via subquery en contracts/budgets
- Especialista: acceso por `assignee_specialist_id`

---

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/operations/HierarchicalTrackingTable.tsx` | Mostrar errores + botón reintentar |
| `src/hooks/useTrackingData.tsx` | Exponer `refetch` |
| `src/hooks/useProjectMilestones.tsx` | Simplificar query eliminando hints de FK |

---

### Verificación Post-Implementación

1. Acceder con usuario **admin** (ruben@hayas.es) → Debe ver TODOS los proyectos
2. Acceder con usuario **AM/PM sin admin** → Debe ver solo clientes asignados
3. Acceder con usuario **especialista** → Debe ver solo milestones donde está asignado
4. Si hay error de query → Debe mostrarse claramente con opción de reintentar

---

### Beneficios

1. **Visibilidad de errores**: Nunca más "No hay proyectos" cuando hay error de query
2. **Robustez**: Query más simple menos propensa a fallar
3. **Debugging**: Mensajes de error claros para diagnóstico
4. **Recuperación**: Botón "Reintentar" para resolver fallos temporales

