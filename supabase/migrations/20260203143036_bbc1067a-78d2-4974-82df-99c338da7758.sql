-- Add default_hourly_rate column to clients table
ALTER TABLE clients 
ADD COLUMN default_hourly_rate numeric DEFAULT NULL;

COMMENT ON COLUMN clients.default_hourly_rate IS 
  'Tarifa por hora por defecto para facturación. Se usa cuando no hay precio definido en contrato.';

-- Populate default rate for Asendia clients
UPDATE clients 
SET default_hourly_rate = 70 
WHERE name ILIKE '%ASENDIA%';