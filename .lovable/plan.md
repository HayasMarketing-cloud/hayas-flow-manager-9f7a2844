# F4 — Máquina de estados, forzado auditado e higiene de borrado

Objetivo: una única definición de las transiciones válidas de `financial_requests.status`, consumida por UI y BD; forzado de estado sólo para admin/finanzas con motivo registrado; y fin del "éxito silencioso" en borrados y actualizaciones.

## 1. Fuente única de transiciones

Diseño: **tabla de datos + funciones de lectura**, no constantes duplicadas.

- Tabla `public.request_status_transitions` (`from_status financial_request_status`, `to_status financial_request_status`, `pk (from, to)`), sembrada con la matriz aprobada:

```text
draft              -> pending_specialist, cancelled
pending_specialist -> in_progress, draft, cancelled
in_progress        -> pending_review, cancelled
pending_review     -> completed, in_progress
completed          -> in_progress
cancelled          -> draft
```

- GRANT `SELECT` a `authenticated` (es catálogo, no dato sensible); `ALL` a `service_role`. RLS activada con política de lectura para cualquier usuario autenticado.
- `public.allowed_request_transitions(_from financial_request_status) RETURNS financial_request_status[]` — `STABLE SECURITY DEFINER`, lee la tabla. La UI la llama por RPC.
- `public.is_valid_request_transition(_from, _to) RETURNS boolean`.
- Trigger `BEFORE UPDATE OF status ON financial_requests` → `enforce_request_status_transition()`: si `OLD.status IS DISTINCT FROM NEW.status` y la transición no está en la tabla, `RAISE EXCEPTION` con mensaje legible (`Transición no permitida: % → %`). Se salta la validación cuando la sesión lleva la marca de forzado (ver punto 2).

Consumo desde la UI: hook `useRequestTransitions()` que cachea el resultado del RPC `allowed_request_transitions` (uno por estado, `staleTime` alto). `RequestFormModal` y `RequestFlowActions` derivan sus opciones de ahí; se elimina cualquier lista hardcodeada de estados.

### Casos reales que la matriz no cubre (a decidir antes de ejecutar)

1. **Rollback de `process-request-action`** (`supabase/functions/process-request-action/index.ts:388`): si falla el email tras aceptar, revierte `in_progress → pending_specialist`. Esa transición **no está en la matriz** y el trigger la rechazaría. Propuesta: añadir `in_progress → pending_specialist` a la tabla (es también el "devolver al especialista" natural desde gestión). Alternativa: que el rollback use el RPC de forzado con motivo de sistema.
2. **`pending_review → cancelled`**: hoy no está permitido; un trabajo entregado que el cliente anula tendría que pasar por `in_progress` primero. Propuesta: añadirla.
3. **`completed → cancelled`** no se añade: un completado ya facturable se reabre a `in_progress` y se cancela desde ahí (deja rastro).

Si prefieres la matriz literal tal cual la diste, se implementa así y el rollback del punto 1 pasa por forzado.

## 2. Selector de estados y forzado auditado

- **Creación**: sólo `draft` y `pending_specialist`.
- **Edición (AM/PM)**: estado actual + `allowed_request_transitions(actual)`.
- **Edición (admin/finanzas)**: lo mismo, más un ítem "Forzar estado…" que abre un diálogo con selector libre de los 7 estados y **motivo obligatorio** (mínimo ~10 caracteres). Sin motivo, el botón de confirmar queda deshabilitado.

Mecanismo del forzado:

```
force_request_status(_request_id uuid, _new_status financial_request_status, _reason text)
  RETURNS void  LANGUAGE plpgsql  SECURITY DEFINER
```

1. Comprueba `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finanzas')` → si no, excepción.
2. Comprueba `_reason` no vacío tras `btrim` → si no, excepción `El forzado de estado requiere un motivo`.
3. Marca la sesión: `PERFORM set_config('app.force_status','on', true)` (ámbito transacción).
4. `UPDATE financial_requests SET status = _new_status`. El trigger lee `current_setting('app.force_status', true)` y salta la validación.
5. Inserta en `activity_log` (`action = 'status_forced'`, `changes = {from, to, reason}`, `user_id = auth.uid()`, `source = 'force_rpc'`) en la **misma transacción**.

Como el flag es transaction-local y sólo se activa dentro del RPC, un `UPDATE` directo del cliente nunca lo tiene: transición inválida por PostgREST → rechazada.

## 3. activity_log

- `SELECT`: se añade `finanzas` a la política existente (hoy admin + project_manager).
- `user_id` pasa a **nullable** y se añade `source text` (`'ui'` por defecto, `'cron'`, `'edge'`, `'force_rpc'`, `'token'`). La política de INSERT se ajusta: `auth.uid() = user_id` **o** `user_id IS NULL` cuando el insert viene de `service_role`.
- Registro nuevo: transiciones forzadas (RPC), borrados de requests (código, título, autor, origen) y las aceptaciones/rechazos de lote de F3 desde `process-request-action` (`source = 'token'`, `user_id = NULL`, un registro por request procesado con el resultado accepted/skipped).

## 4. Higiene de borrado y éxito silencioso

Inventario: **44 llamadas a `.delete()`** en 25 ficheros; ninguna comprueba filas afectadas — el patrón actual es `if (error) throw`, y RLS devuelve `200 []` sin error (mismo síntoma del check 10c de F2).

Helper compartido nuevo `src/lib/db-mutations.ts`:

```ts
mustAffectRows(builder, { entity, action })  // fuerza .select('id'), lanza si data.length === 0
```

Aplicación en F4 (los tres flujos pedidos), dejando el resto para una pasada posterior:

- Requests: `src/pages/Solicitudes.tsx` (`handleDeleteRequest`, línea ~260), `src/pages/SolicitudDetalle.tsx`, `src/components/modals/RequestFormModal.tsx` (update).
- Presupuestos: `src/pages/Presupuestos.tsx`, `src/pages/PresupuestoDetalle.tsx`, `src/components/budgets/BudgetFormModal.tsx`.
- Liquidaciones: `src/pages/Liquidaciones.tsx`, `src/pages/LiquidacionDetalle.tsx`, `src/components/liquidations/LiquidationFormModal.tsx`.

Visibilidad del botón de borrar: `src/pages/Solicitudes.tsx:50` usa `canManage = canAccessFinance() || canAccessOperations()`, lo que muestra borrar a project_manager cuando la RLS de `financial_requests` sólo permite `DELETE` a admin/finanzas. Se separa en `canManage` (crear/editar) y `canDelete = canAccessFinance()`, y se propaga a `RequestTableView` / `RequestCard`.

## 5. Estados fantasma

`src/components/requests/RequestProcessTimeline.tsx` declara un tipo local con `accepted`, `rejected` y `billed`, y `statusOrder` los usa para calcular el índice del paso actual. Se sustituye por el enum real (`Database['public']['Enums']['financial_request_status']`) y se reordena `statusOrder` a `draft → pending_specialist → in_progress → pending_review → completed`; el estado facturado se sigue mostrando como paso derivado de la factura vinculada, no como estado. Grep final para asegurar que no quedan literales muertos en otros componentes.

## 6. Restricciones

Paso 0 de respaldo (`_backup_financial_requests_<fecha>` y `_backup_activity_log_<fecha>`) en la migración. Sin tocar liquidaciones/facturación ni `operational_projects`. Antes de activar el trigger, consulta de los estados actuales para confirmar que ninguna automatización viva depende de una transición fuera de la matriz.

## Riesgos

- **Trigger demasiado estricto rompe automatismos**: el rollback de `process-request-action` y cualquier edge function que mueva estados. Mitigación: inventario previo de todos los `update({status:...})` en `supabase/functions/` y decisión explícita (matriz ampliada o forzado con `source='edge'`).
- **`set_config` transaction-local**: si algún día el update se hace fuera de la transacción del RPC, el forzado fallaría en silencio con excepción. Mitigación: el RPC hace el update él mismo, nunca delega al cliente.
- **`user_id` nullable en activity_log**: relaja la política de INSERT. Mitigación: sólo `service_role` puede insertar filas con `user_id IS NULL`.
- **`mustAffectRows` cambia el contrato de mutaciones existentes**: un update legítimo que no cambia filas (idempotente) pasaría a mostrar error. Mitigación: aplicarlo sólo a borrados y a updates de acción explícita del usuario.
- **Cachear el RPC de transiciones**: si se edita la tabla, la UI tarda en verlo. Mitigación: `staleTime` de 5 min e invalidación al abrir el modal.

## Checks propuestos

1. `UPDATE financial_requests SET status='completed'` desde `draft` por SQL directo → rechazado por el trigger, con mensaje literal.
2. `force_request_status(id, 'completed', '')` → rechazado por falta de motivo.
3. `force_request_status(id, 'completed', 'motivo real')` como admin → aplicado, y fila en `activity_log` con `action='status_forced'`, `user_id` del admin y el motivo.
4. `force_request_status` como AM → rechazado por rol.
5. Usuario con rol `finanzas` lee `activity_log` (antes: 0 filas; después: filas visibles).
6. Borrado de request por un project_manager → error real en UI ("no tienes permiso"), no toast de éxito; y el botón ya no se le muestra.
7. Aceptación de lote por token de F3 (`pending_specialist → in_progress` en N requests) sigue funcionando tras activar el trigger; rechazo (`→ draft`) también.
8. Gestión avanza un request de un especialista sin acceso a FLOW paso a paso: `pending_specialist → in_progress → pending_review → completed`, todos aceptados sin forzado.
9. `RequestFormModal` en creación ofrece exactamente 2 estados; en edición desde `in_progress` ofrece exactamente `pending_review` y `cancelled` (más el actual) para un AM.
10. Grep: cero referencias a `billed` / `accepted` / `approved` como estado de request en `src/`.

## Complejidad estimada

| Punto | Complejidad |
| --- | --- |
| 1. Fuente única + trigger | Alta |
| 2. Selector por rol + forzado | Alta |
| 3. activity_log | Media |
| 4. Higiene de borrado | Media |
| 5. Estados fantasma | Baja |
