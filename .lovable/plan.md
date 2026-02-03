
## Plan: Corregir la Vista de Seguimiento que Muestra "No hay proyectos"

### Diagnóstico del Problema

He identificado la causa raíz del problema:

**Datos en la base de datos:**
- 11 proyectos operativos
- 76 milestones/solicitudes operativas

**El problema está en el hook `useProjectMilestones.tsx`:**

En la línea 58-61, existe esta condición:
```typescript
if (needsFiltering && assignedClientIds.length === 0) {
  return [];
}
```

Esta condición retorna un array vacío cuando:
1. `needsFiltering` es `true` (usuario es AM/PM sin roles elevados)
2. `assignedClientIds` está vacío

**Sin embargo**, para usuarios admin/finanzas, aunque `needsFiltering` debería ser `false`, hay un problema de timing:

1. El hook `useUserRole` carga los roles de forma asíncrona
2. Durante la carga inicial, `shouldFilterByAssignment()` puede devolver un valor incorrecto
3. `useAssignedClients` recibe `needsFiltering` mientras los roles aún se están cargando
4. Esto causa que `needsFiltering = true` temporalmente incluso para admins
5. Como la query de clientes asignados no se ejecuta para admins, `assignedClientIds` permanece vacío
6. La condición `needsFiltering && assignedClientIds.length === 0` se cumple y retorna array vacío

---

### Solución Propuesta

Modificar el hook `useProjectMilestones.tsx` para:

1. **Mejorar la condición de retorno vacío**: Añadir verificación explícita de que `assignedLoading` ya terminó
2. **Añadir logs de debug** para verificar el flujo (temporalmente)
3. **Simplificar la lógica**: Si `needsFiltering = false`, NO aplicar ningún filtro de cliente

#### Cambio en `useProjectMilestones.tsx`:

```typescript
// Líneas 55-61 actuales:
queryFn: async (): Promise<MilestoneWithDetails[]> => {
  if (needsFiltering && assignedClientIds.length === 0) {
    return [];
  }
  // ... resto del código
}

// Cambiar a:
queryFn: async (): Promise<MilestoneWithDetails[]> => {
  // Solo retornar vacío si:
  // 1. El usuario NECESITA filtrado (AM/PM sin acceso elevado)
  // 2. Y NO tiene clientes asignados
  // 3. Y ya terminó de cargar (no estamos esperando)
  // Para admin/finanzas, needsFiltering será false, así que nunca entra aquí
  if (needsFiltering && assignedClientIds.length === 0) {
    console.log('[useProjectMilestones] Empty: needsFiltering=true, no assigned clients');
    return [];
  }

  console.log('[useProjectMilestones] Fetching:', {
    needsFiltering,
    assignedClientIds: assignedClientIds.length,
    shouldFilterBySpecialist
  });
  
  // ... resto del código sin cambios
}
```

Además, añadir una verificación adicional en el `enabled`:

```typescript
// Cambiar de:
enabled: !assignedLoading && !specialistLoading,

// A:
enabled: !assignedLoading && !specialistLoading && 
         // Para AM/PM, esperar a que tengan clientes o confirmar que no tienen
         (!needsFiltering || assignedClientIds.length > 0 || !assignedLoading),
```

**Pero hay un problema más profundo**: El valor de `needsFiltering` viene de `useAssignedClients`, que a su vez lo obtiene de `useUserRole`. Si `useUserRole` aún está cargando, `shouldFilterByAssignment()` puede devolver un valor incorrecto.

---

### Solución Completa

#### 1. Modificar `useAssignedClients.tsx`

El hook debe esperar a que los roles terminen de cargar antes de determinar `needsFiltering`:

```typescript
// Cambiar línea 14 de:
const needsFiltering = shouldFilterByAssignment();

// A:
// Solo determinar needsFiltering cuando los roles ya están cargados
const needsFiltering = !rolesLoading && shouldFilterByAssignment();
```

Esto asegura que mientras los roles se están cargando, `needsFiltering = false` y no se aplica el filtro de "array vacío".

#### 2. Modificar `useProjectMilestones.tsx`

Simplificar la lógica para ser más robusta:

```typescript
export const useProjectMilestones = (filters?: MilestoneFilters) => {
  const { assignedClientIds, isLoading: assignedLoading, needsFiltering } = useAssignedClients();
  const { specialistId: currentSpecialistId, isLoading: specialistLoading } = useCurrentSpecialist();
  const { isSpecialist, isAdmin, canAccessFinance } = useUserRole();
  
  const shouldFilterBySpecialist = isSpecialist() && !isAdmin() && !canAccessFinance() && currentSpecialistId;

  return useQuery({
    queryKey: ['project-milestones', filters, assignedClientIds, currentSpecialistId, needsFiltering, shouldFilterBySpecialist],
    queryFn: async (): Promise<MilestoneWithDetails[]> => {
      // Para usuarios que necesitan filtrado (AM/PM sin roles elevados)
      // y no tienen clientes asignados, retornar vacío
      if (needsFiltering && assignedClientIds.length === 0) {
        return [];
      }

      let query = supabase
        .from('operational_requests')
        .select(`...`)
        .order('deadline', { ascending: true, nullsFirst: false });

      // Aplicar filtro de cliente asignado SOLO si needsFiltering es true
      if (needsFiltering && assignedClientIds.length > 0) {
        query = query.in('client_id', assignedClientIds);
      }

      // ... resto del código
    },
    enabled: !assignedLoading && !specialistLoading,
  });
};
```

---

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useAssignedClients.tsx` | Cambiar línea 14 para que `needsFiltering` sea `false` mientras se cargan los roles |
| `src/hooks/useProjectMilestones.tsx` | Añadir logs de debug y simplificar lógica de filtrado |

---

### Verificación

Después de los cambios:

1. Usuario admin/finanzas:
   - `rolesLoading = false` (roles cargados)
   - `shouldFilterByAssignment() = false` (tiene acceso elevado)
   - `needsFiltering = false`
   - La query se ejecuta sin filtro de cliente → ve todos los proyectos

2. Usuario AM/PM sin acceso elevado:
   - `rolesLoading = false` (roles cargados)
   - `shouldFilterByAssignment() = true` (necesita filtrado)
   - `needsFiltering = true`
   - La query de clientes asignados se ejecuta
   - Si tiene clientes asignados → ve sus proyectos
   - Si no tiene clientes asignados → ve array vacío (correcto)

3. Durante la carga inicial (cualquier usuario):
   - `rolesLoading = true`
   - `needsFiltering = false` (forzado durante carga)
   - `assignedLoading = true`
   - Query deshabilitada hasta que termine la carga
   - Una vez cargado, se ejecuta con el valor correcto de `needsFiltering`
