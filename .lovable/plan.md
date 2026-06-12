
# Dashboard Admin & Account Manager

Nueva página `/dashboard-admin` accesible desde sección **Administración** del sidebar. Visible para `admin` y `account_manager`. Vista de control operativo del mes en curso. Solo lectura: cada item enlaza a su detalle para editar en origen.

## Diferencia por rol

- **Admin / Finanzas**: ve todos los clientes.
- **Account Manager** (sin admin/finanzas): ve solo clientes asignados vía `client_assignments`, `contracts.am_user_id`, `budgets.am_user_id` (reutilizando `useAssignedClients`).

El filtro se aplica de forma transversal en todas las secciones del dashboard.

## Estructura del dashboard

### 🔴 Sección 1 — Alertas críticas (atrasos)

**1a. Requests atrasados de meses anteriores**
- Criterio: `(work_year, work_month) < (mes_actual, año_actual)` Y `status NOT IN ('completed','cancelled','liquidated')` Y no es plantilla recurrente.
- Excluye también requests vinculadas a invoice (`billed_invoice_id IS NOT NULL`) si ya están facturadas.
- Tabla con: código, cliente, título, especialista, mes de trabajo, status, antigüedad (meses de retraso), enlace al detalle.
- Ordenadas de más antiguas a más recientes.

**1b. Presupuestos aprobados de meses anteriores sin requests**
- Criterio: `status = 'approved'`, `created_at < primer_día_mes_actual`, sin filas en `operational_requests` asociadas (`LEFT JOIN ... WHERE oper_req IS NULL`).
- Tabla con: código, cliente, título, AM/PM, importe, fecha aprobación, enlace al presupuesto.

### 🟡 Sección 2 — Seguimiento comercial

**Presupuestos pendientes de aprobar (cualquier fecha)**
- Criterio: `status IN ('pending','sent')`.
- Ordenados por antigüedad descendente (los más viejos arriba).
- Columnas: código, cliente, título, AM, importe, días en pendiente, status, enlace al presupuesto.

### 🟢 Sección 3 — Mes en curso (vista jerárquica agrupada por cliente)

Datos del mes actual agrupados en estructura **Cliente → Contratos/Presupuestos → Requests**:

```
▼ Cliente A                              [X presupuestos · Y requests · Z€]
   ▼ Presupuesto PRE-2026-018 (Aprobado)   [3 requests · 4.500€]
      • REQ-2026-390  Título...  Especialista  Status
      • REQ-2026-391  Título...  Especialista  Status
      • REQ-2026-395  Título...  Especialista  Status
   ▼ Contrato CON-2026-007 (Activo)        [2 requests · 1.200€]
      • REQ-2026-398  Título...  Especialista  Status
      • REQ-2026-401  Título...  Especialista  Status
   ▼ Sin presupuesto/contrato              [1 request · 300€]
      • REQ-2026-405  Título...  Especialista  Status

▼ Cliente B
   ...
```

**Criterios de inclusión del mes en curso:**
- **Requests**: `work_year = año_actual` AND `work_month = mes_actual`, excluyendo plantillas recurrentes.
- **Presupuestos**: `created_at` dentro del mes actual, O presupuestos que tengan requests del mes actual (aunque el presupuesto sea de un mes anterior, así no se pierde el contexto).
- **Contratos**: contratos activos que tengan requests del mes actual.

**Agrupación:**
- Nivel 1: Cliente (`clients.name`), colapsable, con badges-resumen.
- Nivel 2: Origen del request (presupuesto / contrato / "Sin presupuesto"), colapsable, con badge de status y total importe.
- Nivel 3: Request individual con código, título, especialista, status, importe, link al detalle.

Por defecto **todo expandido** para tener visibilidad inmediata; el usuario puede colapsar.

## Detalles técnicos

**Ruta y permisos**
- Añadir ruta `/dashboard-admin` en `src/App.tsx` envuelta en `RoleBasedRoute` con `allowedRoles={['admin','account_manager']}`.
- Añadir entrada en `AppSidebar.tsx` dentro de `adminItems` con icono `LayoutDashboard`, `requiredRoles: ['admin','account_manager']`.

**Archivos nuevos**
- `src/pages/DashboardAdmin.tsx` — página contenedora con las 3 secciones.
- `src/components/dashboard-admin/OverdueRequestsCard.tsx` — sección 1a.
- `src/components/dashboard-admin/ApprovedBudgetsWithoutRequestsCard.tsx` — sección 1b.
- `src/components/dashboard-admin/PendingBudgetsCard.tsx` — sección 2.
- `src/components/dashboard-admin/CurrentMonthByClient.tsx` — sección 3 (acordeón jerárquico usando `Collapsible` de shadcn).
- `src/hooks/useDashboardAdmin.tsx` — hooks agrupados que devuelven los 4 datasets, cada uno aceptando opcionalmente `assignedClientIds` para filtrar cuando el usuario es AM puro.

**Lógica de filtrado por rol (en cada hook):**
```ts
const { isAdmin, canAccessFinance, shouldFilterByAssignment } = useUserRole();
const { assignedClientIds } = useAssignedClients();
const needsClientFilter = shouldFilterByAssignment(); // true solo para AM/PM puros
// Si needsClientFilter → .in('client_id', assignedClientIds)
// Si admin/finanzas → sin filtro
```

**Consultas Supabase principales** (todas client-side con `useQuery`):
1. `financial_requests` con join a `clients`, `specialists`, filtros por work_month/year.
2. `budgets` con `LEFT JOIN operational_requests` para detectar los huérfanos (vía RPC o doble query + filtro en cliente si la cardinalidad es baja).
3. `budgets` filtrado por `status IN ('pending','sent')`.
4. Para sección 3: una query de requests del mes + sus presupuestos/contratos relacionados vía `budget_id` y `contract_id` en `financial_requests`, agrupados en cliente con `useMemo`.

**UI**
- Header con título, mes actual visible ("Junio 2026"), botón refrescar.
- KPIs resumen arriba (4 cards): #requests atrasados, #presupuestos huérfanos, #presupuestos pendientes, #requests del mes.
- Cada sección usa `Card` + tabla compacta o lista con `Collapsible` (sección 3).
- Estados vacíos amigables ("Sin alertas — todo al día ✓").
- Loading skeletons.

## Fuera de alcance (futuro si se pide)

- Edición inline.
- Acciones rápidas tipo "Generar requests desde presupuesto" inline.
- Filtros por especialista / status / AM dentro del dashboard.
- Export CSV.
