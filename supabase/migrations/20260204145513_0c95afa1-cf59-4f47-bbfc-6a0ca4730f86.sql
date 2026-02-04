-- Añadir campos de período de trabajo a financial_requests
ALTER TABLE public.financial_requests 
  ADD COLUMN IF NOT EXISTS work_month INTEGER,
  ADD COLUMN IF NOT EXISTS work_year INTEGER;

-- Añadir campos de período de trabajo a operational_projects
ALTER TABLE public.operational_projects 
  ADD COLUMN IF NOT EXISTS work_month INTEGER,
  ADD COLUMN IF NOT EXISTS work_year INTEGER;

-- Índice para búsqueda rápida de duplicados en requests
CREATE INDEX IF NOT EXISTS idx_requests_work_period 
  ON financial_requests(contract_id, work_month, work_year);

-- Índice para búsqueda rápida de duplicados en projects
CREATE INDEX IF NOT EXISTS idx_projects_work_period 
  ON operational_projects(contract_id, work_month, work_year);