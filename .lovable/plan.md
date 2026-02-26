

## Añadir columna "Horas" del especialista en todas las vistas de solicitudes

### Dato a mostrar

El campo `hours` de la tabla `financial_requests` contiene las horas (o fracción) del especialista asignado a cada solicitud. Este dato ya se carga en las queries existentes y está disponible como `request.hours`.

### Formato de visualización

- Si hay horas: mostrar con formato `X.XXh` (ej: `2.5h`, `0.25h`, `8h`)
- Si no hay horas o es 0: mostrar `-`
- Icono: `Clock` de lucide-react

### Cambios necesarios

#### 1. Vista tabla (`src/components/requests/RequestTableView.tsx`)
- Añadir columna `<TableHead>Horas</TableHead>` después de "Especialista"
- Añadir celda con el valor `request.hours` formateado
- Actualizar `colSpan` de la fila vacía de 14 a 15

#### 2. Vista tarjeta (`src/components/requests/RequestCard.tsx`)
- Añadir línea con icono `Clock` y las horas, junto al especialista o después del deadline
- Importar `Clock` de lucide-react

#### 3. Exportador CSV (`src/utils/excel/requestsExporter.ts`)
- Añadir columna "Horas" en los headers
- Añadir `request.hours || '-'` en las filas
- Añadir total de horas en la fila de totales

### Detalle técnico

No requiere cambios en queries ni en la base de datos. El campo `hours` ya existe en `financial_requests` y se devuelve en todas las consultas de solicitudes.

