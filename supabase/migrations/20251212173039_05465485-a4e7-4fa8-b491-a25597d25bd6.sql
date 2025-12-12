-- Add drive_folder_url column to clients table
ALTER TABLE public.clients ADD COLUMN drive_folder_url text;

-- Add drive_folder_url column to operational_projects table
ALTER TABLE public.operational_projects ADD COLUMN drive_folder_url text;