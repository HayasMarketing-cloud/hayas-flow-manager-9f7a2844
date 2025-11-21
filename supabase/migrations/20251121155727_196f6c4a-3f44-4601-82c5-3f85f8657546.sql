-- Agregar los nuevos roles al enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'finanzas';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'project_manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'especialista';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'account_manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'seller';