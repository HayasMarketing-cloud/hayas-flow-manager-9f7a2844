-- Cambiar el tipo de la columna quantity de integer a numeric para permitir decimales
ALTER TABLE budget_items 
ALTER COLUMN quantity TYPE numeric USING quantity::numeric;