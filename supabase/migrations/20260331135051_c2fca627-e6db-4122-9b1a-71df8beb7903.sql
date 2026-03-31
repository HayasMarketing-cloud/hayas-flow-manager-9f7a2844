-- Fix duplicate 28€ commission item: should be 141€ for Factura 2026/10 (Asendia Spain)
UPDATE public.liquidation_items
SET description = 'Comisión AM (10%) — Factura Nº 2026/10',
    unit_price = 141.00,
    total = 141.00,
    updated_at = now()
WHERE id = 'c7c3270d-3a05-44c8-bc95-b672eedfe5ae';

-- Update liquidation totals for LIQ-2026-021 (difference: +113€)
UPDATE public.liquidations
SET subtotal = subtotal + 113,
    total_amount = subtotal + 113 + tax_amount,
    updated_at = now()
WHERE code = 'LIQ-2026-021';