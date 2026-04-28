UPDATE public.notifications
SET action_url = '/liquidaciones/' || entity_id
WHERE action_url = '/mis-liquidaciones'
  AND entity_type = 'liquidation'
  AND entity_id IS NOT NULL;