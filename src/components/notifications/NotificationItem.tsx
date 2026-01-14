import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification } from '@/hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onClick?: () => void;
  compact?: boolean;
}

const typeIcons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

const typeColors = {
  info: 'text-blue-500',
  success: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-destructive',
};

export const NotificationItem = ({ notification, onClick, compact = false }: NotificationItemProps) => {
  const Icon = typeIcons[notification.type] || Bell;
  const iconColor = typeColors[notification.type] || 'text-muted-foreground';

  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex gap-3 p-3 cursor-pointer transition-colors hover:bg-muted/50',
        !notification.is_read && 'bg-primary/5',
        compact && 'p-2'
      )}
    >
      <div className={cn('flex-shrink-0 mt-0.5', iconColor)}>
        <Icon className={cn('h-5 w-5', compact && 'h-4 w-4')} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            'text-sm font-medium truncate',
            !notification.is_read && 'text-foreground',
            notification.is_read && 'text-muted-foreground'
          )}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />
          )}
        </div>
        <p className={cn(
          'text-sm text-muted-foreground',
          compact ? 'line-clamp-1' : 'line-clamp-2'
        )}>
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {timeAgo}
        </p>
      </div>
    </div>
  );
};
