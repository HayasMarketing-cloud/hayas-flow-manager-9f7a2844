import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Filter, Inbox } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { Skeleton } from '@/components/ui/skeleton';

const categories = [
  { value: 'all', label: 'Todas' },
  { value: 'request', label: 'Solicitudes' },
  { value: 'budget', label: 'Presupuestos' },
  { value: 'invoice', label: 'Facturas' },
  { value: 'liquidation', label: 'Liquidaciones' },
  { value: 'system', label: 'Sistema' },
];

const Notificaciones = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredNotifications = notifications.filter(n => {
    if (readFilter === 'unread' && n.is_read) return false;
    if (readFilter === 'read' && !n.is_read) return false;
    if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
    return true;
  });

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  return (
    <AppLayout title="Notificaciones" description="Centro de notificaciones">
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificaciones
                {unreadCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-destructive text-destructive-foreground rounded-full">
                    {unreadCount} sin leer
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {unreadCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={markAllAsRead}
                  >
                    <CheckCheck className="mr-2 h-4 w-4" />
                    Marcar todas
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={readFilter} onValueChange={(v) => setReadFilter(v as typeof readFilter)}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">
                  Todas ({notifications.length})
                </TabsTrigger>
                <TabsTrigger value="unread">
                  Sin leer ({unreadCount})
                </TabsTrigger>
                <TabsTrigger value="read">
                  Leídas ({notifications.length - unreadCount})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={readFilter} className="mt-0">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex gap-3 p-3">
                        <Skeleton className="h-5 w-5 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-2/3" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No hay notificaciones</p>
                    <p className="text-sm">
                      {readFilter === 'unread' 
                        ? 'Todas las notificaciones han sido leídas'
                        : 'No tienes notificaciones en esta categoría'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border rounded-lg border">
                    {filteredNotifications.map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClick={() => handleNotificationClick(notification)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Notificaciones;
