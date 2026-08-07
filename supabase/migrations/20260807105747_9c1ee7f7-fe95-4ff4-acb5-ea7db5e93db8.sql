-- Paso 0: respaldos
CREATE TABLE IF NOT EXISTS public._backup_financial_requests_20260807 AS SELECT * FROM public.financial_requests;
CREATE TABLE IF NOT EXISTS public._backup_activity_log_20260807 AS SELECT * FROM public.activity_log;

-- 1. Catálogo de transiciones (fuente única)
CREATE TABLE public.request_status_transitions (
  from_status public.financial_request_status NOT NULL,
  to_status public.financial_request_status NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

GRANT SELECT ON public.request_status_transitions TO authenticated;
GRANT ALL ON public.request_status_transitions TO service_role;

ALTER TABLE public.request_status_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read transition catalog"
ON public.request_status_transitions FOR SELECT TO authenticated USING (true);

INSERT INTO public.request_status_transitions (from_status, to_status) VALUES
  ('draft','pending_specialist'),
  ('draft','cancelled'),
  ('pending_specialist','in_progress'),
  ('pending_specialist','draft'),
  ('pending_specialist','cancelled'),
  ('in_progress','pending_review'),
  ('in_progress','pending_specialist'),
  ('in_progress','cancelled'),
  ('pending_review','completed'),
  ('pending_review','in_progress'),
  ('pending_review','cancelled'),
  ('completed','in_progress'),
  ('cancelled','draft');

CREATE OR REPLACE FUNCTION public.allowed_request_transitions(_from public.financial_request_status)
RETURNS public.financial_request_status[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(to_status ORDER BY to_status), ARRAY[]::public.financial_request_status[])
  FROM public.request_status_transitions
  WHERE from_status = _from
$$;

CREATE OR REPLACE FUNCTION public.is_valid_request_transition(
  _from public.financial_request_status,
  _to public.financial_request_status
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _from = _to OR EXISTS (
    SELECT 1 FROM public.request_status_transitions
    WHERE from_status = _from AND to_status = _to
  )
$$;

CREATE OR REPLACE FUNCTION public.enforce_request_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF COALESCE(current_setting('app.force_status', true), 'off') = 'on' THEN
      RETURN NEW;
    END IF;
    IF NOT public.is_valid_request_transition(OLD.status, NEW.status) THEN
      RAISE EXCEPTION 'Transición no permitida: % → %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Se ejecuta DESPUÉS del gate de entregable (orden alfabético de triggers)
CREATE TRIGGER trg_enforce_request_status_transition
BEFORE UPDATE OF status ON public.financial_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_request_status_transition();

-- 2. activity_log: user_id nullable + source
ALTER TABLE public.activity_log ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'ui';

DROP POLICY IF EXISTS "Users can view relevant activity logs" ON public.activity_log;
CREATE POLICY "Users can view relevant activity logs"
ON public.activity_log FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'finanzas'::app_role)
  OR public.has_role(auth.uid(), 'project_manager'::app_role)
);

DROP POLICY IF EXISTS "Authenticated users can create activity logs" ON public.activity_log;
CREATE POLICY "Authenticated users can create activity logs"
ON public.activity_log FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

-- 3. Forzado auditado
CREATE OR REPLACE FUNCTION public.force_request_status(
  _request_id uuid,
  _new_status public.financial_request_status,
  _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old public.financial_request_status;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'finanzas'::app_role)) THEN
    RAISE EXCEPTION 'Solo administración o finanzas pueden forzar el estado de un request';
  END IF;

  IF _reason IS NULL OR length(btrim(_reason)) < 10 THEN
    RAISE EXCEPTION 'El forzado de estado requiere un motivo de al menos 10 caracteres';
  END IF;

  SELECT status INTO v_old FROM public.financial_requests WHERE id = _request_id;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Request no encontrado';
  END IF;

  IF v_old = _new_status THEN
    RAISE EXCEPTION 'El request ya está en el estado %', _new_status;
  END IF;

  PERFORM set_config('app.force_status', 'on', true);

  UPDATE public.financial_requests
  SET status = _new_status, updated_at = now()
  WHERE id = _request_id;

  PERFORM set_config('app.force_status', 'off', true);

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, changes, source)
  VALUES (
    auth.uid(),
    'financial_request',
    _request_id,
    'status_forced',
    jsonb_build_object('from', v_old, 'to', _new_status, 'reason', btrim(_reason)),
    'force_rpc'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.force_request_status(uuid, public.financial_request_status, text) FROM public;
GRANT EXECUTE ON FUNCTION public.force_request_status(uuid, public.financial_request_status, text) TO authenticated;