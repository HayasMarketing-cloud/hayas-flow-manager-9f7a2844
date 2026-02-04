

## Plan: Corrección Definitiva del Problema de Frontend

### Diagnóstico Confirmado
El panel de debug muestra claramente:
- **RLS funciona**: 11 proyectos y 76 requests visibles en la base de datos
- **Permisos correctos**: `needsFiltering = false` (Admin ve todo)
- **Especialista vinculado**: ID correcto
- **Conclusión del panel**: "Las consultas a la base de datos devuelven datos. Si la UI está vacía, el problema está en el filtrado del frontend."

### Causa Raíz Identificada
El problema está en el hook `useOperationalProjects`. La query usa un **FK hint explícito** para obtener el owner:

```typescript
owner:profiles!operational_projects_owner_user_id_fkey(id, full_name)
```

Aunque la FK existe, cuando PostgREST intenta resolver esta relación junto con otras (client, contract, budget) en una sola query, puede haber problemas de:
1. **Timeouts silenciosos** en queries complejas
2. **Errores en la resolución de FK hints** que no se propagan correctamente
3. **Condiciones de carrera** donde la query se ejecuta antes de que el hook esté completamente estabilizado

### Solución: Simplificar la Query y Agregar Manejo de Errores

#### Cambio 1: Simplificar FK hints en `useOperationalProjects`
**Archivo**: `src/hooks/useOperationalProjects.tsx`

Eliminar los FK hints explícitos y dejar que PostgREST infiera las relaciones:

**Antes (líneas 54-62)**:
```typescript
let query = supabase
  .from('operational_projects')
  .select(`
    *,
    client:clients(id, name, code, hub_client_url),
    contract:contracts(id, title),
    budget:budgets(id, title),
    owner:profiles!operational_projects_owner_user_id_fkey(id, full_name)
  `)
```

**Después**:
```typescript
let query = supabase
  .from('operational_projects')
  .select(`
    id,
    name,
    description,
    status,
    deadline,
    drive_folder_url,
    client_id,
    contract_id,
    budget_id,
    owner_user_id,
    created_at,
    created_by,
    client:clients(id, name, code, hub_client_url),
    contract:contracts(id, title),
    budget:budgets(id, title),
    owner:profiles(id, full_name)
  `)
```

Cambios clave:
- Usar campos explícitos en vez de `*` (más predecible)
- Quitar `!operational_projects_owner_user_id_fkey` - PostgREST puede inferirlo
- Simplificar la query para reducir fallos

#### Cambio 2: Agregar logging y manejo de error explícito
**Archivo**: `src/hooks/useOperationalProjects.tsx`

Agregar console.log para debugging y asegurar que los errores se capturen:

```typescript
const { data, error } = await query;

if (error) {
  console.error('Error fetching operational projects:', error);
  throw error;
}

console.log('Operational projects fetched:', data?.length || 0, 'projects');
return data || [];
```

#### Cambio 3: Asegurar que el hook espera a que todo esté listo
**Archivo**: `src/pages/operations/OperationalProjects.tsx`

Agregar condición `enabled` al hook para evitar queries prematuras:

El problema es que `useOperationalProjects` no tiene una condición `enabled`. Cuando `assignedLoading` es true, la query ya se está ejecutando pero con valores potencialmente inestables.

```typescript
const { data: projects, isLoading, error } = useOperationalProjects({
  clientId: clientFilter === 'all' ? undefined : clientFilter,
  status: statusFilter === 'all' ? undefined : statusFilter,
  searchTerm: searchTerm || undefined,
  assignedClientIds: needsFiltering ? assignedClientIds : undefined,
  needsFiltering,
  enabled: !assignedLoading,  // <-- Nueva prop
});
```

Y en el hook, agregar:
```typescript
enabled: filters?.enabled !== false,
```

#### Cambio 4: Mostrar errores en la UI de Tarjetas
**Archivo**: `src/pages/operations/OperationalProjects.tsx`

Similar a lo que hicimos para Seguimiento, mostrar errores explícitamente:

```typescript
const { data: projects, isLoading, error } = useOperationalProjects({...});

// En el TabsContent de cards:
{error ? (
  <div className="text-center py-12">
    <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
    <h3 className="text-lg font-medium mb-2">Error al cargar proyectos</h3>
    <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
  </div>
) : isLoading ? (
  // skeletons...
) : // resto...
}
```

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useOperationalProjects.tsx` | Simplificar query, agregar logging, agregar `enabled` |
| `src/pages/operations/OperationalProjects.tsx` | Pasar `enabled`, mostrar errores |

### Verificación
1. Navegar a `/proyectos-operativos` como admin
2. Verificar que los 11 proyectos aparecen en tarjetas
3. Verificar que el panel de debug ya no dice "UI vacía"
4. Verificar consola del navegador para logs de "Operational projects fetched: 11 projects"

### Riesgo
- Bajo: solo simplificamos la query y agregamos manejo de errores
- Los datos y permisos ya funcionan (confirmado por el panel de debug)

