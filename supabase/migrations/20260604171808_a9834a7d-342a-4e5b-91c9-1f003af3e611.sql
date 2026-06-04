ALTER TABLE public.financial_requests
  ADD COLUMN IF NOT EXISTS is_recurring_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS template_source_id uuid REFERENCES public.financial_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bill_separately boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_fr_recurring_templates
  ON public.financial_requests(contract_id, is_recurring_template, recurrence_active)
  WHERE is_recurring_template = true;

CREATE INDEX IF NOT EXISTS idx_fr_template_source
  ON public.financial_requests(template_source_id, work_month, work_year)
  WHERE template_source_id IS NOT NULL;