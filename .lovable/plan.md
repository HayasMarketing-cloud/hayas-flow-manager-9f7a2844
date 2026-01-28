
# Plan: Añadir Columna "Proyecto/Presupuesto" en Tablas de Liquidación

## Contexto

El usuario solicita añadir una columna que muestre el proyecto operacional o presupuesto asociado a cada request en:
1. **Tabla de trabajos incluidos** (liquidación sin equipo)
2. **Tablas de trabajos del líder y miembros** (liquidación con equipo)
3. **Tabla de trabajos pendientes para próxima liquidación**

## Estructura de Datos

Las `financial_requests` tienen:
- `budget_id` → relación directa con `budgets`
- Relación inversa con `operational_requests` via `financial_request_id` → `operational_projects`

## Diseño Visual

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Código    │ Descripción  │ Cliente   │ Proyecto/Presupuesto │ Cant │ Total    │
│ REQ-001   │ Diseño web   │ ACME      │ Proyecto Alpha       │ 1    │ 200,00 € │
│ REQ-002   │ SEO básico   │ Corp S.A  │ PRES-2026-001        │ 1    │ 150,00 € │
└────────────────────────────────────────────────────────────────────────────────┘
```

La columna mostrará:
- Si tiene proyecto operacional: nombre del proyecto (con link)
- Si no tiene proyecto pero tiene presupuesto: código del presupuesto (con link)
- Si no tiene ninguno: "-"

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/LiquidacionDetalle.tsx` | Actualizar query y añadir columna en las 3 tablas de items |
| `src/hooks/useUnliquidatedRequests.tsx` | Incluir budget y operational_project en la query |

## Implementación Detallada

### 1. Actualizar Query Principal en LiquidacionDetalle.tsx

**Líneas ~230-250:** Modificar la query de `liquidation_items` para incluir budget y operational_request:

```typescript
liquidation_items(
  id,
  description,
  quantity,
  unit_price,
  total,
  financial_request:financial_requests(
    id,
    code,
    title,
    hours,
    quantity,
    cost_type,
    budget_id,
    client:clients(id, name),
    budget:budgets(id, code, title),
    operational_request:operational_requests!financial_request_id(
      id,
      operational_project:operational_projects(id, name)
    )
  )
)
```

### 2. Crear Helper para Renderizar Proyecto/Presupuesto

Crear una función helper dentro del componente para renderizar la celda:

```typescript
const renderProjectOrBudget = (financialRequest: any) => {
  // Priorizar proyecto operacional
  const opRequest = financialRequest?.operational_request?.[0];
  if (opRequest?.operational_project) {
    return (
      <span 
        className="text-primary hover:underline cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/proyectos/${opRequest.operational_project.id}`);
        }}
      >
        {opRequest.operational_project.name}
      </span>
    );
  }
  
  // Fallback a presupuesto
  if (financialRequest?.budget) {
    return (
      <span 
        className="text-primary hover:underline cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/presupuestos/${financialRequest.budget.id}`);
        }}
      >
        {financialRequest.budget.code}
      </span>
    );
  }
  
  return '-';
};
```

### 3. Actualizar Tablas de Items Incluidos

**3.1 Tabla del Líder (líneas ~773-831):**

Añadir en TableHeader después de "Cliente":
```tsx
<TableHead>Proyecto/Presupuesto</TableHead>
```

Añadir en TableBody después de la celda de cliente:
```tsx
<TableCell onClick={(e) => e.stopPropagation()}>
  {renderProjectOrBudget(item.financial_request)}
</TableCell>
```

**3.2 Tabla de Miembros (líneas ~860-896):**

Mismos cambios que la tabla del líder.

**3.3 Tabla Sin Equipo (líneas ~931-989):**

Mismos cambios que las anteriores.

### 4. Actualizar useUnliquidatedRequests.tsx

**Modificar selectFields (línea ~12-18):**

```typescript
const selectFields = `
  *,
  client:clients(id, name, code),
  service:services(id, name),
  specialist:specialists(id, name),
  billed_invoice:invoices(id, code),
  budget:budgets(id, code, title),
  operational_request:operational_requests!financial_request_id(
    id,
    operational_project:operational_projects(id, name)
  )
`;
```

### 5. Actualizar PendingRequestsSection (líneas ~156-197)

Añadir en TableHeader:
```tsx
<TableHead>Proyecto/Pres.</TableHead>
```

Añadir en TableBody (después de Servicio, antes de Estado):
```tsx
<TableCell onClick={(e) => e.stopPropagation()}>
  {renderProjectOrBudgetPending(request)}
</TableCell>
```

Crear helper similar:
```typescript
const renderProjectOrBudgetPending = (request: any) => {
  const opRequest = request?.operational_request?.[0];
  if (opRequest?.operational_project) {
    return (
      <span 
        className="text-primary hover:underline cursor-pointer text-sm"
        onClick={(e) => {
          e.stopPropagation();
          window.open(`/proyectos/${opRequest.operational_project.id}`, '_blank');
        }}
      >
        {opRequest.operational_project.name?.substring(0, 15)}...
      </span>
    );
  }
  if (request?.budget) {
    return (
      <span 
        className="text-primary hover:underline cursor-pointer text-sm"
        onClick={(e) => {
          e.stopPropagation();
          window.open(`/presupuestos/${request.budget.id}`, '_blank');
        }}
      >
        {request.budget.code}
      </span>
    );
  }
  return '-';
};
```

## Resumen de Cambios

1. **Query principal**: Añadir `budget` y `operational_request` en la relación de `financial_request`
2. **useUnliquidatedRequests**: Incluir mismos campos
3. **4 tablas actualizadas**: Líder, miembros, sin equipo, y pendientes
4. **Navegación**: Click en proyecto/presupuesto abre detalle
5. **UX**: Click en la celda no dispara el click de la fila (stopPropagation)

## Comportamiento Esperado

- Si la request tiene proyecto operacional asociado: muestra el nombre del proyecto como link
- Si no tiene proyecto pero tiene presupuesto: muestra el código del presupuesto como link  
- Si no tiene ninguno: muestra "-"
- El click en el link navega al detalle correspondiente sin afectar otras acciones de la fila
