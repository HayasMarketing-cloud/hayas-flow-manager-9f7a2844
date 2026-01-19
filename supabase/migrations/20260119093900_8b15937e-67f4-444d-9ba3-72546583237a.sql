
-- Drop existing AM/PM related SELECT policies and recreate with expanded logic

-- 1. CLIENTS - Add budget-based AM access
DROP POLICY IF EXISTS "Account managers can view clients from assigned contracts" ON public.clients;

CREATE POLICY "Account managers can view clients from assigned contracts or budgets"
ON public.clients FOR SELECT
USING (
  (id IN (
    SELECT contracts.client_id FROM contracts WHERE contracts.am_user_id = auth.uid()
    UNION
    SELECT budgets.client_id FROM budgets WHERE budgets.am_user_id = auth.uid()
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR (created_by = auth.uid())
);

-- 2. FINANCIAL_REQUESTS - Expand AM access to include budgets
DROP POLICY IF EXISTS "Account managers can view requests from assigned clients" ON public.financial_requests;

CREATE POLICY "Account managers can view requests from assigned clients or budgets"
ON public.financial_requests FOR SELECT
USING (
  (client_id IN (
    SELECT contracts.client_id FROM contracts WHERE contracts.am_user_id = auth.uid()
    UNION
    SELECT budgets.client_id FROM budgets WHERE budgets.am_user_id = auth.uid()
  ))
  OR (budget_id IN (
    SELECT budgets.id FROM budgets WHERE budgets.am_user_id = auth.uid() OR budgets.pm_user_id = auth.uid()
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);

-- 3. INVOICES - Expand AM access to include budgets
DROP POLICY IF EXISTS "Account managers can view invoices from assigned clients" ON public.invoices;

CREATE POLICY "Account managers can view invoices from assigned clients or budgets"
ON public.invoices FOR SELECT
USING (
  (client_id IN (
    SELECT contracts.client_id FROM contracts WHERE contracts.am_user_id = auth.uid()
    UNION
    SELECT budgets.client_id FROM budgets WHERE budgets.am_user_id = auth.uid()
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);

-- 4. BUDGETS - Add direct AM/PM access check
DROP POLICY IF EXISTS "Account managers can view budgets from assigned clients" ON public.budgets;

CREATE POLICY "AM and PM can view assigned budgets"
ON public.budgets FOR SELECT
USING (
  (am_user_id = auth.uid())
  OR (pm_user_id = auth.uid())
  OR (client_id IN (
    SELECT contracts.client_id FROM contracts WHERE contracts.am_user_id = auth.uid() OR contracts.pm_user_id = auth.uid()
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);

-- 5. OPERATIONAL_PROJECTS - Expand to include budgets
DROP POLICY IF EXISTS "Account managers can view projects from assigned clients" ON public.operational_projects;

CREATE POLICY "AM and PM can view projects from assigned clients or budgets"
ON public.operational_projects FOR SELECT
USING (
  (client_id IN (
    SELECT contracts.client_id FROM contracts WHERE contracts.am_user_id = auth.uid() OR contracts.pm_user_id = auth.uid()
    UNION
    SELECT budgets.client_id FROM budgets WHERE budgets.am_user_id = auth.uid() OR budgets.pm_user_id = auth.uid()
  ))
  OR (budget_id IN (
    SELECT budgets.id FROM budgets WHERE budgets.am_user_id = auth.uid() OR budgets.pm_user_id = auth.uid()
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);

-- 6. OPERATIONAL_REQUESTS - Expand to include budgets
DROP POLICY IF EXISTS "Account managers can view operational requests from assigned cl" ON public.operational_requests;

CREATE POLICY "AM and PM can view operational requests from assigned clients or budgets"
ON public.operational_requests FOR SELECT
USING (
  (client_id IN (
    SELECT contracts.client_id FROM contracts WHERE contracts.am_user_id = auth.uid() OR contracts.pm_user_id = auth.uid()
    UNION
    SELECT budgets.client_id FROM budgets WHERE budgets.am_user_id = auth.uid() OR budgets.pm_user_id = auth.uid()
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);

-- 7. MILESTONES - Expand to include budgets
DROP POLICY IF EXISTS "Account managers can view milestones from assigned clients" ON public.milestones;

CREATE POLICY "AM and PM can view milestones from assigned clients or budgets"
ON public.milestones FOR SELECT
USING (
  (operational_request_id IN (
    SELECT operational_requests.id FROM operational_requests
    WHERE operational_requests.client_id IN (
      SELECT contracts.client_id FROM contracts WHERE contracts.am_user_id = auth.uid() OR contracts.pm_user_id = auth.uid()
      UNION
      SELECT budgets.client_id FROM budgets WHERE budgets.am_user_id = auth.uid() OR budgets.pm_user_id = auth.uid()
    )
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);

-- 8. TASKS - Expand to include budgets
DROP POLICY IF EXISTS "Account managers can view tasks from assigned clients" ON public.tasks;

CREATE POLICY "AM and PM can view tasks from assigned clients or budgets"
ON public.tasks FOR SELECT
USING (
  (milestone_id IN (
    SELECT m.id FROM milestones m
    JOIN operational_requests r ON m.operational_request_id = r.id
    WHERE r.client_id IN (
      SELECT contracts.client_id FROM contracts WHERE contracts.am_user_id = auth.uid() OR contracts.pm_user_id = auth.uid()
      UNION
      SELECT budgets.client_id FROM budgets WHERE budgets.am_user_id = auth.uid() OR budgets.pm_user_id = auth.uid()
    )
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);

-- 9. LIQUIDATIONS - Expand AM access to include budgets
DROP POLICY IF EXISTS "Account managers can view liquidations from assigned clients" ON public.liquidations;

CREATE POLICY "AM can view liquidations from assigned clients or budgets"
ON public.liquidations FOR SELECT
USING (
  (specialist_id IN (
    SELECT DISTINCT financial_requests.specialist_id FROM financial_requests
    WHERE financial_requests.specialist_id IS NOT NULL
    AND (
      financial_requests.client_id IN (
        SELECT contracts.client_id FROM contracts WHERE contracts.am_user_id = auth.uid()
        UNION
        SELECT budgets.client_id FROM budgets WHERE budgets.am_user_id = auth.uid()
      )
      OR financial_requests.budget_id IN (
        SELECT budgets.id FROM budgets WHERE budgets.am_user_id = auth.uid()
      )
    )
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);

-- 10. LIQUIDATION_ITEMS - Expand AM access to include budgets
DROP POLICY IF EXISTS "Account managers can view liquidation items from assigned clien" ON public.liquidation_items;

CREATE POLICY "AM can view liquidation items from assigned clients or budgets"
ON public.liquidation_items FOR SELECT
USING (
  (liquidation_id IN (
    SELECT liquidations.id FROM liquidations
    WHERE liquidations.specialist_id IN (
      SELECT DISTINCT financial_requests.specialist_id FROM financial_requests
      WHERE financial_requests.specialist_id IS NOT NULL
      AND (
        financial_requests.client_id IN (
          SELECT contracts.client_id FROM contracts WHERE contracts.am_user_id = auth.uid()
          UNION
          SELECT budgets.client_id FROM budgets WHERE budgets.am_user_id = auth.uid()
        )
        OR financial_requests.budget_id IN (
          SELECT budgets.id FROM budgets WHERE budgets.am_user_id = auth.uid()
        )
      )
    )
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);
