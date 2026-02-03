-- Añadir campo de fecha estimada de facturación al cliente
ALTER TABLE public.budgets 
ADD COLUMN estimated_invoice_date date;

COMMENT ON COLUMN public.budgets.estimated_invoice_date 
IS 'Fecha estimada en que se facturará al cliente';