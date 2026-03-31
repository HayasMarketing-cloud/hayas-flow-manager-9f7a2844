

## Filtros AM/PM y correcciones en Proyectos Operativos

### Contexto: Asignación de AM/PM

Los AM y PM se asignan en **contratos** (`am_user_id`, `pm_user_id`) y **presupuestos** (`am_user_id`, `pm_user_id`). Los proyectos operativos heredan esta relación a través de `contract_id` o `budget_id`. No hay campos AM/PM directos en `operational_projects`.

Los AM y PM **ya pueden ver** la página de proyectos (configurado en el sidebar con `requiredRoles: ['admin', 'project_manager', 'account_manager']`). Su vista se filtra automáticamente por clientes asignados mediante el hook `useAssignedClients`.

### Bug: Filtro "Activos (sin completados)" en Seguimiento

El filtro `not_completed` se aplica a los **milestones** (`operational_requests.status != 'completed'`), no a los **proyectos**. Por eso aparecen proyectos completados en la lista si tienen milestones no completados. Hay que filtrar también los proyectos con `status = 'completed'` en la vista de seguimiento.

### Cambios

1. **Añadir filtros AM y PM** en `src/pages/operations/OperationalProjects.tsx`
   - Nuevo query para obtener la lista de usuarios que son AM o PM en algún contrato/presupuesto (consultar `contracts` + `budgets` → `profiles` para obtener nombres)
   - Dos selectores: "Account Manager" y "Project Manager"
   - Al seleccionar un AM/PM, filtrar proyectos cuyo `contract` o `budget` tenga ese usuario asignado

2. **Filtrar proyectos completados en vista Seguimiento** en `src/hooks/useProjectMilestones.tsx`
   - Cuando `status === 'not_completed'`, añadir post-filtro para excluir milestones cuyo `operational_project.status === 'completed'`

3. **Vista inicial personalizada para AM/PM** en `src/pages/operations/OperationalProjects.tsx`
   - Si el usuario es AM o PM (sin roles elevados), preseleccionar su propio ID en el filtro AM o PM correspondiente
   - Esto hace que al entrar vean directamente "sus proyectos activos"

### Detalle técnico

**Query para obtener AM/PM activos:**
```sql
-- Unión de am_user_id y pm_user_id de contracts + budgets, luego join con profiles
SELECT DISTINCT p.id, p.full_name 
FROM profiles p
WHERE p.id IN (
  SELECT am_user_id FROM contracts WHERE am_user_id IS NOT NULL
  UNION SELECT pm_user_id FROM contracts WHERE pm_user_id IS NOT NULL
  UNION SELECT am_user_id FROM budgets WHERE am_user_id IS NOT NULL
  UNION SELECT pm_user_id FROM budgets WHERE pm_user_id IS NOT NULL
)
```

**Filtrado por AM/PM en proyectos:** Como los proyectos tienen `contract_id` y `budget_id`, se necesita post-filtro o subquery para verificar que el contrato/presupuesto asociado tenga el AM/PM seleccionado.

**Archivos a modificar:**
- `src/pages/operations/OperationalProjects.tsx` — filtros AM/PM + vista inicial
- `src/hooks/useProjectMilestones.tsx` — excluir proyectos completados del filtro `not_completed`
- `src/hooks/useOperationalProjects.tsx` — aceptar filtros `amUserId`/`pmUserId` y filtrar

