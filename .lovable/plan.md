# F3 — Notificaciones

Objetivo: un único email por especialista al asignar un lote de requests, aceptación de lote en un clic, y destinatarios de gestión resueltos dinámicamente (fin de `info@hayas.es`).

## Alcance

1. Email agrupado de asignación (generación desde presupuesto y asignación en lote de requests existentes).
2. Tokens de lote mediante tabla puente `request_action_token_items`.
3. Destinatarios de gestión dinámicos (AM de origen + admin/finanzas, deduplicados).
4. Reglas por origen: presupuesto → agrupado; manual individual → email actual; recurrentes de contrato → sin email.
5. Normalización y autocompletado de `phase` — **ya implementado** en el turno anterior (`normalizePhase` / `canonicalizePhase` en `src/lib/budget-request-generation.ts` y datalist en el modal). En F3 solo queda verificarlo.

## Esquema (migración única, con paso 0 de respaldo)

Paso 0: `CREATE TABLE public._backup_request_action_tokens_<fecha> AS SELECT * FROM public.request_action_tokens;`

Cambios:

- `request_action_tokens`: `request_id` pasa a **nullable** (los tokens de lote no apuntan a un request único) y se añade `action_type = 'specialist_batch_response'` como valor admitido. Los tokens existentes conservan su `request_id` y siguen funcionando sin cambios.
- Nueva tabla `request_action_token_items`:
  - `id uuid pk`, `token_id uuid not null references request_action_tokens(id) on delete cascade`, `request_id uuid not null references financial_requests(id) on delete cascade`, `status text not null default 'pending'` (`pending` | `accepted` | `skipped`), `processed_at timestamptz`, `created_at timestamptz`.
  - `unique (token_id, request_id)`.
  - Índices por `token_id` y por `request_id`.
  - GRANTs: solo `service_role` (todo el ciclo pasa por Edge Functions). Sin GRANT a `anon`/`authenticated`.
  - RLS activada; política de lectura únicamente para admin/finanzas (igual que `request_action_tokens`). Ninguna política para `anon`.
- Check de integridad por trigger: un token con `action_type = 'specialist_batch_response'` debe tener `request_id IS NULL` y al menos una fila en la tabla puente; un token individual debe tener `request_id NOT NULL`.

### Ciclo de vida del token de lote

- **Generación**: al confirmar el modal de generación (o la asignación en lote), la función `send-batch-assignment-notification` agrupa los requests por especialista y, por cada especialista, crea **un** token (`uuid` v4 aleatorio, columna `token`) con `expires_at = now() + 7 días`, `status = 'pending'`, más N filas en `request_action_token_items`. Antes de crearlo, invalida (`status = 'expired'`) tokens pendientes previos que cubran esos mismos requests.
- **Validación**: `validate-request-action-token` se amplía; si el token es de lote devuelve la lista de requests del lote con su estado actual en lugar de un único request. Comprueba existencia, `expires_at > now()` y `status = 'pending'`.
- **Un solo uso**: al procesarse, el token pasa a `accepted`/`rejected` con `acted_at`, IP y user-agent. Cualquier reintento cae en la comprobación `status <> 'pending'` → rechazo.
- **Anti-falsificación**: el token es un UUID aleatorio de 122 bits generado en servidor, nunca derivado de datos del request; la tabla no es legible por `anon` ni `authenticated`; toda la resolución ocurre en Edge Functions con `service_role`; el alcance del lote lo fija la tabla puente en el momento de emisión, así que manipular la URL no permite añadir requests. El formato UUID se valida antes de consultar.

### Decisión completa y lote parcial

La decisión del especialista sobre el lote es **completa**: aceptar todo o rechazar todo, sin selección por ítem. El email y la página del token incluyen una línea explícita para discrepancias puntuales: contactar antes de aceptar, o aceptar y comentar, dejando claro que horas y deadline son ajustables tras la aceptación.

Al aceptar, la función recorre las filas puente y aplica, por request:

- `status = 'pending_specialist'` **y** `specialist_id` coincide con el `specialist_id` persistido en el token → pasa a `in_progress`, `specialist_acceptance = true`, item `accepted`.
- cualquier otro caso (ya avanzado, cancelado, o reasignado a otro especialista) → no se toca, item `skipped` con el estado/motivo encontrado.

El token se marca usado igualmente. La respuesta devuelve `{ accepted: [...], skipped: [{code, status, reason}] }` y la página `/solicitud/accion/:token` muestra ambos bloques. Un lote donde **todos** los items estén skipped no se considera error: se informa de que ya no había nada pendiente. Rechazo (`reject`) aplica la misma lógica devolviendo los pendientes a `draft`.


## Funciones y ficheros afectados

- **Nueva** `supabase/functions/send-batch-assignment-notification/index.ts`: agrupa por especialista, crea tokens + items (con `specialist_id`), compone y envía el email agrupado vía Gmail (mismo mecanismo de impersonación @hayas.es ya usado en `send-request-notification`). Acepta `resend: true` para reemitir el lote de un especialista concreto.
- **Nuevo** `supabase/functions/_shared/management-recipients.ts`: resuelve destinatarios de gestión — AM/PM del presupuesto o contrato de origen (o `client_assignments` como fallback) + usuarios con rol `admin` y `finanzas` vía `user_roles → profiles.email`, filtrado `@hayas.es` y deduplicado por email en minúsculas. Mismo patrón que `send-liquidation-email`.
- `supabase/functions/process-request-action/index.ts`: rama de lote (recorrido de items, parciales, verificación anti-reasignación) y sustitución del bloque de destinatarios actual (líneas 364-372) por el helper compartido. **Esta misma función compone y envía la notificación agregada de vuelta a gestión**: un único email por acto de lote, con tabla de aceptados y de omitidos (código, título, motivo) y totales, en lugar de un email por request. Los eventos individuales (creación manual, terminado, correcciones, aprobado) siguen generando emails unitarios.
- `supabase/functions/validate-request-action-token/index.ts`: soporte de tokens de lote.
- `src/pages/AccionRequest.tsx`: render de lote (tabla de requests, aviso de discrepancias, resultado con aceptados/omitidos).
- `src/components/requests/RequestFlowActions.tsx`: elimina `managementEmail = 'info@hayas.es'` (línea 248); los eventos de flujo dejan de pasar un destinatario fijo y el envío resuelve destinatarios en el servidor.
- `src/pages/SolicitudDetalle.tsx` y `src/hooks/useOperationalProjects.tsx`: ajustan la invocación al nuevo contrato (sin `recipientEmail` para eventos hacia gestión).
- `src/lib/budget-request-generation.ts` + `src/hooks/useGenerateBudgetRequests.tsx`: tras insertar, invocan la notificación agrupada con los ids creados.
- `src/pages/PresupuestoDetalle.tsx`: **punto de reenvío**. En el bloque de requests del presupuesto, agrupados por especialista, una acción "Reenviar asignación a {especialista}" (visible para gestión) que invoca la función con `resend: true`; invalida el token pendiente anterior y emite uno nuevo con 7 días. Se muestra el estado del último envío (fecha, o "no enviado") por especialista.
- `supabase/functions/generate-monthly-requests/index.ts`: se verifica que no invoca ninguna notificación (regla 4); sin cambios previstos.


### Estructura del email agrupado

1. Cabecera Hayas + asunto `N nuevos trabajos asignados — {Cliente}` (o `{Cliente} · {Presupuesto}`).
2. Saludo al especialista y una línea de contexto (cliente, presupuesto de origen).
3. Tabla: **Código · Título · Fase · Horas · Deadline**.
4. Fila de totales: nº de requests, horas totales, coste total para ese especialista.
5. CTA principal "Aceptar asignación" (todo el lote) + enlace secundario "Ver en FLOW".
6. Nota de caducidad (7 días) y aviso de que los requests que ya hayan cambiado de estado no se verán afectados.
7. Pie estándar.

## Riesgos

- **Envío parcial**: si falla el email de un especialista, los requests ya están creados. Mitigación: la notificación no bloquea la generación; se reporta por toast y el reenvío queda disponible desde el listado.
- **Reasignación posterior**: un token de lote emitido para el especialista A cubre requests que pueden reasignarse a B. Mitigación: al procesar se verifica que el `specialist_id` actual coincide con el del token; si no, el item se marca `skipped`.
- **Volumen de emails de gestión**: admin + finanzas + AM puede dar varios destinatarios por evento. Mitigación: deduplicación y filtro `@hayas.es`.
- **Cuota Gmail API**: un envío por especialista y evento; sigue muy por debajo del límite, pero se registran fallos por destinatario sin abortar el resto.
- **Tokens huérfanos**: `on delete cascade` en ambas FKs evita filas puente sin request o sin token.

## Checks de verificación

1. Especialista con 5 requests generados en un mismo acto recibe **1** email con 5 filas y totales (nº, horas, coste) correctos.
2. Aceptar el lote mueve exactamente esos 5 requests a `in_progress` y ninguno más (verificación por consulta antes/después).
3. Token caducado → rechazo con mensaje claro; token ya usado → rechazo.
4. Lote parcial: se avanza manualmente 1 de los 5 antes de aceptar; el resultado acepta 4 e informa del omitido, sin error.
5. Evento de flujo (aceptado / terminado / correcciones / aprobado) llega al AM del presupuesto + admin + finanzas, deduplicado si el AM es también admin, y **no** a `info@hayas.es`.
6. Ejecución del cron de recurrentes: 0 emails enviados (log de la función y ausencia de tokens nuevos).
7. Grep en el repo: cero ocurrencias de `info@hayas.es` como destinatario.
8. Autocompletado de `phase` en el modal sugiere las fases existentes del presupuesto y `" fase  1 "` se guarda como `Fase 1` reutilizando la grafía existente.

## Complejidad estimada

| Punto | Complejidad |
| --- | --- |
| 1. Email agrupado | Alta |
| 2. Tabla puente y tokens de lote | Media |
| 3. Destinatarios dinámicos | Media |
| 4. Reglas por origen | Baja |
| 5. Phase (ya hecho, solo verificación) | Baja |
