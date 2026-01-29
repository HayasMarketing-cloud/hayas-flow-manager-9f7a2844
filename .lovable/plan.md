
# Plan: Asociar Facturas de Ingresos con Proyectos para Controlling Financiero

## Situación Actual

### Datos que tenemos:
1. **Facturas importadas**: ~60+ facturas con PDF, cliente y montos, pero sin líneas de detalle (`invoice_items`) ni `financial_requests` vinculados
2. **Financial Requests**: Registros con información completa de proyecto, presupuesto, contrato, importe de venta (`sale_amount`), cliente, etc.
3. **Proyectos operativos**: Vinculados a requests via `operational_requests`

### Problema:
- La asociación factura-proyecto depende de `financial_requests.billed_invoice_id`
- Las facturas importadas por IA no capturaron esta relación
- Sin esta vinculación, no es posible hacer controlling por proyecto/cliente

---

## Solución Propuesta: Herramienta de Reconciliación Manual Asistida

Crear una interfaz donde el usuario pueda asociar las facturas importadas con los requests correspondientes de forma manual pero asistida con sugerencias inteligentes.

### Enfoque en 3 Fases:

---

## Fase 1: Pantalla de Reconciliación de Facturas

**Nueva página**: `/facturas/reconciliar` o modal desde lista de facturas

### Componentes:
1. **Lista de facturas sin asociar**: Facturas donde `linked_requests_count = 0`
2. **Para cada factura mostrar**:
   - Código, cliente, fecha, subtotal/total
   - Requests disponibles del mismo cliente (status: completed, sin billed_invoice_id)
   - Checkbox para seleccionar qué requests asociar

### Lógica de sugerencias automáticas:
- Filtrar requests por mismo cliente
- Ordenar por fecha cercana a la factura
- Si la suma de `sale_amount` de requests coincide (±5%) con el subtotal de la factura: marcar como "sugerencia"
- Agrupar requests por proyecto/presupuesto para facilitar selección

---

## Fase 2: Modificaciones al Modelo de Datos

### Opción A: Vincular requests existentes (Recomendada)
Actualizar `financial_requests.billed_invoice_id` con el ID de la factura correspondiente.

**Ventajas**:
- Usa la estructura existente
- La tabla de facturas ya muestra correctamente proyectos/presupuestos/contratos
- Compatible con el flujo normal de facturación

### Flujo:
```sql
UPDATE financial_requests 
SET billed_invoice_id = 'factura-uuid'
WHERE id IN ('request-1', 'request-2', ...);
```

---

## Fase 3: Reporting por Proyecto/Cliente

Una vez reconciliadas las facturas, el sistema ya tiene toda la información para:

1. **P&L por Proyecto**: 
   - Ingresos: SUM(sale_amount) de requests vinculados a factura
   - Costes: SUM(cost_to_agency) de los mismos requests
   - Margen: Ingresos - Costes

2. **P&L por Cliente**: Agrupar proyectos por cliente

3. **P&L Mensual**: Filtrar por `invoice_date` o período de los requests

---

## Cambios Técnicos

### Nuevos Componentes:

| Archivo | Descripción |
|---------|-------------|
| `src/pages/FacturasReconciliar.tsx` | Página principal de reconciliación |
| `src/components/invoices/ReconciliationTable.tsx` | Tabla de facturas pendientes de asociar |
| `src/components/invoices/RequestSelector.tsx` | Selector de requests para asociar a factura |
| `src/hooks/useUnassignedInvoices.tsx` | Hook para obtener facturas sin requests vinculados |
| `src/hooks/useAvailableRequests.tsx` | Hook para obtener requests sin facturar por cliente |

### Modificaciones:

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Nueva ruta `/facturas/reconciliar` |
| `src/pages/Facturas.tsx` | Botón "Reconciliar facturas" en toolbar |

---

## Flujo de Usuario

```text
+------------------+     +----------------------+     +-------------------+
| Lista Facturas   | --> | Reconciliar Facturas | --> | Factura Asociada  |
| (ver sin asociar)|     | (seleccionar requests)|     | (ver proyectos)   |
+------------------+     +----------------------+     +-------------------+
                                   |
                                   v
                         +--------------------+
                         | Sugerencias        |
                         | automáticas por:   |
                         | - Cliente          |
                         | - Importe similar  |
                         | - Fecha cercana    |
                         +--------------------+
```

---

## Estructura Visual de la Página de Reconciliación

```text
+------------------------------------------------------------------------+
| Reconciliar Facturas                                      [X facturas] |
+------------------------------------------------------------------------+
| Factura: 2026/8  | Cliente: ASENDIA HQ  | Subtotal: 1.403,62€          |
+------------------------------------------------------------------------+
| Requests disponibles del cliente:                                      |
| +--------------------------------------------------------------------+ |
| | □ REQ-2026-103 | Proyecto SendNow    | PRE-2026-004 | 140€         | |
| | □ REQ-2026-104 | Proyecto SendNow    | PRE-2026-004 | 140€         | |
| | □ REQ-2026-097 | Switzerland...      | PRE-2025-201 | 210€         | |
| | ☑ REQ-2026-100 | Switzerland...      | PRE-2025-201 | 490€         | |
| | ☑ REQ-2026-105 | Newsletter Q4 USA   | CON-2025-001 | 913€         | |
| +--------------------------------------------------------------------+ |
| Suma seleccionada: 1.403,00€  [Diferencia: 0,62€]     [Asociar]        |
+------------------------------------------------------------------------+
```

---

## Beneficios

1. **Control financiero completo**: Cada € facturado queda trazado a un proyecto
2. **P&L real**: Margen por proyecto = Ingresos facturados - Costes (liquidaciones)
3. **Histórico reconciliado**: Las facturas antiguas quedan igualmente asociadas
4. **Datos ya disponibles**: No requiere nuevas tablas, solo vincular registros existentes

---

## Archivos a Crear/Modificar

### Nuevos archivos:
- `src/pages/FacturasReconciliar.tsx`
- `src/components/invoices/ReconciliationRow.tsx`
- `src/components/invoices/RequestCheckboxList.tsx`
- `src/hooks/useUnassignedInvoices.tsx`
- `src/hooks/useAvailableRequestsForReconciliation.tsx`

### Archivos a modificar:
- `src/App.tsx` (nueva ruta)
- `src/pages/Facturas.tsx` (botón de acceso)
