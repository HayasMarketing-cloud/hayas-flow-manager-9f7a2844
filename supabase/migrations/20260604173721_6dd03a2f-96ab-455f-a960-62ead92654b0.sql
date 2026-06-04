UPDATE public.financial_requests
SET work_month = NULL, work_year = NULL
WHERE is_recurring_template = true
  AND (work_month IS NOT NULL OR work_year IS NOT NULL);