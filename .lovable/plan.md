# Validación de liquidaciones por Account Manager

Flujo paralelo a la firma del especialista: Admin/Finanzas envían la liquidación a los AMs implicados, que entran autenticados, ven el detalle y marcan **Validar** o **Incidencia** con notas. Es **informativo** (no bloquea pagar) y requiere validación de **todos** los AMs implicados.

## 1. Modelo de datos

Nueva tabla `liquidation_am_reviews`:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `liquidation_id` | uuid FK → liquidations (ON DELETE CASCADE) | |
| `am_user_id` | uuid (auth.users.id) | AM al que se le pide la validación |
| `status` | text | `pending` \| `validated` \| `issue` |
| `notes` | text | comentarios del AM |
| `requested_at` | timestamptz | cuándo se envió |
| `reviewed_at` | timestamptz | cuándo respondió |
| `requested_by` | uuid | quien disparó el envío |
| `created_at` / `updated_at` | timestamptz | |

Único: `(liquidation_id, am_user_id)`.

**RLS:**
- AM: SELECT/UPDATE solo sus propias filas (`am_user_id = auth.uid()`).
- Admin/Finanzas: ALL.
- Especialista: sin acceso.

Grants: `authenticated` + `service_role`.

Sin nuevos campos en `liquidations` — el estado agregado se deriva de las reviews.

## 2. Resolución de AMs implicados

Función SECURITY DEFINER `get_liquidation_am_user_ids(_liquidation_id uuid) RETURNS uuid[]` que:

1. Recorre `liquidation_items` → `financial_requests` de la liquidación.
2. Para cada request resuelve AM según jerarquía:
   - `budgets.am_user_id` (si `budget_id`)
   - `contracts.am_user_id` (si `contract_id`)
   - `client_assignments(role='account_manager')` del cliente del request (fallback)
3. Devuelve el set deduplicado de uuids no nulos.

Si el resultado es vacío → no se puede enviar (aviso UI).

## 3. Edge Functions

**`send-liquidation-am-validation`** (nueva)
- Input: `{ liquidation_id }`
- Auth: admin/finanzas.
- Calcula AMs con la función SQL.
- Hace upsert en `liquidation_am_reviews` (pending) por cada AM.
- Para cada AM envía email (template `liquidation-am-review-request`) con link directo `/liquidaciones/:id?am_review=1`.
- Crea notificación in-app por cada AM.

**Sin token público:** el AM ya tiene cuenta, accede autenticado y RLS filtra.

## 4. Backend de respuesta del AM

Sin edge function — el AM hace UPDATE directo sobre su fila de `liquidation_am_reviews` (RLS lo limita). Trigger `set_reviewed_at` para autocompletar `reviewed_at` cuando `status` pasa de `pending` a `validated`/`issue`.

Trigger AFTER UPDATE: si `status = 'issue'` → inserta notificación a admin/finanzas y envía email vía función existente.

## 5. UI — `LiquidacionDetalle.tsx`

**Panel "Validación AM"** visible siempre que existan reviews:

- Lista de AMs con badge por estado (pending / validated / issue) y nota.
- Botón **"Enviar a AM para validación"** (admin/finanzas, estado liquidación ∈ draft/validated/sent/disputed). Si ya hay reviews, botón pasa a **"Reenviar"** (re-emails sin crear duplicados).
- Si el usuario actual es AM de la liquidación → tarjeta destacada con botones **Validar** / **Marcar incidencia** + textarea de notas, y muestra su review existente editable.

**Card de liquidación (`LiquidationCard`):** nuevo badge agregado:
- "Pendiente AM (1/3)" si hay alguna pending
- "Incidencia AM" si alguna en issue
- "Validado AM ✓" si todas validated
- Sin badge si no se ha enviado

## 6. Email

Nuevo template app email `liquidation-am-review-request`:
- Asunto: `Validación pendiente: liquidación {code} de {especialista}`
- CTA al detalle de la liquidación.
- Resumen: periodo, especialista, total, nº items.

Trigger desde la nueva edge function, idempotency key `am-review-{liquidation_id}-{am_user_id}-{requested_at}`.

## 7. Hook

`useLiquidationAmReviews(liquidationId)` con React Query:
- Lista reviews + AM info (profile name/email).
- Mutaciones: `sendForValidation`, `respondAsAm({ status, notes })`, `resend`.
- Invalida también la query de la liquidación para refrescar el badge agregado.

## 8. Notificaciones in-app

Reusar `notifications`:
- AM recibe noti "Liquidación pendiente de tu validación".
- Admin/Finanzas reciben noti cuando AM marca `issue` (con la nota incluida).
- Admin/Finanzas reciben noti cuando **todos** los AMs han validado (badge verde).

## 9. Caso límite confirmado

Requests sin budget/contract y sin AM en `client_assignments` → se ignoran en el cálculo. Si la liquidación entera no tiene AMs → toast "Esta liquidación no tiene AM asignado en ningún request" y se deshabilita el envío.

## 10. Memoria de proyecto

Añadir `mem://features/liquidations/am-validation-workflow` describiendo:
- Resolución AM (budget → contract → client_assignments)
- Validación múltiple (todos los AMs)
- Carácter informativo (no bloquea pago)
- Tabla `liquidation_am_reviews`

---

## Resumen técnico (orden de implementación)

1. Migración: tabla + RLS + grants + función SQL + triggers.
2. Edge function `send-liquidation-am-validation` + template email.
3. Hook `useLiquidationAmReviews`.
4. Panel UI en `LiquidacionDetalle` + badge en `LiquidationCard`.
5. Memoria.

**Fuera de alcance (futuro):** validación PM, validación bloqueante para pago, historial de cambios de notas (por ahora se sobreescribe la nota al actualizar).
