-- Añadir tipo de precio de venta al cliente (fijo vs por horas)
ALTER TABLE financial_requests 
ADD COLUMN IF NOT EXISTS sale_type price_rule_type DEFAULT 'fixed';

-- Añadir campos para tarifa y horas de venta al cliente
ALTER TABLE financial_requests 
ADD COLUMN IF NOT EXISTS sale_rate numeric DEFAULT NULL;

ALTER TABLE financial_requests 
ADD COLUMN IF NOT EXISTS sale_hours numeric DEFAULT NULL;