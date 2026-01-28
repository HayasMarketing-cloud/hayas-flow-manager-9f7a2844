
# Plan: Agregar filtro de Contratos en Solicitudes

## Resumen
Agregar un selector de contratos en los filtros de la pagina de Solicitudes, similar al filtro de presupuestos existente.

## Cambios a Realizar

### 1. Modificar el hook de filtros (`src/hooks/useRequestFilters.tsx`)

Agregar el campo `contractId` al interface y a toda la logica del hook:

| Cambio | Detalle |
|--------|---------|
| Interface | Agregar `contractId: string \| null` |
| Estado inicial | Leer `contractId` de URL params |
| syncToUrl | Sincronizar `contractId` a la URL |
| updateFilter | Resetear `contractId` cuando cambia el cliente |
| resetFilters | Incluir `contractId: null` |

### 2. Modificar la pagina de Solicitudes (`src/pages/Solicitudes.tsx`)

**a) Agregar query para cargar contratos:**
```typescript
const { data: contracts } = useQuery({
  queryKey: ['contracts-filter', filters.clientId, filters.contractId],
  queryFn: async () => {
    if (filters.contractId && !filters.clientId) {
      // Cargar contrato especifico si viene por URL
      const { data, error } = await supabase
        .from('contracts')
        .select('id, title, code, client_id')
        .eq('id', filters.contractId);
      if (error) throw error;
      return data;
    }
    
    if (filters.clientId) {
      // Cargar contratos del cliente seleccionado
      const { data, error } = await supabase
        .from('contracts')
        .select('id, title, code')
        .eq('client_id', filters.clientId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    
    return [];
  },
  enabled: !!filters.clientId || !!filters.contractId,
});
```

**b) Agregar filtro de contrato en la query principal:**
```typescript
if (filters.contractId) queryFilters.contract_id = filters.contractId;
```

**c) Agregar selector UI despues del selector de presupuestos:**
```tsx
{(filters.clientId || filters.contractId) && (
  <Select
    value={filters.contractId || 'all'}
    onValueChange={(value) =>
      updateFilter('contractId', value === 'all' ? null : value)
    }
  >
    <SelectTrigger className="w-[250px]">
      <SelectValue placeholder="Todos los contratos" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos los contratos</SelectItem>
      {contracts?.map((contract) => (
        <SelectItem key={contract.id} value={contract.id}>
          {contract.code} - {contract.title}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)}
```

**d) Actualizar condicion del boton "Limpiar filtros":**
Agregar `filters.contractId` a la condicion.

## Archivos a Modificar

| Archivo | Tipo de Cambio |
|---------|----------------|
| `src/hooks/useRequestFilters.tsx` | Agregar campo contractId |
| `src/pages/Solicitudes.tsx` | Agregar query de contratos, filtro en query principal, y selector UI |

## Comportamiento Esperado

- El filtro de contratos aparece cuando se selecciona un cliente O cuando hay un contractId en la URL
- Al cambiar de cliente, se resetea el filtro de contrato (igual que presupuesto)
- El filtro persiste en la URL como `contractId=xxx`
- Se puede navegar desde Contratos a Solicitudes con el filtro preseleccionado
