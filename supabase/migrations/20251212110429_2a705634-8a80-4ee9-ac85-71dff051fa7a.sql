-- Ajustar la FK para permitir borrar o regenerar financial_requests
ALTER TABLE operational_requests DROP CONSTRAINT IF EXISTS operational_requests_financial_request_id_fkey;

ALTER TABLE operational_requests
ADD CONSTRAINT operational_requests_financial_request_id_fkey
FOREIGN KEY (financial_request_id)
REFERENCES financial_requests(id)
ON DELETE SET NULL;