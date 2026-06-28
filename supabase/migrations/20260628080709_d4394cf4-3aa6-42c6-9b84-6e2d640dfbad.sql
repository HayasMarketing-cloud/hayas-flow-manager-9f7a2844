
-- 1) Restrict specialists' SELECT on financial_requests; expose safe columns via a definer view

DROP POLICY IF EXISTS "Specialists can view own requests" ON public.financial_requests;

CREATE POLICY "Specialists liquidation context can view own requests"
ON public.financial_requests
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finanzas'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);

-- View that exposes only specialist-safe columns (no sale_*, no unit_price, no fixed_cost)
CREATE OR REPLACE VIEW public.specialist_my_requests
WITH (security_invoker = false) AS
SELECT
  fr.id,
  fr.code,
  fr.title,
  fr.description,
  fr.status,
  fr.specialist_id,
  fr.client_id,
  fr.budget_id,
  fr.contract_id,
  fr.liquidation_id,
  fr.deadline,
  fr.completed_at,
  fr.work_year,
  fr.work_month,
  fr.hours,
  fr.cost_rate,
  fr.cost_type,
  fr.cost_to_agency,
  fr.created_at,
  fr.updated_at
FROM public.financial_requests fr
WHERE
  fr.specialist_id = public.get_current_specialist_id()
  OR public.is_specialist_liquidation(fr.liquidation_id);

GRANT SELECT ON public.specialist_my_requests TO authenticated;

-- 2) Specialists UPDATE policy hardening: non-admins can only update rows already linked to themselves
DROP POLICY IF EXISTS "Los usuarios pueden actualizar especialistas que crearon" ON public.specialists;

CREATE POLICY "Specialists self or admin can update"
ON public.specialists
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (user_id IS NOT NULL AND user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (user_id IS NOT NULL AND user_id = auth.uid())
);

-- Defense in depth: prevent non-admins from changing user_id at all
CREATE OR REPLACE FUNCTION public.prevent_specialist_user_id_hijack()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change specialist.user_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_specialist_user_id_hijack ON public.specialists;
CREATE TRIGGER trg_prevent_specialist_user_id_hijack
BEFORE UPDATE OF user_id ON public.specialists
FOR EACH ROW EXECUTE FUNCTION public.prevent_specialist_user_id_hijack();
