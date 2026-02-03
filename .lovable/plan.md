

## Objetivo
Corregir los filtros de la pestaña "Seguimiento" en Proyectos Operativos y añadir filtros de Presupuesto y Contrato cuando se seleccione un cliente.

---

## Diagnóstico del problema

### Problema 1: Búsqueda en relaciones anidadas
En el hook `useProjectMilestones.tsx`, la línea 109 usa:
```typescript
query.or(`name.ilike.%${filters.searchTerm}%,operational_project.name.ilike.%${filters.searchTerm}%`)
```

Esto es **inválido** en Supabase/PostgREST - no se puede buscar en relaciones anidadas con `ilike`. La búsqueda solo funciona en columnas directas de la tabla.

### Problema 2: Faltan filtros de presupuesto y contrato
La UI de la pestaña "Seguimiento" no incluye selectores para filtrar por presupuesto o contrato cuando se selecciona un cliente.

---

## Cambios a realizar

### 1. Corregir búsqueda en `src/hooks/useProjectMilestones.tsx`

**Cambio en líneas 108-110:**
```typescript
// Antes (INCORRECTO)
if (filters?.searchTerm) {
  query = query.or(`name.ilike.%${filters.searchTerm}%,operational_project.name.ilike.%${filters.searchTerm}%`);
}

// Después (CORRECTO) - Solo buscar en columnas directas
if (filters?.searchTerm) {
  query = query.ilike('name', `%${filters.searchTerm}%`);
}
```

La búsqueda en el nombre del proyecto se realizará mediante post-filtrado junto con los otros filtros de relaciones anidadas (contrato/presupuesto).

**Añadir post-filtrado por nombre de proyecto (líneas ~122-131):**
```typescript
// Añadir al post-filtrado existente
if (filters?.searchTerm) {
  const term = filters.searchTerm.toLowerCase();
  results = results.filter(m => 
    m.name.toLowerCase().includes(term) || 
    m.operational_project?.name?.toLowerCase().includes(term)
  );
}
```

### 2. Añadir estados para filtros en `src/pages/operations/OperationalProjects.tsx`

**Nuevos estados (después de línea 58):**
```typescript
const [budgetFilter, setBudgetFilter] = useState<string>('all');
const [contractFilter, setContractFilter] = useState<string>('all');
```

**Nuevas queries para presupuestos y contratos del cliente seleccionado:**
```typescript
// Presupuestos del cliente seleccionado
const { data: clientBudgets } = useQuery({
  queryKey: ['client-budgets-filter', clientFilter],
  queryFn: async () => {
    if (clientFilter === 'all') return [];
    const { data, error } = await supabase
      .from('budgets')
      .select('id, title, code')
      .eq('client_id', clientFilter)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  enabled: clientFilter !== 'all',
});

// Contratos del cliente seleccionado  
const { data: clientContracts } = useQuery({
  queryKey: ['client-contracts-filter', clientFilter],
  queryFn: async () => {
    if (clientFilter === 'all') return [];
    const { data, error } = await supabase
      .from('contracts')
      .select('id, title, code')
      .eq('client_id', clientFilter)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  enabled: clientFilter !== 'all',
});
```

**Limpiar filtros al cambiar cliente:**
```typescript
// Handler para cambio de cliente
const handleClientChange = (value: string) => {
  setClientFilter(value);
  setBudgetFilter('all');
  setContractFilter('all');
};
```

### 3. Actualizar UI de filtros

**Añadir filtros condicionales en el grid (dentro del `<Card>` de filtros):**

Cambiar el grid a 5 columnas cuando hay filtros adicionales y añadir:
```tsx
{activeTab === 'tracking' && clientFilter !== 'all' && (
  <>
    <Select value={budgetFilter} onValueChange={setBudgetFilter}>
      <SelectTrigger>
        <SelectValue placeholder="Todos los presupuestos" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos los presupuestos</SelectItem>
        {clientBudgets?.map((budget) => (
          <SelectItem key={budget.id} value={budget.id}>
            {budget.code} - {budget.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>

    <Select value={contractFilter} onValueChange={setContractFilter}>
      <SelectTrigger>
        <SelectValue placeholder="Todos los contratos" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos los contratos</SelectItem>
        {clientContracts?.map((contract) => (
          <SelectItem key={contract.id} value={contract.id}>
            {contract.code} - {contract.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </>
)}
```

### 4. Pasar filtros al hook `useProjectMilestones`

**Actualizar llamada al hook (línea ~139-144):**
```typescript
const { data: milestones, isLoading: milestonesLoading } = useProjectMilestones({
  clientId: clientFilter === 'all' ? undefined : clientFilter,
  specialistId: specialistFilter === 'all' ? undefined : specialistFilter,
  status: statusFilter === 'all' ? undefined : statusFilter,
  budgetId: budgetFilter === 'all' ? undefined : budgetFilter,
  contractId: contractFilter === 'all' ? undefined : contractFilter,
  searchTerm: searchTerm || undefined,
});
```

### 5. Actualizar `hasActiveFilters`

**Actualizar cálculo (línea ~136):**
```typescript
const hasActiveFilters = !!(
  searchTerm || 
  clientFilter !== 'all' || 
  statusFilter !== 'all' || 
  specialistFilter !== 'all' ||
  budgetFilter !== 'all' ||
  contractFilter !== 'all'
);
```

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useProjectMilestones.tsx` | Corregir búsqueda y añadir post-filtrado por nombre de proyecto |
| `src/pages/operations/OperationalProjects.tsx` | Añadir estados, queries y UI para filtros de presupuesto y contrato |

---

## Resultado esperado

1. Al seleccionar un cliente en la pestaña "Seguimiento", aparecen dos filtros adicionales: **Presupuesto** y **Contrato**
2. La búsqueda por texto funciona correctamente (busca en nombre de milestone y nombre de proyecto)
3. Al cambiar de cliente, los filtros de presupuesto y contrato se limpian automáticamente
4. Todos los filtros funcionan combinados para refinar la vista de milestones

