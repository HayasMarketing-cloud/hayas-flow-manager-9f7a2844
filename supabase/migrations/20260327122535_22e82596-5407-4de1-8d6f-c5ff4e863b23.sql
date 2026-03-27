ALTER TABLE public.financial_requests ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS notes text;