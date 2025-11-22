-- ============================================
-- PASO 16.1: OPTIMIZACIÓN DE QUERIES CON ÍNDICES
-- ============================================

-- Índices para invoices (facturas)
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date_unpaid ON public.invoices(due_date) WHERE status IN ('draft', 'sent', 'overdue');

-- Índices para requests (solicitudes)
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_client_id ON public.requests(client_id);
CREATE INDEX IF NOT EXISTS idx_requests_specialist_id ON public.requests(specialist_id);
CREATE INDEX IF NOT EXISTS idx_requests_service_id ON public.requests(service_id);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON public.requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_completed_at ON public.requests(completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_billed_invoice_id ON public.requests(billed_invoice_id) WHERE billed_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_liquidation_id ON public.requests(liquidation_id) WHERE liquidation_id IS NOT NULL;

-- Índices para liquidations (liquidaciones)
CREATE INDEX IF NOT EXISTS idx_liquidations_status ON public.liquidations(status);
CREATE INDEX IF NOT EXISTS idx_liquidations_specialist_id ON public.liquidations(specialist_id);
CREATE INDEX IF NOT EXISTS idx_liquidations_period ON public.liquidations(period_year DESC, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_liquidations_created_at ON public.liquidations(created_at DESC);

-- Índices para budgets (presupuestos)
CREATE INDEX IF NOT EXISTS idx_budgets_status ON public.budgets(status);
CREATE INDEX IF NOT EXISTS idx_budgets_client_id ON public.budgets(client_id);
CREATE INDEX IF NOT EXISTS idx_budgets_created_at ON public.budgets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_valid_until ON public.budgets(valid_until) WHERE valid_until IS NOT NULL;

-- Índices para contracts (contratos)
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON public.contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_start_date ON public.contracts(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON public.contracts(end_date) WHERE end_date IS NOT NULL;

-- Índices para clients (clientes)
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_code ON public.clients(code) WHERE code IS NOT NULL;

-- Índices para specialists (especialistas)
CREATE INDEX IF NOT EXISTS idx_specialists_active ON public.specialists(active);
CREATE INDEX IF NOT EXISTS idx_specialists_name ON public.specialists(name);
CREATE INDEX IF NOT EXISTS idx_specialists_user_id ON public.specialists(user_id) WHERE user_id IS NOT NULL;

-- Índices para services (servicios)
CREATE INDEX IF NOT EXISTS idx_services_active ON public.services(active);
CREATE INDEX IF NOT EXISTS idx_services_name ON public.services(name);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category) WHERE category IS NOT NULL;

-- Índices compuestos para queries complejas frecuentes
CREATE INDEX IF NOT EXISTS idx_requests_flow_pending ON public.requests(client_id, status, created_at DESC) 
  WHERE billed_invoice_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_requests_flow_invoiced ON public.requests(specialist_id, created_at DESC) 
  WHERE billed_invoice_id IS NOT NULL AND liquidation_id IS NULL;

-- Comentarios para documentación
COMMENT ON INDEX idx_invoices_due_date_unpaid IS 'Optimiza queries de facturas vencidas pendientes de pago';
COMMENT ON INDEX idx_requests_flow_pending IS 'Optimiza queries de requests pendientes de facturación';
COMMENT ON INDEX idx_requests_flow_invoiced IS 'Optimiza queries de requests facturados pendientes de liquidación';