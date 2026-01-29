-- Fase 1: Añadir proposal_context a budgets
ALTER TABLE public.budgets 
ADD COLUMN IF NOT EXISTS proposal_context JSONB DEFAULT NULL;

-- Fase 2: Añadir template_structure a services
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS template_structure JSONB DEFAULT NULL;

COMMENT ON COLUMN public.budgets.proposal_context IS 'Contexto de propuesta: {objectives: string[], scope: string, approach: string, drive_proposal_url: string}';
COMMENT ON COLUMN public.services.template_structure IS 'Plantilla operativa: {milestones: [{name: string, tasks: string[]}]}';