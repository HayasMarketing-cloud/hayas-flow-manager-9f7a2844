import { toast } from 'sonner';

type NotificationChannel = 'in-app' | 'email';

interface NotificationFeedbackOptions {
  channels: NotificationChannel[];
  recipients: string;
  context?: string;
}

/**
 * Shows a visual feedback toast when notifications are sent
 * Informs the user about the channel(s) used and the recipients
 */
export const showNotificationFeedback = ({ channels, recipients, context }: NotificationFeedbackOptions) => {
  const hasEmail = channels.includes('email');
  const hasInApp = channels.includes('in-app');
  
  let channelText = '';
  let icon = '';
  
  if (hasInApp && hasEmail) {
    icon = '🔔✉️';
    channelText = 'Notificación in-app y email';
  } else if (hasEmail) {
    icon = '✉️';
    channelText = 'Email';
  } else {
    icon = '🔔';
    channelText = 'Notificación in-app';
  }
  
  const message = context 
    ? `${icon} ${channelText} enviado a ${recipients} (${context})`
    : `${icon} ${channelText} enviado a ${recipients}`;
  
  toast.info(message, {
    duration: 4000,
  });
};

/**
 * Pre-configured feedback for common notification scenarios
 */
export const notificationFeedback = {
  /**
   * Specialist assigned to a request
   */
  specialistAssigned: (specialistName: string, hasEmail: boolean, hasInApp: boolean) => {
    const channels: NotificationChannel[] = [];
    if (hasInApp) channels.push('in-app');
    if (hasEmail) channels.push('email');
    
    if (channels.length > 0) {
      showNotificationFeedback({
        channels,
        recipients: specialistName,
      });
    }
  },

  /**
   * Request status changed
   */
  requestStatusChange: (requestCode: string) => {
    showNotificationFeedback({
      channels: ['in-app'],
      recipients: 'Admin, Finanzas, PM, AM',
      context: requestCode,
    });
  },

  /**
   * Email sent to specialist (resend or action notification)
   */
  emailToSpecialist: (specialistName: string) => {
    showNotificationFeedback({
      channels: ['email'],
      recipients: specialistName,
    });
  },

  /**
   * Specialist accepted/rejected request
   */
  specialistResponse: (response: 'accepted' | 'rejected', hasEmail: boolean) => {
    const channels: NotificationChannel[] = ['in-app'];
    if (hasEmail) channels.push('email');
    
    showNotificationFeedback({
      channels,
      recipients: 'Admin, AM',
      context: response === 'accepted' ? 'aceptación' : 'rechazo',
    });
  },

  /**
   * Budget approved
   */
  budgetApproved: (budgetCode: string) => {
    showNotificationFeedback({
      channels: ['in-app'],
      recipients: 'Admin, Finanzas, Seller, AM',
      context: budgetCode,
    });
  },

  /**
   * Liquidation sent to specialist
   */
  liquidationSent: (specialistName: string, hasInApp: boolean) => {
    const channels: NotificationChannel[] = ['email'];
    if (hasInApp) channels.push('in-app');
    
    showNotificationFeedback({
      channels,
      recipients: specialistName,
    });
  },

  /**
   * Liquidation signed/disputed
   */
  liquidationSigned: (action: 'accepted' | 'disputed') => {
    showNotificationFeedback({
      channels: ['in-app'],
      recipients: 'Admin, Finanzas, AM, PM',
      context: action === 'accepted' ? 'aceptada' : 'disputada',
    });
  },

  /**
   * Operational project completed
   */
  projectCompleted: (projectName: string, hasEmail: boolean) => {
    const inAppMessage = '🔔 Notificación enviada a Admin, Finanzas, AM, PM';
    const emailMessage = hasEmail ? '. ✉️ Email enviado a Finanzas' : '';
    
    toast.info(`${inAppMessage}${emailMessage}`, {
      duration: 4000,
    });
  },

  /**
   * User invitation sent
   */
  userInvitation: (email: string) => {
    showNotificationFeedback({
      channels: ['email'],
      recipients: email,
    });
  },
};
