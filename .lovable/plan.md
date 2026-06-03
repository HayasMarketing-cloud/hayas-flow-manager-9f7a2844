# Columna unificada "Horas / Coste" en Requests

## Objetivo
Mostrar siempre el dato del especialista en cada request: horas (cuando es por horas) o coste fijo (cuando no hay horas). Aplica a tabla, cards y export CSV.

## Lógica de detección
- **Por horas**: `request.hours > 0` → mostrar `{hours}h` con icono Clock.
- **Coste fijo**: `(!hours || hours === 0) && request.cost > 0` → mostrar `{cost} €` formateado con icono Euro.
- **Sin dato**: `-`.

El valor del coste fijo es `request.cost` (coste a especialista), no `unit_price`.

## Cambios

### 1. `src/components/requests/RequestTableView.tsx`
- Renombrar header `Horas` → `Horas / Coste`.
- En la celda: si hay horas, render actual; si no y hay cost, render `formatCurrency(cost)` con icono Euro de lucide-react; si no, `-`.
- Tooltip opcional con el modo ("Coste fijo a especialista" / "Horas").

### 2. `src/components/requests/RequestCard.tsx`
- Donde hoy se muestran las horas, aplicar misma lógica (horas o coste fijo).

### 3. `src/utils/excel/requestsExporter.ts`
- Renombrar columna `Horas` → `Horas / Coste`.
- Valor: `{hours}h` si por horas, `formatCurrency(cost)` si fijo, `-` si nada.
- Mantener el resto de columnas tal cual (Coste total ya existe aparte como "Coste").

## Fuera de alcance
- No se modifican formularios, filtros, ni schema.
- No se toca PDF de Asendia ni otros exports.
- No se cambia la columna "Coste" (coste total) que ya existe en el export.
