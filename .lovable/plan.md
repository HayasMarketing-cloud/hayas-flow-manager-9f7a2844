

# Plan: Preservar Filtros de Requests en URL

## Problema

Cuando el usuario aplica filtros en la página de Requests y navega a un detalle, al volver con el botón "atrás" los filtros se pierden. Esto ocurre porque:

1. Solo `budget_id` se persiste en la URL
2. Los demás filtros (`status`, `clientId`, `specialistId`, `year`, `month`) solo están en estado local (useState)
3. Al navegar de vuelta, el componente se re-monta con estado inicial vacío

## Solución

Persistir TODOS los filtros en los query parameters de la URL. Así cuando el usuario navegue de vuelta, los filtros se restaurarán automáticamente desde la URL.

## Diseño de URL

```
/solicitudes?status=pending_liquidation&clientId=xxx&specialistId=yyy&year=2025&month=12
```

## Archivo a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useRequestFilters.tsx` | Sincronizar todos los filtros con URL params |

## Implementación

### Actualizar useRequestFilters.tsx

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface RequestFilters {
  searchTerm: string;
  status: string | null;
  clientId: string | null;
  specialistId: string | null;
  budgetId: string | null;
  year: number | null;
  month: number | null;
}

export const useRequestFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize filters from URL params
  const [filters, setFilters] = useState<RequestFilters>(() => ({
    searchTerm: searchParams.get('search') || '',
    status: searchParams.get('status'),
    clientId: searchParams.get('clientId'),
    specialistId: searchParams.get('specialistId'),
    budgetId: searchParams.get('budget_id'),
    year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : null,
    month: searchParams.get('month') ? parseInt(searchParams.get('month')!) : null,
  }));

  // Sync filters TO URL whenever they change
  const syncToUrl = useCallback((newFilters: RequestFilters) => {
    const newParams = new URLSearchParams();
    
    if (newFilters.searchTerm) newParams.set('search', newFilters.searchTerm);
    if (newFilters.status) newParams.set('status', newFilters.status);
    if (newFilters.clientId) newParams.set('clientId', newFilters.clientId);
    if (newFilters.specialistId) newParams.set('specialistId', newFilters.specialistId);
    if (newFilters.budgetId) newParams.set('budget_id', newFilters.budgetId);
    if (newFilters.year) newParams.set('year', newFilters.year.toString());
    if (newFilters.month) newParams.set('month', newFilters.month.toString());
    
    setSearchParams(newParams, { replace: true });
  }, [setSearchParams]);

  const updateFilter = <K extends keyof RequestFilters>(
    key: K,
    value: RequestFilters[K]
  ) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      // Reset budget filter when client changes
      if (key === 'clientId') {
        newFilters.budgetId = null;
      }
      // Reset month if year is cleared
      if (key === 'year' && value === null) {
        newFilters.month = null;
      }
      
      // Sync to URL
      syncToUrl(newFilters);
      
      return newFilters;
    });
  };

  const resetFilters = () => {
    const emptyFilters: RequestFilters = {
      searchTerm: '',
      status: null,
      clientId: null,
      specialistId: null,
      budgetId: null,
      year: null,
      month: null,
    };
    setFilters(emptyFilters);
    setSearchParams({}, { replace: true });
  };

  return {
    filters,
    updateFilter,
    resetFilters,
  };
};
```

## Comportamiento Esperado

1. Usuario aplica filtros: `Pend. Liquidar`, `Iolanda Carbone`
2. URL se actualiza: `/solicitudes?status=pending_liquidation&specialistId=xxx`
3. Usuario hace click en un request → navega a `/solicitudes/abc123`
4. Usuario hace click en "← Atrás" (browser back o botón)
5. Vuelve a `/solicitudes?status=pending_liquidation&specialistId=xxx`
6. Hook lee filtros desde URL → misma vista filtrada

## Notas

- El término de búsqueda también se persiste (útil para búsquedas largas)
- Se usa `replace: true` para no llenar el historial con cada cambio de filtro
- El useEffect de sincronización desde URL se elimina (ya no es necesario, se lee en el useState inicial)

