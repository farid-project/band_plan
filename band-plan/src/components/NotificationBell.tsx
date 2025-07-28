import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  data: {
    group_id: string;
    group_name: string;
    group_member_id: string;
    role: string;
  };
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      setupRealtimeSubscription();

      return () => {
        if (channel) {
          channel.unsubscribe();
        }
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user?.id)
      .eq('read', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    setNotifications(data || []);
  };

  const setupRealtimeSubscription = async () => {
    try {
      // Limpiar suscripción anterior si existe
      if (channel) {
        await channel.unsubscribe();
      }

      
      const newChannel = supabase.channel(`notifications:${user?.id}`, {
        config: {
          broadcast: { self: true }
        }
      });

      newChannel
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`
        }, (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          
          // Mostrar toast de notificación
          toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-white shadow-lg rounded-lg p-4 flex items-center space-x-3`}>
              <Bell className="h-6 w-6 text-indigo-500" />
              <div>
                <p className="font-medium">{newNotification.title}</p>
                <p className="text-sm text-gray-500">{newNotification.message}</p>
              </div>
            </div>
          ), {
            duration: 5000,
            position: 'top-right'
          });
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`
        }, (payload) => {
          setNotifications(prev => 
            prev.map(n => n.id === payload.new.id ? payload.new as Notification : n)
          );
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`
        }, (payload) => {
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
        });

      await newChannel.subscribe();

      setChannel(newChannel);
    } catch (error) {
      console.error('Error al configurar suscripción en tiempo real:', error);
    }
  };

  const handleInvitation = async (notification: Notification, accept: boolean) => {
    try {
      const { error } = await supabase.rpc('handle_group_invitation', {
        p_group_member_id: notification.data.group_member_id,
        p_accept: accept
      });

      if (error) throw error;

      // Marcar la notificación como leída
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notification.id);

      // Actualizar el estado local
      setNotifications(prev => prev.filter(n => n.id !== notification.id));

      toast.success(accept ? 'Invitación aceptada' : 'Invitación rechazada');
      
      if (accept) {
        navigate(`/group/${notification.data.group_id}`);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-white hover:text-indigo-200"
      >
        <Bell className="w-6 h-6" />
        {notifications.length > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {notifications.length}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg z-50">
          <div className="p-4 max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-gray-500 text-center">No hay notificaciones</p>
            ) : (
              notifications.map(notification => (
                <div key={notification.id} className="mb-4 p-4 border rounded-lg">
                  <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                  <p className="text-sm text-gray-600 mb-3">{notification.message}</p>
                  {notification.type === 'group_invitation' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleInvitation(notification, true)}
                        className="px-3 py-1 bg-green-500 text-white rounded-md text-sm hover:bg-green-600"
                      >
                        Aceptar
                      </button>
                      <button
                        onClick={() => handleInvitation(notification, false)}
                        className="px-3 py-1 bg-red-500 text-white rounded-md text-sm hover:bg-red-600"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
} 