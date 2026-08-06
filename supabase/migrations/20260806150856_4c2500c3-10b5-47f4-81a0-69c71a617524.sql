-- 0) Respaldo interno (se elimina cuando F1 esté consolidada)
DROP TABLE IF EXISTS public._backup_financial_requests_20260806;
DROP TABLE IF EXISTS public._backup_budget_items_20260806;
CREATE TABLE public._backup_financial_requests_20260806 AS
  SELECT * FROM public.financial_requests;
CREATE TABLE public._backup_budget_items_20260806 AS
  SELECT * FROM public.budget_items;

-- 1a) Los 13 de Iolanda: ya habían aceptado -> in_progress
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

-- 1c) Saneado: vínculos a líneas de OTRO presupuesto (clones históricos)
UPDATE public.financial_requests fr
   SET budget_item_id = NULL
  FROM public.budget_items bi
 WHERE bi.id = fr.budget_item_id
   AND fr.budget_id IS DISTINCT FROM bi.budget_id;

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
        AND fr.budget_item_id IS NULL
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

DROP TRIGGER IF EXISTS trg_prevent_duplicate_budget_request ON public.financial_requests;
CREATE TRIGGER trg_prevent_duplicate_budget_request
BEFORE INSERT ON public.financial_requests
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_budget_request();