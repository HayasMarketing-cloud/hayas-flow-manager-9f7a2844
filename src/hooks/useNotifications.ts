import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: string;
  entity_id: string | null;
  entity_type: string | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data as Notification[] || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [user?.id]);

  // Setup realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();

    const channel = supabase
      .channel(`notifications:user:${user.id}`, { config: { private: true } })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          
          // Add to state
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Show toast notification
          toast({
            title: newNotification.title,
            description: newNotification.message,
            variant: newNotification.type === 'error' ? 'destructive' : 'default',
          });

          // Invalidate relevant queries based on entity type
          if (newNotification.entity_type === 'financial_request') {
            queryClient.invalidateQueries({ queryKey: ['financial_requests'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications, queryClient]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications
  };
};

// Helper function to create notifications (for use in components)
export const createNotification = async (
  userId: string,
  data: {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    category?: string;
    entity_id?: string;
    entity_type?: string;
    action_url?: string;
  }
) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        category: data.category || 'system',
        entity_id: data.entity_id || null,
        entity_type: data.entity_type || null,
        action_url: data.action_url || null,
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error };
  }
};

// Helper to notify multiple users
export const notifyUsers = async (
  userIds: string[],
  data: {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    category?: string;
    entity_id?: string;
    entity_type?: string;
    action_url?: string;
  }
) => {
  const notifications = userIds.map(userId => ({
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
