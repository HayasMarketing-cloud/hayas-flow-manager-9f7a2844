CREATE OR REPLACE FUNCTION public.fill_request_work_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ref_date timestamptz;
BEGIN
  -- Pure recurring templates are masters, not operational requests.
  -- Keep them period-less so the operational Requests list can exclude them.
  IF COALESCE(NEW.is_recurring_template, false) = true
     AND NEW.template_source_id IS NULL
     AND (NEW.work_month IS NULL OR NEW.work_year IS NULL)
     AND NEW.title NOT ILIKE '% - enero de %'
     AND NEW.title NOT ILIKE '% - febrero de %'
     AND NEW.title NOT ILIKE '% - marzo de %'
     AND NEW.title NOT ILIKE '% - abril de %'
     AND NEW.title NOT ILIKE '% - mayo de %'
     AND NEW.title NOT ILIKE '% - junio de %'
     AND NEW.title NOT ILIKE '% - julio de %'
     AND NEW.title NOT ILIKE '% - agosto de %'
     AND NEW.title NOT ILIKE '% - septiembre de %'
     AND NEW.title NOT ILIKE '% - octubre de %'
     AND NEW.title NOT ILIKE '% - noviembre de %'
     AND NEW.title NOT ILIKE '% - diciembre de %'
  THEN
    NEW.work_month := NULL;
    NEW.work_year := NULL;
    RETURN NEW;
  END IF;

  IF NEW.work_year IS NULL OR NEW.work_month IS NULL THEN
    ref_date := COALESCE(
      NEW.completed_at,
      CASE WHEN NEW.deadline IS NOT NULL THEN NEW.deadline::timestamptz ELSE NULL END,
      NEW.created_at,
      now()
    );
    IF NEW.work_year IS NULL THEN
      NEW.work_year := EXTRACT(YEAR FROM ref_date)::int;
    END IF;
    IF NEW.work_month IS NULL THEN
      NEW.work_month := EXTRACT(MONTH FROM ref_date)::int;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.financial_requests
SET work_month = NULL,
    work_year = NULL
WHERE code IN ('REQ-2026-379','REQ-2026-380','REQ-2026-381','REQ-2026-382','REQ-2026-383')
  AND is_recurring_template = true
  AND template_source_id IS NULL;