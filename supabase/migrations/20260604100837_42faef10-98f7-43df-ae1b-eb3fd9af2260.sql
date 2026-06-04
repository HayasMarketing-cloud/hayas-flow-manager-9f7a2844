ALTER TABLE public.b2brouter_config
  ADD COLUMN IF NOT EXISTS issuer_name text,
  ADD COLUMN IF NOT EXISTS issuer_tax_id text,
  ADD COLUMN IF NOT EXISTS issuer_address text,
  ADD COLUMN IF NOT EXISTS issuer_postal_code text,
  ADD COLUMN IF NOT EXISTS issuer_city text,
  ADD COLUMN IF NOT EXISTS issuer_province text,
  ADD COLUMN IF NOT EXISTS issuer_country_code text DEFAULT 'ES',
  ADD COLUMN IF NOT EXISTS issuer_iban text,
  ADD COLUMN IF NOT EXISTS issuer_email text,
  ADD COLUMN IF NOT EXISTS issuer_phone text,
  ADD COLUMN IF NOT EXISTS invoice_series text DEFAULT 'F',
  ADD COLUMN IF NOT EXISTS default_payment_terms_days integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS default_payment_means text DEFAULT 'transfer';