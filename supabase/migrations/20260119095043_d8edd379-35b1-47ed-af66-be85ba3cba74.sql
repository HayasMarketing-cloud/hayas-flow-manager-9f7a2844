-- =============================================
-- ADD DELETE POLICIES FOR AM/PM IN OPERATIONS
-- =============================================

-- 1. OPERATIONAL_PROJECTS - Add DELETE for AM/PM
CREATE POLICY "AM and PM can delete projects for assigned clients"
ON public.operational_projects FOR DELETE
USING (
  (client_id IN (
    SELECT contracts.client_id FROM contracts 
    WHERE contracts.am_user_id = auth.uid() OR contracts.pm_user_id = auth.uid()
  ))
  OR (client_id IN (
    SELECT budgets.client_id FROM budgets 
    WHERE budgets.am_user_id = auth.uid() OR budgets.pm_user_id = auth.uid()
  ))
  OR (budget_id IN (
    SELECT budgets.id FROM budgets 
    WHERE budgets.am_user_id = auth.uid() OR budgets.pm_user_id = auth.uid()
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);

-- 2. OPERATIONAL_REQUESTS - Add DELETE for AM/PM
CREATE POLICY "AM and PM can delete operational requests for assigned clients"
ON public.operational_requests FOR DELETE
USING (
  (client_id IN (
    SELECT contracts.client_id FROM contracts 
    WHERE contracts.am_user_id = auth.uid() OR contracts.pm_user_id = auth.uid()
  ))
  OR (client_id IN (
    SELECT budgets.client_id FROM budgets 
    WHERE budgets.am_user_id = auth.uid() OR budgets.pm_user_id = auth.uid()
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);

-- 3. MILESTONES - Add DELETE for AM/PM
CREATE POLICY "AM and PM can delete milestones for assigned clients"
ON public.milestones FOR DELETE
USING (
  (operational_request_id IN (
    SELECT operational_requests.id FROM operational_requests
    WHERE operational_requests.client_id IN (
      SELECT contracts.client_id FROM contracts 
      WHERE contracts.am_user_id = auth.uid() OR contracts.pm_user_id = auth.uid()
      UNION
      SELECT budgets.client_id FROM budgets 
      WHERE budgets.am_user_id = auth.uid() OR budgets.pm_user_id = auth.uid()
    )
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);

-- 4. TASKS - Add DELETE for AM/PM
CREATE POLICY "AM and PM can delete tasks for assigned clients"
ON public.tasks FOR DELETE
USING (
  (milestone_id IN (
    SELECT m.id FROM milestones m
    JOIN operational_requests r ON m.operational_request_id = r.id
    WHERE r.client_id IN (
      SELECT contracts.client_id FROM contracts 
      WHERE contracts.am_user_id = auth.uid() OR contracts.pm_user_id = auth.uid()
      UNION
      SELECT budgets.client_id FROM budgets 
      WHERE budgets.am_user_id = auth.uid() OR budgets.pm_user_id = auth.uid()
    )
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);