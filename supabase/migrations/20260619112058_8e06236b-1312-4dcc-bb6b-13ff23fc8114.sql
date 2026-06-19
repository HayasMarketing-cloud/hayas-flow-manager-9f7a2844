
-- 1) closed_months: restrict SELECT to management roles
DROP POLICY IF EXISTS "Authenticated users can view closed_months" ON public.closed_months;
CREATE POLICY "Management roles can view closed_months"
ON public.closed_months FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR has_role(auth.uid(), 'account_manager'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);

-- 2) commission_settings: restrict SELECT to admin/finanzas
DROP POLICY IF EXISTS "Authenticated users can view commission settings" ON public.commission_settings;
CREATE POLICY "Admin and finanzas can view commission settings"
ON public.commission_settings FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
);

-- 3) specialists: prevent user_id hijack via UPDATE
DROP POLICY IF EXISTS "Los usuarios pueden actualizar especialistas que crearon" ON public.specialists;
CREATE POLICY "Los usuarios pueden actualizar especialistas que crearon"
ON public.specialists FOR UPDATE TO authenticated
USING (
  (auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role))
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR user_id IS NULL
    OR user_id = auth.uid()
  )
);

-- 4) user_roles: remove self-insert from invitation policy.
-- Role assignment happens atomically via handle_new_user() SECURITY DEFINER trigger,
-- which marks the invitation accepted in the same transaction. Self-insert is unnecessary
-- and allows race-condition abuse.
DROP POLICY IF EXISTS "Users can insert own roles from invitation" ON public.user_roles;
