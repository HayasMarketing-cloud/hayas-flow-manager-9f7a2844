-- =============================================
-- UPDATE RLS POLICIES FOR OPERATIONS SECTION
-- Allow AM and PM to create/edit operational items for assigned clients
-- =============================================

-- 1. OPERATIONAL_REQUESTS - Add INSERT and UPDATE for AM/PM
-- =============================================

-- Add INSERT policy for AM and PM
CREATE POLICY "AM and PM can create operational requests for assigned clients"
ON public.operational_requests FOR INSERT
WITH CHECK (
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

-- Add UPDATE policy for AM and PM
CREATE POLICY "AM and PM can update operational requests for assigned clients"
ON public.operational_requests FOR UPDATE
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

-- 2. MILESTONES - Add INSERT and UPDATE for AM/PM
-- =============================================

-- Add INSERT policy for AM and PM
CREATE POLICY "AM and PM can create milestones for assigned clients"
ON public.milestones FOR INSERT
WITH CHECK (
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

-- Add UPDATE policy for AM and PM (expand existing)
DROP POLICY IF EXISTS "Assigned users can update milestones" ON public.milestones;

CREATE POLICY "Assigned users and AM/PM can update milestones"
ON public.milestones FOR UPDATE
USING (
  (assignee_user_id = auth.uid())
  OR (assignee_specialist_id IN (
    SELECT specialists.id FROM specialists WHERE specialists.user_id = auth.uid()
  ))
  OR (operational_request_id IN (
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

-- 3. TASKS - Add INSERT and UPDATE for AM/PM
-- =============================================

-- Add INSERT policy for AM and PM
CREATE POLICY "AM and PM can create tasks for assigned clients"
ON public.tasks FOR INSERT
WITH CHECK (
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

-- Update existing UPDATE policy to include AM/PM
DROP POLICY IF EXISTS "Assigned users can update tasks" ON public.tasks;

CREATE POLICY "Assigned users and AM/PM can update tasks"
ON public.tasks FOR UPDATE
USING (
  (assignee_user_id = auth.uid())
  OR (assignee_specialist_id IN (
    SELECT specialists.id FROM specialists WHERE specialists.user_id = auth.uid()
  ))
  OR (milestone_id IN (
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

-- 4. OPERATIONAL_PROJECTS - Add INSERT and UPDATE for AM/PM
-- =============================================

-- Add INSERT policy for AM/PM
CREATE POLICY "AM and PM can create projects for assigned clients"
ON public.operational_projects FOR INSERT
WITH CHECK (
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

-- Add UPDATE policy for AM/PM
CREATE POLICY "AM and PM can update projects for assigned clients"
ON public.operational_projects FOR UPDATE
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