
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS b2brouter_invoice_id text,
  ADD COLUMN IF NOT EXISTS b2brouter_status text,
  ADD COLUMN IF NOT EXISTS b2brouter_environment text,
  ADD COLUMN IF NOT EXISTS b2brouter_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS b2brouter_last_error text;

CREATE INDEX IF NOT EXISTS idx_invoices_b2brouter_invoice_id ON public.invoices(b2brouter_invoice_id);

CREATE TABLE IF NOT EXISTS public.b2brouter_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id_staging text,
  account_id_production text,
  environment text NOT NULL DEFAULT 'staging' CHECK (environment IN ('staging','production')),
  api_version text NOT NULL DEFAULT '2026-03-02',
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.b2brouter_config TO authenticated;
GRANT ALL ON public.b2brouter_config TO service_role;

ALTER TABLE public.b2brouter_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Finanzas can view b2brouter config"
  ON public.b2brouter_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finanzas'));

CREATE POLICY "Admin/Finanzas can insert b2brouter config"
  ON public.b2brouter_config FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finanzas'));

CREATE POLICY "Admin/Finanzas can update b2brouter config"
  ON public.b2brouter_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finanzas'));

CREATE POLICY "Admin/Finanzas can delete b2brouter config"
  ON public.b2brouter_config FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finanzas'));

CREATE TRIGGER trg_b2brouter_config_updated_at
  BEFORE UPDATE ON public.b2brouter_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.b2brouter_config (account_id_staging, environment, api_version, enabled)
SELECT '260492', 'staging', '2026-03-02', true
WHERE NOT EXISTS (SELECT 1 FROM public.b2brouter_config);
