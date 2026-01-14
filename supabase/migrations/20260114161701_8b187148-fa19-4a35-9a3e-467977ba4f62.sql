-- Añadir columna para vincular presupuesto a contrato (opcional)
ALTER TABLE public.budgets 
ADD COLUMN contract_id uuid REFERENCES public.contracts(id);

COMMENT ON COLUMN public.budgets.contract_id IS 'Contrato asociado al presupuesto (opcional)';