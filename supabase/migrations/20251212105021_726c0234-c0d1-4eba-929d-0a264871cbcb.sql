-- Eliminar el constraint actual que requiere quantity >= 1
ALTER TABLE budget_items DROP CONSTRAINT IF EXISTS budget_items_quantity_check;

-- Añadir nuevo constraint que permite cualquier cantidad mayor que 0 (incluyendo decimales como 0.5)
ALTER TABLE budget_items ADD CONSTRAINT budget_items_quantity_check CHECK (quantity > 0);