
# Plan: Boton "Crear Proyecto" en Vista de Contrato

## Resumen
Agregar un boton "Crear Proyecto" en el modal de visualizacion de contrato que permita generar automaticamente un proyecto operativo con milestones (operational_requests) desde las solicitudes financieras asociadas al contrato.

## Situacion Actual

```text
FLUJO EXISTENTE (Presupuestos):
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Presupuesto   │ --> │ financial_       │ --> │ operational_project │
│   (budget)      │     │ requests         │     │ + milestones        │
│                 │     │ (via budget_id)  │     │ (via budget_id)     │
└─────────────────┘     └──────────────────┘     └─────────────────────┘

FLUJO NUEVO (Contratos):
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Contrato      │ --> │ financial_       │ --> │ operational_project │
│   (contract)    │     │ requests         │     │ + milestones        │
│                 │     │ (via contract_id)│     │ (via contract_id)   │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

### Datos Verificados
- La tabla `financial_requests` tiene columna `contract_id` para vincular requests a contratos
- La tabla `operational_projects` tiene columna `contract_id` para vincular proyectos a contratos
- Ya existen financial_requests vinculados directamente a contratos (sin budget_id)

## Componentes a Crear/Modificar

### 1. Nuevo Hook: `useCreateProjectFromContract.tsx`

Similar a `useCreateProjectWithActivities` pero para contratos:

```typescript
// src/hooks/useCreateProjectFromContract.tsx

interface CreateProjectFromContractParams {
  projectData: {
    name: string;
    client_id: string;
    contract_id: string;  // En lugar de budget_id
    description?: string | null;
    deadline?: string | null;
    status?: 'pending' | 'in_progress' | 'in_review' | 'completed';
    owner_user_id?: string | null;
    created_by: string;
  };
}
```

**Logica del hook:**
1. Crear el proyecto operativo con `contract_id`
2. Obtener los `financial_requests` donde `contract_id` = contrato seleccionado
3. Crear `operational_requests` (milestones) por cada financial_request

### 2. Modificar: `ContractFormModal.tsx`

Agregar:
- Query para verificar si ya existe un proyecto operativo para este contrato
- Estado para el modal de confirmacion
- Boton "Crear Proyecto" visible cuando:
  - El contrato esta en modo vista (`mode === 'view'`)
  - El contrato esta activo (`status === 'active'`)
  - No existe ya un proyecto operativo asociado
  - Hay financial_requests asociados al contrato

### 3. Nuevo Componente: `ContractProjectCreationModal.tsx`

Modal de confirmacion similar a `ProjectCreationModal` pero adaptado para contratos:
- Muestra resumen del contrato
- Cuenta de financial_requests que se convertiran en milestones
- Botones "Ahora No" y "Crear Proyecto"

## Flujo de Usuario

```text
1. Usuario abre un contrato en modo vista
                    │
                    ▼
2. Si contrato está activo Y tiene requests 
   Y no tiene proyecto existente
                    │
                    ▼
    ┌───────────────────────────────┐
    │     Botón "Crear Proyecto"    │
    │     visible en el modal       │
    └───────────────────────────────┘
                    │
                    ▼ (click)
    ┌───────────────────────────────┐
    │ Modal de confirmación:        │
    │ - Nombre del contrato         │
    │ - Cliente                     │
    │ - Requests a convertir: N     │
    │ [Ahora No] [Crear Proyecto]   │
    └───────────────────────────────┘
                    │
                    ▼ (confirmar)
    ┌───────────────────────────────┐
    │ Se crea:                      │
    │ - 1 operational_project       │
    │ - N operational_requests      │
    │   (milestones)                │
    └───────────────────────────────┘
                    │
                    ▼
       Toast: "Proyecto creado con N milestones"
       Redirige a detalle del proyecto
```

## Archivos a Crear/Modificar

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `src/hooks/useCreateProjectFromContract.tsx` | Crear | Hook para crear proyecto desde contrato |
| `src/components/contracts/ContractProjectCreationModal.tsx` | Crear | Modal de confirmacion |
| `src/components/contracts/ContractFormModal.tsx` | Modificar | Agregar boton y logica |

## Detalles Tecnicos

### Query para verificar proyecto existente:
```typescript
const { data: existingProject } = useQuery({
  queryKey: ['contract-operational-project', contract?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('operational_projects')
      .select('id, name')
      .eq('contract_id', contract.id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
  enabled: !!contract?.id && isOpen,
});
```

### Query para contar financial_requests del contrato:
```typescript
const { data: contractRequests } = useQuery({
  queryKey: ['contract-financial-requests-count', contract?.id],
  queryFn: async () => {
    const { data, error, count } = await supabase
      .from('financial_requests')
      .select('id, title', { count: 'exact' })
      .eq('contract_id', contract.id);
    
    if (error) throw error;
    return { requests: data, count };
  },
  enabled: !!contract?.id && isOpen,
});
```

### Boton en el DialogFooter:
```typescript
{isViewMode && contract?.status === 'active' && !existingProject && contractRequests?.count > 0 && (
  <Button 
    variant="outline" 
    onClick={() => setShowProjectModal(true)}
  >
    <FolderKanban className="h-4 w-4 mr-2" />
    Crear Proyecto
  </Button>
)}

{existingProject && (
  <Button 
    variant="outline" 
    onClick={() => navigate(`/proyectos-operativos/${existingProject.id}`)}
  >
    <ExternalLink className="h-4 w-4 mr-2" />
    Ver Proyecto
  </Button>
)}
```

## Consideraciones

- Si el contrato ya tiene un proyecto, mostrar enlace "Ver Proyecto" en lugar de "Crear Proyecto"
- El nombre del proyecto se generara automaticamente desde el titulo del contrato
- El owner_user_id sera el PM del contrato si existe, si no el AM, si no el usuario actual
- Se heredara el client_id del contrato
- Los milestones heredaran el specialist_id de cada financial_request
