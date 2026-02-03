-- Reload PostgREST schema cache to pick up the new client_po_number column
NOTIFY pgrst, 'reload schema';