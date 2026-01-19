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
  excludeUserId?: string
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

  await notifyByRole(
    ['admin', 'finanzas', 'project_manager', 'account_manager'],
    {
      title: 'Cambio de estado en solicitud',
      message: `${requestCode} cambió a: ${statusLabels[newStatus] || newStatus}`,
      type: 'info',
      category: 'request',
      entity_id: requestId,
      entity_type: 'financial_request',
      action_url: `/solicitudes/${requestId}`,
    },
    excludeUserId
  );
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
    ['admin', 'finanzas', 'account_manager', 'project_manager'],
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
    ['admin', 'finanzas', 'account_manager'],
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
    ['admin', 'finanzas', 'account_manager', 'project_manager'],
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
