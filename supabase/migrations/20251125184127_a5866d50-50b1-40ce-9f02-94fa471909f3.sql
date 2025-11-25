-- ==========================================
-- FLOW MANAGER DATABASE MIGRATION (CORREGIDA)
-- ==========================================

-- FASE 1: CREAR ENUMS
-- ==========================================

CREATE TYPE cost_type AS ENUM ('hourly', 'fixed');
CREATE TYPE price_rule_type AS ENUM ('hourly', 'fixed');
CREATE TYPE billing_frequency AS ENUM ('monthly', 'one_time');
CREATE TYPE payment_method AS ENUM ('stripe', 'credit_card', 'sdd', 'bank_transfer');
CREATE TYPE contract_type AS ENUM ('retainer', 'project', 'one_time');
CREATE TYPE financial_request_status AS ENUM ('draft', 'active', 'invoiced', 'liquidated');
CREATE TYPE operational_status AS ENUM ('pending', 'in_progress', 'in_review', 'completed');
CREATE TYPE reviewer_type AS ENUM ('am', 'client');

-- ==========================================
-- FASE 2: MODIFICACIÓN DE TABLAS EXISTENTES
-- ==========================================

-- 2.1 CLIENTS
ALTER TABLE clients ADD COLUMN hub_client_url TEXT;
ALTER TABLE clients ADD COLUMN payment_method payment_method DEFAULT 'bank_transfer';
ALTER TABLE clients ADD COLUMN billing_emails TEXT[];
ALTER TABLE clients ADD COLUMN invoice_day INTEGER CHECK (invoice_day >= 1 AND invoice_day <= 31);
ALTER TABLE clients ADD COLUMN expected_payment_day INTEGER CHECK (expected_payment_day >= 1 AND expected_payment_day <= 31);

-- 2.2 SPECIALISTS
ALTER TABLE specialists ADD COLUMN cost_type cost_type DEFAULT 'hourly';
ALTER TABLE specialists ADD COLUMN default_rate NUMERIC;
ALTER TABLE specialists ADD COLUMN liquidation_terms TEXT;

-- 2.3 CONTRACTS
ALTER TABLE contracts ADD COLUMN contract_type contract_type DEFAULT 'retainer';
ALTER TABLE contracts ADD COLUMN am_user_id UUID REFERENCES profiles(id);
ALTER TABLE contracts ADD COLUMN pm_user_id UUID REFERENCES profiles(id);
ALTER TABLE contracts ADD COLUMN seller_id UUID REFERENCES profiles(id);
ALTER TABLE contracts ADD COLUMN attached_contract_url TEXT;
ALTER TABLE contracts ADD COLUMN specialists_default UUID[];
ALTER TABLE contracts ADD COLUMN client_po_number TEXT;
ALTER TABLE contracts ADD COLUMN hub_project_url TEXT;

-- 2.4 CONTRACT_SERVICES
ALTER TABLE contract_services RENAME COLUMN unit_price TO price_value;
ALTER TABLE contract_services ADD COLUMN price_rule_type price_rule_type DEFAULT 'fixed';
ALTER TABLE contract_services ADD COLUMN billing_frequency billing_frequency DEFAULT 'monthly';
ALTER TABLE contract_services ADD COLUMN project_type TEXT;
ALTER TABLE contract_services DROP COLUMN billing_mode;

-- ==========================================
-- FASE 3: TRANSFORMACIÓN REQUESTS → FINANCIAL_REQUESTS
-- ==========================================

-- Renombrar tabla
ALTER TABLE requests RENAME TO financial_requests;

-- Eliminar campos que NO pertenecen a Finance Layer
ALTER TABLE financial_requests DROP COLUMN unit_price;
ALTER TABLE financial_requests DROP COLUMN total;
ALTER TABLE financial_requests DROP COLUMN margin;

-- Renombrar cost → cost_to_agency
ALTER TABLE financial_requests RENAME COLUMN cost TO cost_to_agency;

-- Añadir campos de Flow Manager
ALTER TABLE financial_requests ADD COLUMN cost_type cost_type DEFAULT 'fixed';
ALTER TABLE financial_requests ADD COLUMN cost_rate NUMERIC;
ALTER TABLE financial_requests ADD COLUMN hours NUMERIC;
ALTER TABLE financial_requests ADD COLUMN fixed_cost NUMERIC;
ALTER TABLE financial_requests ADD COLUMN specialist_acceptance BOOLEAN DEFAULT FALSE;
ALTER TABLE financial_requests ADD COLUMN contract_id UUID REFERENCES contracts(id);

-- Migrar status al nuevo enum (con manejo correcto del default)
ALTER TABLE financial_requests ALTER COLUMN status DROP DEFAULT;
ALTER TABLE financial_requests ALTER COLUMN status TYPE TEXT;
UPDATE financial_requests SET status = 
  CASE 
    WHEN status IN ('draft') THEN 'draft'
    WHEN status IN ('pending_approval', 'approved', 'in_progress', 'completed') THEN 'active'
    WHEN status IN ('billed') THEN 'invoiced'
    ELSE 'draft'
  END;
ALTER TABLE financial_requests ALTER COLUMN status TYPE financial_request_status USING status::financial_request_status;
ALTER TABLE financial_requests ALTER COLUMN status SET DEFAULT 'draft'::financial_request_status;

-- Actualizar referencias en otras tablas
ALTER TABLE invoice_items RENAME COLUMN request_id TO financial_request_id;
ALTER TABLE liquidation_items RENAME COLUMN request_id TO financial_request_id;

-- ==========================================
-- FASE 4: NUEVAS TABLAS - OPERATIONS LAYER
-- ==========================================

CREATE TABLE operational_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id),
  budget_id UUID REFERENCES budgets(id),
  name TEXT NOT NULL,
  description TEXT,
  owner_user_id UUID REFERENCES profiles(id),
  deadline DATE,
  status operational_status DEFAULT 'pending',
  hub_client_url TEXT,
  hub_project_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE operational_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_project_id UUID NOT NULL REFERENCES operational_projects(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  financial_request_id UUID REFERENCES financial_requests(id),
  name TEXT NOT NULL,
  description TEXT,
  assignee_user_id UUID REFERENCES profiles(id),
  assignee_specialist_id UUID REFERENCES specialists(id),
  deadline DATE,
  status operational_status DEFAULT 'pending',
  reviewer_type reviewer_type,
  context_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_request_id UUID NOT NULL REFERENCES operational_requests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  assignee_user_id UUID REFERENCES profiles(id),
  assignee_specialist_id UUID REFERENCES specialists(id),
  deadline DATE,
  status operational_status DEFAULT 'pending',
  reviewer_type reviewer_type,
  context_url TEXT,
  notes TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  assignee_user_id UUID REFERENCES profiles(id),
  assignee_specialist_id UUID REFERENCES specialists(id),
  deadline DATE,
  status operational_status DEFAULT 'pending',
  context_url TEXT,
  notes TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- FASE 5: POLÍTICAS RLS
-- ==========================================

ALTER TABLE operational_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assigned projects" ON operational_projects
FOR SELECT USING (
  owner_user_id = auth.uid() OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role) OR
  has_role(auth.uid(), 'finanzas'::app_role)
);

CREATE POLICY "PM and admin can manage projects" ON operational_projects
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "Users can view assigned requests" ON operational_requests
FOR SELECT USING (
  assignee_user_id = auth.uid() OR
  assignee_specialist_id IN (SELECT id FROM specialists WHERE user_id = auth.uid()) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role) OR
  has_role(auth.uid(), 'finanzas'::app_role)
);

CREATE POLICY "PM and admin can manage requests" ON operational_requests
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "Users can view assigned milestones" ON milestones
FOR SELECT USING (
  assignee_user_id = auth.uid() OR
  assignee_specialist_id IN (SELECT id FROM specialists WHERE user_id = auth.uid()) OR
  operational_request_id IN (
    SELECT id FROM operational_requests 
    WHERE assignee_user_id = auth.uid() OR
    assignee_specialist_id IN (SELECT id FROM specialists WHERE user_id = auth.uid())
  ) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "Assigned users can update milestones" ON milestones
FOR UPDATE USING (
  assignee_user_id = auth.uid() OR
  assignee_specialist_id IN (SELECT id FROM specialists WHERE user_id = auth.uid()) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "PM and admin can create milestones" ON milestones
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "Users can view assigned tasks" ON tasks
FOR SELECT USING (
  assignee_user_id = auth.uid() OR
  assignee_specialist_id IN (SELECT id FROM specialists WHERE user_id = auth.uid()) OR
  milestone_id IN (
    SELECT id FROM milestones 
    WHERE assignee_user_id = auth.uid() OR
    assignee_specialist_id IN (SELECT id FROM specialists WHERE user_id = auth.uid())
  ) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "Assigned users can update tasks" ON tasks
FOR UPDATE USING (
  assignee_user_id = auth.uid() OR
  assignee_specialist_id IN (SELECT id FROM specialists WHERE user_id = auth.uid()) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "PM and admin can create tasks" ON tasks
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "Users can view relevant activity logs" ON activity_log
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "Authenticated users can create activity logs" ON activity_log
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update financial_requests policies
DROP POLICY IF EXISTS "Finance and admin can manage requests" ON financial_requests;
DROP POLICY IF EXISTS "All authenticated users can view requests" ON financial_requests;

CREATE POLICY "Finance roles can manage financial_requests" ON financial_requests
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'finanzas'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "Specialists can view own requests" ON financial_requests
FOR SELECT USING (
  specialist_id IN (SELECT id FROM specialists WHERE user_id = auth.uid()) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'finanzas'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role)
);

-- Triggers
CREATE TRIGGER update_operational_projects_updated_at
BEFORE UPDATE ON operational_projects
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operational_requests_updated_at
BEFORE UPDATE ON operational_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_milestones_updated_at
BEFORE UPDATE ON milestones
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();