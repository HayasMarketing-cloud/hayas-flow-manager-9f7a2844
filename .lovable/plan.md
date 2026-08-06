# Sprint Requests — Fase 1 (revisada y aprobada con cambios)

## 0. Evidencia empírica solicitada (ya verificada, sin tocar código)

### 0.1 Veredicto sobre B1.2 — causa real de los duplicados de PRE-2026-045

Los datos confirman que **no fue una edición manual del bloque económico lo que borró el vínculo, sino el patrón de escritura del editor**:

- Los 16 `budget_items` del PRE-2026-045 tienen **todos** `created_at = updated_at = 2026-07-01 15:54:22.671035+00` (timestamp idéntico al microsegundo → una única inserción en bloque).
- Los 16 requests originales se crearon el **2026-06-30 16:49:19** — es decir, **antes** que los items que hoy existen. Los items a los que apuntaban ya no existen.
- Los 16 requests originales tienen hoy `budget_item_id = NULL` (todos).

Patrón de escritura del editor (verificado en código):

- `src/components/budgets/BudgetFormModal.tsx:273` — al editar un presupuesto ejecuta `delete().eq('budget_id', budget.id)` sobre `budget_items` y **reinserta** todas las líneas (`:288-289`). Es **delete + reinsert**, no update in-place. No hay diffing por id.
- `supabase/migrations/20251212110031_*.sql:2` — la FK es `REFERENCES budget_items(id) ON DELETE SET NULL`. Por tanto **cualquier guardado del presupuesto pone a NULL el `budget_item_id` de todos sus requests**, aunque el usuario solo cambiara el precio de una línea.
- `src/pages/PresupuestoDetalle.tsx:573-574` — segundo punto que escribe `budget_item_id: null` explícitamente, al detectar items eliminados.
- `src/pages/Presupuestos.tsx:404-406` — borra items al eliminar presupuesto (aceptable).

**Conclusión de diseño para B1.2:** el problema no se resuelve solo con un índice único sobre `budget_item_id`, porque el vínculo se destruye desde el propio editor. B1.2 pasa a tener dos piezas:

1. **Editor idempotente:** `BudgetFormModal` deja de hacer delete+reinsert y pasa a diff por `id` (update de existentes, insert de nuevos, delete solo de los realmente eliminados).
2. **Guarda de generación:** dedupe por `budget_item_id` **y**, como red de seguridad, por firma `(budget_id, description, quantity, unit_price)` cuando `budget_item_id` sea NULL.

### 0.2 Los 14 requests en `pending_approval` (previo al remapeo)

| Código | Título | Especialista | Cliente |
|---|---|---|---|
| REQ-2026-219 | New Page Redesign | Tomás White | ASENDIA HQ |
| REQ-2026-483 | DE_Home, ePAQ, Parcel Delivery, SmartDesign, SD Section About US | Iolanda Carbone | ASENDIA HQ |
| REQ-2026-485 | CN_Home, ePAQ, Parcel Delivery, SmartDesign, SD Section About US | Iolanda Carbone | ASENDIA HQ |
| REQ-2026-486 | CN_Translations | Iolanda Carbone | ASENDIA HQ |
| REQ-2026-487 | HK_Home, ePAQ, Parcel Delivery, SmartDesign, SD Section About US | Iolanda Carbone | ASENDIA HQ |
| REQ-2026-488 | IT_Home, ePAQ, Parcel Delivery, SmartDesign, SD Section About US | Iolanda Carbone | ASENDIA HQ |
| REQ-2026-489 | IT_Translations | Iolanda Carbone | ASENDIA HQ |
| REQ-2026-490 | ES_Home, ePAQ, Parcel Delivery, SmartDesign, SD Section About US | Iolanda Carbone | ASENDIA HQ |
| REQ-2026-491 | ES_Translations | Iolanda Carbone | ASENDIA HQ |
| REQ-2026-492 | OC_Home, ePAQ, Parcel Delivery, SmartDesign, SD Section About US | Iolanda Carbone | ASENDIA HQ |
| REQ-2026-493 | SG_Home, ePAQ, Parcel Delivery, SmartDesign, SD Section About US | Iolanda Carbone | ASENDIA HQ |
| REQ-2026-494 | SE_Home, ePAQ, Parcel Delivery, SmartDesign, SD Section About US | Iolanda Carbone | ASENDIA HQ |
| REQ-2026-496 | DK_Home, ePAQ, Parcel Delivery, SmartDesign, SD Section About US | Iolanda Carbone | ASENDIA HQ |
| REQ-2026-498 | USA_Home, ePAQ, Parcel Delivery, SmartDesign, SD Section About US | Iolanda Carbone | ASENDIA HQ |

Destino tras tus ajustes: los **13 de Iolanda (REQ-2026-483 … 498)** pasan a `in_progress` (ya habían aceptado; devolverlos a `pending_specialist` desharía la aceptación). **REQ-2026-219** se excluye del remapeo y pasa a `cancelled` con nota.

## 1. Alcance de F1 (tras tus decisiones)

Incluye:

- Respaldo interno de tablas afectadas (paso 0).
- Retirada operativa de `pending_approval`: 13 requests → `in_progress`, REQ-2026-219 → `cancelled`.
- Índice único parcial anti-duplicados en `financial_requests`.
- Trigger de guarda contra regeneración sobre requests desvinculados.
- Limpieza TS de los 11 ficheros que referencian `pending_approval`.
- Editor idempotente (`BudgetFormModal`), causa raíz verificada.

Excluye (movido o descartado):

- **`progress_pct`: eliminado de F1 y de todo el sprint.** El avance de fase se calcula como `requests completados / requests totales`; el semáforo de Proyectos será `estado + deadline`.
- `activity_log`: `finanzas` en SELECT, `user_id` nullable y campo `source` → **F4**, junto con B7.
- Validación de transiciones de estado en BD → **F4**, con una única fuente compartida con la UI.
- Re-vinculación de los 167 requests históricos con `budget_id` y sin `budget_item_id`: **no se hace**. El índice y las guardas protegen solo lo nuevo.
- Tabla puente para tokens de lote (Q4): se diseña en su fase, no en F1.
- B6.1 (dejar de crear `operational_projects` desde el cron) se mantiene en el sprint aunque B6.2 se reduzca a ocultar.

Deuda menor aceptada: el valor `pending_approval` queda **zombi** en el enum (Postgres no permite eliminar valores sin recrear el tipo). Sin uso ni exposición en UI; la recreación del tipo se hará en una ventana futura y F4 añadirá la validación de transiciones que impide reescribirlo.

## 2. Migraciones SQL de F1

**Paso previo: copia de seguridad de la BD por tu parte, además del respaldo interno del paso 0.**

```sql
-- 0) Respaldo interno (se elimina cuando F1 esté consolidada)
CREATE TABLE public._backup_financial_requests_20260806 AS
  SELECT * FROM public.financial_requests;
CREATE TABLE public._backup_budget_items_20260806 AS
  SELECT * FROM public.budget_items;

-- 1a) Los 13 de Iolanda: ya habían aceptado → in_progress
UPDATE public.financial_requests
   SET status = 'in_progress'
 WHERE status = 'pending_approval'
   AND code <> 'REQ-2026-219';

-- 1b) REQ-2026-219: cancelado en limpieza
UPDATE public.financial_requests
   SET status = 'cancelled',
       notes = COALESCE(notes || E'\n', '') ||
         'Pendiente de Elliott, sin respuesta — cancelado en limpieza 08/2026'
 WHERE code = 'REQ-2026-219';

-- 2) Índice único parcial: un request por línea de presupuesto
CREATE UNIQUE INDEX IF NOT EXISTS uniq_request_per_budget_item
  ON public.financial_requests (budget_item_id)
  WHERE budget_item_id IS NOT NULL;

-- 3) Guarda: bloquear regeneración cuando ya existe el mismo trabajo desvinculado
CREATE OR REPLACE FUNCTION public.prevent_duplicate_budget_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.budget_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.financial_requests fr
      WHERE fr.budget_id = NEW.budget_id
        AND fr.budget_item_id IS NULL          -- request huérfano preexistente
        AND fr.status <> 'cancelled'
        AND fr.title = NEW.title
        AND fr.quantity = NEW.quantity
        AND COALESCE(fr.unit_price, 0) = COALESCE(NEW.unit_price, 0)
    ) THEN
      RAISE EXCEPTION
        'Ya existe un request equivalente (sin vínculo a línea) para este presupuesto: %. Revisa antes de regenerar.',
        NEW.title;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_prevent_duplicate_budget_request
BEFORE INSERT ON public.financial_requests
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_budget_request();
```

Dirección corregida según el incidente real: se dispara en **todo INSERT con `budget_id`** (tenga o no `budget_item_id`) y compara contra los requests **desvinculados** del mismo presupuesto. Dos líneas idénticas en un presupuesto nuevo no se bloquean, porque sus requests nacen **con** `budget_item_id`.

## 3. Limpieza TypeScript (11 ficheros)

Eliminar `pending_approval` de etiquetas, filtros, badges y acciones en:
`src/lib/request-utils.ts`, `src/components/requests/RequestFlowActions.tsx`, `RequestStatusBadge.tsx`, `FlowStatusCell.tsx`, `RequestFlowIndicator.tsx`, `RequestProcessTimeline.tsx`, `RequestTableView.tsx`, `src/hooks/useRequestFilters.tsx`, `src/pages/Solicitudes.tsx`, `src/pages/SolicitudDetalle.tsx`, `src/components/modals/RequestFormModal.tsx`.

Los mapas tipados `Record<FinancialRequestStatus, …>` conservarán la clave zombi mínima necesaria para compilar, sin etiqueta ni opción en filtros.

Además, en el mismo despliegue: **editor idempotente** en `BudgetFormModal.tsx` (diff por `id`: update de existentes, insert de nuevos, delete solo de los realmente eliminados) en sustitución del `delete + reinsert` de la línea 273.

## 4. Checks de verificación (4 originales + 2 nuevos)

1. `SELECT count(*) FROM financial_requests WHERE status='pending_approval'` → 0.
2. Índice `uniq_request_per_budget_item` presente y válido.
3. Doble generación sobre presupuesto de prueba ad hoc → segunda ejecución bloqueada.
4. `rg pending_approval src/` → sin coincidencias funcionales.
5. **(nuevo)** Presupuesto de prueba con **dos líneas idénticas** → se generan **ambos** requests sin bloqueo.
6. **(nuevo)** Escenario legacy simulado (requests con `budget_item_id NULL` + regeneración) → bloqueo con el mensaje del trigger.

## 5. Orden de fases y complejidad (según briefing)

| Orden | Fase | Complejidad |
|---|---|---|
| F1 | Migraciones, triggers, limpieza TS, editor idempotente | Media |
| F2 | Creación íntegra: generación unificada + modal resumen por especialista | Alta |
| F3 | Notificaciones (email agrupado enganchado al flujo de generación) | Media |
| F4 | Transiciones de estado, `activity_log`, auditoría | Alta |
| F5/F6 | Vistas y operativa | Baja-Media |

## 6. Backup y restauración en Lovable Cloud (documentación, no bloquea F1)

Lo que puedo confirmar desde el producto:

- **Export de datos:** Cloud → Advanced settings → *Export data*. Descarga los datos; **solo exporta, no importa**.
- **Exportes puntuales:** cualquier tabla o consulta a CSV bajo demanda (lo hemos usado ya).
- **Respaldo lógico dentro de la propia BD:** tablas `_backup_*` como las del paso 0 — es el mecanismo bajo nuestro control directo y el que usamos como red para F1.
- **Version history del proyecto:** revierte código, **no** revierte la base de datos.

Lo que **no** puedo afirmar sin verificarlo con soporte: si el plan actual incluye backups automáticos diarios retenidos, si hay *point-in-time restore*, y cuál es el procedimiento y el RTO para solicitar una restauración. No hay panel de restauración self-service expuesto en Cloud. Recomendación: antes de arrancar F2, abrir consulta a soporte de Lovable con esas tres preguntas concretas y, mientras tanto, mantener la política de export + tablas `_backup_*` antes de cada migración destructiva.

