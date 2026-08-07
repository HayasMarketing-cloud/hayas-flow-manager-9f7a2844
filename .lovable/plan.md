# F6 — Desmontaje de Proyectos operativos y nueva vista "Proyectos" de solo lectura

Última fase del sprint. Se desmonta la sección operativa antigua (49 proyectos, 138 requests operacionales) sin borrar datos, y se sustituye por una vista agregada derivada de `financial_requests`.

Nota: el fix de pagos parciales aprobado, las dos tareas menores (paso fantasma del timeline y `docs/`) se ejecutan en el despliegue previo; este plan cubre solo F6.

## Inventario de dependencias `operational_*` y veredicto

**Retirar (creación y edición operativa)**
- `src/pages/operations/OperationalProjects.tsx`, `OperationalProjectDetail.tsx` — rutas `/proyectos-operativos` y `/operaciones/proyectos/:id` (App.tsx 114-115) y entrada de sidebar (AppSidebar.tsx 27).
- `OperationalProjectFormModal.tsx`, `OperationalRequestFormModal.tsx`, `ProjectTrackingRow.tsx`, `HierarchicalTrackingTable.tsx`, `MilestoneTracking*`, `InlineTask*`, `DebugAccessPanel.tsx`.
- `RequestProjectCreationModal.tsx`, `ProjectCreationModal.tsx`, `ContractProjectCreationModal.tsx` y sus hooks `useCreateProjectFromRequest`, `useCreateProjectFromContract`, `useCreateProjectWithActivities`, más sus disparadores en `SolicitudDetalle.tsx`, `PresupuestoDetalle.tsx`, `ContractFormModal.tsx`.
- `useTrackingData.tsx`, `useProjectMilestones.tsx`, `useRequestTasks.ts`, `useAllTasks.tsx`, `useOperationalProjects.tsx` (incl. `useUpdateProjectField`, `useDeleteOperationalProject`).
- `ClientProjectsTab.tsx` (pestaña Proyectos de la ficha de cliente) → sustituida por la lente nueva filtrada por cliente.

**Conservar (no son operativos)**
- `useEntityPnL.tsx`, `useUnliquidatedRequests.tsx`, `useCompletedProjectsPendingInvoice.tsx`, `get-liquidation-items` — usan `operational_requests` solo como puente de join financiero; se revisan uno a uno y se mantienen intactos si no dependen de creación.
- `useBudgetDetail.tsx`, `InvoiceUploadModal.tsx` — lecturas puntuales; se comprueban y se conservan.

**Decisión pendiente de tu criterio: `MyTasks`**
`src/pages/operations/MyTasks.tsx` + `useMyTasks.tsx` es la única pantalla viva que el equipo usa a diario sobre `tasks`/`operational_requests`. Propuesta: **conservarla intacta en esta fase** (queda descolgada de Proyectos pero accesible), y decidir su futuro cuando la vista nueva esté en uso. No se rompe en silencio.

**Backend**
- `generate-monthly-requests`: se elimina la creación de `operational_projects`, milestones y tareas; el cron pasa a generar solo requests.
- `send-project-completed-notification`: queda sin invocadores; se deja desplegada pero desconectada (borrado en otro sprint).
- Tablas `operational_projects`, `operational_requests`, `tasks`: intactas, con sus datos. Sin migración de datos → sin paso 0 de respaldo.

## Nueva vista "Proyectos" (solo lectura)

Ruta `/proyectos`, sustituye a la antigua en la navegación. Derivada 100% de `financial_requests`.

Jerarquía:

```text
Origen (presupuesto | contrato | Puntuales)
  └─ Fase (phase, o "Sin fase")
       └─ Request → enlace a SolicitudDetalle
```

- **Agrupación**: por `budget_id` (proyectos), por `contract_id` cuando no hay presupuesto (fees), y grupo **"Puntuales"** para los requests sin ninguno de los dos (hoy 8 de 464).
- **Métricas por grupo y fase**: nº de requests, horas, coste, precio, avance = `completed` / (total − `cancelled`), y gate de fase (todos completados → fase cerrada).
- **Semáforo** por request y agregado a fase: vencido y no completado → rojo; deadline ≤7 días → ámbar; resto → verde; sin deadline → neutro.
- **Filtros**: cliente, especialista, estado del proyecto (con requests vivos / todo completado).
- Sin escritura, sin campos nuevos, sin `progress_pct`; el avance se computa en cada render.

### Consulta de agregación

Query de cliente, no vista SQL ni RPC: una sola lectura de `financial_requests` con los campos necesarios (`id, code, title, status, phase, deadline, hours, cost_to_agency, sale_amount, budget_id, contract_id, client_id, specialist_id`) y joins ligeros a `budgets`, `contracts`, `clients`, `specialists`; la agrupación y las métricas se calculan en memoria en un módulo `src/lib/projects-view-aggregation.ts`.

Justificación: ~480 filas es un volumen trivial (decenas de KB), respeta la RLS existente sin funciones nuevas, y evita crear objetos de BD que habría que mantener. Si el volumen creciera por encima de unos pocos miles, la agregación se mueve a vista materializada sin cambiar la UI.

Nota de datos: `phase` está hoy a NULL en los 464 requests (campo introducido en F2). Al arrancar, todo caerá en "Sin fase" salvo lo que se etiquete; PRE-2026-045 se etiqueta con sus 5 fases para la validación.

## Ficheros

- Nuevo `src/pages/Proyectos.tsx`, `src/components/projects/ProjectGroupCard.tsx`, `PhaseGroupRow.tsx`, `RequestLensRow.tsx`, `ProjectsFiltersBar.tsx`.
- Nuevo `src/lib/projects-view-aggregation.ts` y `src/hooks/useProjectsLens.tsx`.
- `src/App.tsx`, `src/components/layout/AppSidebar.tsx` — ruta y navegación.
- `supabase/functions/generate-monthly-requests/index.ts` — sin creación operativa.
- Bajas de los ficheros listados en "Retirar".

## Orden de desconexión

1. Cortar la alimentación automática (edge function del cron).
2. Publicar la vista nueva en `/proyectos`.
3. Retirar navegación y rutas antiguas.
4. Retirar puntos de creación y modales.
5. Borrar hooks y componentes ya sin invocadores; grep final.

## Riesgos

- Hooks financieros que atraviesan `operational_requests` (regla del proyecto: es el único puente request↔proyecto). Se revisan antes de tocar nada; ninguno se elimina.
- Accesos guardados a `/proyectos-operativos`: la ruta deja de existir y cae en NotFound.
- Pérdida temporal de la pestaña Proyectos en la ficha de cliente hasta que la lente nueva acepte filtro por cliente (va en el mismo despliegue).

## Checks

1. PRE-2026-045 renderizado con sus 5 fases, avance y semáforos correctos contra datos reales.
2. Un contrato de fee (Asendia Spain) con sus meses agrupados y métricas correctas.
3. Grupo "Puntuales" con los 8 requests sin presupuesto ni contrato.
4. `generate-monthly-requests` ejecutado manualmente → 0 `operational_projects` nuevos; count antes/después con output literal.
5. `/proyectos-operativos` y `/operaciones/proyectos/:id` inaccesibles por URL directa.
6. Grep sin hooks ni modales muertos invocados (`useCreateProjectFrom*`, `useTrackingData`, `useOperationalProjects`).
7. Verificación de que P&L, liquidaciones y facturación siguen resolviendo el join por `operational_requests` sin errores.
8. Smoke test en UI real (navegador): entrar en /proyectos, filtrar por cliente y especialista, expandir un presupuesto y una fase, abrir un request hasta `SolicitudDetalle`, y confirmar que no hay ningún control de escritura en la vista.
