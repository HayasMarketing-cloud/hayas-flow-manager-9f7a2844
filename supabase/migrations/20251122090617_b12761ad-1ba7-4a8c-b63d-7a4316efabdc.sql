-- PASO 11: Tabla budget_items para líneas de presupuesto
CREATE TABLE public.budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1 NOT NULL CHECK (quantity >= 1),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_budget_items_budget_id ON public.budget_items(budget_id);
CREATE INDEX idx_budget_items_service_id ON public.budget_items(service_id);

-- RLS policies para budget_items
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view budget items"
  ON public.budget_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage budget items"
  ON public.budget_items FOR ALL
  USING (
    budget_id IN (
      SELECT id FROM public.budgets 
      WHERE created_by = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'finanzas'::app_role)
    )
  );

-- Trigger para actualizar updated_at
CREATE TRIGGER update_budget_items_updated_at
  BEFORE UPDATE ON public.budget_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- PASO 12: Tabla contract_services para servicios del contrato
CREATE TABLE public.contract_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  specialist_id UUID REFERENCES public.specialists(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1 NOT NULL CHECK (quantity >= 1),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  billing_mode TEXT DEFAULT 'monthly' CHECK (billing_mode IN ('monthly', 'per_service', 'one_time')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_contract_services_contract_id ON public.contract_services(contract_id);
CREATE INDEX idx_contract_services_service_id ON public.contract_services(service_id);
CREATE INDEX idx_contract_services_specialist_id ON public.contract_services(specialist_id);

-- RLS policies para contract_services
ALTER TABLE public.contract_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contract services"
  ON public.contract_services FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage contract services"
  ON public.contract_services FOR ALL
  USING (
    contract_id IN (
      SELECT id FROM public.contracts 
      WHERE created_by = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'finanzas'::app_role)
    )
  );

-- Trigger para actualizar updated_at
CREATE TRIGGER update_contract_services_updated_at
  BEFORE UPDATE ON public.contract_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();