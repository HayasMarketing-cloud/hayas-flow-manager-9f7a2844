-- Add columns for invoice verification evidence to liquidation_signatures
ALTER TABLE public.liquidation_signatures
ADD COLUMN IF NOT EXISTS invoice_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS invoice_verification jsonb;