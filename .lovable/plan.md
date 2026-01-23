
# Plan: Filtrar Facturas por Clientes Asignados para Account Manager

## Situacion Actual

La seccion de Facturas esta accesible para Account Managers (AM), pero actualmente muestra **todas las facturas de todos los clientes** en lugar de solo las facturas de los clientes a los que el AM esta asignado.

Esto es inconsistente con las otras secciones (Clientes, Contratos, Presupuestos, Proyectos) donde ya se implemento el filtrado por asignacion.

## Cambios Propuestos

### Archivo: `src/pages/Facturas.tsx`

1. **Importar hooks necesarios**:
   - `useAssignedClients` para obtener los IDs de clientes asignados
   - Funciones adicionales de `useUserRole` (`shouldFilterByAssignment`, `isAccountManager`)

2. **Filtrar consulta de clientes**:
   - Para el dropdown de filtro de clientes, mostrar solo clientes asignados si `needsFiltering` es true

3. **Filtrar consulta de facturas**:
   - Agregar condicion `.in('client_id', assignedClientIds)` cuando `needsFiltering` sea true
   - Mantener la consulta sin filtro para admin/finanzas

4. **Actualizar query keys**:
   - Incluir `assignedClientIds` y `needsFiltering` en las claves de cache

## Flujo de Datos

```text
Account Manager accede a /facturas
           │
           ▼
┌─────────────────────────┐
│ shouldFilterByAssignment│ → true (solo AM sin admin/finanzas)
└─────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│ useAssignedClients()    │ → [client_id_1, client_id_2, ...]
└─────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│ Query facturas con      │
│ .in('client_id', [...]) │
└─────────────────────────┘
           │
           ▼
    Solo facturas de
    clientes asignados
```

## Detalles Tecnicos

### Codigo a agregar en imports:

```typescript
import { useAssignedClients } from '@/hooks/useAssignedClients';
```

### Codigo a agregar despues de useUserRole:

```typescript
const { shouldFilterByAssignment, isAccountManager } = useUserRole();
const { assignedClientIds, isLoading: assignedClientsLoading, needsFiltering } = useAssignedClients();
```

### Modificacion en query de clientes (dropdown):

```typescript
const { data: clients } = useQuery({
  queryKey: ['clients-for-invoices', needsFiltering, assignedClientIds],
  queryFn: async () => {
    let query = supabase
      .from('clients')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    
    // Filtrar por clientes asignados si es AM
    if (needsFiltering && assignedClientIds.length > 0) {
      query = query.in('id', assignedClientIds);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  enabled: !needsFiltering || assignedClientIds.length > 0,
});
```

### Modificacion en query de facturas:

```typescript
const { data: invoices, isLoading } = useQuery({
  queryKey: ['invoices', filters, needsFiltering, assignedClientIds],
  queryFn: async () => {
    // ... codigo existente ...
    
    // Agregar filtro por clientes asignados
    if (needsFiltering && assignedClientIds.length > 0) {
      query = query.in('client_id', assignedClientIds);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  enabled: !needsFiltering || assignedClientIds.length > 0,
});
```

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Facturas.tsx` | Agregar filtrado por clientes asignados para AM |

## Resultado Esperado

- **Admin/Finanzas**: Ven todas las facturas (sin cambios)
- **Account Manager**: Ve solo facturas de clientes donde es AM o PM en contratos/presupuestos
- **Project Manager**: No tiene acceso a Facturas (ya bloqueado en sidebar)
- **Especialista**: No tiene acceso a Facturas (ya bloqueado en sidebar)

## Consistencia con Otras Secciones

Este cambio alineara Facturas con el comportamiento ya implementado en:
- Clientes
- Contratos  
- Presupuestos
- Proyectos Operativos
