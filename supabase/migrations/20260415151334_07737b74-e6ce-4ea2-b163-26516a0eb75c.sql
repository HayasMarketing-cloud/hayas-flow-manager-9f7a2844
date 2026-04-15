
ALTER TABLE public.expense_records
  ADD COLUMN IF NOT EXISTS issuer_name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric,
  ADD COLUMN IF NOT EXISTS invoice_date date;
