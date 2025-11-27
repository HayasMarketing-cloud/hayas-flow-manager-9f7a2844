-- Actualizar el request existente "Modificar main banner temporada verano"
UPDATE financial_requests
SET 
  specialist_id = '7901fb1f-231e-43a3-b39b-20b17a8bfc53',
  deadline = '2025-05-26',
  hours = 1,
  cost_type = 'hourly',
  cost_rate = 25,
  cost_to_agency = 25,
  status = 'active',
  contract_id = 'e8a987ab-7234-416a-807d-602ad8c39d0d'
WHERE title ILIKE '%Modificar main banner temporada verano%';

-- Insertar los 14 nuevos requests
INSERT INTO financial_requests (client_id, service_id, contract_id, specialist_id, title, deadline, hours, cost_type, cost_rate, cost_to_agency, status, quantity, code)
VALUES
  -- Iolanda Carbone requests
  ('a1795ef9-ed11-4df9-9c08-5c98b6a49613', '0118dcb8-43d5-467e-8b0a-062da48ddeb5', 'e8a987ab-7234-416a-807d-602ad8c39d0d', '99ed33b0-3c2e-424d-890e-18d366c82e16', 'Modificar main banner USA tienda completa', '2025-05-26', 1, 'hourly', 25, 25, 'active', 1, public.generate_code('requests')),
  ('a1795ef9-ed11-4df9-9c08-5c98b6a49613', '0118dcb8-43d5-467e-8b0a-062da48ddeb5', 'e8a987ab-7234-416a-807d-602ad8c39d0d', '99ed33b0-3c2e-424d-890e-18d366c82e16', 'Añadir nueva categoría de producto (Pegatinas)', '2025-05-26', 3, 'hourly', 25, 75, 'active', 1, public.generate_code('requests')),
  ('a1795ef9-ed11-4df9-9c08-5c98b6a49613', '0118dcb8-43d5-467e-8b0a-062da48ddeb5', 'e8a987ab-7234-416a-807d-602ad8c39d0d', '99ed33b0-3c2e-424d-890e-18d366c82e16', 'Añadir nueva categoría de producto (Papel de envolver)', '2025-05-26', 3, 'hourly', 25, 75, 'active', 1, public.generate_code('requests')),
  ('a1795ef9-ed11-4df9-9c08-5c98b6a49613', '0118dcb8-43d5-467e-8b0a-062da48ddeb5', 'e8a987ab-7234-416a-807d-602ad8c39d0d', '99ed33b0-3c2e-424d-890e-18d366c82e16', 'Crear nuevos flujos de personalización de productos', '2025-06-23', 40, 'hourly', 25, 1000, 'active', 1, public.generate_code('requests')),
  ('a1795ef9-ed11-4df9-9c08-5c98b6a49613', '0118dcb8-43d5-467e-8b0a-062da48ddeb5', 'e8a987ab-7234-416a-807d-602ad8c39d0d', '99ed33b0-3c2e-424d-890e-18d366c82e16', 'Preparar contenidos tienda USA', '2025-06-06', 80, 'hourly', 25, 2000, 'active', 1, public.generate_code('requests')),
  ('a1795ef9-ed11-4df9-9c08-5c98b6a49613', '0118dcb8-43d5-467e-8b0a-062da48ddeb5', 'e8a987ab-7234-416a-807d-602ad8c39d0d', '99ed33b0-3c2e-424d-890e-18d366c82e16', 'Setup and launch USA store', '2025-06-05', 6, 'hourly', 25, 150, 'active', 1, public.generate_code('requests')),
  ('a1795ef9-ed11-4df9-9c08-5c98b6a49613', '0118dcb8-43d5-467e-8b0a-062da48ddeb5', 'e8a987ab-7234-416a-807d-602ad8c39d0d', '99ed33b0-3c2e-424d-890e-18d366c82e16', 'Implementar nuevo módulo blog homepage', '2025-06-02', 4, 'hourly', 25, 100, 'active', 1, public.generate_code('requests')),
  
  -- Sandra Vásquez requests
  ('a1795ef9-ed11-4df9-9c08-5c98b6a49613', '0118dcb8-43d5-467e-8b0a-062da48ddeb5', 'e8a987ab-7234-416a-807d-602ad8c39d0d', 'a9b073eb-9c82-484b-8041-07dffcf0d3a7', 'Añadir nueva categoría de producto (Invitaciones)', '2025-05-26', 3, 'hourly', 25, 75, 'active', 1, public.generate_code('requests')),
  ('a1795ef9-ed11-4df9-9c08-5c98b6a49613', '0118dcb8-43d5-467e-8b0a-062da48ddeb5', 'e8a987ab-7234-416a-807d-602ad8c39d0d', 'a9b073eb-9c82-484b-8041-07dffcf0d3a7', 'Añadir nueva categoría de producto (Bolsas)', '2025-05-26', 3, 'hourly', 25, 75, 'active', 1, public.generate_code('requests')),
  ('a1795ef9-ed11-4df9-9c08-5c98b6a49613', '0118dcb8-43d5-467e-8b0a-062da48ddeb5', 'e8a987ab-7234-416a-807d-602ad8c39d0d', 'a9b073eb-9c82-484b-8041-07dffcf0d3a7', 'Crear página de thank-you', '2025-06-02', 2, 'hourly', 25, 50, 'active', 1, public.generate_code('requests')),
  ('a1795ef9-ed11-4df9-9c08-5c98b6a49613', '0118dcb8-43d5-467e-8b0a-062da48ddeb5', 'e8a987ab-7234-416a-807d-602ad8c39d0d', 'a9b073eb-9c82-484b-8041-07dffcf0d3a7', 'Revisar y arreglar problemas de las nuevas plantillas', '2025-05-26', 30, 'hourly', 25, 750, 'active', 1, public.generate_code('requests')),
  ('a1795ef9-ed11-4df9-9c08-5c98b6a49613', '0118dcb8-43d5-467e-8b0a-062da48ddeb5', 'e8a987ab-7234-416a-807d-602ad8c39d0d', 'a9b073eb-9c82-484b-8041-07dffcf0d3a7', 'SEO blog posts', '2025-06-02', 5, 'hourly', 25, 125, 'active', 1, public.generate_code('requests')),
  ('a1795ef9-ed11-4df9-9c08-5c98b6a49613', '0118dcb8-43d5-467e-8b0a-062da48ddeb5', 'e8a987ab-7234-416a-807d-602ad8c39d0d', 'a9b073eb-9c82-484b-8041-07dffcf0d3a7', 'Revisar blog posts con actualizaciones de imágenes', '2025-06-02', 8, 'hourly', 25, 200, 'active', 1, public.generate_code('requests')),
  
  -- Tomás White request
  ('a1795ef9-ed11-4df9-9c08-5c98b6a49613', '0118dcb8-43d5-467e-8b0a-062da48ddeb5', 'e8a987ab-7234-416a-807d-602ad8c39d0d', '7901fb1f-231e-43a3-b39b-20b17a8bfc53', 'Resolver incidencias página checkout', '2025-05-26', 8, 'hourly', 25, 200, 'active', 1, public.generate_code('requests'));