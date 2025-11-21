-- ==============================================
-- PASO 5.5: TABLAS OPERACIONALES
-- ==============================================

-- 1. CREAR ENUMS
-- ==============================================

CREATE TYPE request_status AS ENUM (
  'draft',
  'pending_approval', 
  'approved',
  'in_progress',
  'completed',
  'billed',
  'cancelled'
);

CREATE TYPE invoice_status AS ENUM (
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled'
);

CREATE TYPE liquidation_status AS ENUM (
  'draft',
  'sent',
  'paid',
  'disputed'
);

-- 2. CREAR TABLAS
-- ==============================================

-- Tabla: requests (solicitudes de servicios)
CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,

  -- Relaciones
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  specialist_id UUID REFERENCES public.specialists(id) ON DELETE SET NULL,
  budget_id UUID REFERENCES public.budgets(id) ON DELETE SET NULL,

  -- Información básica
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status request_status DEFAULT 'draft' NOT NULL,

  -- Pricing
  quantity INTEGER DEFAULT 1 NOT NULL CHECK (quantity >= 1),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  cost NUMERIC(10,2) CHECK (cost >= 0),
  margin NUMERIC(10,2),

  -- Fechas
  deadline DATE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabla: invoices (facturas)
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,

  -- Relación con cliente
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,

  -- Fechas
  invoice_date DATE DEFAULT CURRENT_DATE NOT NULL,
  due_date DATE,

  -- Estado y montos
  status invoice_status DEFAULT 'draft' NOT NULL,
  subtotal NUMERIC(10,2) DEFAULT 0 NOT NULL CHECK (subtotal >= 0),
  tax_rate NUMERIC(5,2) DEFAULT 21.00 NOT NULL CHECK (tax_rate >= 0 AND tax_rate <= 100),
  tax_amount NUMERIC(10,2) DEFAULT 0 NOT NULL CHECK (tax_amount >= 0),
  total_amount NUMERIC(10,2) DEFAULT 0 NOT NULL CHECK (total_amount >= 0),

  -- Documentación
  pdf_url TEXT,
  notes TEXT,

  -- Tracking
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,

  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Validaciones lógicas
  CONSTRAINT check_due_date_after_invoice_date CHECK (due_date IS NULL OR due_date >= invoice_date),
  CONSTRAINT check_paid_after_sent CHECK (paid_at IS NULL OR sent_at IS NULL OR paid_at >= sent_at)
);

-- Tabla: invoice_items (líneas de factura)
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relaciones
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,

  -- Datos del item
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1 NOT NULL CHECK (quantity >= 1),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),

  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabla: liquidations (liquidaciones de especialistas)
CREATE TABLE public.liquidations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,

  -- Especialista
  specialist_id UUID NOT NULL REFERENCES public.specialists(id) ON DELETE RESTRICT,

  -- Periodo
  period_year INTEGER NOT NULL CHECK (period_year >= 2020 AND period_year <= 2100),
  period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),

  -- Estado y montos
  status liquidation_status DEFAULT 'draft' NOT NULL,
  subtotal NUMERIC(10,2) DEFAULT 0 NOT NULL CHECK (subtotal >= 0),
  tax_rate NUMERIC(5,2) DEFAULT 21.00 NOT NULL CHECK (tax_rate >= 0 AND tax_rate <= 100),
  tax_amount NUMERIC(10,2) DEFAULT 0 NOT NULL CHECK (tax_amount >= 0),
  total_amount NUMERIC(10,2) DEFAULT 0 NOT NULL CHECK (total_amount >= 0),

  -- Documentación
  pdf_url TEXT,
  notes TEXT,

  -- Tracking
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,

  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Constraint de unicidad: un especialista no puede tener dos liquidaciones para el mismo periodo
  CONSTRAINT unique_specialist_period UNIQUE (specialist_id, period_year, period_month)
);

-- Tabla: liquidation_items (líneas de liquidación)
CREATE TABLE public.liquidation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relaciones
  liquidation_id UUID NOT NULL REFERENCES public.liquidations(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,

  -- Datos del item
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1 NOT NULL CHECK (quantity >= 1),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),

  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabla: sequences (para códigos auto-incrementales)
CREATE TABLE public.sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  prefix VARCHAR(20) NOT NULL,
  current_value INTEGER DEFAULT 0 NOT NULL,
  year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Agregar foreign keys a requests después de crear invoices y liquidations
ALTER TABLE public.requests ADD COLUMN billed_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;
ALTER TABLE public.requests ADD COLUMN liquidation_id UUID REFERENCES public.liquidations(id) ON DELETE SET NULL;

-- 3. ÍNDICES PARA OPTIMIZACIÓN
-- ==============================================

-- Requests
CREATE INDEX idx_requests_code ON public.requests(code);
CREATE INDEX idx_requests_client_id ON public.requests(client_id);
CREATE INDEX idx_requests_service_id ON public.requests(service_id);
CREATE INDEX idx_requests_specialist_id ON public.requests(specialist_id) WHERE specialist_id IS NOT NULL;
CREATE INDEX idx_requests_status ON public.requests(status);
CREATE INDEX idx_requests_created_at ON public.requests(created_at DESC);
CREATE INDEX idx_requests_billed_invoice_id ON public.requests(billed_invoice_id) WHERE billed_invoice_id IS NOT NULL;
CREATE INDEX idx_requests_liquidation_id ON public.requests(liquidation_id) WHERE liquidation_id IS NOT NULL;
CREATE INDEX idx_requests_completed_at ON public.requests(completed_at) WHERE completed_at IS NOT NULL;

-- Invoices
CREATE INDEX idx_invoices_code ON public.invoices(code);
CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_invoice_date ON public.invoices(invoice_date DESC);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_invoices_paid_at ON public.invoices(paid_at) WHERE paid_at IS NOT NULL;

-- Invoice Items
CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_request_id ON public.invoice_items(request_id) WHERE request_id IS NOT NULL;

-- Liquidations
CREATE INDEX idx_liquidations_code ON public.liquidations(code);
CREATE INDEX idx_liquidations_specialist_id ON public.liquidations(specialist_id);
CREATE INDEX idx_liquidations_status ON public.liquidations(status);
CREATE INDEX idx_liquidations_period ON public.liquidations(period_year DESC, period_month DESC);

-- Liquidation Items
CREATE INDEX idx_liquidation_items_liquidation_id ON public.liquidation_items(liquidation_id);
CREATE INDEX idx_liquidation_items_request_id ON public.liquidation_items(request_id) WHERE request_id IS NOT NULL;

-- Sequences
CREATE INDEX idx_sequences_name ON public.sequences(name);

-- 4. FUNCIONES
-- ==============================================

-- Función para generar códigos secuenciales (REQ-2025-001, INV-2025-001, etc.)
CREATE OR REPLACE FUNCTION public.generate_code(sequence_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  seq_record RECORD;
  new_code TEXT;
  current_year INTEGER := EXTRACT(YEAR FROM NOW());
BEGIN
  -- Obtener o crear el registro de secuencia
  SELECT * INTO seq_record FROM public.sequences WHERE name = sequence_name FOR UPDATE;

  IF NOT FOUND THEN
    -- Crear nueva secuencia si no existe
    INSERT INTO public.sequences (name, prefix, current_value, year)
    VALUES (sequence_name, UPPER(LEFT(sequence_name, 3)), 0, current_year)
    RETURNING * INTO seq_record;
  END IF;

  -- Resetear contador si cambió el año
  IF seq_record.year != current_year THEN
    UPDATE public.sequences 
    SET current_value = 0, year = current_year, updated_at = NOW()
    WHERE name = sequence_name;
    seq_record.current_value := 0;
    seq_record.year := current_year;
  END IF;

  -- Incrementar contador
  UPDATE public.sequences 
  SET current_value = current_value + 1, updated_at = NOW()
  WHERE name = sequence_name;

  -- Generar código: PREFIX-YEAR-NUM (ej: REQ-2025-001)
  new_code := seq_record.prefix || '-' || current_year || '-' || LPAD((seq_record.current_value + 1)::TEXT, 3, '0');

  RETURN new_code;
END;
$$;

-- 5. TRIGGERS
-- ==============================================

-- Triggers para updated_at
CREATE TRIGGER update_requests_updated_at 
  BEFORE UPDATE ON public.requests 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at 
  BEFORE UPDATE ON public.invoices 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoice_items_updated_at 
  BEFORE UPDATE ON public.invoice_items 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_liquidations_updated_at 
  BEFORE UPDATE ON public.liquidations 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_liquidation_items_updated_at 
  BEFORE UPDATE ON public.liquidation_items 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sequences_updated_at 
  BEFORE UPDATE ON public.sequences 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Triggers para generar códigos automáticamente
CREATE OR REPLACE FUNCTION generate_request_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_code('requests');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION generate_invoice_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_code('invoices');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION generate_liquidation_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_code('liquidations');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_request_code
  BEFORE INSERT ON public.requests
  FOR EACH ROW EXECUTE FUNCTION generate_request_code();

CREATE TRIGGER set_invoice_code
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_code();

CREATE TRIGGER set_liquidation_code
  BEFORE INSERT ON public.liquidations
  FOR EACH ROW EXECUTE FUNCTION generate_liquidation_code();

-- 6. HABILITAR ROW LEVEL SECURITY
-- ==============================================

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;

-- 7. POLÍTICAS RLS (Basadas en roles del PASO 5)
-- ==============================================

-- REQUESTS: Todos los autenticados pueden ver, solo admin, finanzas y project_manager pueden gestionar
CREATE POLICY "All authenticated users can view requests"
  ON public.requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Finance and admin can manage requests"
  ON public.requests FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finanzas'::app_role) OR
    has_role(auth.uid(), 'project_manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finanzas'::app_role) OR
    has_role(auth.uid(), 'project_manager'::app_role)
  );

-- INVOICES: Solo admin y finanzas
CREATE POLICY "Finance and admin can view invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finanzas'::app_role)
  );

CREATE POLICY "Finance and admin can manage invoices"
  ON public.invoices FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finanzas'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finanzas'::app_role)
  );

-- INVOICE_ITEMS: Igual que invoices
CREATE POLICY "Finance and admin can manage invoice items"
  ON public.invoice_items FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finanzas'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finanzas'::app_role)
  );

-- LIQUIDATIONS: Solo admin y finanzas pueden ver y gestionar (CORRECCIÓN APLICADA)
CREATE POLICY "Finance and admin can view liquidations"
  ON public.liquidations FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finanzas'::app_role)
  );

CREATE POLICY "Finance and admin can manage liquidations"
  ON public.liquidations FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finanzas'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finanzas'::app_role)
  );

-- LIQUIDATION_ITEMS: Igual que liquidations
CREATE POLICY "Finance and admin can manage liquidation items"
  ON public.liquidation_items FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finanzas'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finanzas'::app_role)
  );

-- SEQUENCES: Solo admin puede gestionar
CREATE POLICY "Admin can manage sequences"
  ON public.sequences FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 8. POBLAR SEQUENCES INICIALES
-- ==============================================

INSERT INTO public.sequences (name, prefix, current_value, year) VALUES
('requests', 'REQ', 0, EXTRACT(YEAR FROM NOW())),
('invoices', 'INV', 0, EXTRACT(YEAR FROM NOW())),
('liquidations', 'LIQ', 0, EXTRACT(YEAR FROM NOW()))
ON CONFLICT (name) DO NOTHING;

-- 9. COMENTARIOS PARA DOCUMENTACIÓN
-- ==============================================

COMMENT ON TABLE public.requests IS 'Solicitudes de servicios de clientes';
COMMENT ON TABLE public.invoices IS 'Facturas emitidas a clientes';
COMMENT ON TABLE public.liquidations IS 'Liquidaciones de especialistas por periodo';
COMMENT ON TABLE public.sequences IS 'Secuencias para códigos auto-incrementales';