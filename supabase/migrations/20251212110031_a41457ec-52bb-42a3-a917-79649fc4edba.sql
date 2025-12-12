-- Añadir columna budget_item_id a financial_requests para vincular con budget_items
ALTER TABLE financial_requests ADD COLUMN budget_item_id uuid REFERENCES budget_items(id) ON DELETE SET NULL;

-- Crear índice para mejorar rendimiento de consultas
CREATE INDEX idx_financial_requests_budget_item ON financial_requests(budget_item_id);