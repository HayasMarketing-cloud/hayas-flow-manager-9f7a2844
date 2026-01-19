
-- Add INSERT and UPDATE policies for Account Managers and Project Managers
-- Based on their assignments in contracts OR budgets

-- 1. FINANCIAL_REQUESTS - Allow AM/PM to create requests for assigned clients/budgets
CREATE POLICY "AM and PM can create requests for assigned clients or budgets"
ON public.financial_requests FOR INSERT
WITH CHECK (
  -- Can create if assigned to a contract for this client
  (client_id IN (
    SELECT contracts.client_id FROM contracts 
    WHERE contracts.am_user_id = auth.uid() OR contracts.pm_user_id = auth.uid()
  ))
  -- Or if assigned to a budget for this client
  OR (client_id IN (
    SELECT budgets.client_id FROM budgets 
    WHERE budgets.am_user_id = auth.uid() OR budgets.pm_user_id = auth.uid()
  ))
  -- Or if the request is linked to a budget where they are assigned
  OR (budget_id IN (
    SELECT budgets.id FROM budgets 
    WHERE budgets.am_user_id = auth.uid() OR budgets.pm_user_id = auth.uid()
  ))
  -- Or has elevated roles
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);

-- 2. FINANCIAL_REQUESTS - Allow AM/PM to update requests for assigned clients/budgets
CREATE POLICY "AM and PM can update requests for assigned clients or budgets"
ON public.financial_requests FOR UPDATE
USING (
  -- Can update if assigned to a contract for this client
  (client_id IN (
    SELECT contracts.client_id FROM contracts 
    WHERE contracts.am_user_id = auth.uid() OR contracts.pm_user_id = auth.uid()
  ))
  -- Or if assigned to a budget for this client
  OR (client_id IN (
    SELECT budgets.client_id FROM budgets 
    WHERE budgets.am_user_id = auth.uid() OR budgets.pm_user_id = auth.uid()
  ))
  -- Or if the request is linked to a budget where they are assigned
  OR (budget_id IN (
    SELECT budgets.id FROM budgets 
    WHERE budgets.am_user_id = auth.uid() OR budgets.pm_user_id = auth.uid()
  ))
  -- Or has elevated roles
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);

-- 3. BUDGETS - Allow AM/PM to update their assigned budgets
CREATE POLICY "AM and PM can update assigned budgets"
ON public.budgets FOR UPDATE
USING (
  (am_user_id = auth.uid())
  OR (pm_user_id = auth.uid())
  OR (client_id IN (
    SELECT contracts.client_id FROM contracts 
    WHERE contracts.am_user_id = auth.uid() OR contracts.pm_user_id = auth.uid()
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);

-- 4. BUDGETS - Allow AM/PM to create budgets for assigned clients
CREATE POLICY "AM and PM can create budgets for assigned clients"
ON public.budgets FOR INSERT
WITH CHECK (
  (client_id IN (
    SELECT contracts.client_id FROM contracts 
    WHERE contracts.am_user_id = auth.uid() OR contracts.pm_user_id = auth.uid()
  ))
  OR (am_user_id = auth.uid())
  OR (pm_user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR (auth.uid() = created_by)
);

-- 5. BUDGET_ITEMS - Allow AM/PM to manage budget items for their assigned budgets
CREATE POLICY "AM and PM can manage budget items for assigned budgets"
ON public.budget_items FOR ALL
USING (
  budget_id IN (
    SELECT budgets.id FROM budgets 
    WHERE budgets.am_user_id = auth.uid() 
      OR budgets.pm_user_id = auth.uid()
      OR budgets.created_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'finanzas'::app_role)
  )
)
WITH CHECK (
  budget_id IN (
    SELECT budgets.id FROM budgets 
    WHERE budgets.am_user_id = auth.uid() 
      OR budgets.pm_user_id = auth.uid()
      OR budgets.created_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);

-- 6. CONTRACTS - Allow AM/PM to update their assigned contracts
CREATE POLICY "AM and PM can update assigned contracts"
ON public.contracts FOR UPDATE
USING (
  (am_user_id = auth.uid())
  OR (pm_user_id = auth.uid())
  OR (auth.uid() = created_by)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);

-- 7. CONTRACT_SERVICES - Expand management to include AM/PM assigned to contract
DROP POLICY IF EXISTS "Users can manage contract services" ON public.contract_services;

CREATE POLICY "Users can manage contract services"
ON public.contract_services FOR ALL
USING (
  contract_id IN (
    SELECT contracts.id FROM contracts
    WHERE contracts.created_by = auth.uid()
      OR contracts.am_user_id = auth.uid()
      OR contracts.pm_user_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'finanzas'::app_role)
  )
)
WITH CHECK (
  contract_id IN (
    SELECT contracts.id FROM contracts
    WHERE contracts.created_by = auth.uid()
      OR contracts.am_user_id = auth.uid()
      OR contracts.pm_user_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'finanzas'::app_role)
  )
);
