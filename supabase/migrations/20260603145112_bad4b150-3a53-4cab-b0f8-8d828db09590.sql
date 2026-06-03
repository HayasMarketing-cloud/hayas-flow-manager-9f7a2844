
-- 1. Trigger function to auto-fill work_year / work_month when null
CREATE OR REPLACE FUNCTION public.fill_request_work_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ref_date timestamptz;
BEGIN
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

DROP TRIGGER IF EXISTS trg_fill_request_work_period ON public.financial_requests;
CREATE TRIGGER trg_fill_request_work_period
BEFORE INSERT OR UPDATE ON public.financial_requests
FOR EACH ROW
EXECUTE FUNCTION public.fill_request_work_period();

-- 2. Backfill existing rows
UPDATE public.financial_requests
SET
  work_year = COALESCE(
    work_year,
    EXTRACT(YEAR FROM COALESCE(completed_at, deadline::timestamptz, created_at))::int
  ),
  work_month = COALESCE(
    work_month,
    EXTRACT(MONTH FROM COALESCE(completed_at, deadline::timestamptz, created_at))::int
  )
WHERE work_year IS NULL OR work_month IS NULL;
