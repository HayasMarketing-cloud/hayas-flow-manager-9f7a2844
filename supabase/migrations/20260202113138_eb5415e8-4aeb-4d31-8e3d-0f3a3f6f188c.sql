-- Tabla de cobros/pagos recibidos
CREATE TABLE public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR NOT NULL,
  payment_date DATE NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reference TEXT,
  payment_method payment_method DEFAULT 'bank_transfer',
  bank_account TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Relación N:M entre facturas y cobros
CREATE TABLE public.invoice_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  allocated_amount NUMERIC NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(invoice_id, payment_id)
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payments
CREATE POLICY "Finance and admin can manage payments"
  ON public.payments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role));

CREATE POLICY "Finance and admin can view payments"
  ON public.payments FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role));

-- RLS Policies for invoice_payments
CREATE POLICY "Finance and admin can manage invoice_payments"
  ON public.invoice_payments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role));

CREATE POLICY "Finance and admin can view invoice_payments"
  ON public.invoice_payments FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role));

-- Trigger for auto-generating payment code
CREATE OR REPLACE FUNCTION public.generate_payment_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_code('payments');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_payment_code_trigger
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_payment_code();

-- Trigger for updated_at
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sequence for payment codes (PAG-YYYY-XXX)
INSERT INTO public.sequences (name, prefix, year, current_value)
VALUES ('payments', 'PAG', EXTRACT(YEAR FROM NOW())::INTEGER, 0)
ON CONFLICT DO NOTHING;