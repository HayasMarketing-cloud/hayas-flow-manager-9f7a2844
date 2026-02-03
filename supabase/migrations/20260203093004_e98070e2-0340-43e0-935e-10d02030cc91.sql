-- Añadir campo PO Number / Referencia cliente a presupuestos
ALTER TABLE public.budgets 
ADD COLUMN client_po_number text DEFAULT 'Pendiente';

COMMENT ON COLUMN public.budgets.client_po_number 
IS 'Número de orden de compra o referencia del cliente';