REVOKE ALL ON FUNCTION public.can_view_liquidation_as_assigned_am(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_team_leader_liquidation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_liquidation_as_assigned_am(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_liquidation_as_assigned_am(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_team_leader_liquidation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_leader_liquidation(uuid) TO service_role;