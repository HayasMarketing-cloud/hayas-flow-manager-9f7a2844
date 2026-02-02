-- Create invoice_budget_allocations table for N:M relationship
CREATE TABLE public.invoice_budget_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE RESTRICT,
  allocated_amount NUMERIC NOT NULL CHECK (allocated_amount > 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Un presupuesto solo puede aparecer una vez por factura
  UNIQUE(invoice_id, budget_id)
);

-- Trigger para updated_at
CREATE TRIGGER update_invoice_budget_allocations_updated_at
  BEFORE UPDATE ON public.invoice_budget_allocations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.invoice_budget_allocations ENABLE ROW LEVEL SECURITY;

-- Policy for finance and admin to manage allocations
CREATE POLICY "Finance and admin can manage allocations"
  ON public.invoice_budget_allocations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role));

-- Policy for AM to view allocations from assigned clients
CREATE POLICY "AM can view allocations from assigned budgets"
  ON public.invoice_budget_allocations FOR SELECT
  USING (
    budget_id IN (
      SELECT id FROM public.budgets WHERE am_user_id = auth.uid() OR pm_user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'finanzas'::app_role)
  );

-- Migrate existing budget_id from invoices to allocations
INSERT INTO public.invoice_budget_allocations (invoice_id, budget_id, allocated_amount)
SELECT 
  id AS invoice_id,
  budget_id,
  total_amount AS allocated_amount
FROM public.invoices
WHERE budget_id IS NOT NULL;