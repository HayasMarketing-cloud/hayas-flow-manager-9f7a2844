
## Plan: Corregir columna de horas/cantidad en todas las liquidaciones

### Problema

La columna "Cantidad" en las liquidaciones siempre muestra "1" porque:

1. El campo `quantity` de `liquidation_items` se hardcodea a `1` en todos los lugares donde se crean items
2. El valor real de horas está en `financial_requests.hours` pero no se está obteniendo correctamente en todas las consultas

### Solución

Actualizar la lógica para mostrar `financial_request.hours` cuando existe (solicitudes por horas), o `financial_request.quantity` cuando es coste fijo, y solo usar `liquidation_item.quantity` como fallback.

---

### Cambios a realizar

#### 1. Detalle de liquidación (`src/pages/LiquidacionDetalle.tsx`)

**Ya parcheado** en la consulta para traer `hours`, pero falta traer también `quantity` y `cost_type` del financial_request para determinar qué mostrar:

- Actualizar el query para incluir `hours`, `quantity`, `cost_type` del `financial_request`
- Actualizar la lógica de la celda:
  ```typescript
  // Si es hourly, mostrar hours; si es fixed, mostrar quantity del request
  const displayQuantity = item.financial_request?.cost_type === 'hourly'
    ? item.financial_request?.hours
    : item.financial_request?.quantity ?? item.quantity;
  ```

#### 2. Generador de PDF (`src/utils/pdf/liquidationPDFGenerator.ts`)

Actualizar las dos funciones de generación para:
- Obtener `hours`, `quantity` y `cost_type` del `financial_request`
- Mostrar el valor correcto en la columna "Cantidad" de la tabla

Cambios en ambas funciones (`generateLiquidationPDF` y `generateLiquidationPDFBase64`):
```typescript
// Líneas 109 y 337 aproximadamente
const displayQuantity = item.financial_request?.cost_type === 'hourly'
  ? (item.financial_request?.hours || item.quantity || 1)
  : (item.financial_request?.quantity || item.quantity || 1);

tableData.push([
  description,
  displayQuantity.toString(),
  // ...
]);
```

#### 3. Edge Function `get-liquidation-items` (`supabase/functions/get-liquidation-items/index.ts`)

Actualizar el query para incluir los campos necesarios:
```typescript
financial_request:financial_requests(
  id,
  title,
  hours,
  quantity,
  cost_type,
  client:clients(name)
)
```

#### 4. Página de detalle - sección "Trabajos pendientes" (líneas 46-65 de `LiquidacionDetalle.tsx`)

En la función `addSingleRequest` que añade items desde "Trabajos pendientes", también necesita propagar las horas/cantidad correctas al crear el `liquidation_item`:

No cambiaremos el valor guardado en `quantity` del `liquidation_item` (eso requeriría más cambios), pero nos aseguraremos de que la UI siempre lea del `financial_request`.

---

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/LiquidacionDetalle.tsx` | Query: añadir `quantity`, `cost_type` al select de `financial_request`. UI: lógica condicional para mostrar horas vs cantidad |
| `src/utils/pdf/liquidationPDFGenerator.ts` | Ambas funciones: usar `hours`/`quantity` del financial_request según `cost_type` |
| `supabase/functions/get-liquidation-items/index.ts` | Query: añadir `hours`, `quantity`, `cost_type` al select |

---

### Notas técnicas

- El campo `liquidation_items.quantity` seguirá siendo `1` (representa "1 solicitud incluida")
- La UI mostrará las horas/cantidad reales leyendo del `financial_request` vinculado
- Para items manuales (sin `financial_request_id`), se seguirá mostrando `item.quantity`
- Esto es consistente con cómo funciona el sistema: la liquidación agrupa solicitudes, y cada solicitud tiene sus propios datos de horas/cantidad
