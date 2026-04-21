-- 1. Create liquidation_invoices table
CREATE TABLE public.liquidation_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  liquidation_id uuid NOT NULL REFERENCES public.liquidations(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text,
  storage_path text,
  invoice_number text,
  invoice_date date,
  subtotal numeric,
  tax_amount numeric,
  irpf_amount numeric,
  total_amount numeric,
  ai_extracted jsonb,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_liquidation_invoices_liquidation_id ON public.liquidation_invoices(liquidation_id);

-- 2. Enable RLS
ALTER TABLE public.liquidation_invoices ENABLE ROW LEVEL SECURITY;

-- 3. Policies
CREATE POLICY "Finance and admin can manage liquidation invoices"
ON public.liquidation_invoices
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role));

CREATE POLICY "Specialists can view own liquidation invoices"
ON public.liquidation_invoices
FOR SELECT
TO authenticated
USING (
  liquidation_id IN (
    SELECT l.id FROM public.liquidations l
    JOIN public.specialists s ON l.specialist_id = s.id
    WHERE s.user_id = auth.uid()
  )
);

CREATE POLICY "Specialists can insert own liquidation invoices"
ON public.liquidation_invoices
FOR INSERT
TO authenticated
WITH CHECK (
  liquidation_id IN (
    SELECT l.id FROM public.liquidations l
    JOIN public.specialists s ON l.specialist_id = s.id
    WHERE s.user_id = auth.uid()
  )
);

CREATE POLICY "Specialists can delete own liquidation invoices"
ON public.liquidation_invoices
FOR DELETE
TO authenticated
USING (
  liquidation_id IN (
    SELECT l.id FROM public.liquidations l
    JOIN public.specialists s ON l.specialist_id = s.id
    WHERE s.user_id = auth.uid()
  )
);

CREATE POLICY "Team leaders can view team liquidation invoices"
ON public.liquidation_invoices
FOR SELECT
TO authenticated
USING (
  liquidation_id IN (
    SELECT l.id FROM public.liquidations l
    JOIN public.specialists s ON l.specialist_id = s.id
    WHERE s.team_leader_id = get_current_specialist_id()
  )
);

-- 4. updated_at trigger
CREATE TRIGGER update_liquidation_invoices_updated_at
BEFORE UPDATE ON public.liquidation_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Backfill from existing liquidations
INSERT INTO public.liquidation_invoices (
  liquidation_id,
  file_url,
  file_name,
  storage_path,
  subtotal,
  tax_amount,
  irpf_amount,
  total_amount,
  ai_extracted,
  uploaded_at
)
SELECT
  l.id,
  l.specialist_invoice_url,
  -- Derive a friendly file name from the URL (last path segment)
  regexp_replace(l.specialist_invoice_url, '^.*/([^/?#]+).*$', '\1'),
  -- Derive storage path (everything after /liquidation-invoices/)
  CASE
    WHEN l.specialist_invoice_url ~ '/liquidation-invoices/'
      THEN regexp_replace(l.specialist_invoice_url, '^.*/liquidation-invoices/', '')
    ELSE NULL
  END,
  NULLIF((sig.invoice_verification->>'subtotal'), '')::numeric,
  NULLIF((sig.invoice_verification->>'tax_amount'), '')::numeric,
  NULLIF((sig.invoice_verification->>'irpf_amount'), '')::numeric,
  NULLIF((sig.invoice_verification->>'total_amount'), '')::numeric,
  sig.invoice_verification,
  COALESCE(sig.invoice_uploaded_at, l.updated_at)
FROM public.liquidations l
LEFT JOIN LATERAL (
  SELECT invoice_verification, invoice_uploaded_at
  FROM public.liquidation_signatures
  WHERE liquidation_id = l.id
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1
) sig ON true
WHERE l.specialist_invoice_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.liquidation_invoices li WHERE li.liquidation_id = l.id
  );