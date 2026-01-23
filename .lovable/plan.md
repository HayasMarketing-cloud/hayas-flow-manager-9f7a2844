
# Plan: Eliminar información de costes y precios de la lista de requests

## Objetivo
Ocultar los datos financieros (coste de especialista y precio de venta) de las vistas de lista de solicitudes, tanto en la vista de tarjetas como en la vista de tabla, manteniendo esta información disponible en el detalle individual y en los formularios de alta/edición.

## Cambios a realizar

### 1. Modificar RequestCard.tsx
Eliminar la sección que muestra coste y venta (líneas 72-87):
- Icono Euro con el coste del especialista
- Icono TrendingUp con el precio de venta al cliente
- Las variables de cálculo `costAmount` y `saleAmount` también se eliminarán ya que no se usarán
- Se eliminarán los imports de `Euro` y `TrendingUp` que ya no serán necesarios

### 2. Modificar RequestTableView.tsx
Eliminar las columnas de coste y venta:
- Quitar las cabeceras "Coste (€)" y "Venta (€)" del header de la tabla
- Quitar las celdas que muestran `formatCurrency(costAmount)` y `formatCurrency(saleAmount)`
- Eliminar las variables de cálculo `costAmount`, `saleAmount`, `costHours` y `saleHours` del map de requests
- Ajustar el `colSpan` del mensaje de "No se encontraron solicitudes" de 14 a 12

### 3. Limpiar imports no utilizados
- En `RequestCard.tsx`: eliminar `Euro` y `TrendingUp` de los imports de lucide-react
- En `RequestTableView.tsx`: eliminar `formatCurrency` del import de request-utils

---

## Resumen de archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/requests/RequestCard.tsx` | Eliminar sección de coste/venta y limpiar código no usado |
| `src/components/requests/RequestTableView.tsx` | Eliminar columnas de coste/venta y limpiar código no usado |

---

## Lo que NO se modifica (según lo solicitado)
- `src/pages/SolicitudDetalle.tsx` - El detalle del request mantiene la información financiera
- `src/components/modals/RequestFormModal.tsx` - El formulario de alta/edición mantiene todos los campos
- `src/utils/excel/requestsExporter.ts` - La exportación a Excel mantiene los datos financieros
