/**
 * F3 — Resolución dinámica de destinatarios de gestión.
 * Sustituye el antiguo destinatario fijo info@hayas.es.
 *
 * Destinatarios = AM/PM del presupuesto o contrato de origen
 *               + fallback a client_assignments del cliente
 *               + todos los usuarios con rol admin o finanzas.
 * Filtrado a @hayas.es y deduplicado por email en minúsculas.
 */
export interface ManagementScope {
  clientId?: string | null;
  budgetId?: string | null;
  contractId?: string | null;
}

export interface ManagementRecipients {
  userIds: string[];
  emails: string[];
}

export async function resolveManagementRecipients(
  supabase: any,
  scope: ManagementScope
): Promise<ManagementRecipients> {
  const managerIds = new Set<string>();

  if (scope.budgetId) {
    const { data } = await supabase
      .from('budgets')
      .select('am_user_id, pm_user_id')
      .eq('id', scope.budgetId)
      .maybeSingle();
    [data?.am_user_id, data?.pm_user_id].forEach((id) => id && managerIds.add(id));
  }

  if (scope.contractId) {
    const { data } = await supabase
      .from('contracts')
      .select('am_user_id, pm_user_id')
      .eq('id', scope.contractId)
      .maybeSingle();
    [data?.am_user_id, data?.pm_user_id].forEach((id) => id && managerIds.add(id));
  }

  // Fallback / refuerzo por cliente
  if (scope.clientId) {
    const { data: assignments } = await supabase
      .from('client_assignments')
      .select('user_id')
      .eq('client_id', scope.clientId);
    assignments?.forEach((a: any) => a.user_id && managerIds.add(a.user_id));

    if (managerIds.size === 0) {
      const [{ data: contracts }, { data: budgets }] = await Promise.all([
        supabase.from('contracts').select('am_user_id, pm_user_id').eq('client_id', scope.clientId),
        supabase.from('budgets').select('am_user_id, pm_user_id').eq('client_id', scope.clientId),
      ]);
      [...(contracts || []), ...(budgets || [])].forEach((row: any) => {
        [row.am_user_id, row.pm_user_id].forEach((id) => id && managerIds.add(id));
      });
    }
  }

  const { data: elevated } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', ['admin', 'finanzas']);
  elevated?.forEach((r: any) => r.user_id && managerIds.add(r.user_id));

  const userIds = Array.from(managerIds);
  if (userIds.length === 0) return { userIds: [], emails: [] };

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', userIds);

  const seen = new Set<string>();
  const emails: string[] = [];
  for (const p of profiles || []) {
    const email = (p.email || '').trim();
    const key = email.toLowerCase();
    if (!email || !key.endsWith('@hayas.es') || seen.has(key)) continue;
    seen.add(key);
    emails.push(email);
  }

  return { userIds, emails };
}
