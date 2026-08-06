-- Paso 0: respaldo
CREATE TABLE IF NOT EXISTS public._backup_financial_requests_f2 AS
SELECT * FROM public.financial_requests;

-- 1) Nuevas columnas
ALTER TABLE public.financial_requests
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS requires_deliverable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deliverable_url text,
  ADD COLUMN IF NOT EXISTS deliverable_filename text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id);

-- 2) Gate de entregable + snapshot de aprobación
CREATE OR REPLACE FUNCTION public.enforce_deliverable_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status, 'draft') IS DISTINCT FROM 'completed' THEN
    IF COALESCE(NEW.requires_deliverable, false) = true
       AND (NEW.deliverable_url IS NULL OR btrim(NEW.deliverable_url) = '') THEN
      RAISE EXCEPTION 'Este request requiere un entregable antes de marcarse como completado';
    END IF;

    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
    IF NEW.approved_by IS NULL THEN
      NEW.approved_by := auth.uid();
    END IF;
    IF NEW.deliverable_filename IS NULL AND NEW.deliverable_url IS NOT NULL THEN
      NEW.deliverable_filename := NEW.deliverable_url;
    END IF;
  END IF;

  IF OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
    NEW.approved_by := NULL;
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_deliverable_gate ON public.financial_requests;
CREATE TRIGGER trg_enforce_deliverable_gate
BEFORE UPDATE ON public.financial_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_deliverable_gate();

-- 3) RPC acotado: sólo deliverable_url
CREATE OR REPLACE FUNCTION public.set_request_deliverable_url(_request_id uuid, _url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  SELECT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'finanzas'::app_role)
    OR public.has_role(auth.uid(), 'project_manager'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.specialists s
      WHERE s.id = fr.specialist_id AND s.user_id = auth.uid()
    )
  ) INTO v_allowed
  FROM public.financial_requests fr
  WHERE fr.id = _request_id;

  IF v_allowed IS NULL THEN
    RAISE EXCEPTION 'Request no encontrado';
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'No autorizado para actualizar el entregable de este request';
  END IF;

  UPDATE public.financial_requests
  SET deliverable_url = NULLIF(btrim(_url), ''),
      deliverable_filename = COALESCE(deliverable_filename, NULLIF(btrim(_url), '')),
      updated_at = now()
  WHERE id = _request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_request_deliverable_url(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_request_deliverable_url(uuid, text) TO authenticated;