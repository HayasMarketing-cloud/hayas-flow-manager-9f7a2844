

## Plan revisado: Sistema de controlling financiero unificado

**Acceso: exclusivamente roles `admin` y `finanzas`** — sin cambios en permisos. El Dashboard Mensual ya está restringido a estos roles y así se mantiene.

### 1. Consolidar DashboardFinanzas → DashboardMensual

DashboardFinanzas está huérfano (sin ruta en sidebar). Absorber sus widgets útiles en DashboardMensual:
- **AlertsWidget** (facturas vencidas, liquidaciones borrador, requests sin facturar) → sección colapsable
- **CompletedProjectsWidget** (proyectos completados pendientes de facturar) → sección colapsable
- **KPIs con tendencia** (comparación vs período anterior) → enriquecer KPIs existentes

Eliminar: `DashboardFinanzas.tsx`, `useDashboardData.tsx`, `useDashboardCharts.tsx`, ruta `/dashboard-finanzas` en App.tsx.

### 2. Cruzar costes de especialistas con clientes en tabla mensual

Modificar `useDashboardMensualData.tsx` para consultar `financial_requests` del período y agrupar `cost_to_agency` por `client_id`. La tabla de clientes mostrará:

| Cliente | Ingresos | Costes especialistas | Comisiones | Margen neto | % |

### 3. Sección de reconciliación "Estado del cierre"

Nueva sección en DashboardMensual con contadores clicables:
- Requests del mes sin factura (`billed_invoice_id IS NULL`)
- Requests del mes sin liquidación (`liquidation_id IS NULL`)  
- Requests sin origen económico (`budget_id IS NULL AND contract_id IS NULL`)

Cada contador enlaza a Solicitudes filtradas. Solo visible para admin/finanzas (ya implícito por estar en DashboardMensual).

### 4. Corrección de datos históricos (migración)

- Rellenar `work_month/work_year` en requests huérfanos usando `period_month/period_year` de su liquidación
- Rellenar `contract_id` en facturas importadas por PDF de clientes con contrato activo único

### Archivos a modificar

1. `src/hooks/useDashboardMensualData.tsx` — Cruzar costes con clientes; datos de reconciliación
2. `src/pages/DashboardMensual.tsx` — Columna costes en tabla clientes; sección reconciliación; alertas; KPIs con tendencia
3. `src/hooks/useDashboardKPIs.tsx` — Simplificar para solo tendencias
4. `src/App.tsx` — Eliminar ruta `/dashboard-finanzas`
5. **Eliminar**: `DashboardFinanzas.tsx`, `useDashboardData.tsx`, `useDashboardCharts.tsx`
6. **Migración SQL** — UPDATE requests y facturas con datos faltantes

### Nota sobre permisos

- El `DashboardMensual` ya está protegido con `RoleBasedRoute allowedRoles={['admin']}` y validación interna `canAccessFinance()`
- Los hooks `useDashboardAlerts` y `useDashboardKPIs` ya verifican `canAccessFinance()` internamente
- No se requiere ningún cambio de permisos — todo queda dentro del perímetro admin/finanzas existente

