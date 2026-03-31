import { supabase } from '@/integrations/supabase/client';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationCategory = 'request' | 'budget' | 'invoice' | 'liquidation' | 'system' | 'project';

interface NotificationData {
  title: string;
  message: string;
  type?: NotificationType;
  category?: NotificationCategory;
  entity_id?: string;
  entity_type?: string;
  action_url?: string;
}

type AppRole = 'account_manager' | 'admin' | 'especialista' | 'finanzas' | 'moderator' | 'project_manager' | 'seller' | 'user';

// Get users with specific roles
export const getUsersByRole = async (roles: AppRole[]): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', roles);

    if (error) throw error;
    return [...new Set(data?.map(r => r.user_id) || [])];
  } catch (error) {
    console.error('Error fetching users by role:', error);
    return [];
  }
};

// Get relevant users filtering AM/PM by client assignment
const getRelevantUserIds = async (
  roles: AppRole[],
  clientId?: string,
  excludeUserId?: string
): Promise<string[]> => {
  const elevatedRoles = roles.filter(r => ['admin', 'finanzas'].includes(r));
  const filterableRoles = roles.filter(r => ['project_manager', 'account_manager'].includes(r));

  // Admin/finanzas: all users with these roles
  const elevated = elevatedRoles.length > 0
    ? await getUsersByRole(elevatedRoles) : [];

  // AM/PM: only those assigned to the client
  let assigned: string[] = [];
  if (filterableRoles.length > 0 && clientId) {
    const [{ data: contracts }, { data: budgets }] = await Promise.all([
      supabase.from('contracts').select('am_user_id, pm_user_id').eq('client_id', clientId),
      supabase.from('budgets').select('am_user_id, pm_user_id').eq('client_id', clientId),
    ]);

    assigned = [...new Set([
      ...(contracts?.flatMap(c => [c.am_user_id, c.pm_user_id]) || []),
      ...(budgets?.flatMap(b => [b.am_user_id, b.pm_user_id]) || []),
    ].filter(Boolean) as string[])];
  } else if (filterableRoles.length > 0 && !clientId) {
    // Fallback: if no clientId provided, include all (backwards compat)
    const allManagers = await getUsersByRole(filterableRoles);
    assigned = allManagers;
  }

  const all = [...new Set([...elevated, ...assigned])];
  return excludeUserId ? all.filter(id => id !== excludeUserId) : all;
};

// Notify users with specific roles
export const notifyByRole = async (
  roles: AppRole[],
  data: NotificationData,
  excludeUserId?: string
) => {
  const userIds = await getUsersByRole(roles);
  const filteredUserIds = excludeUserId 
    ? userIds.filter(id => id !== excludeUserId) 
    : userIds;

  if (filteredUserIds.length === 0) return { success: true };

  const notifications = filteredUserIds.map(userId => ({
    user_id: userId,
    title: data.title,
    message: data.message,
    type: data.type || 'info',
    category: data.category || 'system',
    entity_id: data.entity_id || null,
    entity_type: data.entity_type || null,
    action_url: data.action_url || null,
  }));

  try {
    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error creating notifications:', error);
    return { success: false, error };
  }
};

// Specific notification helpers
export const notifyRequestStatusChange = async (
  requestCode: string,
  requestId: string,
  newStatus: string,
  excludeUserId?: string,
  clientId?: string
) => {
  const statusLabels: Record<string, string> = {
    draft: 'borrador',
    pending_specialist: 'pendiente especialista',
    accepted: 'aceptado',
    rejected: 'rechazado',
    in_progress: 'en progreso',
    completed: 'completado',
    billed: 'facturado',
    cancelled: 'cancelado',
  };

  const roles: AppRole[] = ['admin', 'finanzas', 'project_manager', 'account_manager'];
  const userIds = await getRelevantUserIds(roles, clientId, excludeUserId);

  if (userIds.length === 0) return;

  const notifications = userIds.map(userId => ({
    user_id: userId,
    title: 'Cambio de estado en solicitud',
    message: `${requestCode} cambió a: ${statusLabels[newStatus] || newStatus}`,
    type: 'info',
    category: 'request',
    entity_id: requestId,
    entity_type: 'financial_request',
    action_url: `/solicitudes/${requestId}`,
  }));

  try {
    await supabase.from('notifications').insert(notifications);
  } catch (error) {
    console.error('Error creating request status notifications:', error);
  }
};

export const notifySpecialistResponse = async (
  requestCode: string,
  requestId: string,
  specialistName: string,
  accepted: boolean
) => {
  await notifyByRole(
    ['admin', 'finanzas', 'project_manager', 'account_manager'],
    {
      title: accepted ? 'Especialista aceptó solicitud' : 'Especialista rechazó solicitud',
      message: `${specialistName} ${accepted ? 'aceptó' : 'rechazó'} ${requestCode}`,
      type: accepted ? 'success' : 'warning',
      category: 'request',
      entity_id: requestId,
      entity_type: 'financial_request',
      action_url: `/solicitudes/${requestId}`,
    }
  );
};

export const notifySpecialistAssigned = async (
  specialistUserId: string,
  requestCode: string,
  requestId: string,
  clientName: string
) => {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: specialistUserId,
      title: 'Nueva solicitud asignada',
      message: `Te han asignado ${requestCode} para ${clientName}`,
      type: 'info',
      category: 'request',
      entity_id: requestId,
      entity_type: 'financial_request',
      action_url: `/solicitudes/${requestId}`,
    });

  if (error) console.error('Error notifying specialist:', error);
};

export const notifyBudgetApproved = async (
  budgetCode: string,
  budgetId: string,
  clientName: string
) => {
  await notifyByRole(
    ['admin', 'finanzas', 'seller', 'account_manager'],
    {
      title: 'Presupuesto aprobado',
      message: `${budgetCode} para ${clientName} ha sido aprobado`,
      type: 'success',
      category: 'budget',
      entity_id: budgetId,
      entity_type: 'budget',
      action_url: `/presupuestos/${budgetId}`,
    }
  );
};

export const notifyLiquidationSigned = async (
  liquidationCode: string,
  liquidationId: string,
  specialistName: string
) => {
  await notifyByRole(
    ['admin', 'finanzas'],
    {
      title: 'Liquidación firmada',
      message: `${liquidationCode} de ${specialistName} ha sido firmada`,
      type: 'success',
      category: 'liquidation',
      entity_id: liquidationId,
      entity_type: 'liquidation',
      action_url: `/liquidaciones/${liquidationId}`,
    }
  );
};

// Notify specialist when liquidation is sent
export const notifyLiquidationSent = async (
  specialistUserId: string | null,
  liquidationCode: string,
  liquidationId: string,
  periodMonth: number,
  periodYear: number
) => {
  if (!specialistUserId) return;

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  await supabase.from('notifications').insert({
    user_id: specialistUserId,
    title: 'Nueva liquidación recibida',
    message: `Tienes pendiente revisar ${liquidationCode} de ${monthNames[periodMonth - 1]} ${periodYear}`,
    type: 'info',
    category: 'liquidation',
    entity_id: liquidationId,
    entity_type: 'liquidation',
    action_url: '/mis-liquidaciones',
  });
};

// Notify admins/AM when specialist accepts liquidation  
export const notifyLiquidationAccepted = async (
  liquidationCode: string,
  liquidationId: string,
  specialistName: string
) => {
  await notifyByRole(
    ['admin', 'finanzas'],
    {
      title: 'Liquidación aceptada',
      message: `${specialistName} ha aceptado ${liquidationCode}`,
      type: 'success',
      category: 'liquidation',
      entity_id: liquidationId,
      entity_type: 'liquidation',
      action_url: `/liquidaciones/${liquidationId}`,
    }
  );
};

// Notify admins/AM when specialist disputes liquidation
export const notifyLiquidationDisputed = async (
  liquidationCode: string,
  liquidationId: string,
  specialistName: string,
  disputeReason?: string
) => {
  await notifyByRole(
    ['admin', 'finanzas'],
    {
      title: 'Liquidación disputada',
      message: `${specialistName} ha disputado ${liquidationCode}${disputeReason ? `: ${disputeReason}` : ''}`,
      type: 'warning',
      category: 'liquidation',
      entity_id: liquidationId,
      entity_type: 'liquidation',
      action_url: `/liquidaciones/${liquidationId}`,
    }
  );
};

// Notify admin/finanzas when specialist uploads invoice
export const notifySpecialistInvoiceUploaded = async (
  liquidationCode: string,
  liquidationId: string,
  specialistName: string,
  amountsMatch: boolean | null
) => {
  const matchText = amountsMatch === true
    ? 'Los importes coinciden ✓'
    : amountsMatch === false
      ? '⚠ ATENCIÓN: Los importes NO coinciden'
      : 'No se pudo verificar el importe';

  await notifyByRole(
    ['admin', 'finanzas'],
    {
      title: 'Factura de especialista recibida',
      message: `${specialistName} ha subido su factura para ${liquidationCode}. ${matchText}`,
      type: amountsMatch === false ? 'warning' : 'info',
      category: 'liquidation',
      entity_id: liquidationId,
      entity_type: 'liquidation',
      action_url: `/liquidaciones/${liquidationId}`,
    }
  );
};

// Notify when operational project is completed - for billing and liquidation
export const notifyProjectCompleted = async (
  projectName: string,
  projectId: string,
  clientName: string
) => {
  await notifyByRole(
    ['admin', 'finanzas', 'account_manager', 'project_manager'],
    {
      title: 'Proyecto completado - Pendiente facturación',
      message: `${projectName} de ${clientName} completado. Revisar solicitudes para facturación y liquidación.`,
      type: 'success',
      category: 'project',
      entity_id: projectId,
      entity_type: 'operational_project',
      action_url: `/operaciones/proyectos/${projectId}`,
    }
  );
};
