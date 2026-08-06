# F2 — Creación íntegra de requests

Plan de implementación. No se ejecuta nada hasta aprobación.

## Hallazgos previos (verificados contra código y base de datos)

Tres puntos del briefing no coinciden con el estado real y cambian el alcance:

1. **El gate de entregable no existe.** En `financial_requests` solo existe `deadline`. No existen `phase`, `requires_deliverable`, `deliverable_url` (ni `progress_pct`). Los triggers actuales son solo `set_request_code`, `trg_fill_request_work_period`, `trg_prevent_duplicate_budget_request` y `update_requests_updated_at`. F2 debe crear las columnas **y** el trigger de bloqueo; no basta con exponer campos en UI.
2. **Queda una segunda vía de desvinculación.** F1 arregló `BudgetFormModal`, pero el editor del bloque económico de `PresupuestoDetalle.tsx:570-578` sigue haciendo `update financial_requests set budget_item_id = null` antes de borrar líneas. Con `ON DELETE RESTRICT` esa ruta seguiría dejando huérfanos silenciosos, así que hay que convertirla en bloqueo antes de tocar la FK.
3. **Los dos cron jobs son idénticos.** Ambos (`generate-monthly-contract-requests`, jobid 1, `5 0 1 * *`; `generate-monthly-requests-monthly`, jobid 2, `0 6 1 * *`) hacen el mismo `http_post` a `generate-monthly-requests` con `{"auto_mode": true}`. Son mensuales el día 1 (no diarios). Ninguno está referenciado en código ni en `config.toml`; la única referencia a la función desde la app es la llamada manual de `ContractFormModal.tsx`.

También confirmado el **bug de clonación** (punto 7): `Solicitudes.tsx:282-325` y `SolicitudDetalle.tsx:189-230` excluyen la relación `budget_item` pero **no** las columnas `budget_item_id` ni `budget_id`, así que el clon hereda el puntero a la línea de presupuesto. Encaja con REQ-2026-295 / 384 / 385.

## Qué se construye

### 1. Función única de generación desde presupuesto (complejidad: media)

Nuevo hook `src/hooks/useGenerateBudgetRequests.tsx` con toda la lógica hoy duplicada en `useApproveBudget.tsx` y `PresupuestoDetalle.tsx:843-915`: cálculo de líneas pendientes, tarifas de especialista, coste, inserción.

- "Aprobar y Generar Solicitudes" = `update budgets.status='approved'` + la función.
- "Generar Requests" = solo la función.
- Misma guarda de "líneas sin servicio", mismo modal, mismo resultado observable.
- La notificación de aprobación (`notifyBudgetApproved`, PO Number) se queda donde está: es del acto de aprobar, no de generar.

### 2. Modal de confirmación con resumen por especialista (complejidad: alta)

Nuevo `src/components/budgets/GenerateRequestsConfirmModal.tsx`. Se abre siempre antes de insertar:

- Resumen agrupado por especialista: nº de requests, horas totales, coste total.
- Secciones de aviso (no bloqueante): líneas sin especialista, líneas sin horas o sin coste.
- Si el presupuesto ya tiene requests vivos, aviso explícito y listado solo de las líneas pendientes.
- Botón de confirmación explícito; nada se inserta antes.

### 3. `phase` y `deadline` en la generación y en creación manual (complejidad: media)

- Esquema: nueva columna `phase text` en `financial_requests`.
- En el modal: edición de `phase` y `deadline` por línea, más asignación en bloque sobre líneas seleccionadas. Ambos opcionales.
- `RequestFormModal.tsx`: `deadline` ya existe; se añade `phase`.
- Recurrentes desde contrato (`supabase/functions/generate-monthly-requests`): `deadline` = último día del `work_month` generado, `phase` = null.

### 4. Campos de entregable + snapshot de aprobación (complejidad: media)

- Esquema: `requires_deliverable boolean not null default false`, `deliverable_url text`, `deliverable_filename text`, `approved_by uuid REFERENCES public.profiles(id)`.
- Trigger `BEFORE UPDATE` único que hace gate y snapshot:
  - Al pasar a `completed`: si `requires_deliverable` y `deliverable_url` vacío → error. Si pasa, fijar `completed_at` (si nulo), `approved_by = auth.uid()` (si nulo) y `deliverable_filename = deliverable_url` (si nulo y hay URL).
  - Al salir de `completed`: `approved_by = NULL` y `completed_at = NULL`.
- UI: campos en `RequestFormModal` y en `SolicitudDetalle`, con mensaje de error claro cuando el gate salte.
- `progress_pct` no se añade en ningún sitio.

**Mecanismo exacto para que el especialista edite solo `deliverable_url`:** RPC `SECURITY DEFINER` `public.set_request_deliverable_url(_request_id uuid, _url text)`, que comprueba que el llamante es el especialista asignado al request (o admin/finanzas/gestión) y hace un `UPDATE` de esa única columna. `GRANT EXECUTE` a `authenticated`. No se toca la política `UPDATE` de `financial_requests` para especialistas: nada de abrir columnas adicionales por RLS.

### 5. FK a `ON DELETE RESTRICT` (complejidad: media)

Orden confirmado: primero el editor económico, después la FK.

1. Cambiar `PresupuestoDetalle.tsx:570-578`: en lugar de anular `budget_item_id`, comprobar si las líneas a borrar tienen requests vinculados y, si los hay, abortar el guardado con un aviso que nombre las líneas y sus requests.
2. Cambiar `financial_requests_budget_item_id_fkey` a `ON DELETE RESTRICT`.

Borrado de presupuesto completo (`Presupuestos.tsx:370-415`): ya borra `financial_requests` **antes** que `budget_items`, así que es compatible con RESTRICT. Aprobado el endurecimiento: se **bloquea** el borrado del presupuesto cuando alguno de sus requests tenga `billed_invoice_id` o `liquidation_id`, con aviso que enumere los requests implicados.

### 6. Cron: eliminar el job redundante (complejidad: baja)

Se elimina `generate-monthly-requests-monthly` (jobid 2). Se mantiene `generate-monthly-contract-requests` (jobid 1, `5 0 1 * *`), por nombre descriptivo del dominio y por ejecutarse primero. La función ya es idempotente por `contract_id` + `work_month`, por eso el duplicado no ha causado daño visible. Queda documentado en el propio plan y en el repositorio.

### 7. Reset de clonación (complejidad: baja)

En `Solicitudes.tsx` y `SolicitudDetalle.tsx`, añadir `budget_item_id: null` y `budget_id: null` al objeto insertado del clon.

**Confirmación pedida sobre re-vinculación (punto 2):** verificado en `RequestFormModal.tsx` — el campo `budget_id` es editable (línea 752, selector "Presupuesto") y el formulario exige origen (`contract_id` o `budget_id`, línea 76). Es decir, gestión **sí** puede re-vincular un clon a un presupuesto desde el formulario de edición. Matiz: `budget_item_id` (vínculo a la **línea** concreta) no es editable en el formulario; solo lo establece la generación desde presupuesto. Un clon quedará ligado al presupuesto pero no a una línea, que es exactamente el comportamiento deseado para no colisionar con el índice único de F1.


## Detalles técnicos

Migración única, con paso 0 de respaldo (`CREATE TABLE AS SELECT` de `financial_requests` antes de mutar):

```sql
ALTER TABLE public.financial_requests
  ADD COLUMN phase text,
  ADD COLUMN requires_deliverable boolean NOT NULL DEFAULT false,
  ADD COLUMN deliverable_url text,
  ADD COLUMN deliverable_filename text,
  ADD COLUMN approved_by uuid REFERENCES public.profiles(id);

-- trigger único: gate de entregable + snapshot de aprobación (no CHECK)
-- RPC set_request_deliverable_url (SECURITY DEFINER, columna única)
-- FK: DROP CONSTRAINT financial_requests_budget_item_id_fkey
--     ADD  ... REFERENCES public.budget_items(id) ON DELETE RESTRICT
```

Sin notificaciones (F3) y sin validación de transiciones de estado en BD (F4).

## Riesgos

- **Regresión de la ruta "Aprobar"**: al unificar, cualquier diferencia de comportamiento se nota en producción. Mitigación: la función replica exactamente la lógica actual y las notificaciones quedan fuera de ella.
- **RESTRICT sin el paso 1**: si la FK cambia antes de arreglar el editor económico, el guardado de presupuestos empieza a fallar con error de BD crudo.
- **`approved_by` en actualizaciones automáticas**: si un proceso de servidor completa un request sin sesión, `auth.uid()` es nulo y el snapshot queda vacío. Es aceptable: la columna queda nula, no bloquea.
- **Recurrentes con `deadline`**: al rellenar `deadline` cambia lo que ven filtros y avisos por vencimiento de los fees mensuales.
- **Volumen del modal**: presupuestos con muchas líneas requieren tabla compacta y selección múltiple usable.

## Checks de verificación

1. Doble generación: generar dos veces sobre el mismo presupuesto — la segunda muestra el aviso de requests existentes y solo ofrece líneas pendientes; con todas generadas, no inserta nada.
2. Presupuesto de prueba multi-especialista: los totales por especialista del modal (nº, horas, coste) cuadran con la suma de las líneas.
3. `phase` y `deadline`: asignación en bloque a 2 líneas seleccionadas y verificación de los valores en los requests creados.
4. Gate de entregable: request con `requires_deliverable` y sin URL no puede pasar a `completed`; con URL, sí.
5. RESTRICT: `DELETE` directo en SQL de una línea con request vinculado falla; el editor económico avisa antes de intentarlo.
6. Clon: clonar un request generado desde presupuesto produce un clon con `budget_item_id` y `budget_id` nulos y sin colisión de índice.
7. Cron: queda un único job activo y la generación mensual sigue funcionando en ejecución manual.
8. Snapshot: completar un request con entregable rellena `approved_by`, `completed_at` y `deliverable_filename`; al salir de `completed` se liberan `approved_by` y `completed_at`.
9. `phase` asignable también en creación manual desde `RequestFormModal`.


## Complejidad por punto

| Punto | Complejidad |
|---|---|
| 1. Función única de generación | Media |
| 2. Modal con resumen por especialista | Alta |
| 3. `phase` y `deadline` | Media |
| 4. Entregable + snapshot de aprobación + RPC | Media |
| 5. FK a RESTRICT (+ editor económico) | Media |
| 6. Limpieza de cron | Baja |
| 7. Reset de clonación | Baja |
