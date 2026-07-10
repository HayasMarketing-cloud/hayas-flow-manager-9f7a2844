DROP POLICY IF EXISTS "Authenticated users can view client_assignments" ON public.client_assignments;

CREATE POLICY "Users view own or privileged view all client_assignments"
ON public.client_assignments
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'finanzas'::app_role)
);