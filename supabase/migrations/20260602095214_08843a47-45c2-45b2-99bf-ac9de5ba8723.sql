-- Function: auto-fill billing_period on invoices
CREATE OR REPLACE FUNCTION public.set_invoice_billing_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_est_date date;
  v_distinct_months int;
BEGIN
  -- Respect manual values
  IF NEW.billing_period_month IS NOT NULL AND NEW.billing_period_year IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1) Try via invoice_budget_allocations (must all share the same estimated month)
  SELECT MIN(b.estimated_invoice_date),
         COUNT(DISTINCT date_trunc('month', b.estimated_invoice_date))
    INTO v_est_date, v_distinct_months
  FROM public.invoice_budget_allocations a
  JOIN public.budgets b ON b.id = a.budget_id
  WHERE a.invoice_id = NEW.id
    AND b.estimated_invoice_date IS NOT NULL;

  IF v_est_date IS NOT NULL AND v_distinct_months = 1 THEN
    NEW.billing_period_month := EXTRACT(MONTH FROM (v_est_date - INTERVAL '1 month'))::int;
    NEW.billing_period_year  := EXTRACT(YEAR  FROM (v_est_date - INTERVAL '1 month'))::int;
    RETURN NEW;
  END IF;

  -- 2) Try via direct budget_id
  IF NEW.budget_id IS NOT NULL THEN
    SELECT estimated_invoice_date INTO v_est_date
    FROM public.budgets WHERE id = NEW.budget_id;
    IF v_est_date IS NOT NULL THEN
      NEW.billing_period_month := EXTRACT(MONTH FROM (v_est_date - INTERVAL '1 month'))::int;
      NEW.billing_period_year  := EXTRACT(YEAR  FROM (v_est_date - INTERVAL '1 month'))::int;
      RETURN NEW;
    END IF;
  END IF;

  -- 3) Fallback: invoice_date - 1 month
  IF NEW.invoice_date IS NOT NULL THEN
    NEW.billing_period_month := EXTRACT(MONTH FROM (NEW.invoice_date - INTERVAL '1 month'))::int;
    NEW.billing_period_year  := EXTRACT(YEAR  FROM (NEW.invoice_date - INTERVAL '1 month'))::int;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_invoice_billing_period ON public.invoices;
CREATE TRIGGER trg_set_invoice_billing_period
BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.set_invoice_billing_period();

-- Trigger on allocations: when a new allocation is added/changed, recompute the invoice's billing_period if it was derived
CREATE OR REPLACE FUNCTION public.recompute_invoice_billing_period_from_alloc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  -- Touch invoice to re-run the BEFORE UPDATE trigger; only if billing_period is NULL
  UPDATE public.invoices
     SET updated_at = now()
   WHERE id = v_invoice_id
     AND (billing_period_month IS NULL OR billing_period_year IS NULL);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_alloc_recompute_billing_period ON public.invoice_budget_allocations;
CREATE TRIGGER trg_alloc_recompute_billing_period
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_budget_allocations
FOR EACH ROW
EXECUTE FUNCTION public.recompute_invoice_billing_period_from_alloc();

-- Backfill historical invoices with NULL billing_period
DO $$
DECLARE
  inv RECORD;
  v_est_date date;
  v_distinct_months int;
  v_month int;
  v_year int;
BEGIN
  FOR inv IN
    SELECT id, budget_id, invoice_date
    FROM public.invoices
    WHERE billing_period_month IS NULL OR billing_period_year IS NULL
  LOOP
    v_est_date := NULL;
    v_distinct_months := NULL;

    SELECT MIN(b.estimated_invoice_date),
           COUNT(DISTINCT date_trunc('month', b.estimated_invoice_date))
      INTO v_est_date, v_distinct_months
    FROM public.invoice_budget_allocations a
    JOIN public.budgets b ON b.id = a.budget_id
    WHERE a.invoice_id = inv.id
      AND b.estimated_invoice_date IS NOT NULL;

    IF v_est_date IS NULL OR v_distinct_months <> 1 THEN
      IF inv.budget_id IS NOT NULL THEN
        SELECT estimated_invoice_date INTO v_est_date
        FROM public.budgets WHERE id = inv.budget_id;
      END IF;
    END IF;

    IF v_est_date IS NOT NULL THEN
      v_month := EXTRACT(MONTH FROM (v_est_date - INTERVAL '1 month'))::int;
      v_year  := EXTRACT(YEAR  FROM (v_est_date - INTERVAL '1 month'))::int;
    ELSIF inv.invoice_date IS NOT NULL THEN
      v_month := EXTRACT(MONTH FROM (inv.invoice_date - INTERVAL '1 month'))::int;
      v_year  := EXTRACT(YEAR  FROM (inv.invoice_date - INTERVAL '1 month'))::int;
    ELSE
      CONTINUE;
    END IF;

    UPDATE public.invoices
       SET billing_period_month = v_month,
           billing_period_year  = v_year
     WHERE id = inv.id;
  END LOOP;
END$$;