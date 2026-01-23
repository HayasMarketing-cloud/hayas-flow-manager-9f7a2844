

# Plan: Corregir Visibilidad de Tareas para Admin

## Problema Principal
Las funciones de rol (`isAdmin`, `isAccountManager`, `isProjectManager`) en `useUserRole.ts` retornan funciones, pero en `useAllTasks.tsx` se usan como si fueran valores booleanos. Esto causa que el admin no vea todas las tareas.

---

## Cambios a Implementar

### 1. Modificar `useAllTasks.tsx` - Ejecutar las funciones de rol correctamente

**Archivo:** `src/hooks/useAllTasks.tsx`

Cambiar de:
```typescript
const { isAdmin, isAccountManager, isProjectManager, loading: rolesLoading } = useUserRole();
```

A:
```typescript
const { isAdmin, isAccountManager, isProjectManager, loading: rolesLoading } = useUserRole();

// Ejecutar las funciones para obtener booleanos
const isAdminUser = isAdmin();
const isAMUser = isAccountManager();
const isPMUser = isProjectManager();
```

Y actualizar todas las referencias:
- Línea 106: `enabled: !!user?.id && (isAMUser || isPMUser) && !isAdminUser`
- Línea 111: Actualizar queryKey
- Línea 136: `if (!isAdminUser) {`
- Línea 137: `if (isAMUser || isPMUser) {`
- Línea 179: `if (!isAdminUser && (isAMUser || isPMUser) && ...)`
- Línea 217: Actualizar condición de enabled

### 2. Modificar `useAllTasks.tsx` - Permitir ver proyectos finalizados

**Opción A: Mostrar todas las tareas (incluyendo completadas)**

Eliminar el filtro:
```typescript
// ANTES
.neq('status', 'completed')

// DESPUÉS - Remover esta línea para ver todas
```

**Opción B: Añadir filtro de estado configurable**

Añadir un nuevo filtro `showCompleted` en los filtros:
```typescript
// En TaskFilters
showCompleted: boolean;

// En la query
if (!filters.showCompleted) {
  query = query.neq('status', 'completed');
}
```

**Recomendación**: Implementar Opción B para dar flexibilidad - por defecto ocultar completadas pero permitir verlas.

### 3. Modificar `useTaskFilters.tsx` - Añadir filtro "Mostrar completadas"

Añadir nuevo estado:
```typescript
interface TaskFilters {
  // ... filtros existentes
  showCompleted: boolean;
}

// Estado inicial
showCompleted: false,
```

### 4. Modificar `TaskFiltersBar.tsx` - Añadir toggle para completadas

Añadir un checkbox o switch:
```tsx
<div className="flex items-center gap-2">
  <Checkbox 
    checked={filters.showCompleted} 
    onCheckedChange={(checked) => updateFilter('showCompleted', !!checked)} 
  />
  <Label>Mostrar completadas</Label>
</div>
```

### 5. Corregir MyTasks.tsx - Ejecutar funciones de rol

```typescript
// ANTES
if (isAdmin) return 'Vista de todas las tareas...';

// DESPUÉS
if (isAdmin()) return 'Vista de todas las tareas...';
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useAllTasks.tsx` | Ejecutar funciones de rol correctamente; añadir lógica para filtro showCompleted |
| `src/hooks/useTaskFilters.tsx` | Añadir estado `showCompleted` |
| `src/components/tasks/TaskFiltersBar.tsx` | Añadir checkbox "Mostrar completadas" |
| `src/pages/operations/MyTasks.tsx` | Ejecutar funciones de rol en getDescription() |

---

## Resultado Esperado

1. **Admin** verá todos los proyectos y tareas del sistema
2. **AM/PM** verán las tareas de sus clientes asignados
3. **Especialista** verá solo sus tareas asignadas
4. Nuevo checkbox **"Mostrar completadas"** permite ver/ocultar tareas finalizadas
5. Por defecto, las tareas completadas siguen ocultas para mantener la vista limpia

