ALTER TABLE public.liquidations
  ADD COLUMN IF NOT EXISTS payment_plan jsonb,
  ADD COLUMN IF NOT EXISTS label text;

COMMENT ON COLUMN public.liquidations.payment_plan IS 'Hitos de pago parcial: [{label, percentage, amount, payment_date, paid, paid_at}]';
COMMENT ON COLUMN public.liquidations.label IS 'Etiqueta opcional (p.ej. nombre de proyecto) mostrada junto al periodo';