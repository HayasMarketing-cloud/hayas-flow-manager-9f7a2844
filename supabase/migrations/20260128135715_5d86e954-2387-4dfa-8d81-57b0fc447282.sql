-- Add team_leader_id column to specialists table
-- This allows specialists to be grouped under a team leader
ALTER TABLE public.specialists 
ADD COLUMN team_leader_id uuid REFERENCES public.specialists(id);

-- Create index for efficient queries on team members
CREATE INDEX idx_specialists_team_leader ON public.specialists(team_leader_id);

-- Add comment for documentation
COMMENT ON COLUMN public.specialists.team_leader_id IS 'References the specialist who leads this team. NULL means the specialist is independent or is the team leader.';

-- Update RLS to allow team leaders to view their team members' liquidations
CREATE POLICY "Team leaders can view team member liquidations"
ON public.liquidations
FOR SELECT
USING (
  specialist_id IN (
    SELECT id FROM public.specialists 
    WHERE team_leader_id = get_current_specialist_id()
  )
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'finanzas')
);

-- Allow team leaders to view team member liquidation items
CREATE POLICY "Team leaders can view team member liquidation items"
ON public.liquidation_items
FOR SELECT
USING (
  liquidation_id IN (
    SELECT l.id FROM public.liquidations l
    JOIN public.specialists s ON l.specialist_id = s.id
    WHERE s.team_leader_id = get_current_specialist_id()
  )
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'finanzas')
);