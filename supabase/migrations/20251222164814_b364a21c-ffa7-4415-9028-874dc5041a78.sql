-- Create table for digital signatures
CREATE TABLE public.liquidation_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidation_id UUID REFERENCES liquidations(id) ON DELETE CASCADE NOT NULL,
  token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'disputed')),
  signed_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  dispute_reason TEXT,
  specialist_comments TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.liquidation_signatures ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view with valid token (for public signing page)
CREATE POLICY "Public can view signature by token"
ON public.liquidation_signatures
FOR SELECT
USING (true);

-- Policy: Finance and admin can manage signatures
CREATE POLICY "Finance and admin can manage signatures"
ON public.liquidation_signatures
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role));

-- Index for faster token lookups
CREATE INDEX idx_liquidation_signatures_token ON public.liquidation_signatures(token);
CREATE INDEX idx_liquidation_signatures_liquidation_id ON public.liquidation_signatures(liquidation_id);