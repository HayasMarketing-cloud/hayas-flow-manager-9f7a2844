

## Diagnóstico del problema

Iolanda Carbone tiene los roles: `project_manager`, `account_manager`, `especialista`.

**Causa raíz**: La función `shouldFilterByAssignment()` en `useUserRole.ts` trata a `project_manager` como un rol que necesita filtrado por cliente asignado, pero según la matriz de permisos, PM tiene acceso total (CRUD) a Solicitudes, Proyectos y Tareas.

El flujo del problema:
1. `shouldFilterByAssignment()` devuelve `true` para Iolanda (tiene AM/PM pero no admin/finanzas)
2. `useAssignedClients` busca clientes asignados → el presupuesto PRE-2026-026 tiene `am_user_id = null` y `pm_user_id = null`, y no hay registros en `client_assignments` para ella
3. El cliente "Maria José Boeta Pardo" NO está en su lista → la app filtra el request REQ-2026-266

A nivel de RLS (base de datos), Iolanda SÍ tiene acceso porque `project_manager` está incluido en las políticas. El problema es exclusivamente el **filtro a nivel de aplicación**.

## Solución

Modificar `shouldFilterByAssignment()` para incluir `project_manager` como acceso elevado, ya que según la matriz de permisos el PM tiene visibilidad completa en todos los módulos (Ver o CRUD).

### Cambio en `src/hooks/useUserRole.ts`

Línea actual:
```typescript
const hasElevatedAccess = isAdmin() || canAccessFinance();
```

Cambio a:
```typescript
const hasElevatedAccess = isAdmin() || canAccessFinance() || isProjectManager();
```

Esto hace que solo los usuarios que sean **únicamente account_manager** (sin rol PM, admin o finanzas) tengan filtrado por cliente asignado. Iolanda, al tener PM, verá todo sin restricciones de cliente — coherente con la matriz de permisos y con las políticas RLS ya configuradas.

### Archivos a modificar
- `src/hooks/useUserRole.ts` — una línea

### Sin cambios de base de datos
Las políticas RLS ya otorgan acceso completo a `project_manager`. Solo es corrección del filtro de aplicación.

