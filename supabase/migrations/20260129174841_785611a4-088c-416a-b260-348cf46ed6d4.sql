-- Create sales_commissions table for tracking AM/PM/Sales commissions
CREATE TABLE public.sales_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Commission type: sales (venta), am (account manager), pm (project manager)
  commission_type TEXT NOT NULL CHECK (commission_type IN ('sales', 'am', 'pm')),
  
  -- Beneficiary (internal user)
  seller_user_id UUID NOT NULL,
  
  -- Source entity (project/budget/contract)
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL,
  
  -- Invoices on which the commission is calculated (array of invoice IDs)
  invoice_ids UUID[] DEFAULT '{}',
  
  -- Calculation
  base_amount NUMERIC NOT NULL DEFAULT 0,
  commission_percentage NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  
  -- Status and payment
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_commissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admin and finanzas can manage commissions
CREATE POLICY "Admin and finanzas can manage commissions"
ON public.sales_commissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finanzas'::app_role));

-- Allow users to view their own commissions
CREATE POLICY "Users can view own commissions"
ON public.sales_commissions
FOR SELECT
USING (seller_user_id = auth.uid());

-- Create updated_at trigger
CREATE TRIGGER update_sales_commissions_updated_at
  BEFORE UPDATE ON public.sales_commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for common queries
CREATE INDEX idx_sales_commissions_seller ON public.sales_commissions(seller_user_id);
CREATE INDEX idx_sales_commissions_budget ON public.sales_commissions(budget_id);
CREATE INDEX idx_sales_commissions_contract ON public.sales_commissions(contract_id);
CREATE INDEX idx_sales_commissions_status ON public.sales_commissions(status);

-- Create commission_settings table for default percentages
CREATE TABLE public.commission_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_type TEXT NOT NULL UNIQUE CHECK (commission_type IN ('sales', 'am', 'pm')),
  default_percentage NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;

-- Only admin can manage settings
CREATE POLICY "Admin can manage commission settings"
ON public.commission_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view settings
CREATE POLICY "Authenticated users can view commission settings"
ON public.commission_settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Insert default percentages
INSERT INTO public.commission_settings (commission_type, default_percentage) VALUES
  ('am', 5),
  ('pm', 5),
  ('sales', 10);