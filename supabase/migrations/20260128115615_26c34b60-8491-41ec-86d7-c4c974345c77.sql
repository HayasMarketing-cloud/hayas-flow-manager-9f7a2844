-- Create a security definer function to check if a liquidation belongs to the current user's specialist
-- This breaks the RLS recursion cycle
CREATE OR REPLACE FUNCTION public.is_specialist_liquidation(_liquidation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.liquidations l
    JOIN public.specialists s ON l.specialist_id = s.id
    WHERE l.id = _liquidation_id
      AND s.user_id = auth.uid()
  )
$$;

-- Create a security definer function to check if current user is a specialist
CREATE OR REPLACE FUNCTION public.get_current_specialist_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id FROM public.specialists s WHERE s.user_id = auth.uid() LIMIT 1
$$;

-- Drop the problematic policy and recreate with security definer functions
DROP POLICY IF EXISTS "Specialists can view own requests" ON public.financial_requests;

CREATE POLICY "Specialists can view own requests"
ON public.financial_requests
FOR SELECT
TO authenticated
USING (
  -- Direct assignment to specialist (using security definer function)
  specialist_id = public.get_current_specialist_id()
  OR
  -- Requests in liquidations owned by the specialist (using security definer function)
  public.is_specialist_liquidation(liquidation_id)
  OR
  -- Role-based access
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);