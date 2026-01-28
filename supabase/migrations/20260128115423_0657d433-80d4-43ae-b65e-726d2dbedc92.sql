-- Update the specialists SELECT policy to also allow viewing requests 
-- that are in liquidations belonging to the specialist
DROP POLICY IF EXISTS "Specialists can view own requests" ON public.financial_requests;

CREATE POLICY "Specialists can view own requests"
ON public.financial_requests
FOR SELECT
TO authenticated
USING (
  -- Direct assignment to specialist
  (specialist_id IN (
    SELECT s.id FROM specialists s WHERE s.user_id = auth.uid()
  ))
  OR
  -- Requests in liquidations owned by the specialist
  (liquidation_id IN (
    SELECT l.id FROM liquidations l
    WHERE l.specialist_id IN (
      SELECT s.id FROM specialists s WHERE s.user_id = auth.uid()
    )
  ))
  OR
  -- Role-based access
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);