-- Paso 0: respaldos
CREATE TABLE IF NOT EXISTS public._backup_liquidation_items_20260807 AS
  SELECT * FROM public.liquidation_items;
CREATE TABLE IF NOT EXISTS public._backup_specialists_20260807 AS
  SELECT * FROM public.specialists;

-- Enum de tipo de línea
DO $$ BEGIN
  CREATE TYPE public.liquidation_item_type AS ENUM ('work', 'advance', 'advance_settlement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.liquidation_items
  ADD COLUMN IF NOT EXISTS item_type public.liquidation_item_type NOT NULL DEFAULT 'work',
  ADD COLUMN IF NOT EXISTS source_invoice_id uuid NULL REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS settles_item_id uuid NULL REFERENCES public.liquidation_items(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_liquidation_items_settles ON public.liquidation_items(settles_item_id);
CREATE INDEX IF NOT EXISTS idx_liquidation_items_type ON public.liquidation_items(item_type);

-- Condiciones de pago del especialista
ALTER TABLE public.specialists ADD COLUMN IF NOT EXISTS payment_terms text NULL;

-- Validación de forma de las líneas de anticipo / regularización
CREATE OR REPLACE FUNCTION public.validate_liquidation_item_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_specialist uuid;
  v_adv_specialist uuid;
  v_adv_type public.liquidation_item_type;
BEGIN
  IF NEW.item_type = 'work' THEN
    IF NEW.settles_item_id IS NOT NULL THEN
      RAISE EXCEPTION 'Una línea de trabajo no puede enlazar a un anticipo';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.financial_request_id IS NOT NULL THEN
    RAISE EXCEPTION 'Las líneas de anticipo o regularización no pueden ir vinculadas a un request';
  END IF;

  SELECT specialist_id INTO v_specialist FROM public.liquidations WHERE id = NEW.liquidation_id;

  IF NEW.item_type = 'advance' THEN
    IF NEW.total <= 0 THEN
      RAISE EXCEPTION 'El importe de un anticipo debe ser positivo';
    END IF;
    IF NEW.settles_item_id IS NOT NULL THEN
      RAISE EXCEPTION 'Un anticipo no puede enlazar a otra línea';
    END IF;
    RETURN NEW;
  END IF;

  -- advance_settlement
  IF NEW.total >= 0 THEN
    RAISE EXCEPTION 'El importe de una regularización debe ser negativo';
  END IF;
  IF NEW.settles_item_id IS NULL THEN
    RAISE EXCEPTION 'Una regularización debe enlazar al anticipo que salda';
  END IF;

  SELECT li.item_type, l.specialist_id
    INTO v_adv_type, v_adv_specialist
  FROM public.liquidation_items li
  JOIN public.liquidations l ON l.id = li.liquidation_id
  WHERE li.id = NEW.settles_item_id;

  IF v_adv_type IS NULL OR v_adv_type <> 'advance' THEN
    RAISE EXCEPTION 'La línea enlazada no es un anticipo';
  END IF;
  IF v_adv_specialist IS DISTINCT FROM v_specialist THEN
    RAISE EXCEPTION 'El anticipo pertenece a otro especialista';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_liquidation_item_type ON public.liquidation_items;
CREATE TRIGGER trg_validate_liquidation_item_type
  BEFORE INSERT OR UPDATE ON public.liquidation_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_liquidation_item_type();

-- Saldo pendiente derivado (nunca almacenado)
CREATE OR REPLACE FUNCTION public.specialist_pending_advances(_specialist_id uuid)
RETURNS TABLE (
  item_id uuid,
  description text,
  amount numeric,
  pending numeric,
  liquidation_id uuid,
  liquidation_code text,
  period_year integer,
  period_month integer,
  created_at timestamptz,
  source_invoice_id uuid,
  invoice_code text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT a.id,
         a.description,
         a.total,
         a.total + COALESCE(SUM(s.total), 0) AS pending,
         l.id,
         l.code::text,
         l.period_year,
         l.period_month,
         a.created_at,
         a.source_invoice_id,
         i.code::text
  FROM public.liquidation_items a
  JOIN public.liquidations l ON l.id = a.liquidation_id
  LEFT JOIN public.invoices i ON i.id = a.source_invoice_id
  LEFT JOIN public.liquidation_items s ON s.settles_item_id = a.id
  WHERE a.item_type = 'advance'
    AND l.specialist_id = _specialist_id
  GROUP BY a.id, a.description, a.total, l.id, l.code, l.period_year, l.period_month, a.created_at, a.source_invoice_id, i.code
  HAVING ABS(a.total + COALESCE(SUM(s.total), 0)) > 0.005;
$$;

GRANT EXECUTE ON FUNCTION public.specialist_pending_advances(uuid) TO authenticated, service_role;