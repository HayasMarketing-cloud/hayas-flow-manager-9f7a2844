
ALTER TABLE public.liquidation_items DROP CONSTRAINT IF EXISTS liquidation_items_quantity_check;
ALTER TABLE public.liquidation_items ALTER COLUMN quantity TYPE numeric(10,2) USING quantity::numeric(10,2);
ALTER TABLE public.liquidation_items ADD CONSTRAINT liquidation_items_quantity_check CHECK (quantity > 0);
