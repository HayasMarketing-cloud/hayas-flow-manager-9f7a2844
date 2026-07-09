
DROP POLICY IF EXISTS "AM and PM can view assigned budgets" ON public.budgets;
CREATE POLICY "AM and PM can view assigned budgets"
ON public.budgets FOR SELECT
USING (
  auth.uid() = created_by
  OR am_user_id = auth.uid()
  OR pm_user_id = auth.uid()
  OR client_id IN (SELECT ca.client_id FROM client_assignments ca WHERE ca.user_id = auth.uid())
  OR client_id IN (SELECT c.client_id FROM contracts c WHERE c.am_user_id = auth.uid() OR c.pm_user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);
