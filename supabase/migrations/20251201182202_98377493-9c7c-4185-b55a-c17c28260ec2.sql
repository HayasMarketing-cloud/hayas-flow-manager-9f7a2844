-- Add aggregated_request_ids column to invoice_items to store multiple requests in a single line
ALTER TABLE invoice_items 
ADD COLUMN aggregated_request_ids uuid[] DEFAULT NULL;

COMMENT ON COLUMN invoice_items.aggregated_request_ids IS 'Array of financial_request IDs included in an aggregated invoice line';
