-- Multi-payment plan for budgets (JSONB)
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS payment_plan jsonb;

-- Source milestone index for invoices (idempotency for draft generation)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS source_milestone_index integer;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_invoices_budget_milestone
  ON public.invoices (budget_id, source_milestone_index)
  WHERE source_milestone_index IS NOT NULL;

-- Google Sheet master URL for contracts (1 sheet per contract, 1 tab per month)
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS detail_sheet_url text;