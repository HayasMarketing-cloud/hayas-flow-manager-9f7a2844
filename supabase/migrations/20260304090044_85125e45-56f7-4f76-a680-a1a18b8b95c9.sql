
-- liquidation_items: permitir unit_price y total negativos
ALTER TABLE public.liquidation_items DROP CONSTRAINT IF EXISTS liquidation_items_unit_price_check;
ALTER TABLE public.liquidation_items DROP CONSTRAINT IF EXISTS liquidation_items_total_check;

-- liquidations: permitir subtotal, tax_amount y total_amount negativos
ALTER TABLE public.liquidations DROP CONSTRAINT IF EXISTS liquidations_subtotal_check;
ALTER TABLE public.liquidations DROP CONSTRAINT IF EXISTS liquidations_tax_amount_check;
ALTER TABLE public.liquidations DROP CONSTRAINT IF EXISTS liquidations_total_amount_check;
