-- Añadir campos de asociación directa a invoices
ALTER TABLE public.invoices 
ADD COLUMN budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL,
ADD COLUMN contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
ADD COLUMN billing_period_month integer CHECK (billing_period_month >= 1 AND billing_period_month <= 12),
ADD COLUMN billing_period_year integer CHECK (billing_period_year >= 2000 AND billing_period_year <= 2100);

-- Crear índices para performance
CREATE INDEX idx_invoices_budget_id ON public.invoices(budget_id);
CREATE INDEX idx_invoices_contract_id ON public.invoices(contract_id);