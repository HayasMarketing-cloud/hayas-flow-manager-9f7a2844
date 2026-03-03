
-- Table for budget share tokens (public access via token)
CREATE TABLE public.budget_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  accessed_count integer NOT NULL DEFAULT 0,
  last_accessed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(token)
);

-- Enable RLS
ALTER TABLE public.budget_share_tokens ENABLE ROW LEVEL SECURITY;

-- Only finance/admin can create and manage share tokens
CREATE POLICY "Finance and admin can manage share tokens"
ON public.budget_share_tokens
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role));

-- AM and PM can also create and view share tokens for their budgets
CREATE POLICY "AM and PM can manage share tokens for assigned budgets"
ON public.budget_share_tokens
FOR ALL
USING (
  budget_id IN (
    SELECT id FROM budgets 
    WHERE am_user_id = auth.uid() OR pm_user_id = auth.uid() OR created_by = auth.uid()
  )
)
WITH CHECK (
  budget_id IN (
    SELECT id FROM budgets 
    WHERE am_user_id = auth.uid() OR pm_user_id = auth.uid() OR created_by = auth.uid()
  )
);

-- Authenticated users can view tokens
CREATE POLICY "Authenticated users can view share tokens"
ON public.budget_share_tokens
FOR SELECT
USING (auth.uid() IS NOT NULL);
