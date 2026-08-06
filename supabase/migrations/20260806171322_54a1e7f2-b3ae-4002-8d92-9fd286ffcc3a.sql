-- Paso 0: respaldo
CREATE TABLE IF NOT EXISTS public._backup_request_action_tokens_20260806 AS
SELECT * FROM public.request_action_tokens;

-- 1. request_action_tokens: request_id nullable + specialist_id
ALTER TABLE public.request_action_tokens
  ALTER COLUMN request_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS specialist_id uuid REFERENCES public.specialists(id) ON DELETE SET NULL;

-- 2. Tabla puente
CREATE TABLE IF NOT EXISTS public.request_action_token_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES public.request_action_tokens(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.financial_requests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  skip_reason text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_ratitems_token ON public.request_action_token_items(token_id);
CREATE INDEX IF NOT EXISTS idx_ratitems_request ON public.request_action_token_items(request_id);

GRANT ALL ON public.request_action_token_items TO service_role;
GRANT SELECT ON public.request_action_token_items TO authenticated;

ALTER TABLE public.request_action_token_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin and finance can view token items" ON public.request_action_token_items;
CREATE POLICY "Admin and finance can view token items"
ON public.request_action_token_items
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'finanzas'::app_role)
);

-- 3. Integridad token individual vs lote
CREATE OR REPLACE FUNCTION public.validate_request_action_token_shape()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.action_type = 'specialist_batch_response' THEN
    IF NEW.request_id IS NOT NULL THEN
      RAISE EXCEPTION 'Un token de lote no puede apuntar a un request individual';
    END IF;
    IF NEW.specialist_id IS NULL THEN
      RAISE EXCEPTION 'Un token de lote requiere specialist_id';
    END IF;
  ELSE
    IF NEW.request_id IS NULL THEN
      RAISE EXCEPTION 'Un token individual requiere request_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_request_action_token_shape ON public.request_action_tokens;
CREATE TRIGGER trg_validate_request_action_token_shape
BEFORE INSERT OR UPDATE ON public.request_action_tokens
FOR EACH ROW EXECUTE FUNCTION public.validate_request_action_token_shape();

-- 4. Flag de notificaciones en el maestro de especialistas
ALTER TABLE public.specialists
  ADD COLUMN IF NOT EXISTS receives_flow_notifications boolean NOT NULL DEFAULT true;