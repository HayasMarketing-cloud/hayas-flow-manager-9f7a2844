
## Objetivo (lo que vamos a arreglar)
Que en **Proyectos Operativos** (Tarjetas y Seguimiento) se muestren proyectos/hitos correctamente según reglas de usuario:

- **Admin**: ve todo.
- **AM / PM**: ve lo asociado a sus **clientes asignados** (vía contratos/presupuestos).
- **Especialista**: ve lo asociado a su **especialista asignado** (requests/milestones asignados).

Ahora mismo la UI muestra “No hay proyectos” **sin error**, lo que indica que las queries están devolviendo 0 filas por (a) permisos/asociaciones o (b) lógica de filtrado/identidad del especialista, no por fallo técnico visible.

---

## Hallazgos clave (cosas que no estábamos viendo)
1) **Usuarios con múltiples roles (AM/PM + especialista) pueden quedar filtrados como “solo especialista” en Seguimiento**  
En `useProjectMilestones`, el filtro “ver solo mis hitos” se activa si el usuario tiene rol especialista y no es admin/finanzas.  
Pero **no excluye AM/PM**. Si un usuario tiene roles mixtos, puede quedar limitado a `assignee_specialist_id = miEspecialista`, aunque su rol AM/PM debería permitirle ver por cliente asignado.

2) **Vinculación “usuario ↔ especialista” puede estar rota en datos**  
La visibilidad “especialista” en backend depende de que exista un registro en `specialists` con `user_id = auth.uid()`.  
Hemos visto que **hay especialistas con `user_id` en null**. Eso provoca que, aunque haya requests asignados a ese especialista, el usuario no los vea “como especialista”.

3) **Muchos proyectos tienen `owner_user_id` en null** (dato real)  
Hay políticas que usan `owner_user_id = auth.uid()` para visibilidad. Si este campo está en null, el creador puede no ver lo que creó (según rol). Aunque vuestro modelo principal es AM/PM/Especialista, este campo vacío empeora la trazabilidad y puede dejar a usuarios sin acceso “por propiedad”.

4) El mensaje “No hay proyectos” hoy **no distingue** entre:
- “No hay datos”
- “No tienes asociaciones (AM/PM sin clientes, especialista sin vínculo)”
- “Estás en un entorno distinto (preview/publicado)”

---

## Estrategia (en 2 fases)
### Fase 1 — Diagnóstico en pantalla (sin depender de consola)
Implementaremos un “panel de diagnóstico” activable con `?debug=1` (solo visible en ese modo) dentro de **/proyectos-operativos** para que, con 1 captura, sepamos exactamente qué está pasando.

Mostrará:
- Usuario actual (email + id)
- Roles detectados (desde `user_roles`)
- `needsFiltering` + `assignedClientIds.length`
- `currentSpecialistId` (si existe)
- Resultados de 2 “consultas sonda”:
  - `operational_projects` (count/head)
  - `operational_requests` (count/head)
- Si count=0: sabremos que es **permisos/asociación**.  
- Si count>0 pero UI vacío: sabremos que es **filtro UI**.

### Fase 2 — Corrección definitiva según causa (conservando las reglas de negocio)
En paralelo al panel, aplicaremos correcciones “seguras” que ya encajan con vuestras reglas:

A) **Corregir el filtrado de Seguimiento para usuarios con roles mixtos**
- Cambiar `shouldFilterBySpecialist` para que SOLO aplique si el usuario es “especialista puro” (sin roles AM/PM) y sin acceso elevado.
- Resultado: AM/PM que también tengan rol “especialista” no quedarán limitados a “solo mis hitos”.

B) **Garantizar vínculo usuario-especialista (sin depender de edición manual)**
Opción recomendada (segura y automática):
- Backfill + automatización: si un usuario autenticado tiene `auth.email()` y existe un `specialists.email` igual (case-insensitive) con `user_id` vacío, enlazarlo.
- Hacerlo con una función SQL `SECURITY DEFINER` (o trigger controlado) para evitar abrir permisos peligrosos en `specialists`.

C) **Opcional pero muy recomendable: rellenar `owner_user_id`**
- Backfill: `owner_user_id = created_by` donde esté null.
- Trigger en INSERT para que nuevos proyectos tengan `owner_user_id` por defecto.
- Esto mejora consistencia de “asociación” y evita proyectos “huérfanos”.

D) **Ajuste de Empty State**
- Si `needsFiltering=true` y `assignedClientIds.length===0`: mostrar “No tienes clientes asignados como AM/PM”.
- Si rol especialista y `currentSpecialistId===null`: mostrar “Tu usuario no está vinculado a un registro de especialista”.
- Si Admin y count=0: “No hay proyectos en el sistema” (dato real).

---

## Cambios concretos (archivos)
### 1) Diagnóstico UI (debug)
- `src/pages/operations/OperationalProjects.tsx`
  - Añadir componente/bloque “DebugAccessPanel” visible solo con `?debug=1`.
- (Opcional) `src/components/operations/HierarchicalTrackingTable.tsx`
  - Mostrar también un mini-resumen en debug: milestones recibidos, projectGroups, etc.

### 2) Fix roles mixtos (causa probable en Seguimiento)
- `src/hooks/useProjectMilestones.tsx`
  - Cambiar:
    - `shouldFilterBySpecialist = isSpecialist() && !isAdmin() && !canAccessFinance() && currentSpecialistId`
  - Por:
    - `shouldFilterBySpecialist = isSpecialist() && !isAdmin() && !canAccessFinance() && !isAccountManager() && !isProjectManager() && currentSpecialistId`
  - (importando `isAccountManager` e `isProjectManager` del hook `useUserRole`)

### 3) Fix vínculo especialista (backend)
- Nueva migración (Lovable Cloud / database):
  - Backfill: setear `specialists.user_id` por match de email con profiles cuando sea seguro.
  - Crear función `link_my_specialist()` que:
    - Verifica `auth.email()` no null
    - Busca `specialists` con `lower(email)=lower(auth.email())`
    - Si encuentra exactamente 1 y `user_id` es null, asigna `user_id=auth.uid()`
    - Devuelve el id enlazado
  - (Opcional) Índice único en `lower(email)` si el negocio lo permite (o índice parcial para emails no null).

- `src/hooks/useCurrentSpecialist.ts`
  - En vez de depender solo de `eq('user_id', user.id)`, intentar:
    1) buscar por `user_id`
    2) si no hay, buscar por email (case-insensitive) y, si existe, invocar `link_my_specialist()` y reconsultar.

### 4) Opcional: consistencia de owner_user_id
- Nueva migración:
  - `update operational_projects set owner_user_id = created_by where owner_user_id is null and created_by is not null;`
  - Trigger para futuros inserts.

---

## Verificación (muy concreta)
1) Entrar a `/proyectos-operativos?debug=1` con:
   - Un **Admin**
   - Un **AM/PM**
   - Un **Especialista**
2) Validar que el panel muestra:
   - roles correctos
   - assignedClientIds correcto para AM/PM
   - specialistId presente para especialistas
   - counts > 0 cuando corresponda
3) Comprobar:
   - Tarjetas lista proyectos correctos
   - Seguimiento lista proyectos/hitos correctos
   - Si un usuario no tiene asociación, el mensaje lo explica y no “miente” con “No hay proyectos”.

---

## Decisiones / aclaraciones (no bloqueantes, pero ayudan)
- ¿PM debe ver “todo” o solo asignados? (Ahora mismo en backend parece que PM podría tener acceso amplio; lo ajustaremos para cumplir exactamente lo que indicas: asociado al usuario.)
- Confirmar si el vínculo especialista debe ser por **email** (recomendado) o se gestionará manualmente desde Usuarios/Especialistas.

---

## Alcance y riesgo
- Cambios de frontend: bajo riesgo, solo mejora lógica y diagnóstico.
- Cambios de backend (link especialista + owner_user_id): controlados y reversibles; mejoran consistencia. Se harán con políticas seguras para no abrir datos.

Si quieres que continúe con la implementación, dime en un nuevo mensaje “continúa con la Fase 1 y 2”.
