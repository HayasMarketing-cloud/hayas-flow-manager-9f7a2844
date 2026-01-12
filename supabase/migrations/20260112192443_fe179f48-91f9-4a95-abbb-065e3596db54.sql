-- Drop the insecure public policy that allows anyone to enumerate all signatures
DROP POLICY IF EXISTS "Public can view signature by token" ON public.liquidation_signatures;

-- Create a secure policy: only admin and finanzas roles can view signatures through authenticated queries
CREATE POLICY "Finance and admin can view signatures"
ON public.liquidation_signatures
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'finanzas'::app_role)
);

-- Ensure INSERT policy exists for creating signatures (finance/admin only)
DROP POLICY IF EXISTS "Finance and admin can create signatures" ON public.liquidation_signatures;
CREATE POLICY "Finance and admin can create signatures"
ON public.liquidation_signatures
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'finanzas'::app_role)
);

-- Ensure UPDATE policy exists (for process-signature edge function uses service role, but authenticated users with proper roles can also update)
DROP POLICY IF EXISTS "Finance and admin can update signatures" ON public.liquidation_signatures;
CREATE POLICY "Finance and admin can update signatures"
ON public.liquidation_signatures
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'finanzas'::app_role)
);