
-- Create expenses table
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'software',
  is_active boolean NOT NULL DEFAULT true,
  periodicity text NOT NULL DEFAULT 'monthly',
  monthly_cost numeric NOT NULL DEFAULT 0,
  renewal_month text,
  account_email text,
  website_url text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create expense_records table
CREATE TABLE public.expense_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  period_year integer NOT NULL,
  period_month integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  invoice_url text,
  amount numeric,
  notes text,
  uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(expense_id, period_year, period_month)
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for expenses
CREATE POLICY "Admin and finance can manage expenses"
ON public.expenses FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role));

-- RLS policies for expense_records
CREATE POLICY "Admin and finance can manage expense_records"
ON public.expense_records FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role));

-- Updated_at triggers
CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expense_records_updated_at
BEFORE UPDATE ON public.expense_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for expense invoices
INSERT INTO storage.buckets (id, name, public) VALUES ('expense-invoices', 'expense-invoices', false);

-- Storage policies
CREATE POLICY "Admin and finance can upload expense invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expense-invoices'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Admin and finance can view expense invoices"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'expense-invoices'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Admin and finance can update expense invoices"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'expense-invoices'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);

CREATE POLICY "Admin and finance can delete expense invoices"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'expense-invoices'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
);
