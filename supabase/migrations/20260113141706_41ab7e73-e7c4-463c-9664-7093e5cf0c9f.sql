-- ===========================================
-- Cleanup: Remove seller data and policies (keep enum for compatibility)
-- ===========================================

-- 1. Delete any seller role assignments
DELETE FROM public.user_roles WHERE role = 'seller'::app_role;

-- 2. Drop seller-related RLS policies
DROP POLICY IF EXISTS "Sellers can view clients from their contracts" ON public.clients;
DROP POLICY IF EXISTS "Sellers can view invoices from their clients" ON public.invoices;
DROP POLICY IF EXISTS "Sellers can create budgets" ON public.budgets;
DROP POLICY IF EXISTS "Sellers can view own budgets" ON public.budgets;

-- 3. Drop the orphaned app_role_v2 type if it exists from failed migration
DROP TYPE IF EXISTS public.app_role_v2;

-- Note: 'seller' stays in the enum but won't be usable from frontend
-- The table sales_commissions was already created in a previous partial migration