
# Diagnóstico y solución: Tomás no puede ver sus requests como especialista

## Problema identificado

Tomás White tiene dos roles: `project_manager` + `especialista`. El sistema actualmente lo trata siempre como PM y lo dirige al Dashboard principal de operaciones. No existe ningún mecanismo que le muestre su vista como especialista asignado (sus propios requests donde él es el `specialist_id`).

La imagen muestra que Tomás ve "Requests Activos: 14" en el Dashboard normal de PM — ese contador incluye todos los requests de los proyectos donde él es PM. Pero los "14" no son sus requests como especialista, son los requests del proyecto general que gestiona.

**Lo que necesita Tomás**: ver sus propios requests como especialista asignado (`specialist_id = su ID`), igual que Iolanda o Ebelyn. Actualmente esto solo ocurre en `/dashboard-especialista`, que Tomás nunca visita porque el sistema no lo redirige allí.

## Causa técnica

1. **Dashboard**: La ruta `/dashboard` muestra el Dashboard principal (no el de especialista). No hay lógica de redirección inteligente que lleve a usuarios con rol `especialista` (aunque tengan otros roles) al dashboard correspondiente.

2. **Solicitudes**: En `/solicitudes`, Tomás ve todos los requests de sus clientes asignados como PM. Sus requests como especialista (REQ-2026-133 a REQ-2026-137 en ASENDIA HQ) están mezclados ahí pero sin distinción visual.

3. **Sin acceso rápido**: No hay enlace en el sidebar ni en el dashboard que lleve a Tomás al DashboardEspecialista donde puede ver exactamente sus requests como especialista asignado.

## Solución: 3 cambios

### 1. Añadir enlace "Mi perfil especialista" en el sidebar (para usuarios con rol `especialista`)
Añadir en el sidebar un ítem "Mi Dashboard Especialista" visible solo para quienes tengan rol `especialista`, independientemente de otros roles.

### 2. Añadir widget en el Dashboard principal para usuarios con doble rol (PM + especialista)
En `src/pages/Dashboard.tsx`, detectar si el usuario tiene rol `especialista` y mostrar una tarjeta resumen "Como especialista asignado" con un enlace directo al DashboardEspecialista.

### 3. Corregir la RLS para que la policy SELECT de especialistas también cubra a usuarios con rol `especialista` aunque tengan otros roles
La policy "Specialists can view own requests" ya cubre `get_current_specialist_id()`, que busca por `user_id`. Tomás está vinculado correctamente, así que el RLS funciona bien para la página de Solicitudes.

## Archivos a modificar

### `src/components/layout/AppSidebar.tsx`
- Añadir en `operationsItems`: `{ title: 'Mi Dashboard', url: '/dashboard-especialista', icon: UserCheck, requiredRoles: ['especialista'] }`
- Esto hará que aparezca en el menú "Operations" para Tomás.

### `src/pages/Dashboard.tsx`
- Importar `useUserRole` y `useCurrentSpecialist`.
- Si `isSpecialist()` es true, mostrar un widget "Mis Requests como Especialista" con el conteo de requests activos asignados a él y un botón "Ver mis requests" que lleva a `/solicitudes?specialistId=<su_specialist_id>`.

### `src/pages/Solicitudes.tsx`
- Cuando el usuario tiene rol `especialista` (sin ser admin/finanzas), añadir en el sidebar de filtros un botón rápido "Mis Requests" que prefiltra automáticamente por su `specialist_id`. Esto es una mejora opcional de UX.

## Orden de implementación

1. Añadir enlace "Mi Dashboard" al sidebar para rol `especialista` — cambio más impactante e inmediato.
2. Añadir widget en Dashboard principal para usuarios con doble rol.
3. (Opcional) Botón "Mis Requests" en Solicitudes para especialistas.

## Consideraciones

- No se requieren cambios en RLS ni en la base de datos: la vinculación de Tomás ya está correcta.
- No se requiere modificar migraciones.
- El cambio es puramente de navegación y UX.
- No afecta a otros usuarios.
