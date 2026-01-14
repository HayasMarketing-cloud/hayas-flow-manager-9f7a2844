import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { cn } from '@/lib/utils';

export const NotificationDropdown = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const recentNotifications = notifications.slice(0, 5);

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className={cn(
              "absolute -top-1 -right-1 flex items-center justify-center",
              "min-w-[18px] h-[18px] px-1 text-xs font-bold",
              "bg-destructive text-destructive-foreground rounded-full"
            )}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <h4 className="font-semibold">Notificaciones</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/notificaciones')}
            className="text-xs h-7"
          >
            Ver todas
            <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        </div>
        <Separator />
        
        {recentNotifications.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tienes notificaciones</p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[300px]">
              {recentNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                  compact
                />
              ))}
            </ScrollArea>
            
            {unreadCount > 0 && (
              <>
                <Separator />
                <div className="p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="w-full text-xs"
                  >
                    <CheckCheck className="mr-2 h-4 w-4" />
                    Marcar todas como leídas
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
