
# Plan: Añadir Estado "Liquidado" al Filtro de Requests

## Resumen
Añadir una opcion de filtro "Liquidado" en el selector de estados de la pagina de Requests, que muestre aquellos requests que ya han sido añadidos a una liquidacion (tienen `liquidation_id` asignado).

---

## Analisis

El estado "Liquidado" no es un estado real en el enum `financial_request_status` de la base de datos, sino una condicion derivada:
- **Request liquidado** = request con `liquidation_id IS NOT NULL`

Los estados actuales del enum son:
- draft, pending_specialist, pending_approval, in_progress, pending_review, completed, cancelled

---

## Cambios a realizar

### 1. Actualizar hook useRequestFilters

**Archivo:** `src/hooks/useRequestFilters.tsx`

Añadir soporte para el valor especial `liquidated` en el filtro de status:

```typescript
export interface RequestFilters {
  searchTerm: string;
  status: string | null; // Incluye 'liquidated' como valor especial
  clientId: string | null;
  specialistId: string | null;
  budgetId: string | null;
}
```

---

### 2. Actualizar la consulta en Solicitudes.tsx

**Archivo:** `src/pages/Solicitudes.tsx`

Modificar la query para manejar el caso especial de `liquidated`:

```typescript
// Si el filtro es 'liquidated', no lo añadimos a queryFilters
// sino que lo manejamos con .not('liquidation_id', 'is', null)
if (filters.status === 'liquidated') {
  query = query.not('liquidation_id', 'is', null);
} else if (filters.status) {
  queryFilters.status = filters.status;
}
```

---

### 3. Añadir opcion al Select de estados

**Archivo:** `src/pages/Solicitudes.tsx`

Añadir la opcion "Liquidado" al dropdown de estados:

```tsx
<SelectItem value="liquidated">Liquidado</SelectItem>
```

---

### 4. Actualizar utilidades de request (opcional)

**Archivo:** `src/lib/request-utils.ts`

Añadir soporte para mostrar el badge "Liquidado" si se desea usarlo en otras partes:

```typescript
// Para estados virtuales/derivados
export const getVirtualRequestStatusColor = (status: string): string => {
  if (status === 'liquidated') return 'bg-teal-500 text-white';
  return getFinancialRequestStatusColor(status as FinancialRequestStatus);
};

export const getVirtualRequestStatusLabel = (status: string): string => {
  if (status === 'liquidated') return 'Liquidado';
  return getFinancialRequestStatusLabel(status as FinancialRequestStatus);
};
```

---

## Resultado esperado

El dropdown de estados mostrara:
- Todos los estados
- Borrador
- Pend. Especialista
- Pend. Aprobacion
- En Progreso
- Pend. Revision
- Completado
- Cancelado
- **Liquidado** (nuevo)

Al seleccionar "Liquidado", se mostraran solo los requests que tienen una liquidacion asociada.

---

## Seccion tecnica

### Logica de filtrado en la query

```typescript
// En Solicitudes.tsx, dentro de la queryFn
const queryFilters: Record<string, string> = {};

// Status filter - handle 'liquidated' specially
if (filters.status && filters.status !== 'liquidated') {
  queryFilters.status = filters.status;
}
if (filters.clientId) queryFilters.client_id = filters.clientId;
if (filters.specialistId) queryFilters.specialist_id = filters.specialistId;
if (filters.budgetId) queryFilters.budget_id = filters.budgetId;

let query = supabase
  .from('financial_requests')
  .select(`...`)
  .match(queryFilters)
  .order('created_at', { ascending: false });

// Apply liquidated filter if selected
if (filters.status === 'liquidated') {
  query = query.not('liquidation_id', 'is', null);
}
```

### Orden visual sugerido en el dropdown

Ordenar de forma logica: flujo normal primero, luego estados finales:
1. Borrador
2. Pend. Especialista  
3. Pend. Aprobacion
4. En Progreso
5. Pend. Revision
6. Completado
7. Liquidado (despues de completado, ya que es el paso posterior)
8. Cancelado
