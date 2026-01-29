-- Add partner_reference column to financial_requests
ALTER TABLE financial_requests 
ADD COLUMN partner_reference VARCHAR(100);

-- Index for fast lookups by partner reference
CREATE INDEX idx_financial_requests_partner_reference 
ON financial_requests(partner_reference) 
WHERE partner_reference IS NOT NULL;

-- Descriptive comment
COMMENT ON COLUMN financial_requests.partner_reference IS 
'Código de referencia del partner/proveedor (ej: P1225-5602-4821 de Wolfestone)';