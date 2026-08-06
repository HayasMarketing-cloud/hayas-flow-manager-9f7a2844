ALTER TABLE public._backup_financial_requests_f2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._backup_financial_requests_20260806 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._backup_budget_items_20260806 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public._backup_financial_requests_f2 FROM anon, authenticated;
REVOKE ALL ON public._backup_financial_requests_20260806 FROM anon, authenticated;
REVOKE ALL ON public._backup_budget_items_20260806 FROM anon, authenticated;

GRANT ALL ON public._backup_financial_requests_f2 TO service_role;
GRANT ALL ON public._backup_financial_requests_20260806 TO service_role;
GRANT ALL ON public._backup_budget_items_20260806 TO service_role;