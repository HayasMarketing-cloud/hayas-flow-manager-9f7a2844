-- Añadir campos para el precio de venta al cliente
ALTER TABLE public.financial_requests 
ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS sale_amount numeric DEFAULT 0;

-- Comentarios explicativos
COMMENT ON COLUMN public.financial_requests.unit_price IS 'Precio unitario de venta al cliente';
COMMENT ON COLUMN public.financial_requests.sale_amount IS 'Importe total de venta (unit_price * quantity)';

-- Actualizar requests existentes con los importes de sus budget_items
UPDATE financial_requests fr
SET 
  unit_price = bi.unit_price,
  sale_amount = bi.total
FROM budget_items bi
WHERE fr.budget_id = bi.budget_id
  AND fr.title = bi.description
  AND (fr.unit_price IS NULL OR fr.unit_price = 0);