-- 1) FK budget_item_id: SET NULL -> RESTRICT
ALTER TABLE public.financial_requests
  DROP CONSTRAINT IF EXISTS financial_requests_budget_item_id_fkey;

ALTER TABLE public.financial_requests
  ADD CONSTRAINT financial_requests_budget_item_id_fkey
  FOREIGN KEY (budget_item_id) REFERENCES public.budget_items(id) ON DELETE RESTRICT;

-- 2) Eliminar cron duplicado
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-monthly-requests-monthly') THEN
    PERFORM cron.unschedule('generate-monthly-requests-monthly');
  END IF;
END $$;