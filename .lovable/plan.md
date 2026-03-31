

## Filtrar notificaciones por asignación de cliente para AM/PM

### Problema

Las funciones de notificación (`notifyByRole`, `notifyRequestStatusChange`, `notifySpecialistResponse`, etc.) envían a **todos** los usuarios con roles `project_manager` y `account_manager`, sin filtrar por asignación de cliente. Ebelyn recibe notificaciones de solicitudes que no le pertenecen porque tiene rol `account_manager` + `project_manager`.

**Roles de Ebelyn**: `project_manager`, `account_manager`, `especialista` → correctos para su función, no hay que cambiarlos.

### Solución

Modificar la lógica de notificación para que los AM/PM solo reciban notificaciones de entidades vinculadas a sus clientes asignados. Los `admin` y `finanzas` siguen recibiendo todo.

### Cambios

#### 1. `src/lib/notification-utils.ts` — Nueva función `getRelevantUserIds`

Crear una función que dado un `client_id`:
- Retorna todos los `admin` y `finanzas` (sin filtrar)
- Para `project_manager` y `account_manager`, consulta `contracts` y `budgets` para encontrar qué usuarios tienen `am_user_id` o `pm_user_id` vinculado al cliente, y solo incluye esos

```
async function getRelevantUserIds(
  roles: AppRole[], 
  clientId?: string,
  excludeUserId?: string
): string[]
```

Actualizar `notifyRequestStatusChange`, `notifySpecialistResponse` y `notifyProjectCompleted` para recibir `clientId` y usar esta nueva función en lugar de `notifyByRole` genérico.

#### 2. `src/components/requests/RequestFlowActions.tsx` (~línea 193)

Pasar `request.client_id` a `notifyRequestStatusChange`.

#### 3. `src/pages/SolicitudDetalle.tsx`

Donde se llame a notificaciones de request, pasar `client_id`.

#### 4. `supabase/functions/process-request-action/index.ts` (~líneas 316-344)

Cambiar la consulta de destinatarios: en vez de buscar todos los `admin/finanzas/project_manager/account_manager`, hacer:
- Buscar todos `admin` y `finanzas` directamente
- Para AM/PM, consultar `contracts` y `budgets` donde `client_id` del request coincida con `am_user_id` o `pm_user_id`
- Unir ambos sets para las notificaciones in-app y emails

#### 5. `supabase/functions/process-request-action/index.ts` (~líneas 346-354)

Aplicar el mismo filtro al envío de emails (actualmente usa `uniqueUserIds` que ya estaría filtrado tras el cambio anterior).

### Detalle técnico de la función `getRelevantUserIds`

```typescript
async function getRelevantUserIds(roles: AppRole[], clientId?: string, excludeUserId?: string): Promise<string[]> {
  const elevatedRoles = roles.filter(r => ['admin', 'finanzas'].includes(r));
  const filterableRoles = roles.filter(r => ['project_manager', 'account_manager'].includes(r));
  
  // Admin/finanzas: all users with these roles
  const elevated = elevatedRoles.length > 0 
    ? await getUsersByRole(elevatedRoles) : [];
  
  // AM/PM: only those assigned to the client
  let assigned: string[] = [];
  if (filterableRoles.length > 0 && clientId) {
    const { data: contracts } = await supabase
      .from('contracts').select('am_user_id, pm_user_id')
      .eq('client_id', clientId);
    const { data: budgets } = await supabase
      .from('budgets').select('am_user_id, pm_user_id')
      .eq('client_id', clientId);
    
    assigned = [...new Set([
      ...contracts?.flatMap(c => [c.am_user_id, c.pm_user_id]) || [],
      ...budgets?.flatMap(b => [b.am_user_id, b.pm_user_id]) || []
    ].filter(Boolean))];
  }
  
  const all = [...new Set([...elevated, ...assigned])];
  return excludeUserId ? all.filter(id => id !== excludeUserId) : all;
}
```

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/lib/notification-utils.ts` | Nueva función `getRelevantUserIds`, actualizar `notifyRequestStatusChange`, `notifySpecialistResponse`, `notifyProjectCompleted` |
| `src/components/requests/RequestFlowActions.tsx` | Pasar `client_id` a las funciones de notificación |
| `src/pages/SolicitudDetalle.tsx` | Pasar `client_id` a las funciones de notificación |
| `supabase/functions/process-request-action/index.ts` | Filtrar destinatarios por cliente asignado |

